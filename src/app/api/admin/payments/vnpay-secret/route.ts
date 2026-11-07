import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { setSetting } from "@/modules/settings";
import { encryptVnpaySecret } from "@/modules/vnpay";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Lưu hash secret VNPay: nhận plaintext qua kênh admin đã xác thực, MÃ HOÁ AES-GCM
// rồi mới ghi setting vnpay.hash_secret_enc. Secret không bao giờ hiển thị lại,
// audit chỉ ghi "đã cập nhật" (không ghi giá trị).
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "settings.update");
    const b = await readJson(req);
    const secret = String(b.secret ?? "");
    if (secret.length < 8) throw new Error("VALIDATION_SECRET_TOO_SHORT");
    await setSetting("vnpay.hash_secret_enc", encryptVnpaySecret(secret), s.userId);
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "VNPAY_SECRET_UPDATED", entityType: "SETTING", entityId: "vnpay.hash_secret_enc", result: "SUCCESS", summary: "Đã cập nhật hash secret VNPay (lưu mã hoá)" });
    return ok({ updated: true });
  } catch (e) { return fail(e); }
}
