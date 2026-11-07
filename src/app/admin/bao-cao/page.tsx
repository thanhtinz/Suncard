import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const orders = await prisma.order.findMany({ where: { status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 5000, select: { createdAt: true, type: true, totalMinor: true } });
  const byDay = new Map<string, { total: bigint; count: number; byType: Map<string, bigint> }>();
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const row = byDay.get(day) ?? { total: BigInt(0), count: 0, byType: new Map<string, bigint>() };
    row.total += o.totalMinor; row.count += 1;
    row.byType.set(o.type, (row.byType.get(o.type) ?? BigInt(0)) + o.totalMinor);
    byDay.set(day, row);
  }
  const days = Array.from(byDay.entries()).slice(0, 30);
  const typeTotals = new Map<string, { total: bigint; count: number }>();
  for (const o of orders) { const t = typeTotals.get(o.type) ?? { total: BigInt(0), count: 0 }; t.total += o.totalMinor; t.count += 1; typeTotals.set(o.type, t); }
  return (
    <div className="space-y-8">
      <PageTitle title="Báo cáo doanh thu" sub="Tổng hợp từ đơn thành công (tối đa 5.000 đơn gần nhất)" />
      {orders.length === 0 ? <Empty text="Chưa có doanh thu" /> : (<>
        <h2 className="font-bold text-navy">Theo loại đơn</h2>
        <DataTable cols={["Loại đơn", "Số đơn", "Doanh thu"]} rows={Array.from(typeTotals.entries()).map(([type, t]) => [type, String(t.count), <Money key="m" v={t.total} />])} />
        <h2 className="font-bold text-navy">Theo ngày</h2>
        <DataTable cols={["Ngày", "Số đơn", "Nạp game", "Mua thẻ", "Gạch thẻ", "Tổng doanh thu"]} rows={days.map(([day, r]) => [
          day, String(r.count), <Money key="t" v={r.byType.get("TOPUP") ?? BigInt(0)} />, <Money key="c" v={r.byType.get("CARD_PURCHASE") ?? BigInt(0)} />, <Money key="e" v={r.byType.get("EXCHANGE") ?? BigInt(0)} />, <Money key="tt" v={r.total} />,
        ])} />
      </>)}
    </div>
  );
}
