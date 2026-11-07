import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge, Empty } from "@/components/ui";
import { getSession } from "@/modules/security";
import ExchangeLookup from "@/components/ExchangeLookup";

export const dynamic = "force-dynamic";

export default async function TraCuuPage({ searchParams }: { searchParams?: { code?: string } }) {
  const session = await getSession().catch(() => null);
  let history: React.ReactNode;
  if (!session) {
    history = (
      <div className="card p-6 text-center">
        <p className="text-slate-600 text-sm">Đăng nhập để xem lịch sử đổi thẻ của bạn tại đây.</p>
        <Link href="/dang-nhap" className="btn-primary mt-3 inline-flex">Đăng nhập</Link>
      </div>
    );
  } else {
    const orders = await prisma.order.findMany({ where: { userId: session.userId, type: "EXCHANGE" }, orderBy: { createdAt: "desc" }, take: 20 });
    const exs = orders.length ? await prisma.exchangeOrder.findMany({ where: { orderId: { in: orders.map((o) => o.id) } } }) : [];
    const exMap = new Map(exs.map((e) => [e.orderId, e]));
    history = orders.length === 0 ? <Empty text="Bạn chưa có đơn đổi thẻ nào" /> : (
      <DataTable cols={["Mã đơn", "Nhà mạng", "Mệnh giá", "Thực nhận", "Trạng thái", "Thời gian"]} rows={orders.map((o) => {
        const ex = exMap.get(o.id);
        return [
          <Link key="c" href={`/tai-khoan/don-hang/${o.id}`} className="font-medium text-sundeep">{o.code}</Link>,
          ex?.carrier ?? "", ex ? <Money key="f" v={ex.faceValueMinor} /> : "",
          ex?.payoutMinor != null ? <Money key="p" v={ex.payoutMinor} /> : "—",
          <StatusBadge key="s" status={o.status} />, o.createdAt.toLocaleString("vi-VN"),
        ];
      })} />
    );
  }
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <PageTitle title="Tra cứu & lịch sử đổi thẻ" sub="Nhập mã đơn để xem trạng thái, hoặc xem lại các đơn đổi thẻ của bạn" />
        <ExchangeLookup code={searchParams?.code} />
      </div>
      <section>
        <h2 className="font-bold text-navy mb-3">Lịch sử đổi thẻ của bạn</h2>
        {history}
      </section>
    </div>
  );
}
