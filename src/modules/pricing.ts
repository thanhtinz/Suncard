import { discounted } from "@/lib/money";
import type { DB } from "./ledger";

// Pricing precedence (doc 03): override tài khoản → nhánh/đại lý → cấp đại lý → nhóm khách → mặc định.
// Giá được snapshot tại thời điểm xác nhận đơn (bảng price_snapshots).

export type PriceSource = "ACCOUNT_OVERRIDE" | "BRANCH" | "AGENT_LEVEL" | "CUSTOMER_GROUP" | "DEFAULT";

export interface ResolvedPrice {
  unitPriceMinor: bigint;
  discountBps: number;
  planId: string | null;
  ruleId: string | null;
  source: PriceSource;
}

async function priceFromPlan(db: DB, plan: any, variant: any): Promise<ResolvedPrice | null> {
  const rules = await db.priceRule.findMany({ where: { planId: plan.id, isActive: true } });
  const rule =
    rules.find((r: any) => r.variantId === variant.id) ||
    rules.find((r: any) => r.productId === variant.productId && !r.variantId) ||
    rules.find((r: any) => !r.productId && !r.variantId);
  if (!rule) return null;
  if (rule.fixedPriceMinor != null) {
    return { unitPriceMinor: rule.fixedPriceMinor as bigint, discountBps: rule.discountBps ?? 0, planId: plan.id, ruleId: rule.id, source: plan.scopeType === "ACCOUNT" ? "ACCOUNT_OVERRIDE" : (plan.scopeType as PriceSource) };
  }
  const base = variant.basePriceMinor as bigint;
  const price = discounted(base, rule.discountBps ?? 0);
  return { unitPriceMinor: price, discountBps: rule.discountBps ?? 0, planId: plan.id, ruleId: rule.id, source: plan.scopeType === "ACCOUNT" ? "ACCOUNT_OVERRIDE" : (plan.scopeType as PriceSource) };
}

export async function resolvePrice(
  db: DB,
  params: { userId?: string; agentId?: string; agentLevelId?: string; customerGroup?: string; variantId: string }
): Promise<ResolvedPrice> {
  const variant = await db.productVariant.findUnique({ where: { id: params.variantId } });
  if (!variant) throw new Error("PRODUCT_NOT_FOUND");
  const plans = await db.pricingPlan.findMany({ where: { isActive: true }, orderBy: { priority: "asc" } });
  const scopeOrder: { scopeType: string; scopeId?: string | null }[] = [
    { scopeType: "ACCOUNT", scopeId: params.userId },
    { scopeType: "BRANCH", scopeId: params.agentId },
    { scopeType: "AGENT_LEVEL", scopeId: params.agentLevelId },
    { scopeType: "CUSTOMER_GROUP", scopeId: params.customerGroup ?? "STANDARD" },
    { scopeType: "DEFAULT", scopeId: null },
  ];
  for (const scope of scopeOrder) {
    if (scope.scopeType !== "DEFAULT" && !scope.scopeId) continue;
    const plan = plans
      .filter((p: any) => p.scopeType === scope.scopeType && (scope.scopeType === "DEFAULT" || p.scopeId === scope.scopeId))
      .sort((a: any, b: any) => a.priority - b.priority)[0];
    if (!plan) continue;
    const resolved = await priceFromPlan(db, plan, variant);
    if (resolved) return resolved;
  }
  // Không có rule nào: giá mặc định = basePrice của variant.
  return { unitPriceMinor: variant.basePriceMinor as bigint, discountBps: 0, planId: null, ruleId: null, source: "DEFAULT" };
}

export async function snapshotPrice(db: DB, orderId: string, variantId: string, qty: number, resolved: ResolvedPrice, faceValueMinor: bigint) {
  return db.priceSnapshot.create({
    data: {
      orderId,
      variantId,
      faceValueMinor,
      unitPriceMinor: resolved.unitPriceMinor,
      discountBps: resolved.discountBps,
      planId: resolved.planId,
      ruleId: resolved.ruleId,
      source: resolved.source,
    },
  });
}
