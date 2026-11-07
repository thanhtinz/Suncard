import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const PRIORITY_LABEL: Record<string, string> = { LOW: "Thấp", NORMAL: "Thường", HIGH: "Cao", URGENT: "Khẩn" };

export default async function AdminSupportPage({ searchParams }: { searchParams?: { page?: string; status?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const status = searchParams?.status ?? "";
  const where = { ...(status ? { status } : {}) };
  const [total, tickets] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const messages = tickets.length ? await prisma.ticketMessage.findMany({ where: { ticketId: { in: tickets.map((t) => t.id) } }, select: { ticketId: true } }) : [];
  const msgCount = new Map<string, number>();
  for (const m of messages) msgCount.set(m.ticketId, (msgCount.get(m.ticketId) ?? 0) + 1);
  const users = tickets.length ? await prisma.user.findMany({ where: { id: { in: tickets.map((t) => t.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const totalPages = Math.max(1, Math.ceil(total / take));
  const href = (p: number) => `/admin/ho-tro?page=${p}${status ? `&status=${status}` : ""}`;
  return (
    <div>
      <PageTitle title="Hỗ trợ & tranh chấp đến từ khách" sub={`Tổng ${total} yêu cầu · Trang ${page}/${totalPages}${status ? ` · Lọc: ${status}` : ""}`} />
      <DataTable cols={["Mã", "Khách", "Tiêu đề", "Danh mục", "Ưu tiên", "Trạng thái", "Tin nhắn", "Cập nhật"]} rows={tickets.map((t) => [
        `#${t.id.slice(0, 8)}`,
        userMap.get(t.userId)?.email ?? "",
        t.subject,
        t.category,
        PRIORITY_LABEL[t.priority] ?? t.priority,
        <StatusBadge key="s" status={t.status} />,
        String(msgCount.get(t.id) ?? 0),
        t.updatedAt.toLocaleString("vi-VN"),
      ])} />
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
