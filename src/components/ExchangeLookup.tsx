import { prisma } from "@/lib/prisma";
import { StatusBadge, Money } from "@/components/ui";

// Khối tra cứu đơn gạch thẻ theo mã — dùng chung cho trang /tra-cuu
// và trang lịch sử đổi thẻ trong khu tài khoản.
export default async function ExchangeLookup({ code }: { code?: string }) {
  let result: React.ReactNode = null;
  if (code) {
    const order = await prisma.order.findUnique({ where: { code } });
    if (!order || order.type !== "EXCHANGE")
      result = <div className="rounded-xl bg-amber-50 text-amber-700 px-3 py-2 text-sm mt-3">Không tìm thấy đơn gạch thẻ với mã này.</div>;
    else {
      const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: order.id } });
      result = (
        <div className="rounded-xl bg-orange-50/70 px-4 py-3 text-sm space-y-1 mt-3">
          <div className="flex justify-between"><span>Mã đơn</span><b>{order.code}</b></div>
          <div className="flex justify-between"><span>Trạng thái</span><StatusBadge status={order.status} /></div>
          {ex && <div className="flex justify-between"><span>Nhà mạng</span><span>{ex.carrier}</span></div>}
          {ex && <div className="flex justify-between"><span>Mệnh giá</span><Money v={ex.faceValueMinor} /></div>}
          {ex?.payoutMinor != null && <div className="flex justify-between"><span>Thực nhận</span><Money v={ex.payoutMinor} /></div>}
        </div>
      );
    }
  }
  return (
    <div className="card !rounded-[22px] p-5">
      <div className="font-bold text-navy text-[15px] mb-3">Tra cứu đơn đổi thẻ</div>
      <form method="get" className="flex gap-2">
        <input name="code" className="input flex-1 !py-2.5" defaultValue={code ?? ""} placeholder="Nhập mã đơn, ví dụ SC-8F42KQ" aria-label="Mã đơn gạch thẻ" />
        <button className="btn-primary shrink-0 !px-5">Tra cứu</button>
      </form>
      {result}
    </div>
  );
}
