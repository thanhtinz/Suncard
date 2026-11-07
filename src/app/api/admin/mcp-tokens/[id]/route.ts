import { prisma } from "@/lib/prisma";
import { ok, fail, serialize } from "@/lib/api";
import { requireAuth, requirePermission, ApiError } from "@/modules/security";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Thu hồi token MCP của chính admin đang đăng nhập (set revokedAt — token
// thu hồi không xoá khỏi DB để giữ dấu vết kiểm toán).
// LƯU Ý: delegate McpAccessToken qua cast any vì client local chưa generate lại.
const mcpTokens = () => (prisma as unknown as { mcpAccessToken: any }).mcpAccessToken;

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "settings.update");
    const row = await mcpTokens().findFirst({ where: { id: params.id, userId: s.userId } });
    if (!row) throw new ApiError("NOT_FOUND", 404, "Không tìm thấy token");
    if (!row.revokedAt) {
      await mcpTokens().update({ where: { id: row.id }, data: { revokedAt: new Date() } });
      await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "MCP_TOKEN_REVOKED", entityType: "MCP", entityId: row.id, result: "SUCCESS", summary: `Thu hồi token MCP "${row.name}"` });
    }
    return ok(serialize({ revoked: true, id: row.id }));
  } catch (e) { return fail(e); }
}
