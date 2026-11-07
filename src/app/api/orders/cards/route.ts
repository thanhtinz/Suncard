import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
import { createCardOrder } from "@/modules/orders-service";
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    if (!b.idempotencyKey) throw new Error("VALIDATION_IDEMPOTENCY_KEY_REQUIRED");
    const { order, duplicated } = await createCardOrder({ userId: s.userId, variantId: b.variantId, qty: b.qty ?? 1, idempotencyKey: b.idempotencyKey });
    return ok(serialize({ order, duplicated }), duplicated ? 200 : 201);
  } catch (e) { return fail(e); }
}
