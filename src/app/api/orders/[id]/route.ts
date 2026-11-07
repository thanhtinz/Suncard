import { prisma } from "@/lib/prisma";
import { ok, fail, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order || order.userId !== s.userId) throw new Error("ORDER_NOT_FOUND");
    const [items, history] = await Promise.all([
      prisma.orderItem.findMany({ where: { orderId: order.id } }),
      prisma.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } }),
    ]);
    return ok(serialize({ order, items, history }));
  } catch (e) { return fail(e); }
}
