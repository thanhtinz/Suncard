import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminCreditPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, accounts] = await Promise.all([
    prisma.creditAccount.count(),
    prisma.creditAccount.findMany({ orderBy: { updatedAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const users = accounts.length ? await prisma.user.findMany({ where: { id: { in: accounts.map((a) => a.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const agents = accounts.some((a) => a.agentId) ? await prisma.agent.findMany({ where: { id: { in: accounts.map((a) => a.agentId).filter((x): x is string => !!x) } } }) : [];
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const txs = accounts.length ? await prisma.creditTransaction.findMany({ where: { creditAccountId: { in: accounts.map((a) => a.id) } }, orderBy: { createdAt: "desc" }, take: 30 }) : [];
  const accMap = new Map(accounts.map((a) => [a.id, a]));
  return (
    <div className="space-y-8">
      <PageTitle title="Công nợ" sub={`Tổng ${total} tài khoản tín dụng · Trang ${page}`} />
      <DataTable cols={["Khách", "Đại lý", "Hạn mức", "Dư nợ", "Đã giữ chỗ", "Còn dùng được", "Trạng thái", "Hạn trả"]} rows={accounts.map((a) => [
        userMap.get(a.userId)?.email ?? a.userId, a.agentId ? agentMap.get(a.agentId)?.code ?? a.agentId : "—",
        <Money key="l" v={a.limitMinor} />, <Money key="o" v={a.outstandingMinor} />, <Money key="r" v={a.reservedMinor} />,
        <Money key="av" v={a.limitMinor - a.outstandingMinor - a.reservedMinor} />, <StatusBadge key="s" status={a.status} />, a.dueDate ? a.dueDate.toLocaleDateString("vi-VN") : "—",
      ])} />
      <h2 className="font-bold text-navy">Giao dịch công nợ gần đây</h2>
      <DataTable cols={["Thời gian", "Tài khoản", "Loại", "Số tiền", "Tham chiếu"]} rows={txs.map((t) => [
        t.createdAt.toLocaleString("vi-VN"), userMap.get(accMap.get(t.creditAccountId)?.userId ?? "")?.email ?? t.creditAccountId, t.type, <Money key="m" v={t.amountMinor} />, t.refId ?? "—",
      ])} />
    </div>
  );
}
