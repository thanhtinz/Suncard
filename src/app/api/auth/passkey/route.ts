import { prisma } from "@/lib/prisma";
import { fail, readJson, serialize } from "@/lib/api";
import { SESSION_COOKIE, ApiError, createSessionForUser, verifyUserTotp, hasAdminRole } from "@/modules/security";
import { getNumberSetting } from "@/modules/settings";
import { rateLimitDistributed } from "@/modules/rate-limit";
import { logAudit, notifyUser } from "@/modules/audit";
import { sha256Hex } from "@/lib/crypto";
import { startPasskeyLogin, finishPasskeyLogin } from "@/modules/webauthn";
import type { DB } from "@/modules/ledger";
import { NextResponse } from "next/server";

// Đăng nhập bằng passkey (Phase 4): email -> options (assertion) -> verify -> phiên.
// Tôn trọng đúng cơ chế của login mật khẩu: throttling theo tài khoản+IP+thiết bị
// (khoá tăng dần), TOTP vẫn bắt buộc nếu tài khoản đã bật mà assertion không có
// user-verification, cảnh báo thiết bị mới, phiên DB thu hồi được.
export async function POST(req: Request) {
  try {
    const b = await readJson(req);
    const email = String(b.email ?? "").toLowerCase().trim();
    const db = prisma as unknown as DB;
    if (b.action === "options") {
      if (!email.includes("@")) throw new ApiError("AUTH_INVALID", 401, "Email hoặc mật khẩu không đúng");
      return NextResponse.json({ data: serialize(await startPasskeyLogin(email, req)), request_id: "req" });
    }
    if (b.action === "verify") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const ua = req.headers.get("user-agent") ?? "";
      const deviceId = String(b.deviceId ?? sha256Hex(ua + "|" + ip).slice(0, 32));
      if (!(await rateLimitDistributed(`login:${ip}`, 30))) {
        throw new ApiError("RATE_LIMITED", 429, "Quá nhiều yêu cầu đăng nhập, vui lòng thử lại sau");
      }
      const throttleKey = sha256Hex(`${email}|${ip}|${deviceId}`);
      const throttle = await prisma.loginThrottle.findUnique({ where: { throttleKey } });
      if (throttle?.lockedUntil && throttle.lockedUntil > new Date()) {
        throw new ApiError("RATE_LIMITED", 429, "Đăng nhập tạm bị giới hạn, vui lòng thử lại sau");
      }
      const user = await prisma.user.findUnique({ where: { email } });
      const failLogin = async (reason: string) => {
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
          await logAudit(db, { actorId: user.id, action: "LOGIN_PASSKEY_FAILED", entityType: "USER", entityId: user.id, result: "FAILED", ip, deviceId, summary: reason });
        }
      };
      if (!user || user.status !== "ACTIVE") { await failLogin("Tài khoản không hợp lệ"); throw new ApiError("AUTH_INVALID", 401, "Email hoặc mật khẩu không đúng"); }
      let verified;
      try {
        verified = await finishPasskeyLogin(email, b.response, req);
      } catch (e) {
        await failLogin(e instanceof Error ? e.message.slice(0, 100) : "PASSKEY_FAILED");
        throw new ApiError("AUTH_INVALID", 401, "Xác thực passkey không thành công");
      }
      // Tài khoản đã bật TOTP: assertion có user-verification (vân tay/PIN) thì thay thế được;
      // không có UV thì vẫn đòi mã TOTP như login thường.
      if (user.totpEnabled && !verified.userVerified) {
        const okTotp = await verifyUserTotp(user, b.totpCode);
        if (!okTotp) throw new ApiError("MFA_REQUIRED", 403, "Cần mã TOTP để đăng nhập");
      }
      const urs = await prisma.userRole.findMany({ where: { userId: user.id } });
      const roles = await prisma.role.findMany({ where: { id: { in: urs.map((r) => r.roleId) } } });
      const roleCodes = roles.map((r) => r.code);
      const agent = await prisma.agent.findUnique({ where: { userId: user.id } });
      const knownDevice = await prisma.userDevice.findUnique({ where: { userId_deviceId: { userId: user.id, deviceId } } });
      if (!knownDevice) {
        await prisma.userDevice.create({ data: { userId: user.id, deviceId, platform: ua.slice(0, 120) } });
        await notifyUser(db, { userId: user.id, type: "NEW_DEVICE_LOGIN", title: "Đăng nhập từ thiết bị mới", body: `Đăng nhập bằng passkey từ thiết bị ${deviceId.slice(0, 8)}… IP ${ip}. Nếu không phải bạn, hãy đổi mật khẩu và thu hồi phiên ngay.`, resourceType: "USER", resourceId: user.id });
        await logAudit(db, { actorId: user.id, action: "NEW_DEVICE_LOGIN", entityType: "USER", entityId: user.id, result: "SUCCESS", ip, deviceId });
      } else {
        await prisma.userDevice.update({ where: { id: knownDevice.id }, data: { lastSeenAt: new Date() } });
      }
      await prisma.loginThrottle.deleteMany({ where: { throttleKey } });
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLogins: 0 } });
      const { token } = await createSessionForUser(user, roleCodes, agent?.id ?? null, { ip, userAgent: ua, deviceId });
      await logAudit(db, { actorId: user.id, action: "LOGIN_PASSKEY", entityType: "USER", entityId: user.id, result: "SUCCESS", ip, deviceId, summary: hasAdminRole(roleCodes) ? "Đăng nhập quản trị bằng passkey" : "Đăng nhập bằng passkey" });
      const res = NextResponse.json({ data: serialize({ id: user.id, email: user.email, roles: roleCodes, mfaEnabled: user.totpEnabled }), request_id: "req" });
      res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
      return res;
    }
    throw new ApiError("VALIDATION_ACTION", 400, "Hành động không hợp lệ");
  } catch (e) { return fail(e); }
}
