import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { importCardBatch } from "@/modules/cards";
import { logAudit } from "@/modules/audit";
import { prisma } from "@/lib/prisma";
import type { DB } from "@/modules/ledger";

// Import batch thẻ (Admin): cards [{serial, pin, expiresAt?}]. Trùng fingerprint -> quarantine (không import).
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "cards.import");
    const b = await readJson(req);
    const result = await importCardBatch(prisma as unknown as DB, {
      code: b.code, variantId: b.variantId, providerId: b.providerId, importedBy: s.userId,
      cards: (b.cards ?? []).map((c: any) => ({ serial: String(c.serial), pin: String(c.pin), expiresAt: c.expiresAt ? new Date(c.expiresAt) : undefined })),
      note: b.note,
    });
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "CARDS_IMPORT", entityType: "CARD_BATCH", entityId: result.batch.id, after: { imported: result.imported, duplicates: result.duplicates } });
    return ok(serialize({ batchId: result.batch.id, imported: result.imported, duplicates: result.duplicates, quarantined: result.quarantined }), 201);
  } catch (e) { return fail(e); }
}
