import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/api";
import { requireAuth, ApiError, createSessionForUser, SESSION_COOKIE } from "@/modules/security";
import { verifyTotp } from "@/modules/totp";
import { decryptSecret } from "@/lib/crypto";
import { logAudit, notifyUser } from "@/modules/audit";
import type { DB } from "@/modules/ledger";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const { code } = await readJson(req);
    const user = await prisma.user.findUnique({ where: { id: s.userId } });
    if (!user?.totpSecret) throw new ApiError("VALIDATION_ERROR", 422, "Chưa thiết lập MFA");
    const secret = decryptSecret(user.totpSecret);
    if (!verifyTotp(secret, code ?? "")) throw new ApiError("AUTH_INVALID", 401, "Mã TOTP không đúng");
    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    await logAudit(prisma as unknown as DB, { actorId: user.id, action: "MFA_ENABLED", entityType: "USER", entityId: user.id, result: "SUCCESS" });
    await notifyUser(prisma as unknown as DB, { userId: user.id, type: "MFA_ENABLED", title: "Đã bật xác thực 2 lớp (TOTP)", resourceType: "USER", resourceId: user.id });
    // Rotate phiên sau thay đổi bảo mật (ACC-05)
    const urs = await prisma.userRole.findMany({ where: { userId: user.id } });
    const roles = await prisma.role.findMany({ where: { id: { in: urs.map((r) => r.roleId) } } });
    const agent = await prisma.agent.findUnique({ where: { userId: user.id } });
    const { token } = await createSessionForUser(user, roles.map((r) => r.code), agent?.id ?? null, {});
    const res = NextResponse.json({ data: { mfaEnabled: true }, request_id: "req" });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
    return res;
  } catch (e) { return fail(e); }
}
