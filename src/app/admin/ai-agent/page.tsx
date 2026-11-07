import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable } from "@/components/ui";
import { getSession } from "@/modules/security";
import AiAgentForm, { type McpTokenRow } from "./form";

export const dynamic = "force-dynamic";

// Kết nối AI Agent qua chuẩn MCP (Model Context Protocol): quản trị viên cấp
// token cá nhân, thêm SunCard vào Claude/ChatGPT... rồi ra lệnh bằng lời.
// LƯU Ý: delegate McpAccessToken qua cast any vì client local chưa generate lại
// (bảng mcp_access_tokens được tạo khi deploy chạy prisma db push).
const mcpTokens = () => (prisma as unknown as { mcpAccessToken: any }).mcpAccessToken;

export default async function AdminAiAgentPage() {
  const s = await getSession().catch(() => null);
  const rows: any[] = s ? await mcpTokens().findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" } }).catch(() => []) : [];
  const tokens: McpTokenRow[] = rows.map((t) => ({
    id: t.id, name: t.name, scopes: t.scopes,
    lastUsedAt: t.lastUsedAt ? new Date(t.lastUsedAt).toISOString() : null,
    revokedAt: t.revokedAt ? new Date(t.revokedAt).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    status: t.revokedAt ? "REVOKED" : "ACTIVE",
  }));
  const recentCalls = await prisma.auditLog.findMany({ where: { action: "MCP_TOOL_CALL" }, orderBy: { createdAt: "desc" }, take: 10 }).catch(() => []);
  const actors = recentCalls.length ? await prisma.user.findMany({ where: { id: { in: [...new Set(recentCalls.map((a) => a.actorId).filter(Boolean) as string[])] } } }) : [];
  const actorMap = new Map(actors.map((u) => [u.id, u.email]));

  return (
    <div>
      <PageTitle title="Kết nối AI Agent" sub="Cấp token MCP để quản trị bằng lời nói qua Claude, ChatGPT và các AI Agent hỗ trợ MCP" />

      <div className="card p-5 mb-5 max-w-2xl text-sm text-slate-600 space-y-2">
        <p><b className="text-navy">Cách hoạt động:</b> tạo 1 token ở đây, thêm SunCard vào app AI của bạn bằng token đó (đăng nhập một lần, không dùng mật khẩu). Sau đó ra lệnh bằng lời — ví dụ: <i>“Doanh thu hôm nay thế nào? Có bao nhiêu yêu cầu rút tiền đang chờ duyệt?”</i></p>
        <p><b className="text-navy">Quyền hạn:</b> agent chỉ làm được trong đúng vai trò của tài khoản đã cấp token, và <b>mọi lần gọi công cụ đều ghi vào nhật ký kiểm toán</b> (bảng bên dưới). Thu hồi token là ngắt kết nối ngay lập tức.</p>
        <p className="flex gap-2"><i className="fa-solid fa-circle-info text-sundeep mt-0.5" aria-hidden="true" /><span><b>Phạm vi bản hiện tại:</b> token cấp quyền <b>ĐỌC</b> số liệu qua MCP (tổng quan doanh thu/lãi, việc cần xử lý, danh sách rút tiền chờ, đơn đổi thẻ). Các thao tác ghi (duyệt tiền, sửa cấu hình...) sẽ được mở theo từng công cụ được duyệt riêng — chưa bật ở bản này.</span></p>
      </div>

      <AiAgentForm tokens={tokens} />

      <h2 className="font-bold text-navy mt-8 mb-3">Nhật ký gọi công cụ gần nhất</h2>
      <DataTable cols={["Thời gian", "Tài khoản cấp token", "Nội dung", "Kết quả"]} rows={recentCalls.map((a) => [
        a.createdAt.toLocaleString("vi-VN"),
        a.actorId ? (actorMap.get(a.actorId) ?? a.actorId) : "—",
        a.summary ?? a.action,
        a.result ?? "—",
      ])} />
    </div>
  );
}
