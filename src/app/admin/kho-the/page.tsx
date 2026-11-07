import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";
import ImportCardsForm from "./form";

export const dynamic = "force-dynamic";

export default async function AdminCardsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [batches, grouped, variants] = await Promise.all([
    prisma.cardBatch.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    prisma.cardInventory.groupBy({ by: ["variantId", "status"], _count: { _all: true } }),
    prisma.productVariant.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const varMap = new Map(variants.map((v) => [v.id, v]));
  const byVariant = new Map<string, { status: string; count: number }[]>();
  for (const g of grouped) { const arr = byVariant.get(g.variantId) ?? []; arr.push({ status: g.status, count: g._count._all }); byVariant.set(g.variantId, arr); }
  return (
    <div className="space-y-8">
      <PageTitle title="Kho thẻ" sub={`Trang ${page}`} />
      <section>
        <h2 className="font-bold text-navy mb-3">Tồn kho theo mệnh giá và trạng thái</h2>
        <DataTable cols={["Mệnh giá", "Khả dụng", "Đã giữ", "Đã bán", "Đã giao", "Cách ly", "Hết hạn/Vô hiệu"]} rows={Array.from(byVariant.entries()).map(([vid, arr]) => {
          const get = (s: string) => String(arr.find((a) => a.status === s)?.count ?? 0);
          return [varMap.get(vid)?.name ?? vid, get("AVAILABLE"), get("RESERVED"), get("SOLD"), get("DELIVERED"), get("QUARANTINED"), String((arr.find((a) => a.status === "EXPIRED")?.count ?? 0) + (arr.find((a) => a.status === "VOID")?.count ?? 0))];
        })} />
      </section>
      <section>
        <h2 className="font-bold text-navy mb-3">Lô thẻ</h2>
        <DataTable cols={["Mã lô", "Mệnh giá", "Nguồn", "Tổng thẻ", "Trạng thái", "Ngày nhập"]} rows={batches.map((b) => [
          b.code, varMap.get(b.variantId)?.name ?? b.variantId, b.source, String(b.totalCards), <StatusBadge key="s" status={b.status} />, b.createdAt.toLocaleString("vi-VN"),
        ])} />
      </section>
      <ImportCardsForm variants={variants.map((v) => ({ id: v.id, name: `${v.sku} — ${v.name}` }))} />
    </div>
  );
}
