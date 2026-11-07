import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk, idempotencyKeyOf } from "@/lib/partner";
import { submitExchange } from "@/modules/orders-service";
export async function POST(req: Request) {
  return withPartner(req, async ({ userId, body, client }) => {
    const key = idempotencyKeyOf(req, body);
    const { order, duplicated } = await submitExchange({
      userId: userId!, carrier: String(body.telco ?? body.carrier ?? "").toUpperCase(),
      serial: body.serial ?? body.seri, pin: body.code ?? body.pin,
      faceValueMinor: BigInt(body.amount_minor ?? body.face_value_minor ?? "0"), idempotencyKey: key,
      feeGroup: client.feeGroup ?? "API",
    });
    const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: order!.id } });
    return partnerOk({ submission: { id: order!.id, status: order!.status, declared_value_minor: ex?.declaredValueMinor.toString(), accepted_value_minor: ex?.acceptedValueMinor?.toString(), payout_minor: ex?.payoutMinor?.toString(), wrong_value: ex?.wrongValue }, duplicated }, 201);
  });
}
