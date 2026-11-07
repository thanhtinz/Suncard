import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission, ApiError } from "@/modules/security";
import { getSetting, getNumberSetting } from "@/modules/settings";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Xuất mã (spec bảng 8): mặc định TẮT hẳn (setting cards.export_enabled=false).
// Khi bật: vẫn phải duyệt kép — route này chỉ tạo yêu cầu (maker), checker khác duyệt ở /api/admin/finance/decision kind=CARD_EXPORT.
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "cards.import");
    const enabled = await getSetting<boolean>("cards.export_enabled", false);
    if (!enabled) throw new ApiError("PERMISSION_DENIED", 403, "Xuất mã đang TẮT theo chính sách (cards.export_enabled=false)");
    const b = await readJson(req);
    const max = await getNumberSetting("cards.export_max_per_request", 100);
    const qty = Number(b.qty ?? 0);
    if (!b.variantId || qty <= 0 || qty > max) throw new ApiError("VALIDATION_ERROR", 422, `Số lượng xuất phải trong 1..${max}`);
    const available = await prisma.cardInventory.count({ where: { variantId: b.variantId, status: "AVAILABLE" } });
    if (available < qty) throw new ApiError("VALIDATION_ERROR", 422, "Không đủ mã AVAILABLE");
    const approval = await prisma.financialApprovalRequest.create({
      data: { kind: "CARD_EXPORT", amountMinor: BigInt(qty), makerId: s.userId, payload: { variantId: b.variantId, qty, reason: b.reason } },
    });
    await prisma.financialApprovalRequest.update({ where: { id: approval.id }, data: { refId: approval.id } });
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "CARD_EXPORT_REQUESTED", entityType: "CARD_EXPORT", entityId: approval.id, result: "PENDING", approvalId: approval.id, summary: `Yêu cầu xuất ${qty} mã, chờ duyệt kép` });
    return ok(serialize({ approval }), 201);
  } catch (e) { return fail(e); }
}
