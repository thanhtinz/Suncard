import { ok, fail, readJson } from "@/lib/api";
import { requireAuth } from "@/modules/security";
import { mockPaySignature } from "@/modules/payments";
// Tiện ích sandbox cho demo: lấy chữ ký callback MockPay của intent thuộc user (chỉ môi trường demo).
export async function POST(req: Request) {
  try {
    await requireAuth();
    const b = await readJson(req);
    return ok({ signature: mockPaySignature(b.intentId, b.status ?? "PAID") });
  } catch (e) { return fail(e); }
}
