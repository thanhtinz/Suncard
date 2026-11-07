import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, Money, StatusBadge, DataTable, Empty } from "@/components/ui";
import { statusLabel } from "@/modules/orders";

export const dynamic = "force-dynamic";

export default async function MyOrderDetail({ params }: { params: { id: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.userId !== session.userId) notFound();
  const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
  const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
  const topup = order.type === "TOPUP" ? await prisma.topupOrder.findUnique({ where: { orderId: order.id } }) : null;
  return (
    <div>
      <PageTitle title={`Đơn ${order.code}`} sub={`Loại: ${order.type} · Tạo lúc ${order.createdAt.toLocaleString("vi-VN")}`} action={<StatusBadge status={order.status} />} />
      {order.status === "UNKNOWN" && <div className="rounded-lg bg-amber-50 text-amber-700 px-4 py-3 text-sm mb-4">Đơn đang được xác minh với nhà cung cấp. Đây không phải thất bại — tiền của bạn đang được giữ an toàn và hệ thống sẽ cập nhật khi có kết quả.</div>}
      <div className="card p-5 mb-4 grid md:grid-cols-2 gap-3 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Tạm tính</span><Money v={order.subtotalMinor} /></div>
        <div className="flex justify-between"><span className="text-slate-500">Chiết khấu</span><Money v={order.discountMinor} /></div>
        <div className="flex justify-between"><span className="text-slate-500">Phí</span><Money v={order.feeMinor} /></div>
        <div className="flex justify-between font-semibold"><span>Tổng thanh toán</span><Money v={order.totalMinor} /></div>
        {topup && <div className="flex justify-between"><span className="text-slate-500">UID / nhân vật</span><span>{topup.playerId}{topup.playerName ? ` (${topup.playerName})` : ""}</span></div>}
        {order.failReason && <div className="flex justify-between"><span className="text-slate-500">Lý do</span><span>{order.failReason}</span></div>}
      </div>
      <h2 className="font-bold text-navy mb-3">Chi tiết mặt hàng</h2>
      <div className="mb-6"><DataTable cols={["Sản phẩm", "Số lượng", "Đơn giá", "Thành tiền"]} rows={items.map((i) => [i.name, String(i.qty), <Money key="u" v={i.unitPriceMinor} />, <Money key="t" v={i.totalMinor} />])} /></div>
      <h2 className="font-bold text-navy mb-3">Tiến trình đơn</h2>
      {history.length === 0 ? <Empty text="Chưa có lịch sử trạng thái" /> : (
        <div className="card p-5 space-y-3">
          {history.map((h) => (
            <div key={h.id} className="flex gap-3 text-sm">
              <span className="text-slate-400 whitespace-nowrap">{h.createdAt.toLocaleString("vi-VN")}</span>
              <span>{h.fromStatus ? `${statusLabel(h.fromStatus)} → ` : ""}<b>{statusLabel(h.toStatus)}</b>{h.note ? ` — ${h.note}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
