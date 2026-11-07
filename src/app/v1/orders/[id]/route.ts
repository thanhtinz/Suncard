import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withPartner(req, async ({ userId }) => {
    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order || order.userId !== userId) throw new ApiError("ORDER_NOT_FOUND", 404);
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    return partnerOk({ order: { ...order, totalMinor: order.totalMinor.toString(), subtotalMinor: order.subtotalMinor.toString() }, items: items.map((i) => ({ ...i, unitPriceMinor: i.unitPriceMinor.toString(), totalMinor: i.totalMinor.toString() })), history });
  });
}
