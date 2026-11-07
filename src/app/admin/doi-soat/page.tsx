import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminReconciliationPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [cases, providers] = await Promise.all([
    prisma.reconciliationCase.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    prisma.provider.findMany(),
  ]);
  const provMap = new Map(providers.map((p) => [p.id, p]));
  const runs = await prisma.providerReconciliationRun.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const orders = cases.some((c) => c.orderId) ? await prisma.order.findMany({ where: { id: { in: cases.map((c) => c.orderId).filter((x): x is string => !!x) } } }) : [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const items = runs.length ? await prisma.providerReconciliationItem.findMany({ where: { runId: { in: runs.map((r) => r.id) }, status: { not: "MATCHED" } }, take: 30 }) : [];
  return (
    <div className="space-y-8">
      <PageTitle title="Đối soát" sub="Ca chênh lệch và các lượt đối soát nhà cung cấp" />
      <h2 className="font-bold text-navy">Ca đối soát</h2>
      <DataTable cols={["Ngày", "Loại", "Mức độ", "Nhà cung cấp", "Mã đơn", "Trạng thái", "Kết quả xử lý"]} rows={cases.map((c) => [
        c.createdAt.toLocaleString("vi-VN"), c.type, c.severity, c.providerId ? provMap.get(c.providerId)?.name ?? c.providerId : "—", c.orderId ? orderMap.get(c.orderId)?.code ?? c.orderId : "—", <StatusBadge key="s" status={c.status} />, c.resolution ?? "—",
      ])} />
      <h2 className="font-bold text-navy">Lượt đối soát</h2>
      <DataTable cols={["Nhà cung cấp", "Kỳ từ", "Kỳ đến", "Tổng mục", "Khớp", "Lệch", "Trạng thái"]} rows={runs.map((r) => [
        provMap.get(r.providerId)?.name ?? r.providerId, r.periodStart.toLocaleDateString("vi-VN"), r.periodEnd.toLocaleDateString("vi-VN"), String(r.totalItems), String(r.matched), String(r.mismatched), <StatusBadge key="s" status={r.status} />,
      ])} />
      <h2 className="font-bold text-navy">Mục lệch gần đây</h2>
      <DataTable cols={["Mã đơn", "Kỳ vọng", "Thực tế", "Trạng thái"]} rows={items.map((i) => [
        i.orderId ?? i.externalRef ?? "—", <Money key="e" v={i.expectedMinor} />, <Money key="a" v={i.actualMinor} />, <StatusBadge key="s" status={i.status} />,
      ])} />
    </div>
  );
}
