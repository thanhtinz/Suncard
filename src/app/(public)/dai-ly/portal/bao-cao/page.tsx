import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, DataTable, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AgentReportPage() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const agent = await prisma.agent.findUnique({ where: { userId: session.userId } });
  if (!agent) redirect("/dai-ly");
  const closure = await prisma.agentClosure.findMany({ where: { ancestorId: agent.id } });
  const scopeIds = closure.map((c) => c.descendantId);
  const agents = await prisma.agent.findMany({ where: { id: { in: scopeIds } } });
  const users = agents.length ? await prisma.user.findMany({ where: { id: { in: agents.map((a) => a.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const grouped = await prisma.order.groupBy({ by: ["agentId"], where: { agentId: { in: scopeIds }, status: "SUCCESS" }, _sum: { totalMinor: true }, _count: { _all: true } });
  const gMap = new Map(grouped.map((g) => [g.agentId ?? "", g]));
  const totals = grouped.reduce((acc, g) => acc + (g._sum.totalMinor ?? BigInt(0)), BigInt(0));
  const rows = agents.map((a) => {
    const g = gMap.get(a.id);
    return [a.id === agent.id ? `${a.code} (bạn)` : a.code, userMap.get(a.userId)?.email ?? "", String(g?._count._all ?? 0), <Money key="m" v={g?._sum.totalMinor ?? BigInt(0)} />] as React.ReactNode[];
  }).sort((a, b) => 0);
  return (
    <div>
      <PageTitle title="Báo cáo theo tuyến dưới" sub="Doanh số đơn thành công của từng đại lý trong mạng lưới" action={<span className="text-right"><span className="block text-xs text-slate-500">Tổng doanh số</span><span className="text-xl text-primary"><Money v={totals} /></span></span>} />
      <DataTable cols={["Đại lý", "Email", "Số đơn thành công", "Doanh số"]} rows={rows} />
    </div>
  );
}
