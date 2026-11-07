import type { DB } from "./ledger";

// Đối soát provider (doc 07/FR-15): so giao dịch provider với đơn nội bộ theo kỳ.
// Lệch -> provider_reconciliation_items + reconciliation_cases (owner/severity/evidence).
// KHÔNG sửa ledger trực tiếp — lệch chỉ tạo case để vận hành xử lý.
// - Provider HTTP_CHARGING: đối soát THẬT với upstream qua command=check (Phase 2).
// - Provider còn lại (MANUAL/MOCK): đối soát nội bộ provider_transactions <-> orders.

export async function runReconciliation(
  db: DB,
  params: { providerId: string; from: Date; to: Date; createdBy?: string }
) {
  const provider = await db.provider.findUnique({ where: { id: params.providerId } });
  if (!provider) throw new Error("NOT_FOUND");
  const run = await db.providerReconciliationRun.create({
    data: { providerId: provider.id, periodStart: params.from, periodEnd: params.to, status: "RUNNING", createdBy: params.createdBy },
  });
  let total = 0;
  let matched = 0;
  let mismatched = 0;

  if (provider.code === "HTTP_CHARGING") {
    const { reconcileHttpChargingDetail } = await import("./http-charging");
    const detail = await reconcileHttpChargingDetail(db, provider, { from: params.from, to: params.to });
    total = detail.total;
    matched = detail.matched;
    mismatched = total - matched;
    for (const item of detail.items) {
      const rec = await db.providerReconciliationItem.create({
        data: {
          runId: run.id, orderId: item.orderId, externalRef: item.externalRef,
          expectedMinor: item.expectedMinor, actualMinor: item.actualMinor, status: item.status,
          detail: { localStatus: item.localStatus, upstreamStatus: item.upstreamStatus },
        },
      });
      if (item.status !== "MATCHED") {
        await db.reconciliationCase.create({
          data: {
            runId: run.id, providerId: provider.id, orderId: item.orderId, type: item.status,
            severity: item.status === "MISSING_LOCAL" ? "HIGH" : "MEDIUM", status: "OPEN",
            evidence: { itemId: rec.id, localStatus: item.localStatus, upstreamStatus: item.upstreamStatus },
          },
        });
      }
    }
  } else {
    const txns = await db.providerTransaction.findMany({
      where: { providerId: provider.id, action: "CREATE", createdAt: { gte: params.from, lte: params.to } },
    });
    total = txns.length;
    for (const t of txns) {
      const order = t.orderId ? await db.order.findUnique({ where: { id: t.orderId } }) : null;
      let status = "MATCHED";
      if (!order) status = "MISSING_LOCAL";
      else if (t.status === "SUCCESS" && order.status !== "SUCCESS") status = "STATUS_DIFF";
      else if (t.status !== "SUCCESS" && order.status === "SUCCESS") status = "STATUS_DIFF";
      const item = await db.providerReconciliationItem.create({
        data: { runId: run.id, orderId: t.orderId, externalRef: t.externalRef, expectedMinor: order?.totalMinor ?? 0n, actualMinor: order?.totalMinor ?? 0n, status, detail: { providerStatus: t.status, orderStatus: order?.status } },
      });
      if (status === "MATCHED") matched++;
      else {
        mismatched++;
        await db.reconciliationCase.create({
          data: { runId: run.id, providerId: provider.id, orderId: t.orderId, type: status, severity: status === "MISSING_LOCAL" ? "HIGH" : "MEDIUM", status: "OPEN", evidence: { itemId: item.id, providerStatus: t.status, orderStatus: order?.status } },
        });
      }
    }
  }

  return db.providerReconciliationRun.update({
    where: { id: run.id },
    data: { status: "COMPLETED", totalItems: total, matched, mismatched },
  });
}
