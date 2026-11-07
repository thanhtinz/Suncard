import { withPartner, partnerOk } from "@/lib/partner";
import { createDepositIntent, mockPaySignature } from "@/modules/payments";
export async function POST(req: Request) {
  return withPartner(req, async ({ userId, body }) => {
    const intent = await createDepositIntent(userId!, BigInt(body.amount_minor ?? "0"), body.method ?? "MOCKPAY");
    return partnerOk({ intent: { id: intent.id, amount_minor: intent.amountMinor.toString(), currency: "VND", status: intent.status, expires_at: intent.expiresAt }, mock_callback_signature: mockPaySignature(intent.id, "PAID") }, 201);
  });
}
