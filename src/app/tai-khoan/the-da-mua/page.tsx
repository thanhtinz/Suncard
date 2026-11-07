import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, Empty } from "@/components/ui";
import RevealButton from "./form";

export const dynamic = "force-dynamic";

export default async function MyCardsPage() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const deliveries = await prisma.cardDelivery.findMany({ where: { userId: session.userId }, orderBy: { deliveredAt: "desc" }, take: 50 });
  const cards = deliveries.length ? await prisma.cardInventory.findMany({ where: { id: { in: deliveries.map((d) => d.cardId) } } }) : [];
  const variants = cards.length ? await prisma.productVariant.findMany({ where: { id: { in: cards.map((c) => c.variantId) } } }) : [];
  const orders = deliveries.length ? await prisma.order.findMany({ where: { id: { in: deliveries.map((d) => d.orderId) } } }) : [];
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const varMap = new Map(variants.map((v) => [v.id, v]));
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  return (
    <div>
      <PageTitle title="Thẻ đã mua" sub="Xem serial và PIN bằng bước xác thực lại mật khẩu" />
      {deliveries.length === 0 ? <Empty text="Bạn chưa mua thẻ nào" /> : (
        <div className="card divide-y divide-slate-100">
          {deliveries.map((d) => {
            const card = cardMap.get(d.cardId);
            const variant = card ? varMap.get(card.variantId) : undefined;
            return (
              <div key={d.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div>
                  <div className="font-medium text-sm">{variant?.name ?? "Mã thẻ"}</div>
                  <div className="text-xs text-slate-500">Đơn {orderMap.get(d.orderId)?.code ?? ""} · Giao {d.deliveredAt.toLocaleString("vi-VN")} · Đã xem {d.revealCount} lần</div>
                </div>
                <div className="ml-auto"><RevealButton deliveryId={d.id} productName={variant?.name ?? "Mã thẻ"} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
