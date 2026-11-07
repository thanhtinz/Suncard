import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk, idempotencyKeyOf, cursorOf, pageSize } from "@/lib/partner";
import { ApiError } from "@/modules/security";
import { createTopupOrder, createCardOrder } from "@/modules/orders-service";

function present(order: any) {
  return {
    id: order.id, code: order.code, type: order.type, status: order.status, currency: order.currency,
    total_minor: order.totalMinor.toString(), provider_ref: order.providerRef,
    order_status_hint: order.status === "UNKNOWN" ? "ORDER_UNKNOWN" : order.status === "PENDING" || order.status === "PROCESSING" ? "ORDER_PENDING" : undefined,
    created_at: order.createdAt,
  };
}
export async function POST(req: Request) {
  return withPartner(req, async ({ userId, body }) => {
    const key = idempotencyKeyOf(req, body);
    const variant = await prisma.productVariant.findFirst({ where: { OR: [{ id: body.variant_id ?? "" }, { sku: body.sku ?? "" }] } });
    if (!variant) throw new ApiError("PRODUCT_NOT_FOUND", 404);
    const product = await prisma.product.findUnique({ where: { id: variant.productId } });
    if (product?.type === "GAME_TOPUP") {
      const { order, duplicated } = await createTopupOrder({ userId: userId!, variantId: variant.id, qty: body.qty ?? 1, playerId: body.player_id, regionCode: body.region, serverCode: body.server, idempotencyKey: key, paymentMethod: body.payment_method ?? "WALLET" });
      return partnerOk({ order: present(order), duplicated }, order?.status === "UNKNOWN" || order?.status === "PENDING" ? 202 : 201);
    }
    if (product?.type === "CARD_PIN") {
      const { order, duplicated } = await createCardOrder({ userId: userId!, variantId: variant.id, qty: body.qty ?? 1, idempotencyKey: key });
      return partnerOk({ order: present(order), duplicated }, 201);
    }
    throw new ApiError("PRODUCT_NOT_FOUND", 404);
  });
}
export async function GET(req: Request) {
  return withPartner(req, async ({ userId }) => {
    const url = new URL(req.url);
    const orders = await prisma.order.findMany({
      where: { userId: userId!, ...(url.searchParams.get("status") ? { status: url.searchParams.get("status")! } : {}) },
      take: pageSize(url) + 1, ...(cursorOf(url) ? { cursor: { id: cursorOf(url)! }, skip: 1 } : {}), orderBy: { createdAt: "desc" },
    });
    const hasMore = orders.length > pageSize(url);
    const page = hasMore ? orders.slice(0, -1) : orders;
    return partnerOk({ orders: page.map(present), next_cursor: hasMore ? page[page.length - 1].id : null });
  });
}
