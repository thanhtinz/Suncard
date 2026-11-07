import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
import { createTopupOrder } from "@/modules/orders-service";
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    if (!b.idempotencyKey) throw new Error("VALIDATION_IDEMPOTENCY_KEY_REQUIRED");
    const { order, duplicated } = await createTopupOrder({
      userId: s.userId, variantId: b.variantId, qty: b.qty ?? 1, playerId: b.playerId,
      regionCode: b.regionCode, serverCode: b.serverCode, idempotencyKey: b.idempotencyKey,
      paymentMethod: b.paymentMethod ?? "WALLET",
    });
    return ok(serialize({ order, duplicated }), duplicated ? 200 : 201);
  } catch (e) { return fail(e); }
}
