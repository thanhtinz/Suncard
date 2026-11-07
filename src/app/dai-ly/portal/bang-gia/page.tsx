import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, DataTable, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AgentPricingPage() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const agent = await prisma.agent.findUnique({ where: { userId: session.userId } });
  if (!agent) redirect("/dai-ly");
  const level = await prisma.agentLevel.findUnique({ where: { id: agent.levelId } });
  const plans = await prisma.pricingPlan.findMany({ where: { isActive: true, OR: [{ scopeType: "AGENT_LEVEL", scopeId: agent.levelId }, { scopeType: "DEFAULT" }] }, orderBy: { priority: "desc" } });
  const rules = plans.length ? await prisma.priceRule.findMany({ where: { planId: { in: plans.map((p) => p.id) }, isActive: true } }) : [];
  const variants = rules.some((r) => r.variantId) ? await prisma.productVariant.findMany({ where: { id: { in: rules.map((r) => r.variantId).filter((x): x is string => !!x) } } }) : [];
  const varMap = new Map(variants.map((v) => [v.id, v]));
  const planMap = new Map(plans.map((p) => [p.id, p]));
  return (
    <div>
      <PageTitle title="Bảng giá đại lý" sub={`Cấp hiện tại: ${level?.name ?? ""} · Chiết khấu cấp thêm ${(level ? level.discountBps / 100 : 0)}%`} />
      <DataTable cols={["Bảng giá", "Phạm vi", "Mệnh giá áp dụng", "Giá gốc", "Chiết khấu", "Giá cố định"]} rows={rules.map((r) => {
        const v = r.variantId ? varMap.get(r.variantId) : undefined;
        return [planMap.get(r.planId)?.name ?? "", planMap.get(r.planId)?.scopeType ?? "", v?.name ?? "Tất cả sản phẩm trong phạm vi", v ? <Money key="b" v={v.basePriceMinor} /> : "—", `${r.discountBps / 100}%`, r.fixedPriceMinor != null ? <Money key="f" v={r.fixedPriceMinor} /> : "—"];
      })} />
    </div>
  );
}
