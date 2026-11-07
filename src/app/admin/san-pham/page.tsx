import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, products] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const variants = products.length ? await prisma.productVariant.findMany({ where: { productId: { in: products.map((p) => p.id) } }, orderBy: { sortOrder: "asc" } }) : [];
  const games = products.length ? await prisma.gameCatalog.findMany({ where: { productId: { in: products.map((p) => p.id) } } }) : [];
  const gameMap = new Map(games.map((g) => [g.productId, g]));
  const cats = products.length ? await prisma.category.findMany({ where: { id: { in: products.map((p) => p.categoryId) } } }) : [];
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const varsOf = (pid: string) => variants.filter((v) => v.productId === pid);
  return (
    <div>
      <PageTitle title="Sản phẩm" sub={`Tổng ${total} · Trang ${page}`} />
      <DataTable cols={["Mã", "Tên", "Loại", "Danh mục", "Slug game", "Mệnh giá (giá / tồn)", "Trạng thái"]} rows={products.map((p) => [
        p.code, p.name, p.type, catMap.get(p.categoryId)?.name ?? "", gameMap.get(p.id)?.slug ?? "—",
        <div key="v" className="space-y-0.5">{varsOf(p.id).length === 0 ? "—" : varsOf(p.id).map((v) => <div key={v.id} className="whitespace-nowrap">{v.name}: <Money v={v.basePriceMinor} /></div>)}</div>,
        <StatusBadge key="s" status={p.isActive ? "ACTIVE" : "DISABLED"} />,
      ])} />
    </div>
  );
}
