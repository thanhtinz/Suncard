import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, disputes] = await Promise.all([
    prisma.dispute.count(),
    prisma.dispute.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const users = disputes.length ? await prisma.user.findMany({ where: { id: { in: disputes.map((d) => d.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const orders = disputes.length ? await prisma.order.findMany({ where: { id: { in: disputes.map((d) => d.orderId) } } }) : [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  return (
    <div>
      <PageTitle title="Tranh chấp" sub={`Tổng ${total} · Trang ${page}`} />
      <DataTable cols={["Ngày", "Khách", "Mã đơn", "Lý do", "Số tiền", "Trạng thái", "Kết quả"]} rows={disputes.map((d) => [
        d.createdAt.toLocaleString("vi-VN"), userMap.get(d.userId)?.email ?? d.userId, orderMap.get(d.orderId)?.code ?? d.orderId, d.reason, <Money key="m" v={d.amountMinor} />, <StatusBadge key="s" status={d.status} />, d.resolution ?? "—",
      ])} />
    </div>
  );
}
