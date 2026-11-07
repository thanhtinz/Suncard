import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
import { getAdapter, routeProvider } from "@/modules/providers";
import type { DB } from "@/modules/ledger";
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const variantId = url.searchParams.get("variantId") ?? "";
    const playerId = url.searchParams.get("playerId") ?? "";
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new Error("PRODUCT_NOT_FOUND");
    const route = await routeProvider(prisma as unknown as DB, { productType: "GAME_TOPUP", variantId });
    if (!route) throw new Error("PROVIDER_UNAVAILABLE");
    const adapter = getAdapter(route.provider.code);
    const v = await adapter.validatePlayer(prisma as unknown as DB, { productId: variant.productId, playerId, region: url.searchParams.get("regionCode") ?? undefined, server: url.searchParams.get("serverCode") ?? undefined });
    if (v === "UNSUPPORTED") return ok({ valid: true, playerName: null, note: "Provider không hỗ trợ validate" });
    if (!v.valid) throw new Error("PLAYER_INVALID");
    return ok({ valid: true, playerName: v.playerName });
  } catch (e) { return fail(e); }
}
