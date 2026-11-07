import { bpsOf, minMoney } from "@/lib/money";
import { commissionCode, PLATFORM_MARGIN, postLedger, type DB } from "./ledger";
import { uplineChain } from "./agents";
import { getNumberSetting } from "./settings";

// Commission (doc 03): rule theo beneficiary/base/rate|fixed/điều kiện/vesting/reversal.
// Tổng commission bị CAP theo % margin trong settings. Refund -> đảo commission.

export async function computeCommissionForOrder(
  db: DB,
  params: { orderId: string; sellerAgentId?: string | null; marginMinor: bigint; revenueMinor: bigint; productType: string }
) {
  const created: any[] = [];
  if (params.marginMinor <= 0n || !params.sellerAgentId) return created;
  const capBps = await getNumberSetting("commission.cap_bps_of_margin", 8000);
  const vestingDays = await getNumberSetting("commission.vesting_days", 0);
  let remainingCap = bpsOf(params.marginMinor, capBps);

  const plan = await db.commissionPlan.findFirst({ where: { isActive: true } });
  if (!plan) return created;
  const rules = await db.commissionRule.findMany({ where: { planId: plan.id, isActive: true } });

  const chain = await uplineChain(db, params.sellerAgentId);
  const beneficiaries: { agentId: string; depth: number }[] = [
    { agentId: params.sellerAgentId, depth: 0 },
    ...chain.map((c: any) => ({ agentId: c.agentId, depth: c.depth })),
  ];

  for (const b of beneficiaries) {
    if (remainingCap <= 0n) break;
    const rule = rules.find(
      (r: any) =>
        (r.productType == null || r.productType === params.productType) &&
        (r.levelRank == null || r.levelRank === b.depth) &&
        (b.depth === 0 ? r.beneficiaryType === "AGENT_SELF" || r.beneficiaryType === "SALES" : r.beneficiaryType === "AGENT_UPLINE")
    );
    if (!rule) continue;
    const base = rule.base === "REVENUE" ? params.revenueMinor : params.marginMinor;
    let amount = rule.fixedMinor != null ? (rule.fixedMinor as bigint) : bpsOf(base, rule.rateBps ?? 0);
    if (amount <= 0n) continue;
    amount = minMoney(amount, remainingCap);
    remainingCap -= amount;
    const agent = await db.agent.findUnique({ where: { id: b.agentId } });
    if (!agent) continue;
    const availableAt = new Date(Date.now() + (rule.vestingDays || vestingDays) * 86400000);
    const status = (rule.vestingDays || vestingDays) > 0 ? "PENDING" : "AVAILABLE";
    const entry = await db.commissionEntry.create({
      data: {
        orderId: params.orderId,
        beneficiaryUserId: agent.userId,
        beneficiaryAgentId: agent.id,
        ruleId: rule.id,
        baseMinor: base,
        amountMinor: amount,
        status,
        availableAt,
        idempotencyKey: `commission:${params.orderId}:${agent.id}`,
      },
    }).catch(() => null);
    if (!entry) continue; // đã tính rồi (idempotent)
    if (status === "AVAILABLE") {
      await postLedger(db, {
        type: "COMMISSION",
        refType: "ORDER",
        refId: params.orderId,
        idempotencyKey: `commission-post:${params.orderId}:${agent.id}`,
        description: "Hoa hồng đại lý",
        entries: [
          { accountCode: PLATFORM_MARGIN, ownerType: "PLATFORM", kind: "REVENUE", direction: "DEBIT", amountMinor: amount },
          { accountCode: commissionCode(agent.userId), ownerType: "USER", ownerId: agent.userId, kind: "COMMISSION", direction: "CREDIT", amountMinor: amount },
        ],
      });
    }
    created.push(entry);
  }
  return created;
}

/** Đảo toàn bộ commission của đơn (khi refund). Idempotent theo trạng thái entry. */
export async function reverseCommissionForOrder(db: DB, orderId: string) {
  const entries = await db.commissionEntry.findMany({ where: { orderId, status: { in: ["AVAILABLE", "PENDING", "PAID"] } } });
  for (const e of entries) {
    if (e.status === "AVAILABLE" || e.status === "PAID") {
      await postLedger(db, {
        type: "REVERSAL",
        refType: "ORDER",
        refId: orderId,
        idempotencyKey: `commission-reversal:${e.id}`,
        description: "Đảo hoa hồng do hoàn tiền",
        entries: [
          { accountCode: commissionCode(e.beneficiaryUserId), ownerType: "USER", ownerId: e.beneficiaryUserId, kind: "COMMISSION", direction: "DEBIT", amountMinor: e.amountMinor as bigint },
          { accountCode: PLATFORM_MARGIN, ownerType: "PLATFORM", kind: "REVENUE", direction: "CREDIT", amountMinor: e.amountMinor as bigint },
        ],
      }).catch(() => undefined);
    }
    await db.commissionEntry.update({ where: { id: e.id }, data: { status: "REVERSED" } });
  }
}
