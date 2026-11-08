import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AgentCommissionsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const agent = await prisma.agent.findUnique({ where: { userId: session.userId } });
  if (!agent) redirect("/dai-ly");
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const entries = await prisma.commissionEntry.findMany({ where: { beneficiaryUserId: session.userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take });
  const orders = entries.length ? await prisma.order.findMany({ where: { id: { in: entries.map((e) => e.orderId) } } }) : [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const totalAvail = await prisma.commissionEntry.aggregate({ where: { beneficiaryUserId: session.userId, status: "AVAILABLE" }, _sum: { amountMinor: true } });
  return (
    <div>
      <PageTitle title="Hoa hồng của tôi" sub={`Khả dụng: `} action={<span className="text-xl text-primary"><Money v={totalAvail._sum.amountMinor ?? BigInt(0)} /></span>} />
      <DataTable cols={["Mã đơn", "Cơ sở tính", "Hoa hồng", "Trạng thái", "Khả dụng từ", "Ngày tạo"]} rows={entries.map((e) => [
        orderMap.get(e.orderId)?.code ?? e.orderId, <Money key="b" v={e.baseMinor} />, <Money key="a" v={e.amountMinor} />, <StatusBadge key="s" status={e.status} />, e.availableAt ? e.availableAt.toLocaleDateString("vi-VN") : "—", e.createdAt.toLocaleString("vi-VN"),
      ])} />
    </div>
  );
}
