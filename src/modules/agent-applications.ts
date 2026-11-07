import { prisma } from "@/lib/prisma";
import type { DB } from "./ledger";
import { createAgent } from "./agents";
import { logAudit, notifyUser } from "./audit";
import { notifyAdmins } from "./ops";

// ============================================================================
// Đăng ký làm đại lý: người dùng nộp form ở trang /dai-ly -> PENDING
// -> Admin duyệt (chọn cấp) -> tạo Agent + vai trò AGENT -> vào được cổng đại lý.
// ============================================================================

export async function applyForAgent(userId: string, input: { fullName: string; phone: string; email: string; region?: string; note?: string }) {
  const fullName = (input.fullName ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const email = (input.email ?? "").trim();
  if (fullName.length < 3) throw new Error("FULLNAME_REQUIRED");
  if (!/^[0-9+\s.()-]{8,16}$/.test(phone)) throw new Error("PHONE_INVALID");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("EMAIL_INVALID");
  const existingAgent = await prisma.agent.findUnique({ where: { userId } });
  if (existingAgent) throw new Error("ALREADY_AGENT");
  const pending = await prisma.agentApplication.findFirst({ where: { userId, status: "PENDING" } });
  if (pending) throw new Error("ALREADY_PENDING");
  const app = await prisma.agentApplication.create({
    data: {
      userId, fullName: fullName.slice(0, 80), phone: phone.slice(0, 20), email: email.slice(0, 120),
      region: input.region?.trim().slice(0, 120) || null, note: input.note?.trim().slice(0, 500) || null,
    },
  });
  await notifyAdmins(prisma as unknown as DB, {
    type: "AGENT_APPLICATION_PENDING", title: "Đăng ký đại lý chờ duyệt",
    body: `${fullName} · ${phone} · ${email}`,
    resourceType: "AGENT_APPLICATION", resourceId: app.id,
  }).catch(() => undefined);
  await logAudit(prisma as unknown as DB, {
    actorId: userId, action: "AGENT_APPLY", entityType: "AGENT_APPLICATION", entityId: app.id,
    summary: `Đăng ký làm đại lý: ${fullName} (${phone})`,
  }).catch(() => undefined);
  return app;
}

async function genAgentCode(): Promise<string> {
  const count = await prisma.agent.count();
  for (let i = 0; i < 10; i++) {
    const code = `DL${String(count + 1 + i).padStart(4, "0")}`;
    const exists = await prisma.agent.findUnique({ where: { code } });
    if (!exists) return code;
  }
  return `DL${Date.now().toString().slice(-6)}`;
}

export async function approveAgentApplication(adminId: string, appId: string, levelId?: string, note?: string) {
  const app = await prisma.agentApplication.findUnique({ where: { id: appId } });
  if (!app) throw new Error("NOT_FOUND");
  if (app.status !== "PENDING") throw new Error("NOT_PENDING");
  const existingAgent = await prisma.agent.findUnique({ where: { userId: app.userId } });
  if (existingAgent) throw new Error("ALREADY_AGENT");
  let level = levelId ? await prisma.agentLevel.findUnique({ where: { id: levelId } }) : null;
  if (!level) level = await prisma.agentLevel.findFirst({ where: { isActive: true }, orderBy: { rank: "asc" } });
  if (!level) throw new Error("NO_LEVEL");
  const agent = await createAgent(prisma as unknown as DB, {
    userId: app.userId, levelId: level.id, code: await genAgentCode(), actorId: adminId,
  });
  const agentRole = await prisma.role.findUnique({ where: { code: "AGENT" } }).catch(() => null);
  if (agentRole) {
    await prisma.userRole.create({ data: { userId: app.userId, roleId: agentRole.id } }).catch(() => undefined);
  }
  await prisma.agentApplication.update({
    where: { id: app.id },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: adminId, reviewNote: note?.trim() || null },
  });
  await notifyUser(prisma as unknown as DB, {
    userId: app.userId, type: "AGENT_APPLICATION_APPROVED", title: "Đăng ký đại lý đã được duyệt",
    body: `Bạn đã trở thành đại lý ${agent.code} (cấp ${level.name}). Vào Cổng đại lý để xem bảng giá và mạng lưới.`,
    resourceType: "AGENT", resourceId: agent.id,
  }).catch(() => undefined);
  await logAudit(prisma as unknown as DB, {
    actorId: adminId, action: "AGENT_APPLICATION_APPROVE", entityType: "AGENT_APPLICATION", entityId: app.id,
    summary: `Duyệt đăng ký đại lý -> tạo ${agent.code} cấp ${level.name}`,
  }).catch(() => undefined);
  return agent;
}

export async function rejectAgentApplication(adminId: string, appId: string, note?: string) {
  const app = await prisma.agentApplication.findUnique({ where: { id: appId } });
  if (!app) throw new Error("NOT_FOUND");
  if (app.status !== "PENDING") throw new Error("NOT_PENDING");
  await prisma.agentApplication.update({
    where: { id: app.id },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: adminId, reviewNote: note?.trim() || null },
  });
  await notifyUser(prisma as unknown as DB, {
    userId: app.userId, type: "AGENT_APPLICATION_REJECTED", title: "Đăng ký đại lý chưa được duyệt",
    body: note?.trim() ? `Lý do: ${note.trim()}` : "Vui lòng bổ sung thông tin và đăng ký lại.",
    resourceType: "AGENT_APPLICATION", resourceId: app.id,
  }).catch(() => undefined);
  await logAudit(prisma as unknown as DB, {
    actorId: adminId, action: "AGENT_APPLICATION_REJECT", entityType: "AGENT_APPLICATION", entityId: app.id,
    summary: `Từ chối đăng ký đại lý${note ? `: ${note}` : ""}`,
  }).catch(() => undefined);
  return app;
}
