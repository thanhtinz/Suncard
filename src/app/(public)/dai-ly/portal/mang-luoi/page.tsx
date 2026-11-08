import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";
import InviteForm from "./form";

export const dynamic = "force-dynamic";

export default async function AgentNetworkPage() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const agent = await prisma.agent.findUnique({ where: { userId: session.userId } });
  if (!agent) redirect("/dai-ly");
  const closure = await prisma.agentClosure.findMany({ where: { ancestorId: agent.id, depth: { gt: 0 } }, orderBy: { depth: "asc" } });
  const descendants = closure.length ? await prisma.agent.findMany({ where: { id: { in: closure.map((c) => c.descendantId) } } }) : [];
  const levels = await prisma.agentLevel.findMany({ where: { isActive: true }, orderBy: { rank: "asc" } });
  const levelMap = new Map(levels.map((l) => [l.id, l]));
  const users = descendants.length ? await prisma.user.findMany({ where: { id: { in: descendants.map((a) => a.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const depthMap = new Map(closure.map((c) => [c.descendantId, c.depth]));
  const invites = await prisma.agentInvitation.findMany({ where: { inviterAgentId: agent.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <div className="space-y-6">
      <PageTitle title="Mạng lưới đại lý" sub={`${descendants.length} đại lý trong tuyến dưới`} />
      <DataTable cols={["Mã đại lý", "Email", "Cấp", "Độ sâu", "Trạng thái", "Ngày tham gia"]} rows={descendants.map((a) => [
        a.code, userMap.get(a.userId)?.email ?? "", levelMap.get(a.levelId)?.name ?? "", String(depthMap.get(a.id) ?? ""), <StatusBadge key="s" status={a.status} />, a.createdAt.toLocaleDateString("vi-VN"),
      ])} />
      <InviteForm levels={levels.map((l) => ({ id: l.id, name: l.name }))} />
      <h2 className="font-bold text-navy">Lời mời đã gửi</h2>
      <DataTable cols={["Email", "Trạng thái", "Hết hạn", "Ngày gửi"]} rows={invites.map((i) => [i.email, <StatusBadge key="s" status={i.status} />, i.expiresAt.toLocaleDateString("vi-VN"), i.createdAt.toLocaleString("vi-VN")])} />
    </div>
  );
}
