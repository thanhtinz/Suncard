import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { settleExchange, rejectExchange } from "@/modules/orders-service";
import { logAudit } from "@/modules/audit";
import { prisma } from "@/lib/prisma";
import type { DB } from "@/modules/ledger";

// Duyệt gạch thẻ thủ công: decision=APPROVE (có thể kèm acceptedValueMinor khác khai báo -> sai mệnh giá) | REJECT.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "exchange.review");
    const b = await readJson(req);
    const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: params.id } });
    if (!ex) throw new Error("ORDER_NOT_FOUND");
    let order;
    if (b.decision === "APPROVE") {
      order = await settleExchange(params.id, b.acceptedValueMinor ? BigInt(b.acceptedValueMinor) : (ex.declaredValueMinor as bigint), s.userId);
    } else {
      order = await rejectExchange(params.id, b.reason ?? "Từ chối bởi vận hành", s.userId);
    }
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: `EXCHANGE_${b.decision}`, entityType: "ORDER", entityId: params.id, after: { decision: b.decision } });
    return ok(serialize({ order }));
  } catch (e) { return fail(e); }
}
