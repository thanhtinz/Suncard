import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
import { getAdapter, routeProvider } from "@/modules/providers";
import type { DB } from "@/modules/ledger";
export async function POST(req: Request) {
  return withPartner(req, async ({ body }) => {
    const variant = await prisma.productVariant.findFirst({ where: { OR: [{ id: body.variant_id ?? "" }, { sku: body.sku ?? "" }] } });
    if (!variant) throw new ApiError("PRODUCT_NOT_FOUND", 404);
    const route = await routeProvider(prisma as unknown as DB, { productType: "GAME_TOPUP", variantId: variant.id, region: body.region });
    if (!route) throw new ApiError("PROVIDER_UNAVAILABLE", 503);
    const adapter = getAdapter(route.provider.code);
    const v = await adapter.validatePlayer(prisma as unknown as DB, { productId: variant.productId, playerId: body.player_id, region: body.region, server: body.server });
    if (v === "UNSUPPORTED") return partnerOk({ valid: true, player_name: null, note: "UNSUPPORTED" });
    if (!v.valid) throw new ApiError("PLAYER_INVALID", 422);
    return partnerOk({ valid: true, player_name: v.playerName });
  });
}
