import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import type { DB } from "@/modules/ledger";

// Đối soát: so provider_transactions (CREATE SUCCESS) với orders SUCCESS của provider.
// Lệch -> reconciliation_items + case (owner/severity/evidence). KHÔNG sửa ledger trực tiếp.
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "reconciliation.run");
    const b = await readJson(req);
    const provider = await prisma.provider.findUnique({ where: { id: b.providerId } });
    if (!provider) throw new Error("NOT_FOUND");
    const from = b.from ? new Date(b.from) : new Date(Date.now() - 86400000);
    const to = b.to ? new Date(b.to) : new Date();
    const run = await prisma.providerReconciliationRun.create({ data: { providerId: provider.id, periodStart: from, periodEnd: to, status: "RUNNING", createdBy: s.userId } });
    const txns = await prisma.providerTransaction.findMany({ where: { providerId: provider.id, action: "CREATE", createdAt: { gte: from, lte: to } } });
    let matched = 0, mismatched = 0;
    for (const t of txns) {
      const order = t.orderId ? await prisma.order.findUnique({ where: { id: t.orderId } }) : null;
      let status = "MATCHED";
      if (!order) status = "MISSING_LOCAL";
      else if (t.status === "SUCCESS" && order.status !== "SUCCESS") status = "STATUS_DIFF";
      else if (t.status !== "SUCCESS" && order.status === "SUCCESS") status = "STATUS_DIFF";
      const item = await prisma.providerReconciliationItem.create({
        data: { runId: run.id, orderId: t.orderId, externalRef: t.externalRef, expectedMinor: order?.totalMinor ?? 0n, actualMinor: order?.totalMinor ?? 0n, status, detail: { providerStatus: t.status, orderStatus: order?.status } },
      });
      if (status === "MATCHED") matched++; else {
        mismatched++;
        await prisma.reconciliationCase.create({
          data: { runId: run.id, providerId: provider.id, orderId: t.orderId, type: status, severity: status === "MISSING_LOCAL" ? "HIGH" : "MEDIUM", status: "OPEN", evidence: { itemId: item.id, providerStatus: t.status, orderStatus: order?.status } },
        });
      }
    }
    const done = await prisma.providerReconciliationRun.update({ where: { id: run.id }, data: { status: "COMPLETED", totalItems: txns.length, matched, mismatched } });
    return ok(serialize({ run: done }), 201);
  } catch (e) { return fail(e); }
}
