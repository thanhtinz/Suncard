"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, StatusBadge } from "@/components/ui";

export type McpTokenRow = { id: string; name: string; scopes: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string; status: string };

const MCP_URL = "https://suncard-eight.vercel.app/api/mcp";

function claudeConfig(token: string): string {
  return JSON.stringify({
    mcpServers: {
      "suncard-admin": {
        command: "npx",
        args: ["-y", "mcp-remote", MCP_URL, "--header", `Authorization: Bearer ${token}`],
      },
    },
  }, null, 2);
}

export default function AiAgentForm({ tokens }: { tokens: McpTokenRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState("");

  async function copy(text: string, tag: string) {
    try { await navigator.clipboard.writeText(text); setCopied(tag); setTimeout(() => setCopied(""), 2000); } catch { setMsg("Không sao chép tự động được — hãy bôi đen và sao chép thủ công"); }
  }

  async function create() {
    setBusy(true); setMsg(""); setFresh(null);
    try {
      const r = await fetch("/api/admin/mcp-tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Tạo token thất bại");
      setFresh({ token: d.data.token, name: d.data.name });
      setName("");
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Tạo token thất bại"); }
    setBusy(false);
  }

  async function revoke(id: string, tokenName: string) {
    if (!window.confirm(`Thu hồi token "${tokenName}"? AI Agent đang dùng token này sẽ mất kết nối ngay.`)) return;
    const r = await fetch(`/api/admin/mcp-tokens/${id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d?.error?.message ?? "Thu hồi thất bại"); return; }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-robot text-sundeep" aria-hidden="true" />
          <h2 className="font-bold text-navy">Tạo token kết nối</h2>
        </div>
        <div>
          <label className="label">Tên gợi nhớ</label>
          <div className="flex gap-2">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="vd Claude trên máy của tôi" maxLength={100} />
            <button className="btn-primary whitespace-nowrap" disabled={busy || !name.trim()} onClick={create}>Tạo token</button>
          </div>
          {msg && <p className="text-danger text-sm mt-2">{msg}</p>}
        </div>

        {fresh && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-3">
            <div className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              Token chỉ hiển thị 1 lần này — sao chép và lưu nơi an toàn ngay.
            </div>
            <div className="flex items-center gap-2">
              <code className="break-all font-mono text-sm bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 grow">{fresh.token}</code>
              <button type="button" className="btn-ghost border border-amber-300 whitespace-nowrap" onClick={() => copy(fresh.token, "token")}>
                <i className={`fa-solid ${copied === "token" ? "fa-check" : "fa-copy"}`} aria-hidden="true" /> {copied === "token" ? "Đã chép" : "Sao chép"}
              </button>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Cấu hình mẫu cho Claude Desktop (dán vào claude_desktop_config.json):</div>
              <pre className="text-xs font-mono bg-white border border-amber-200 rounded-lg p-3 overflow-x-auto whitespace-pre">{claudeConfig(fresh.token)}</pre>
              <button type="button" className="btn-ghost border border-amber-300 mt-2" onClick={() => copy(claudeConfig(fresh.token), "cfg")}>
                <i className={`fa-solid ${copied === "cfg" ? "fa-check" : "fa-copy"}`} aria-hidden="true" /> {copied === "cfg" ? "Đã chép cấu hình" : "Sao chép cấu hình"}
              </button>
              <p className="text-xs text-slate-500 mt-2">Cách nối: thêm cấu hình trên vào Claude Desktop (hoặc client MCP khác qua mcp-remote), khởi động lại app — agent đăng nhập bằng token này, không cần mật khẩu. ChatGPT và các client hỗ trợ MCP từ xa có thể trỏ thẳng tới <span className="font-mono">{MCP_URL}</span> với header Authorization tương tự.</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-bold text-navy mb-3">Token đã cấp</h2>
        <DataTable cols={["Tên token", "Quyền", "Lần dùng cuối", "Ngày cấp", "Trạng thái", "Thao tác"]} rows={tokens.map((t) => [
          t.name,
          t.scopes,
          t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString("vi-VN") : "Chưa dùng",
          new Date(t.createdAt).toLocaleString("vi-VN"),
          <StatusBadge key="s" status={t.status} />,
          t.revokedAt
            ? <span key="x" className="text-slate-400 text-sm">Đã thu hồi</span>
            : <button key="r" className="btn-ghost !px-3 !py-1.5 text-red-600 border border-red-200" onClick={() => revoke(t.id, t.name)}><i className="fa-solid fa-ban" aria-hidden="true" /> Thu hồi</button>,
        ])} />
      </div>
    </div>
  );
}
