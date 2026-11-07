import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { CARD: "Thẻ", GAME: "Game", GIFT: "Quà tặng" };

export default async function AdminCategoriesPage() {
  const [cats, products] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }).catch(() => []),
    prisma.product.findMany({ select: { categoryId: true } }).catch(() => []),
  ]);
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
  return (
    <div>
      <PageTitle title="Danh mục sản phẩm" sub={`Tổng ${cats.length} danh mục · ${products.length} sản phẩm`} />
      <DataTable cols={["Tên danh mục", "Mã", "Loại", "Thứ tự", "Số sản phẩm", "Trạng thái"]} rows={cats.map((c) => [
        c.name,
        c.code,
        KIND_LABEL[c.kind] ?? c.kind,
        String(c.sortOrder),
        String(counts.get(c.id) ?? 0),
        <StatusBadge key="s" status={c.isActive ? "ACTIVE" : "INACTIVE"} />,
      ])} />
    </div>
  );
}
