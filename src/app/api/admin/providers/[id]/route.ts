import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Cập nhật cấu hình provider (Admin): config JSON (vd HTTP_CHARGING: baseUrl,
// partnerId, signMode), trạng thái, độ ưu tiên. Secret KHÔNG sửa ở đây —
// partner_key đi qua luồng duyệt kép /api/admin/providers/[id]/credentials.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "providers.manage");
    const b = await readJson(req);
    const provider = await prisma.provider.findUnique({ where: { id: params.id } });
    if (!provider) throw new Error("NOT_FOUND");
    const data: Record<string, unknown> = {};
    if (b.config !== undefined) {
      if (typeof b.config !== "object" || b.config === null) throw new Error("VALIDATION_CONFIG");
      data.config = JSON.stringify(b.config);
    }
    if (b.status !== undefined) {
      if (!["ACTIVE", "DISABLED", "MAINTENANCE"].includes(String(b.status))) throw new Error("VALIDATION_STATUS");
      data.status = String(b.status);
    }
    if (b.priority !== undefined) data.priority = Number(b.priority);
    if (b.name !== undefined) data.name = String(b.name).slice(0, 120);
    const updated = await prisma.provider.update({ where: { id: params.id }, data });
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "PROVIDER_CONFIG_UPDATED", entityType: "PROVIDER", entityId: params.id, result: "SUCCESS", summary: `Cập nhật cấu hình provider ${provider.code}: ${Object.keys(data).join(", ")}` });
    return ok(serialize({ provider: updated }));
  } catch (e) { return fail(e); }
}
