import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission, ApiError } from "@/modules/security";
import { sha256Hex } from "@/lib/crypto";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Token truy cập MCP cho AI Agent. CHỈ lưu SHA-256 hash của token — token thô
// (sc_mcp_...) trả đúng 1 lần trong response tạo mới, không bao giờ hiện lại.
// LƯU Ý: model McpAccessToken mới thêm vào schema; client Prisma local chưa
// generate lại nên truy cập delegate qua cast any tại điểm này.
const mcpTokens = () => (prisma as unknown as { mcpAccessToken: any }).mcpAccessToken;

const safe = (t: any) => ({
  id: t.id, name: t.name, scopes: t.scopes,
  lastUsedAt: t.lastUsedAt, revokedAt: t.revokedAt, createdAt: t.createdAt,
  status: t.revokedAt ? "REVOKED" : "ACTIVE",
});

export async function GET() {
  try {
    const s = await requireAuth();
    await requirePermission(s, "settings.update");
    const rows = await mcpTokens().findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" } });
    return ok(serialize({ tokens: rows.map(safe) }));
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "settings.update");
    const b = await readJson(req);
    const name = String(b.name ?? "").trim();
    if (!name || name.length > 100) throw new ApiError("VALIDATION_ERROR", 422, "Cần tên gợi nhớ cho token (tối đa 100 ký tự)");
    // 24 byte ngẫu nhiên -> base64url đúng 32 ký tự.
    const raw = `sc_mcp_${randomBytes(24).toString("base64url")}`;
    const row = await mcpTokens().create({
      data: { userId: s.userId, name, tokenHash: sha256Hex(raw), scopes: "READ" },
    });
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "MCP_TOKEN_CREATED", entityType: "MCP", entityId: row.id, result: "SUCCESS", summary: `Cấp token MCP "${name}" (quyền READ)` });
    // token: token thô — CHỈ trả 1 lần tại đây.
    return ok(serialize({ ...safe(row), token: raw }), 201);
  } catch (e) { return fail(e); }
}
