import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
import { createVnpayDeposit } from "@/modules/vnpay";

// Tạo URL thanh toán VNPay cho nạp ví (cần đăng nhập). Trả về URL để client chuyển hướng.
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    const amount = BigInt(String(b.amountMinor ?? "0"));
    const origin = new URL(req.url).origin;
    const { intent, deposit, url } = await createVnpayDeposit(s.userId, amount, `${origin}/api/payments/vnpay/return`);
    return ok(serialize({ intent_id: intent.id, deposit_id: deposit.id, payment_url: url }), 201);
  } catch (e) { return fail(e); }
}
