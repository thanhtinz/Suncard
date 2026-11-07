import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, Empty, StatusBadge } from "@/components/ui";
import { CreateTicketForm } from "./form";

export const dynamic = "force-dynamic";

export default async function MyTicketsPage() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const tickets = await prisma.supportTicket.findMany({ where: { userId: session.userId }, orderBy: { updatedAt: "desc" }, take: 50 });
  return (
    <div className="space-y-6">
      <PageTitle title="Hỗ trợ của tôi" sub="Tạo và theo dõi yêu cầu hỗ trợ" />
      <CreateTicketForm />
      <h2 className="font-bold text-navy">Ticket đã gửi</h2>
      {tickets.length === 0 ? <Empty text="Bạn chưa có ticket nào" /> : (
        <div className="card divide-y divide-slate-100">
          {tickets.map((t) => (
            <Link key={t.id} href={`/tai-khoan/ho-tro/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <span className="font-medium text-sm">{t.subject}</span><span className="text-xs text-slate-400">{t.category}</span>
              <span className="ml-auto text-xs text-slate-400">{t.updatedAt.toLocaleString("vi-VN")}</span><StatusBadge status={t.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
