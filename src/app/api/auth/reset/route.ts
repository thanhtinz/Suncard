import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/api";
import { consumePasswordResetToken } from "@/modules/password-reset";
import { hashPassword, revokeAllSessions } from "@/modules/security";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await readJson(req);
    if (!token || !newPassword || String(newPassword).length < 8) throw new Error("VALIDATION_PASSWORD_MIN_8");
    const record = await consumePasswordResetToken(String(token));
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(String(newPassword)), failedLogins: 0 } });
    await revokeAllSessions(record.userId); // thu hồi mọi phiên sau reset (ACC-05)
    await prisma.loginThrottle.deleteMany({ where: {} }).catch(() => undefined);
    await logAudit(prisma as unknown as DB, { actorId: record.userId, action: "PASSWORD_RESET_COMPLETED", entityType: "USER", entityId: record.userId, result: "SUCCESS", summary: "Đặt lại mật khẩu bằng token dùng 1 lần; đã thu hồi mọi phiên" });
    return ok({ reset: true });
  } catch (e) { return fail(e); }
}
