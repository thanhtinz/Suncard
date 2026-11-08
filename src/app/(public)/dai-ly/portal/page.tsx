import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

async function myAgent(userId: string) {
  const agent = await prisma.agent.findUnique({ where: { userId } });
  if (!agent) redirect("/dai-ly");
  return agent;
}

export default async function AgentDashboard() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const agent = await myAgent(session.userId);
  const closure = await prisma.agentClosure.findMany({ where: { ancestorId: agent.id } });
  const scopeIds = closure.map((c) => c.descendantId);
  const subCount = closure.filter((c) => c.depth > 0).length;
  const [sales, pending, available, credit] = await Promise.all([
    prisma.order.aggregate({ where: { agentId: { in: scopeIds }, status: "SUCCESS" }, _sum: { totalMinor: true }, _count: { _all: true } }),
    prisma.commissionEntry.aggregate({ where: { beneficiaryUserId: session.userId, status: "PENDING" }, _sum: { amountMinor: true } }),
    prisma.commissionEntry.aggregate({ where: { beneficiaryUserId: session.userId, status: "AVAILABLE" }, _sum: { amountMinor: true } }),
    prisma.creditAccount.findUnique({ where: { userId: session.userId } }),
  ]);
  const cards: [string, React.ReactNode][] = [
    ["Doanh số mạng lưới (đơn thành công)", <Money key="a" v={sales._sum.totalMinor ?? BigInt(0)} />],
    ["Số đơn thành công", String(sales._count._all)],
    ["Hoa hồng đang chờ", <Money key="b" v={pending._sum.amountMinor ?? BigInt(0)} />],
    ["Hoa hồng khả dụng", <Money key="c" v={available._sum.amountMinor ?? BigInt(0)} />],
    ["Hạn mức công nợ", <Money key="d" v={credit?.limitMinor ?? BigInt(0)} />],
    ["Dư nợ hiện tại", <Money key="e" v={credit?.outstandingMinor ?? BigInt(0)} />],
    ["Số đại lý tuyến dưới", String(subCount)],
  ];
  return (
    <div>
      <PageTitle title="Tổng quan đại lý" sub={`Mã đại lý: ${agent.code}`} />
      <div className="grid md:grid-cols-3 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5"><div className="text-sm text-slate-500">{label}</div><div className="text-2xl mt-1">{value}</div></div>
        ))}
      </div>
    </div>
  );
}
