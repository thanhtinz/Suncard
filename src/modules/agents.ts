import type { DB } from "./ledger";

// Mạng lưới đại lý: 1 parent trực tiếp, cấm chu trình, closure table cập nhật transactional + audit.
// Cấp đại lý là DỮ LIỆU cấu hình (agent_levels), không hard-code số tầng/tên cấp.

export async function rebuildClosureFor(db: DB, agentId: string) {
  // Xoá các dòng descendant=agentId ở depth>0 rồi dựng lại từ parent chain.
  await db.agentClosure.deleteMany({ where: { descendantId: agentId, depth: { gt: 0 } } });
  await db.agentClosure.upsert({
    where: { ancestorId_descendantId: { ancestorId: agentId, descendantId: agentId } },
    create: { ancestorId: agentId, descendantId: agentId, depth: 0 },
    update: {},
  });
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent?.parentId) return;
  const parentRows = await db.agentClosure.findMany({ where: { descendantId: agent.parentId } });
  for (const row of parentRows) {
    await db.agentClosure.upsert({
      where: { ancestorId_descendantId: { ancestorId: row.ancestorId, descendantId: agentId } },
      create: { ancestorId: row.ancestorId, descendantId: agentId, depth: row.depth + 1 },
      update: { depth: row.depth + 1 },
    });
  }
}

export async function createAgent(
  db: DB,
  params: { userId: string; levelId: string; parentId?: string | null; code: string; actorId?: string }
) {
  if (params.parentId) {
    // Chống chu trình: parent không được là chính agent tương lai / hậu duệ của nó (agent mới nên chỉ cần parent tồn tại).
    const parent = await db.agent.findUnique({ where: { id: params.parentId } });
    if (!parent) throw new Error("PARENT_AGENT_NOT_FOUND");
  }
  const agent = await db.agent.create({
    data: { userId: params.userId, levelId: params.levelId, parentId: params.parentId ?? null, code: params.code },
  });
  await rebuildClosureFor(db, agent.id);
  await db.agentRelationHistory.create({
    data: { agentId: agent.id, oldParentId: null, newParentId: params.parentId ?? null, changedBy: params.actorId, reason: "CREATE" },
  });
  return agent;
}

/** Đổi parent: cấm tạo chu trình (parent mới không được nằm trong nhánh của agent). */
export async function reparentAgent(db: DB, agentId: string, newParentId: string | null, actorId?: string, reason?: string) {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error("AGENT_NOT_FOUND");
  if (newParentId) {
    if (newParentId === agentId) throw new Error("AGENT_CYCLE_DETECTED");
    const inBranch = await db.agentClosure.findFirst({
      where: { ancestorId: agentId, descendantId: newParentId },
    });
    if (inBranch) throw new Error("AGENT_CYCLE_DETECTED");
  }
  const oldParentId = agent.parentId;
  await db.agent.update({ where: { id: agentId }, data: { parentId: newParentId } });
  // Dựng lại closure cho agent và toàn bộ hậu duệ.
  const descendants = await db.agentClosure.findMany({ where: { ancestorId: agentId } });
  for (const d of descendants) await rebuildClosureFor(db, d.descendantId);
  await rebuildClosureFor(db, agentId);
  await db.agentRelationHistory.create({
    data: { agentId, oldParentId, newParentId, changedBy: actorId, reason: reason ?? "REPARENT" },
  });
  return db.agent.findUnique({ where: { id: agentId } });
}

/** Danh sách id agent trong scope: chính agent + mọi hậu duệ (data-scope cho RBAC). */
export async function branchAgentIds(db: DB, agentId: string): Promise<string[]> {
  const rows = await db.agentClosure.findMany({ where: { ancestorId: agentId } });
  return rows.map((r: any) => r.descendantId);
}

export async function isInBranch(db: DB, rootAgentId: string, targetAgentId: string): Promise<boolean> {
  const row = await db.agentClosure.findFirst({ where: { ancestorId: rootAgentId, descendantId: targetAgentId } });
  return !!row;
}

/** Upline chain của một agent: [{agentId, depth}] depth 1 = parent trực tiếp. */
export async function uplineChain(db: DB, agentId: string) {
  const rows = await db.agentClosure.findMany({ where: { descendantId: agentId, depth: { gt: 0 } }, orderBy: { depth: "asc" } });
  return rows.map((r: any) => ({ agentId: r.ancestorId, depth: r.depth }));
}

export async function agentOfUser(db: DB, userId: string) {
  return db.agent.findUnique({ where: { userId } });
}
