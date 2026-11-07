import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
import { submitExchange } from "@/modules/orders-service";
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    if (!b.idempotencyKey) throw new Error("VALIDATION_IDEMPOTENCY_KEY_REQUIRED");
    const { order, duplicated } = await submitExchange({
      userId: s.userId, carrier: b.carrier, serial: b.serial, pin: b.pin,
      faceValueMinor: BigInt(b.faceValueMinor), idempotencyKey: b.idempotencyKey,
    });
    return ok(serialize({ order, duplicated }), duplicated ? 200 : 201);
  } catch (e) { return fail(e); }
}
export async function GET() {
  try {
    const s = await requireAuth();
    const orders = await prisma.order.findMany({ where: { userId: s.userId, type: "EXCHANGE" }, orderBy: { createdAt: "desc" }, take: 50 });
    return ok(serialize({ orders }));
  } catch (e) { return fail(e); }
}
