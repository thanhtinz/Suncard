import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MyOrdersPage({ searchParams }: { searchParams?: { page?: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, orders] = await Promise.all([
    prisma.order.count({ where: { userId: session.userId } }),
    prisma.order.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const pages = Math.max(1, Math.ceil(total / take));
  return (
    <div>
      <PageTitle title="Đơn hàng của tôi" sub={`Tổng ${total} đơn`} />
      <DataTable cols={["Mã đơn", "Loại", "Trạng thái", "Tổng tiền", "Thời gian", ""]} rows={orders.map((o) => [
        o.code, o.type, <StatusBadge key="s" status={o.status} />, <Money key="m" v={o.totalMinor} />, o.createdAt.toLocaleString("vi-VN"),
        <Link key="l" className="text-primary" href={`/tai-khoan/don-hang/${o.id}`}>Chi tiết</Link>,
      ])} />
      {pages > 1 && <div className="flex gap-2 mt-4 text-sm">{page > 1 && <Link className="btn-ghost" href={`?page=${page - 1}`}>Trang trước</Link>}<span className="px-2 py-2">Trang {page}/{pages}</span>{page < pages && <Link className="btn-ghost" href={`?page=${page + 1}`}>Trang sau</Link>}</div>}
    </div>
  );
}
