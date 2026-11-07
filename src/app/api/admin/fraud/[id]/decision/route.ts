import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { deliverHeldCardOrder } from "@/modules/orders-service";
import { releaseHold } from "@/modules/ledger";
import { transitionOrder } from "@/modules/orders";
import { releaseReservedCards } from "@/modules/cards";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Duyệt rủi ro: APPROVE -> giao mã cho đơn bị giữ (nếu là CARD_DELIVERY). REJECT -> huỷ đơn bị giữ + hoàn hold.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "disputes.manage");
    const b = await readJson(req);
    const review = await prisma.riskReview.findUnique({ where: { id: params.id } });
    if (!review || review.status !== "PENDING") throw new Error("NOT_FOUND");
    await prisma.riskReview.update({ where: { id: review.id }, data: { status: b.decision === "APPROVE" ? "APPROVED" : "REJECTED", reviewedBy: s.userId, reviewNote: b.note } });
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: `RISK_REVIEW_${b.decision}`, entityType: "RISK_REVIEW", entityId: review.id, result: "SUCCESS", approvalId: review.id, summary: `Score ${review.score} ${review.level}` });
    let orderResult: unknown = null;
    if (review.orderId && review.action === "CARD_DELIVERY") {
      if (b.decision === "APPROVE") {
        orderResult = await deliverHeldCardOrder(review.orderId, s.userId);
      } else {
        const order = await prisma.order.findUnique({ where: { id: review.orderId } });
        if (order && order.status === "REVIEW") {
          const hold = await prisma.walletHold.findFirst({ where: { orderId: order.id, status: "ACTIVE" } });
          await prisma.$transaction(async (tx) => {
            const db = tx as DB;
            if (hold) await releaseHold(db, hold.id, "risk rejected");
            await releaseReservedCards(db, order.id);
          });
          await transitionOrder(prisma as unknown as DB, order.id, "FAILED", s.userId, "Bị từ chối sau rà soát rủi ro").catch(async () => {
            // REVIEW -> FAILED không có trong bảng transition: đi qua REFUND? dùng đường REVIEW->PROCESSING->FAILED
            await transitionOrder(prisma as unknown as DB, order.id, "PROCESSING", s.userId).catch(() => undefined);
            await transitionOrder(prisma as unknown as DB, order.id, "FAILED", s.userId, "Bị từ chối sau rà soát rủi ro").catch(() => undefined);
          });
          orderResult = await prisma.order.findUnique({ where: { id: order.id } });
        }
      }
    }
    return ok(serialize({ review: { id: review.id, status: b.decision }, order: orderResult }));
  } catch (e) { return fail(e); }
}
