import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { refundOrder } from "@/modules/orders-service";
import { getNumberSetting } from "@/modules/settings";
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "orders.refund");
    const b = await readJson(req);
    const amount = BigInt(b.amountMinor);
    const threshold = BigInt(await getNumberSetting("finance.dual_refund_threshold_minor", 5000000));
    const key = b.idempotencyKey ?? `refund:${b.orderId}:${Date.now()}`;
    // PAY-07: hoàn tiền vượt ngưỡng -> duyệt kép (maker tạo yêu cầu, checker khác duyệt ở finance/decision kind=REFUND)
    if (amount > threshold) {
      const approval = await prisma.financialApprovalRequest.create({
        data: { kind: "REFUND", refId: b.orderId, amountMinor: amount, makerId: s.userId, payload: { orderId: b.orderId, amountMinor: amount.toString(), reason: b.reason, idempotencyKey: key } },
      });
      return ok(serialize({ pendingApproval: true, approval }), 202);
    }
    const result = await refundOrder({ orderId: b.orderId, amountMinor: amount, reason: b.reason, idempotencyKey: key, actorId: s.userId });
    return ok(serialize(result), result.duplicated ? 200 : 201);
  } catch (e) { return fail(e); }
}
