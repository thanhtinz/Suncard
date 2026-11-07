import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
import { startPasskeyRegistration, finishPasskeyRegistration, listPasskeys, deletePasskey, startPasskeyStepup } from "@/modules/webauthn";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Quản lý passkey của tài khoản hiện tại: options -> verify -> list -> xoá.
// (Dynamic import ở verify tránh nạp simplewebauthn khi chỉ list.)
export async function GET() {
  try {
    const s = await requireAuth();
    return ok(serialize({ passkeys: await listPasskeys(s.userId) }));
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    const user = await prisma.user.findUnique({ where: { id: s.userId } });
    if (!user) throw new Error("AUTH_INVALID");
    if (b.action === "register-options") {
      return ok(serialize(await startPasskeyRegistration(user, req)));
    }
    if (b.action === "register-verify") {
      const cred = await finishPasskeyRegistration(user, b.response, req, b.deviceName);
      await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "PASSKEY_REGISTERED", entityType: "USER", entityId: s.userId, result: "SUCCESS", summary: `Đăng ký passkey ${cred.deviceName}` });
      return ok(serialize({ id: cred.id, device_name: cred.deviceName }), 201);
    }
    if (b.action === "stepup-options") {
      // Options cho step-up (Secure Reveal): assertion dùng 1 lần, challenge mục đích STEPUP.
      return ok(serialize(await startPasskeyStepup(s.userId, req)));
    }
    if (b.action === "delete") {
      const cred = await deletePasskey(s.userId, String(b.id ?? ""));
      await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "PASSKEY_DELETED", entityType: "USER", entityId: s.userId, result: "SUCCESS", summary: `Xoá passkey ${cred.deviceName}` });
      return ok({ deleted: true });
    }
    throw new Error("VALIDATION_ACTION");
  } catch (e) { return fail(e); }
}
