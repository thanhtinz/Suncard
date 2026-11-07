import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    if (!b.subject || !b.body) throw new Error("VALIDATION_TICKET_FIELDS");
    const ticket = await prisma.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({ data: { userId: s.userId, subject: b.subject, category: b.category ?? "GENERAL", orderId: b.orderId, priority: b.priority ?? "NORMAL" } });
      await tx.ticketMessage.create({ data: { ticketId: t.id, senderId: s.userId, senderType: "CUSTOMER", body: b.body } });
      return t;
    });
    return ok(serialize({ ticket }), 201);
  } catch (e) { return fail(e); }
}
export async function GET() {
  try {
    const s = await requireAuth();
    const tickets = await prisma.supportTicket.findMany({ where: { userId: s.userId }, orderBy: { updatedAt: "desc" }, take: 50 });
    return ok(serialize({ tickets }));
  } catch (e) { return fail(e); }
}
