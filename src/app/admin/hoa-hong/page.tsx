import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminCommissionsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [entries, settlements] = await Promise.all([
    prisma.commissionEntry.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    prisma.commissionSettlement.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const users = entries.length ? await prisma.user.findMany({ where: { id: { in: entries.map((e) => e.beneficiaryUserId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const orders = entries.length ? await prisma.order.findMany({ where: { id: { in: entries.map((e) => e.orderId) } } }) : [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const pending = await prisma.commissionEntry.aggregate({ where: { status: "PENDING" }, _sum: { amountMinor: true } });
  const avail = await prisma.commissionEntry.aggregate({ where: { status: "AVAILABLE" }, _sum: { amountMinor: true } });
  return (
    <div className="space-y-8">
      <PageTitle title="Hoa hồng" sub="Khoản mục hoa hồng và kỳ quyết toán" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5"><div className="text-sm text-slate-500">Đang chờ (PENDING)</div><div className="text-2xl mt-1"><Money v={pending._sum.amountMinor ?? BigInt(0)} /></div></div>
        <div className="card p-5"><div className="text-sm text-slate-500">Khả dụng (AVAILABLE)</div><div className="text-2xl mt-1"><Money v={avail._sum.amountMinor ?? BigInt(0)} /></div></div>
      </div>
      <DataTable cols={["Ngày", "Người hưởng", "Mã đơn", "Cơ sở tính", "Hoa hồng", "Trạng thái", "Kỳ quyết toán"]} rows={entries.map((e) => [
        e.createdAt.toLocaleString("vi-VN"), userMap.get(e.beneficiaryUserId)?.email ?? e.beneficiaryUserId, orderMap.get(e.orderId)?.code ?? e.orderId,
        <Money key="b" v={e.baseMinor} />, <Money key="a" v={e.amountMinor} />, <StatusBadge key="s" status={e.status} />, e.settlementId ?? "—",
      ])} />
      <h2 className="font-bold text-navy">Kỳ quyết toán</h2>
      <DataTable cols={["Mã kỳ", "Từ ngày", "Đến ngày", "Tổng tiền", "Số khoản", "Trạng thái"]} rows={settlements.map((s) => [
        s.code, s.periodStart.toLocaleDateString("vi-VN"), s.periodEnd.toLocaleDateString("vi-VN"), <Money key="m" v={s.totalMinor} />, String(s.entryCount), <StatusBadge key="st" status={s.status} />,
      ])} />
    </div>
  );
}
