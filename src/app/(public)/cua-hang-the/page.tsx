import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { getFxRates } from "@/modules/fx";
import CardShop, { type ShopProduct } from "./shop";

export const dynamic = "force-dynamic";

const TELCOS = ["VIETTEL", "MOBIFONE", "VINAPHONE", "VIETNAMOBILE", "GMOBILE"];

export default async function CardShopPage({ searchParams }: { searchParams?: { usd?: string } }) {
  const fx = await getFxRates();
  const showUsd = fx.displayEnabled && searchParams?.usd === "1";
  const products = await prisma.product.findMany({ where: { type: { in: ["CARD_PIN", "GIFT_CARD"] }, isActive: true } });
  const variants = await prisma.productVariant.findMany({ where: { productId: { in: products.map((p) => p.id) }, isActive: true }, orderBy: { sortOrder: "asc" } });
  const stocks = await prisma.cardInventory.groupBy({ by: ["variantId"], where: { status: "AVAILABLE" }, _count: { _all: true } });
  const stockMap = new Map(stocks.map((s) => [s.variantId, s._count._all]));
  const byProduct = new Map<string, typeof variants>();
  for (const v of variants) { const arr = byProduct.get(v.productId) ?? []; arr.push(v); byProduct.set(v.productId, arr); }

  const suffix = (code: string) => code.replace(/^(CARD|GIFT)-/, "");
  const rank = (code: string) => { const i = TELCOS.indexOf(suffix(code)); return i >= 0 ? i : 50; };
  const shopProducts: ShopProduct[] = [...products]
    .sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name))
    .map((p) => {
      const sfx = suffix(p.code);
      const shortName = p.name.replace(/^Thẻ\s+/i, "");
      return {
        code: p.code,
        name: shortName,
        caption: TELCOS.includes(sfx) ? shortName : p.type === "GIFT_CARD" ? "Gift card" : "Thẻ game",
        wm: sfx.toLowerCase(),
        variants: (byProduct.get(p.id) ?? []).map((v) => ({ id: v.id, face: v.faceValueMinor.toString(), price: v.basePriceMinor.toString(), stock: stockMap.get(v.id) ?? 0 })),
      };
    })
    .filter((p) => p.variants.length > 0);

  const session = await getSession().catch(() => null);
  return <CardShop products={shopProducts} loggedIn={!!session} fxEnabled={fx.displayEnabled} showUsd={showUsd} vndPerUsd={fx.vndPerUsd} />;
}
