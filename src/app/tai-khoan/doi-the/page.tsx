import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MyExchangePage({ searchParams }: { searchParams?: { page?: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const orders = await prisma.order.findMany({ where: { userId: session.userId, type: "EXCHANGE" }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take });
  const exs = orders.length ? await prisma.exchangeOrder.findMany({ where: { orderId: { in: orders.map((o) => o.id) } } }) : [];
  const exMap = new Map(exs.map((e) => [e.orderId, e]));
  return (
    <div>
      <PageTitle title="Đổi thẻ của tôi" sub="Lịch sử gạch thẻ sang số dư ví" action={<Link href="/" className="btn-primary">Gạch thẻ mới</Link>} />
      <DataTable cols={["Mã đơn", "Nhà mạng", "Serial", "Mệnh giá", "Thực nhận", "Trạng thái", "Thời gian"]} rows={orders.map((o) => {
        const ex = exMap.get(o.id);
        return [o.code, ex?.carrier ?? "", ex?.serialMasked ?? "", ex ? <Money key="f" v={ex.faceValueMinor} /> : "", ex?.payoutMinor != null ? <Money key="p" v={ex.payoutMinor} /> : "—", <StatusBadge key="s" status={o.status} />, o.createdAt.toLocaleString("vi-VN")];
      })} />
    </div>
  );
}
