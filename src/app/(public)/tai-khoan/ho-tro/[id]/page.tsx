import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, StatusBadge, Empty } from "@/components/ui";
import { ReplyForm } from "../form";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id } });
  if (!ticket || ticket.userId !== session.userId) notFound();
  const messages = await prisma.ticketMessage.findMany({ where: { ticketId: ticket.id, internal: false }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <PageTitle title={ticket.subject} sub={`Danh mục: ${ticket.category} · Tạo ${ticket.createdAt.toLocaleString("vi-VN")}`} action={<StatusBadge status={ticket.status} />} />
      {messages.length === 0 ? <Empty text="Chưa có tin nhắn nào" /> : (
        <div className="card p-5 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${m.senderType === "CUSTOMER" ? "bg-blue-50 ml-auto" : "bg-slate-100"}`}>
              <div className="text-xs text-slate-400 mb-1">{m.senderType === "CUSTOMER" ? "Bạn" : "Đội hỗ trợ"} · {m.createdAt.toLocaleString("vi-VN")}</div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
        </div>
      )}
      {ticket.status !== "CLOSED" && <ReplyForm ticketId={ticket.id} />}
    </div>
  );
}
