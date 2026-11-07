import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/api";
import { requireAuth, verifyPassword, verifyUserTotp, hasAdminRole, ApiError } from "@/modules/security";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Tắt MFA: cần mật khẩu + mã TOTP. Tài khoản quản trị tắt MFA sẽ bị chặn khỏi Admin cho đến khi bật lại (theo policy bắt buộc).
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const { password, totpCode } = await readJson(req);
    const user = await prisma.user.findUnique({ where: { id: s.userId } });
    if (!user || !(await verifyPassword(password ?? "", user.passwordHash))) throw new ApiError("AUTH_INVALID", 401, "Mật khẩu không đúng");
    if (!(await verifyUserTotp(user, totpCode))) throw new ApiError("AUTH_INVALID", 401, "Mã TOTP không đúng");
    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
    await logAudit(prisma as unknown as DB, { actorId: user.id, action: "MFA_DISABLED", entityType: "USER", entityId: user.id, result: "SUCCESS", summary: hasAdminRole(s.roles) ? "Tài khoản quản trị tắt MFA — sẽ bị chặn khỏi Admin đến khi bật lại" : undefined });
    return ok({ mfaEnabled: false });
  } catch (e) { return fail(e); }
}
