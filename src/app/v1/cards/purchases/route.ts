import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk, idempotencyKeyOf } from "@/lib/partner";
import { ApiError } from "@/modules/security";
import { createCardOrder } from "@/modules/orders-service";
import { decryptSecret } from "@/lib/crypto";
export async function POST(req: Request) {
  return withPartner(req, async ({ userId, body }) => {
    const key = idempotencyKeyOf(req, body);
    const variant = await prisma.productVariant.findFirst({ where: { OR: [{ id: body.variant_id ?? "" }, { sku: body.sku ?? "" }] } });
    if (!variant) throw new ApiError("PRODUCT_NOT_FOUND", 404);
    const { order, duplicated } = await createCardOrder({ userId: userId!, variantId: variant.id, qty: body.qty ?? 1, idempotencyKey: key });
    const deliveries = await prisma.cardDelivery.findMany({ where: { orderId: order!.id } });
    const cards = [];
    for (const d of deliveries) {
      const card = await prisma.cardInventory.findUnique({ where: { id: d.cardId } });
      if (card) cards.push({ serial: decryptSecret(card.serialEnc), code: decryptSecret(card.pinEnc) });
    }
    return partnerOk({ order: { id: order!.id, code: order!.code, status: order!.status, total_minor: order!.totalMinor.toString() }, cards, duplicated }, 201);
  });
}
