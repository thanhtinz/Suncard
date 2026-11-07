import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUSES = ["SUCCESS", "PROCESSING", "UNKNOWN", "FAILED", "REFUNDED", "CANCELLED"];

export default async function AdminCardOrdersPage({ searchParams }: { searchParams?: { page?: string; status?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const status = searchParams?.status ?? "";
  // Đơn bán thẻ = Order có type CARD_PURCHASE (chi tiết ở CardPurchaseOrder).
  const where = { type: "CARD_PURCHASE", ...(status ? { status } : {}) };
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const details = orders.length ? await prisma.cardPurchaseOrder.findMany({ where: { orderId: { in: orders.map((o) => o.id) } } }) : [];
  const dMap = new Map(details.map((d) => [d.orderId, d]));
  const variants = details.length ? await prisma.productVariant.findMany({ where: { id: { in: details.map((d) => d.variantId) } } }) : [];
  const vMap = new Map(variants.map((v) => [v.id, v]));
  const users = orders.length ? await prisma.user.findMany({ where: { id: { in: orders.map((o) => o.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const totalPages = Math.max(1, Math.ceil(total / take));
  const href = (p: number) => `/admin/don-ban-the?page=${p}${status ? `&status=${status}` : ""}`;
  return (
    <div>
      <PageTitle title="Đơn bán thẻ" sub={`Tổng ${total} · Trang ${page}/${totalPages}${status ? ` · Lọc: ${status}` : ""}`} />
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin/don-ban-the" className={!status ? "btn-primary !py-1.5 !px-3 text-[13px]" : "btn-ghost !py-1.5 !px-3 text-[13px]"}>Tất cả</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/don-ban-the?status=${s}`} className={status === s ? "btn-primary !py-1.5 !px-3 text-[13px]" : "btn-ghost !py-1.5 !px-3 text-[13px]"}>{s}</Link>
        ))}
      </div>
      <DataTable cols={["Mã đơn", "Khách", "Sản phẩm", "SL", "Trạng thái", "Tổng tiền", "Đã giao thẻ", "Thời gian"]} rows={orders.map((o) => {
        const d = dMap.get(o.id);
        const v = d ? vMap.get(d.variantId) : undefined;
        return [
          o.code,
          userMap.get(o.userId)?.email ?? "",
          v?.name ?? "",
          String(d?.qty ?? 0),
          <StatusBadge key="s" status={o.status} />,
          <Money key="m" v={o.totalMinor} />,
          d?.deliveredAt ? d.deliveredAt.toLocaleString("vi-VN") : "Chưa giao",
          o.createdAt.toLocaleString("vi-VN"),
        ];
      })} />
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          {page > 1 && <Link className="btn-ghost" href={href(page - 1)}>Trang trước</Link>}
          <span className="text-slate-500">Trang {page}/{totalPages}</span>
          {page < totalPages && <Link className="btn-ghost" href={href(page + 1)}>Trang sau</Link>}
        </div>
      )}
    </div>
  );
}
