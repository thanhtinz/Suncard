import { ok, fail, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { inquireOrder } from "@/modules/orders-service";
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "orders.inquiry");
    const result = await inquireOrder(params.id, s.userId);
    return ok(serialize(result));
  } catch (e) { return fail(e); }
}
