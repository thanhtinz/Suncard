import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, verifyStepUp, ApiError } from "@/modules/security";
import { revealCard } from "@/modules/cards";
import { prisma } from "@/lib/prisma";
import type { DB } from "@/modules/ledger";

// Reveal PIN: bắt buộc step-up + audit mọi lần. Step-up chấp nhận 1 trong 3:
// mật khẩu, hoặc mật khẩu + TOTP, hoặc PASSKEY (assertion đã xác thực ở server,
// challenge mục đích STEPUP dùng đúng 1 lần — Phase 4).
export async function POST(req: Request, { params }: { params: { deliveryId: string } }) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    let stepUp = await verifyStepUp(s.userId, b.password, b.totpCode);
    if (!stepUp && b.passkeyResponse) {
      const { verifyPasskeyAssertion } = await import("@/modules/webauthn");
      await verifyPasskeyAssertion(s.userId, b.passkeyResponse, "STEPUP", req).then(() => { stepUp = true; }).catch(() => { stepUp = false; });
    }
    if (!stepUp) throw new ApiError("STEP_UP_REQUIRED", 403, "Cần xác thực lại bằng mật khẩu hoặc passkey");
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const result = await revealCard(prisma as unknown as DB, { deliveryId: params.deliveryId, userId: s.userId, stepUpVerified: true, ip });
    return ok(serialize(result));
  } catch (e) { return fail(e); }
}
