import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AgentOrdersPage({ searchParams }: { searchParams?: { page?: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const agent = await prisma.agent.findUnique({ where: { userId: session.userId } });
  if (!agent) redirect("/dai-ly");
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const closure = await prisma.agentClosure.findMany({ where: { ancestorId: agent.id } });
  const scopeIds = closure.map((c) => c.descendantId);
  const agents = await prisma.agent.findMany({ where: { id: { in: scopeIds } } });
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const orders = await prisma.order.findMany({ where: { agentId: { in: scopeIds } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take });
  return (
    <div>
      <PageTitle title="Đơn hàng trong mạng lưới" sub="Đơn của bạn và toàn bộ tuyến dưới" />
      <DataTable cols={["Mã đơn", "Đại lý", "Loại", "Trạng thái", "Tổng tiền", "Thời gian"]} rows={orders.map((o) => [
        o.code, o.agentId ? agentMap.get(o.agentId)?.code ?? "" : "", o.type, <StatusBadge key="s" status={o.status} />, <Money key="m" v={o.totalMinor} />, o.createdAt.toLocaleString("vi-VN"),
      ])} />
    </div>
  );
}
