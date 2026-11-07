import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, agents, levels] = await Promise.all([
    prisma.agent.count(),
    prisma.agent.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    prisma.agentLevel.findMany({ orderBy: { rank: "asc" } }),
  ]);
  const levelMap = new Map(levels.map((l) => [l.id, l]));
  const users = agents.length ? await prisma.user.findMany({ where: { id: { in: agents.map((a) => a.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const parents = agents.some((a) => a.parentId) ? await prisma.agent.findMany({ where: { id: { in: agents.map((a) => a.parentId).filter((x): x is string => !!x) } } }) : [];
  const parentMap = new Map(parents.map((a) => [a.id, a]));
  return (
    <div>
      <PageTitle title="Đại lý" sub={`Tổng ${total} đại lý · Trang ${page}`} />
      <div className="mb-8"><DataTable cols={["Mã", "Email", "Cấp", "Đại lý cha", "Trạng thái", "Ngày tạo"]} rows={agents.map((a) => [
        a.code, userMap.get(a.userId)?.email ?? "", levelMap.get(a.levelId)?.name ?? "", a.parentId ? parentMap.get(a.parentId)?.code ?? a.parentId : "—", <StatusBadge key="s" status={a.status} />, a.createdAt.toLocaleDateString("vi-VN"),
      ])} /></div>
      <h2 className="font-bold text-navy mb-3">Cấp đại lý</h2>
      <DataTable cols={["Hạng", "Mã", "Tên cấp", "Chiết khấu thêm", "Hạn mức công nợ", "Trạng thái"]} rows={levels.map((l) => [
        String(l.rank), l.code, l.name, `${l.discountBps / 100}%`, <Money key="m" v={l.creditLimitMinor} />, <StatusBadge key="s" status={l.isActive ? "ACTIVE" : "DISABLED"} />,
      ])} />
    </div>
  );
}
