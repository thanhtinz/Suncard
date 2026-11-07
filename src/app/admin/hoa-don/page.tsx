import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, intents] = await Promise.all([
    prisma.paymentIntent.count(),
    prisma.paymentIntent.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const users = intents.length ? await prisma.user.findMany({ where: { id: { in: intents.map((i) => i.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u.email]));
  const totalPages = Math.max(1, Math.ceil(total / take));
  return (
    <div>
      <PageTitle title="Hoá đơn" sub={`Tổng ${total} hoá đơn thanh toán (PaymentIntent) · Trang ${page}/${totalPages}`} />
      <DataTable cols={["Mã hoá đơn", "Khách", "Mục đích", "Số tiền", "Phương thức", "Trạng thái", "Thời gian"]} rows={intents.map((i) => [
        i.externalRef ? `${i.externalRef}` : i.id.slice(0, 12),
        userMap.get(i.userId) ?? i.userId,
        i.purpose === "DEPOSIT" ? "Nạp ví" : i.purpose === "ORDER" ? "Thanh toán đơn" : i.purpose,
        <Money key="m" v={i.amountMinor} />,
        i.method,
        <StatusBadge key="s" status={i.status} />,
        i.createdAt.toLocaleString("vi-VN"),
      ])} />
      <div className="flex gap-2 mt-4 text-sm items-center">
        {page > 1 && <Link className="btn-ghost" href={`/admin/hoa-don?page=${page - 1}`}>Trang trước</Link>}
        <span className="text-slate-500">Trang {page}/{totalPages}</span>
        {page < totalPages && <Link className="btn-ghost" href={`/admin/hoa-don?page=${page + 1}`}>Trang sau</Link>}
      </div>
    </div>
  );
}
