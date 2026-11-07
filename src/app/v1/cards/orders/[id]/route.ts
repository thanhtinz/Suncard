import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
import { decryptSecret, maskSecret } from "@/lib/crypto";
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withPartner(req, async ({ userId }) => {
    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order || order.userId !== userId || order.type !== "CARD_PURCHASE") throw new ApiError("ORDER_NOT_FOUND", 404);
    const deliveries = await prisma.cardDelivery.findMany({ where: { orderId: order.id } });
    const cards = [];
    for (const d of deliveries) {
      const card = await prisma.cardInventory.findUnique({ where: { id: d.cardId } });
      if (card) cards.push({ serial_masked: maskSecret(decryptSecret(card.serialEnc)), delivered_at: d.deliveredAt, reveal_count: d.revealCount });
    }
    return partnerOk({ order: { id: order.id, status: order.status, total_minor: order.totalMinor.toString() }, cards });
  });
}
