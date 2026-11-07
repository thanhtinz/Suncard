import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const plans = await prisma.pricingPlan.findMany({ orderBy: { priority: "desc" }, skip: (page - 1) * take, take });
  const rules = plans.length ? await prisma.priceRule.findMany({ where: { planId: { in: plans.map((p) => p.id) } } }) : [];
  const variants = rules.some((r) => r.variantId) ? await prisma.productVariant.findMany({ where: { id: { in: rules.map((r) => r.variantId).filter((x): x is string => !!x) } } }) : [];
  const varMap = new Map(variants.map((v) => [v.id, v]));
  const planMap = new Map(plans.map((p) => [p.id, p]));
  return (
    <div className="space-y-8">
      <PageTitle title="Định giá" sub="Bảng giá và quy tắc giá" />
      <DataTable cols={["Mã bảng giá", "Tên", "Phạm vi", "Scope ID", "Ưu tiên", "Trạng thái", "Số quy tắc"]} rows={plans.map((p) => [
        p.code, p.name, p.scopeType, p.scopeId ?? "—", String(p.priority), <StatusBadge key="s" status={p.isActive ? "ACTIVE" : "DISABLED"} />, String(rules.filter((r) => r.planId === p.id).length),
      ])} />
      <h2 className="font-bold text-navy">Quy tắc giá</h2>
      <DataTable cols={["Bảng giá", "Mệnh giá", "Chiết khấu", "Giá cố định", "Biên tối thiểu", "Trạng thái"]} rows={rules.map((r) => [
        planMap.get(r.planId)?.name ?? r.planId, r.variantId ? varMap.get(r.variantId)?.name ?? r.variantId : "Tất cả", `${r.discountBps / 100}%`,
        r.fixedPriceMinor != null ? <Money key="f" v={r.fixedPriceMinor} /> : "—", r.minMarginBps != null ? `${r.minMarginBps / 100}%` : "—", <StatusBadge key="s" status={r.isActive ? "ACTIVE" : "DISABLED"} />,
      ])} />
    </div>
  );
}
