import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256Hex } from "@/lib/crypto";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// MCP server (Model Context Protocol) qua HTTP cho AI Agent: Claude/ChatGPT...
// kết nối bằng token cá nhân của quản trị viên (Authorization: Bearer sc_mcp_...).
// Quyền của agent = quyền của tài khoản cấp token; bản này CHỈ có tool ĐỌC dữ
// liệu — không có tool ghi/duyệt tiền. MỌI lần gọi tool đều ghi AuditLog
// action MCP_TOOL_CALL để truy vết.
// LƯU Ý: delegate McpAccessToken qua cast any vì client local chưa generate lại.
export const dynamic = "force-dynamic";

const mcpTokens = () => (prisma as unknown as { mcpAccessToken: any }).mcpAccessToken;
const str = (v: bigint | null | undefined): string => (v ?? 0n).toString();
const clampLimit = (v: unknown, def = 20) => { const n = Number(v); return Number.isFinite(n) ? Math.min(50, Math.max(1, Math.floor(n))) : def; };

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}
function rpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });
}

async function authenticate(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const raw = auth.slice(7).trim();
  if (!raw.startsWith("sc_mcp_")) return null;
  const row = await mcpTokens().findUnique({ where: { tokenHash: sha256Hex(raw) } }).catch(() => null);
  if (!row || row.revokedAt) return null;
  return row;
}

// ---------------- Tools (chỉ ĐỌC) ----------------

async function toolDashboardSummary() {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const agg = async (from: Date) => {
    const rows = await prisma.order.groupBy({ by: ["type"], where: { status: "SUCCESS", createdAt: { gte: from } }, _sum: { totalMinor: true, feeMinor: true }, _count: true });
    return rows.map((r) => ({ service: r.type, orders: r._count, revenueMinor: str(r._sum.totalMinor), platformFeeMinor: str(r._sum.feeMinor) }));
  };
  const margin = await prisma.ledgerAccount.findUnique({ where: { code: "PLATFORM:MARGIN" } }).catch(() => null);
  return {
    note: "Doanh thu = tổng totalMinor đơn SUCCESS; lãi phí = tổng feeMinor nền tảng thu trên đơn. Số tiền dạng chuỗi VND (minor).",
    today: await agg(todayStart),
    month: await agg(monthStart),
    platformMarginBalanceMinor: str(margin?.balanceMinor),
  };
}

async function toolPendingTasks() {
  const [withdrawalsPending, unknownOrders, reconciliationOpen, reservedCards, approvalsPending] = await Promise.all([
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "UNKNOWN" } }),
    prisma.reconciliationCase.count({ where: { status: "OPEN" } }),
    prisma.cardInventory.count({ where: { status: "RESERVED" } }),
    prisma.financialApprovalRequest.count({ where: { status: "PENDING" } }),
  ]);
  return { withdrawalsPending, unknownOrders, reconciliationOpen, reservedCards, approvalsPending };
}

async function toolListWithdrawalsPending(args: any) {
  const limit = clampLimit(args?.limit);
  const rows = await prisma.withdrawalRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: limit });
  const users = rows.length ? await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u.email]));
  return rows.map((r) => ({
    id: r.id, customer: userMap.get(r.userId) ?? r.userId,
    amountMinor: str(r.amountMinor), feeMinor: str(r.feeMinor),
    bank: r.bankInfo ?? null, createdAt: r.createdAt.toISOString(),
  }));
}

async function toolListExchangeOrders(args: any) {
  const limit = clampLimit(args?.limit);
  const rows = await prisma.exchangeOrder.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  const orders = rows.length ? await prisma.order.findMany({ where: { id: { in: rows.map((r) => r.orderId) } } }) : [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const users = orders.length ? await prisma.user.findMany({ where: { id: { in: orders.map((o) => o.userId) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u.email]));
  return rows.map((r) => {
    const o = orderMap.get(r.orderId);
    return {
      code: o?.code ?? r.orderId, customer: o ? (userMap.get(o.userId) ?? o.userId) : null,
      carrier: r.carrier, faceValueMinor: str(r.faceValueMinor),
      payoutMinor: r.payoutMinor == null ? null : str(r.payoutMinor),
      wrongValue: r.wrongValue, status: o?.status ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

const TOOLS = [
  { name: "dashboard_summary", description: "Doanh thu và lãi phí hôm nay + tháng này, tách theo dịch vụ (đổi thẻ / bán thẻ / nạp cước-game), kèm số dư biên nền tảng.", inputSchema: { type: "object", properties: {} } },
  { name: "pending_tasks", description: "Số việc cần xử lý: rút tiền chờ duyệt, đơn UNKNOWN đang xác minh, ca đối soát đang mở, thẻ đang giữ cho đơn, yêu cầu duyệt tài chính đang chờ.", inputSchema: { type: "object", properties: {} } },
  { name: "list_withdrawals_pending", description: "Danh sách yêu cầu rút tiền đang chờ duyệt mới nhất.", inputSchema: { type: "object", properties: { limit: { type: "number", description: "Số bản ghi tối đa (1–50, mặc định 20)" } } } },
  { name: "list_exchange_orders", description: "Danh sách đơn đổi thẻ cào mới nhất (nhà mạng, mệnh giá, thực nhận, trạng thái).", inputSchema: { type: "object", properties: { limit: { type: "number", description: "Số bản ghi tối đa (1–50, mặc định 20)" } } } },
];

const TOOL_IMPL: Record<string, (args: any) => Promise<unknown>> = {
  dashboard_summary: toolDashboardSummary,
  pending_tasks: toolPendingTasks,
  list_withdrawals_pending: toolListWithdrawalsPending,
  list_exchange_orders: toolListExchangeOrders,
};

// ---------------- JSON-RPC handler ----------------

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { return rpcError(null, -32700, "Parse error", 400); }
  const { id, method, params } = body ?? {};
  const isNotification = id === undefined || id === null;

  const token = await authenticate(req);
  if (!token) return rpcError(id, -32001, "Unauthorized: cần header Authorization: Bearer <token MCP>", 401);
  await mcpTokens().update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => null);

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "suncard-admin", version: "1.0.0" },
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });
    case "tools/call": {
      const name = String(params?.name ?? "");
      const impl = TOOL_IMPL[name];
      let result: unknown;
      let isError = false;
      if (!String(token.scopes ?? "READ").includes("READ")) {
        result = { message: "Token không có quyền READ" };
        isError = true;
      } else if (!impl) {
        result = { message: `Tool không tồn tại: ${name}` };
        isError = true;
      } else {
        try { result = await impl(params?.arguments ?? {}); }
        catch (e) { result = { message: e instanceof Error ? e.message : "Lỗi thực thi tool" }; isError = true; }
      }
      // Ghi nhật ký MỌI lần gọi tool (kể cả lỗi / tool không tồn tại).
      await logAudit(prisma as unknown as DB, {
        actorId: token.userId, actorType: "AI_AGENT", action: "MCP_TOOL_CALL",
        entityType: "MCP", entityId: token.id, result: isError ? "FAILED" : "SUCCESS",
        summary: `MCP tool: ${name || "(không tên)"} qua token "${token.name}"`,
      }).catch(() => null);
      return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError });
    }
    default:
      if (isNotification) return new NextResponse(null, { status: 204 });
      return rpcError(id, -32601, `Method not found: ${String(method ?? "")}`);
  }
}

export async function GET() {
  return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32601, message: "MCP endpoint chỉ nhận POST (JSON-RPC 2.0) kèm Authorization: Bearer <token>" } }, { status: 405 });
}
