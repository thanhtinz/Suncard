import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, verifyStepUp, ApiError } from "@/modules/security";
import { revealCard } from "@/modules/cards";
import { prisma } from "@/lib/prisma";
import type { DB } from "@/modules/ledger";

// Reveal PIN: bắt buộc step-up (nhập lại mật khẩu) + audit mọi lần.
export async function POST(req: Request, { params }: { params: { deliveryId: string } }) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    const stepUp = await verifyStepUp(s.userId, b.password, b.totpCode);
    if (!stepUp) throw new ApiError("STEP_UP_REQUIRED", 403, "Cần xác thực lại bằng mật khẩu");
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const result = await revealCard(prisma as unknown as DB, { deliveryId: params.deliveryId, userId: s.userId, stepUpVerified: true, ip });
    return ok(serialize(result));
  } catch (e) { return fail(e); }
}
