import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";
import InquiryButton from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminTopupOrdersPage({ searchParams }: { searchParams?: { page?: string; status?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const where = { type: "TOPUP", ...(searchParams?.status ? { status: searchParams.status } : {}) };
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const topups = orders.length ? await prisma.topupOrder.findMany({ where: { orderId: { in: orders.map((o) => o.id) } } }) : [];
  const tMap = new Map(topups.map((t) => [t.orderId, t]));
  const users = orders.length ? await prisma.user.findMany({ where: { id: { in: orders.map((o) => o.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return (
    <div>
      <PageTitle title="Đơn nạp game" sub={`Tổng ${total} · Trang ${page}${searchParams?.status ? ` · Lọc: ${searchParams.status}` : ""}`} />
      <DataTable cols={["Mã đơn", "Khách", "UID", "Nhân vật", "Trạng thái", "Tổng tiền", "Inquiry", "Thời gian", "Thao tác"]} rows={orders.map((o) => {
        const t = tMap.get(o.id);
        return [o.code, userMap.get(o.userId)?.email ?? "", t?.playerId ?? "", t?.playerName ?? "", <StatusBadge key="s" status={o.status} />, <Money key="m" v={o.totalMinor} />, String(t?.inquiryCount ?? 0), o.createdAt.toLocaleString("vi-VN"), <InquiryButton key="a" orderId={o.id} />];
      })} />
    </div>
  );
}
