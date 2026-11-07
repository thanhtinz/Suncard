import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
export async function GET(req: Request) {
  return withPartner(req, async () => {
    const games = await prisma.gameCatalog.findMany({ where: { isActive: true } });
    const products = await prisma.product.findMany({ where: { id: { in: games.map((g) => g.productId) } } });
    return partnerOk({ games: games.map((g) => ({ ...g, product: products.find((p) => p.id === g.productId) })) });
  });
}
