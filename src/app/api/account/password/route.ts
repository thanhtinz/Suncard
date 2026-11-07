import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/api";
import { requireAuth, verifyPassword, hashPassword, verifyUserTotp, revokeAllSessions, ApiError } from "@/modules/security";
import { logAudit, notifyUser } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// ACC-08: đổi mật khẩu phải xác thực lại (mật khẩu hiện tại; kèm TOTP nếu đã bật) + thu hồi phiên khác.
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const { currentPassword, newPassword, totpCode } = await readJson(req);
    const user = await prisma.user.findUnique({ where: { id: s.userId } });
    if (!user || !(await verifyPassword(currentPassword ?? "", user.passwordHash))) throw new ApiError("AUTH_INVALID", 401, "Mật khẩu hiện tại không đúng");
    if (user.totpEnabled && !(await verifyUserTotp(user, totpCode))) throw new ApiError("MFA_REQUIRED", 403, "Cần mã TOTP");
    if (!newPassword || String(newPassword).length < 8) throw new Error("VALIDATION_PASSWORD_MIN_8");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(String(newPassword)) } });
    await revokeAllSessions(user.id, s.sid);
    await logAudit(prisma as unknown as DB, { actorId: user.id, action: "PASSWORD_CHANGED", entityType: "USER", entityId: user.id, result: "SUCCESS", summary: "Đã thu hồi các phiên khác" });
    await notifyUser(prisma as unknown as DB, { userId: user.id, type: "PASSWORD_CHANGED", title: "Mật khẩu đã thay đổi", body: "Nếu không phải bạn, hãy đặt lại mật khẩu ngay.", resourceType: "USER", resourceId: user.id });
    return ok({ changed: true });
  } catch (e) { return fail(e); }
}
