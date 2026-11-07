import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";
import ExchangeDecision from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminExchangePage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const orders = await prisma.order.findMany({ where: { type: "EXCHANGE", status: { in: ["PENDING", "PROCESSING", "REVIEW", "VALIDATING", "CREATED"] } }, orderBy: { createdAt: "asc" }, skip: (page - 1) * take, take });
  const exs = orders.length ? await prisma.exchangeOrder.findMany({ where: { orderId: { in: orders.map((o) => o.id) } } }) : [];
  const exMap = new Map(exs.map((e) => [e.orderId, e]));
  const users = orders.length ? await prisma.user.findMany({ where: { id: { in: orders.map((o) => o.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return (
    <div>
      <PageTitle title="Hàng chờ gạch thẻ" sub="Đơn EXCHANGE đang chờ xử lý/duyệt" />
      <DataTable cols={["Mã đơn", "Khách", "Nhà mạng", "Serial", "Mệnh giá khai", "Phí", "Trạng thái", "Thao tác"]} rows={orders.map((o) => {
        const ex = exMap.get(o.id);
        return [o.code, userMap.get(o.userId)?.email ?? "", ex?.carrier ?? "", ex?.serialMasked ?? "", ex ? <Money key="f" v={ex.faceValueMinor} /> : "", ex ? `${ex.feeBps / 100}%` : "", <StatusBadge key="s" status={o.status} />, <ExchangeDecision key="a" orderId={o.id} />];
      })} />
    </div>
  );
}
