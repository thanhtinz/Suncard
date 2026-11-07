import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, Empty, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CardShopPage() {
  const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const products = await prisma.product.findMany({ where: { type: "CARD_PIN", isActive: true } });
  const variants = await prisma.productVariant.findMany({ where: { productId: { in: products.map((p) => p.id) }, isActive: true }, orderBy: { sortOrder: "asc" } });
  const stocks = await prisma.cardInventory.groupBy({ by: ["variantId"], where: { status: "AVAILABLE" }, _count: { _all: true } });
  const stockMap = new Map(stocks.map((s) => [s.variantId, s._count._all]));
  const byProduct = new Map<string, typeof variants>();
  for (const v of variants) { const arr = byProduct.get(v.productId) ?? []; arr.push(v); byProduct.set(v.productId, arr); }
  return (
    <div>
      <PageTitle title="Cửa hàng thẻ" sub="Mua mã thẻ cào và gift card, giao mã ngay sau thanh toán" />
      {products.length === 0 ? <Empty text="Chưa có sản phẩm thẻ nào" /> : categories.map((c) => {
        const ps = products.filter((p) => p.categoryId === c.id);
        if (ps.length === 0) return null;
        return (
          <section key={c.id} className="mb-8">
            <h2 className="font-bold text-navy mb-3">{c.name}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {ps.map((p) => (
                <Link key={p.id} href={`/cua-hang-the/${p.code}`} className="card p-4 hover:shadow-md transition">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-slate-500 mt-1">{(byProduct.get(p.id) ?? []).length} mệnh giá</div>
                  <div className="text-sm mt-2 space-y-0.5">
                    {(byProduct.get(p.id) ?? []).slice(0, 3).map((v) => (
                      <div key={v.id} className="flex justify-between"><span>{v.name}</span><span className="flex gap-2"><Money v={v.basePriceMinor} /><span className="text-slate-400">còn {stockMap.get(v.id) ?? 0}</span></span></div>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {products.some((p) => !categories.find((c) => c.id === p.categoryId)) && (
        <div className="grid md:grid-cols-3 gap-4">{products.filter((p) => !categories.find((c) => c.id === p.categoryId)).map((p) => (
          <Link key={p.id} href={`/cua-hang-the/${p.code}`} className="card p-4"><div className="font-semibold">{p.name}</div></Link>
        ))}</div>
      )}
    </div>
  );
}
