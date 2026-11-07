import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
import { cancelOrder } from "@/modules/orders-service";
import { prisma } from "@/lib/prisma";
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withPartner(req, async ({ userId }) => {
    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order || order.userId !== userId) throw new ApiError("ORDER_NOT_FOUND", 404);
    const cancelled = await cancelOrder(params.id, `partner:${userId}`);
    return partnerOk({ order: { id: cancelled?.id, status: cancelled?.status } });
  });
}
