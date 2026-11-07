import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/api";
import { requireAuth, verifyPassword, ApiError } from "@/modules/security";
import { generateTotpSecret, otpauthUrl } from "@/modules/totp";
import { encryptSecret } from "@/lib/crypto";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Thiết lập MFA TOTP (ACC-02): cần mật khẩu hiện tại. Secret trả 1 lần để nhập app authenticator; lưu DB dạng mã hoá.
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const { password } = await readJson(req);
    const user = await prisma.user.findUnique({ where: { id: s.userId } });
    if (!user || !(await verifyPassword(password ?? "", user.passwordHash))) throw new ApiError("AUTH_INVALID", 401, "Mật khẩu không đúng");
    if (user.totpEnabled) throw new ApiError("VALIDATION_ERROR", 422, "MFA đã bật. Muốn đặt lại, hãy tắt MFA trước (cần mật khẩu + mã TOTP).");
    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: encryptSecret(secret), totpEnabled: false } });
    await logAudit(prisma as unknown as DB, { actorId: user.id, action: "MFA_SETUP_STARTED", entityType: "USER", entityId: user.id, result: "SUCCESS" });
    return ok({ secret, otpauth_url: otpauthUrl(secret, user.email) });
  } catch (e) { return fail(e); }
}
