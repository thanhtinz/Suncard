import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withPartner(req, async ({ userId }) => {
    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order || order.userId !== userId || order.type !== "EXCHANGE") throw new ApiError("ORDER_NOT_FOUND", 404);
    const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: order.id } });
    return partnerOk({ submission: { id: order.id, status: order.status, carrier: ex?.carrier, declared_value_minor: ex?.declaredValueMinor.toString(), accepted_value_minor: ex?.acceptedValueMinor?.toString(), payout_minor: ex?.payoutMinor?.toString(), fee_bps: ex?.feeBps, penalty_minor: ex?.penaltyMinor.toString(), wrong_value: ex?.wrongValue } });
  });
}
