import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { getNumberSetting } from "@/modules/settings";

// Điều chỉnh số dư (maker): chỉ tạo FinancialApprovalRequest, checker khác duyệt mới post ledger.
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "finance.adjust");
    const b = await readJson(req);
    const amount = BigInt(b.amountMinor ?? "0");
    if (amount === 0n) throw new Error("VALIDATION_AMOUNT");
    const target = await prisma.user.findUnique({ where: { id: b.userId } });
    if (!target) throw new Error("NOT_FOUND");
    const approval = await prisma.financialApprovalRequest.create({
      data: { kind: "ADJUSTMENT", amountMinor: amount > 0n ? amount : -amount, makerId: s.userId, payload: { userId: b.userId, amountMinor: amount.toString(), reason: b.reason ?? "Điều chỉnh số dư" } },
    });
    return ok(serialize({ approval }), 201);
  } catch (e) { return fail(e); }
}
