import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withPartner(req, async () => {
    const game = await prisma.gameCatalog.findFirst({ where: { OR: [{ id: params.id }, { slug: params.id }] } });
    if (!game) throw new ApiError("PRODUCT_NOT_FOUND", 404);
    const packages = await prisma.productVariant.findMany({ where: { productId: game.productId, isActive: true }, orderBy: { sortOrder: "asc" } });
    const regions = await prisma.gameRegion.findMany({ where: { gameId: game.id } });
    const servers = await prisma.gameServer.findMany({ where: { gameId: game.id } });
    return partnerOk({ game, packages: packages.map((v) => ({ ...v, faceValueMinor: v.faceValueMinor.toString(), basePriceMinor: v.basePriceMinor.toString() })), regions, servers });
  });
}
