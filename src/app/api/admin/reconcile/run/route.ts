import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { runReconciliation } from "@/modules/reconciliation";
import type { DB } from "@/modules/ledger";

// Đối soát thủ công từ Admin — logic dùng chung ở modules/reconciliation (cron dùng cùng hàm).
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "reconciliation.run");
    const b = await readJson(req);
    const from = b.from ? new Date(b.from) : new Date(Date.now() - 86400000);
    const to = b.to ? new Date(b.to) : new Date();
    const run = await runReconciliation(prisma as unknown as DB, { providerId: b.providerId, from, to, createdBy: s.userId });
    return ok(serialize({ run }), 201);
  } catch (e) { return fail(e); }
}
