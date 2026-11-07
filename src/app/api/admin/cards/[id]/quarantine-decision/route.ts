import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { reviewQuarantinedCard } from "@/modules/cards";
import { prisma } from "@/lib/prisma";
import type { DB } from "@/modules/ledger";
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "cards.import");
    const b = await readJson(req);
    const card = await reviewQuarantinedCard(prisma as unknown as DB, { cardId: params.id, decision: b.decision, actorId: s.userId, reason: b.reason });
    return ok(serialize({ card: { id: card.id, status: card.status } }));
  } catch (e) { return fail(e); }
}
