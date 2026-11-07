import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, ApiError } from "@/modules/security";
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id } });
    const isStaff = s.roles.some((r) => ["SUPER_ADMIN", "ADMIN", "SUPPORT", "OPS"].includes(r));
    if (!ticket || (ticket.userId !== s.userId && !isStaff)) throw new ApiError("NOT_FOUND", 404, "Không thấy ticket");
    const msg = await prisma.ticketMessage.create({ data: { ticketId: ticket.id, senderId: s.userId, senderType: isStaff && ticket.userId !== s.userId ? "STAFF" : "CUSTOMER", body: b.body } });
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: isStaff ? "IN_PROGRESS" : "WAITING", updatedAt: new Date() } });
    return ok(serialize({ message: msg }), 201);
  } catch (e) { return fail(e); }
}
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id } });
    const isStaff = s.roles.some((r) => ["SUPER_ADMIN", "ADMIN", "SUPPORT", "OPS"].includes(r));
    if (!ticket || (ticket.userId !== s.userId && !isStaff)) throw new ApiError("NOT_FOUND", 404, "Không thấy ticket");
    const messages = await prisma.ticketMessage.findMany({ where: { ticketId: ticket.id, internal: false }, orderBy: { createdAt: "asc" } });
    return ok(serialize({ ticket, messages }));
  } catch (e) { return fail(e); }
}
