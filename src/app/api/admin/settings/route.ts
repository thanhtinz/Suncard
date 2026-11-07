import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { setSetting } from "@/modules/settings";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";
export async function GET() {
  try {
    const rows = await prisma.setting.findMany({ orderBy: { key: "asc" } });
    return ok(serialize({ settings: rows }));
  } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "settings.update");
    const b = await readJson(req);
    const before = await prisma.setting.findUnique({ where: { key: b.key } });
    await setSetting(b.key, b.value, s.userId);
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "SETTINGS_UPDATE", entityType: "SETTING", entityId: b.key, before: before?.value, after: b.value });
    return ok(serialize({ key: b.key, value: b.value }));
  } catch (e) { return fail(e); }
}
