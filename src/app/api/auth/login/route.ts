import { prisma } from "@/lib/prisma";
import { fail, readJson, serialize } from "@/lib/api";
import { verifyPassword, SESSION_COOKIE, ApiError, createSessionForUser, verifyUserTotp, hasAdminRole } from "@/modules/security";
import { getNumberSetting } from "@/modules/settings";
import { logAudit, notifyUser } from "@/modules/audit";
import { sha256Hex } from "@/lib/crypto";
import type { DB } from "@/modules/ledger";
import { NextResponse } from "next/server";

// Đăng nhập (ACC-03/04/05/06):
// - Throttling theo tài khoản + IP + thiết bị, khóa tăng dần (lock base x 2^lockCount).
// - Lỗi chung, KHÔNG tiết lộ tài khoản có tồn tại hay không.
// - User đã bật TOTP (bắt buộc với Admin) phải nhập mã TOTP.
// - Thiết bị mới -> cảnh báo qua notification. Phiên DB có thể thu hồi; cookie Secure/HttpOnly/SameSite.
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const email = String(body.email ?? "").toLowerCase().trim();
    const password = String(body.password ?? "");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "";
    const deviceId = String(body.deviceId ?? sha256Hex(ua + "|" + ip).slice(0, 32));
    // Rate limit phân tán theo IP (Postgres) — thay bucket in-memory ở middleware (Phase 4).
    const { rateLimitDistributed } = await import("@/modules/rate-limit");
    if (!(await rateLimitDistributed(`login:${ip}`, 30))) {
      throw new ApiError("RATE_LIMITED", 429, "Quá nhiều yêu cầu đăng nhập, vui lòng thử lại sau");
    }
    const throttleKey = sha256Hex(`${email}|${ip}|${deviceId}`);
    const db = prisma as unknown as DB;

    const throttle = await prisma.loginThrottle.findUnique({ where: { throttleKey } });
    if (throttle?.lockedUntil && throttle.lockedUntil > new Date()) {
      throw new ApiError("RATE_LIMITED", 429, "Đăng nhập tạm bị giới hạn, vui lòng thử lại sau");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || user.status !== "ACTIVE" || !passwordOk) {
      const maxAttempts = await getNumberSetting("login.max_attempts", 5);
      const lockBase = await getNumberSetting("login.lock_base_minutes", 15);
      const fails = (throttle?.fails ?? 0) + 1;
      let lockedUntil: Date | null = throttle?.lockedUntil ?? null;
      let lockCount = throttle?.lockCount ?? 0;
      if (fails >= maxAttempts) {
        lockCount += 1;
        lockedUntil = new Date(Date.now() + lockBase * Math.pow(2, lockCount - 1) * 60000);
      }
      await prisma.loginThrottle.upsert({
        where: { throttleKey },
        create: { throttleKey, fails, lockCount, lockedUntil, lastFailAt: new Date() },
        update: { fails, lockCount, lockedUntil, lastFailAt: new Date() },
      });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { failedLogins: fails } });
        await logAudit(db, { actorId: user.id, action: "LOGIN_FAILED", entityType: "USER", entityId: user.id, result: "FAILED", ip, deviceId, summary: `Đăng nhập sai lần ${fails}` });
      }
      throw new ApiError("AUTH_INVALID", 401, "Email hoặc mật khẩu không đúng");
    }

    // TOTP: bắt buộc nếu đã bật (Admin bắt buộc phải bật — chặn ở requirePermission/layout nếu chưa bật)
    if (user.totpEnabled) {
      const okTotp = await verifyUserTotp(user, body.totpCode);
      if (!okTotp) {
        await logAudit(db, { actorId: user.id, action: "LOGIN_MFA_FAILED", entityType: "USER", entityId: user.id, result: "FAILED", ip, deviceId });
        throw new ApiError("MFA_REQUIRED", 403, "Cần mã TOTP để đăng nhập");
      }
    }

    const urs = await prisma.userRole.findMany({ where: { userId: user.id } });
    const roles = await prisma.role.findMany({ where: { id: { in: urs.map((r) => r.roleId) } } });
    const roleCodes = roles.map((r) => r.code);
    const agent = await prisma.agent.findUnique({ where: { userId: user.id } });

    // Thiết bị mới -> cảnh báo (ACC-06)
    const knownDevice = await prisma.userDevice.findUnique({ where: { userId_deviceId: { userId: user.id, deviceId } } });
    if (!knownDevice) {
      await prisma.userDevice.create({ data: { userId: user.id, deviceId, platform: ua.slice(0, 120) } });
      await notifyUser(db, { userId: user.id, type: "NEW_DEVICE_LOGIN", title: "Đăng nhập từ thiết bị mới", body: `Thiết bị ${deviceId.slice(0, 8)}… IP ${ip}. Nếu không phải bạn, hãy đổi mật khẩu và thu hồi phiên ngay.`, resourceType: "USER", resourceId: user.id });
      await logAudit(db, { actorId: user.id, action: "NEW_DEVICE_LOGIN", entityType: "USER", entityId: user.id, result: "SUCCESS", ip, deviceId });
    } else {
      await prisma.userDevice.update({ where: { id: knownDevice.id }, data: { lastSeenAt: new Date() } });
    }

    await prisma.loginThrottle.deleteMany({ where: { throttleKey } });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLogins: 0 } });
    const { token } = await createSessionForUser(user, roleCodes, agent?.id ?? null, { ip, userAgent: ua, deviceId });
    await logAudit(db, { actorId: user.id, action: "LOGIN_SUCCESS", entityType: "USER", entityId: user.id, result: "SUCCESS", ip, deviceId, summary: hasAdminRole(roleCodes) ? "Đăng nhập quản trị" : "Đăng nhập" });
    const res = NextResponse.json({ data: serialize({ id: user.id, email: user.email, roles: roleCodes, mfaEnabled: user.totpEnabled }), request_id: "req" });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
    return res;
  } catch (e) { return fail(e); }
}
