import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission, verifyStepUp, ApiError } from "@/modules/security";
import { getSetting, setSetting } from "@/modules/settings";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Emergency Vault Lock (spec 7.4): bật = ngừng MỌI reveal/delivery. Đổi trạng thái cần step-up + audit.
export async function GET() {
  try {
    const locked = await getSetting<boolean>("cards.vault_locked", false);
    return ok({ vault_locked: locked });
  } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "cards.view");
    const b = await readJson(req);
    const stepUp = await verifyStepUp(s.userId, b.password, b.totpCode);
    if (!stepUp) throw new ApiError("STEP_UP_REQUIRED", 403, "Đổi Vault Lock cần xác thực lại (mật khẩu hoặc TOTP)");
    const before = await getSetting<boolean>("cards.vault_locked", false);
    await setSetting("cards.vault_locked", !!b.locked, s.userId);
    await logAudit(prisma as unknown as DB, {
      actorId: s.userId, action: b.locked ? "VAULT_LOCKED" : "VAULT_UNLOCKED", entityType: "CARD_VAULT", result: "SUCCESS",
      reason: b.reason, summary: `Vault Lock: ${before} -> ${!!b.locked}`,
    });
    return ok(serialize({ vault_locked: !!b.locked }));
  } catch (e) { return fail(e); }
}
