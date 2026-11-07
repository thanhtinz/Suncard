import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/ui";
import { getSession } from "@/modules/security";
import BuyCardForm from "./form";

export const dynamic = "force-dynamic";

export default async function CardDetailPage({ params }: { params: { code: string } }) {
  const product = await prisma.product.findUnique({ where: { code: params.code } });
  if (!product || product.type !== "CARD_PIN") notFound();
  const variants = await prisma.productVariant.findMany({ where: { productId: product.id, isActive: true }, orderBy: { sortOrder: "asc" } });
  const stocks = await prisma.cardInventory.groupBy({ by: ["variantId"], where: { variantId: { in: variants.map((v) => v.id) }, status: "AVAILABLE" }, _count: { _all: true } });
  const stockMap = new Map(stocks.map((s) => [s.variantId, s._count._all]));
  const session = await getSession().catch(() => null);
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle title={product.name} sub={product.description ?? undefined} />
      <BuyCardForm loggedIn={!!session} variants={variants.map((v) => ({ id: v.id, name: v.name, price: v.basePriceMinor.toString(), stock: stockMap.get(v.id) ?? 0 }))} />
    </div>
  );
}
