import { prisma } from "@/lib/prisma";
import { Empty } from "@/components/ui";
import GameList, { type GameItem } from "./list";

export const dynamic = "force-dynamic";

export default async function NapGamePage() {
  const games = await prisma.gameCatalog.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  const products = await prisma.product.findMany({ where: { id: { in: games.map((g) => g.productId) } } });
  const pmap = new Map(products.map((p) => [p.id, p]));
  const items: GameItem[] = games.map((g) => ({
    slug: g.slug,
    name: pmap.get(g.productId)?.name ?? g.slug,
    publisher: g.publisher ?? "",
    currencyName: g.currencyName ?? "",
  }));
  if (items.length === 0) return <Empty text="Chưa có game nào đang mở nạp" />;
  return <GameList games={items} />;
}
