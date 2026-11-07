"use client";
import { useState } from "react";

// Cấu hình provider HTTP (Phase 2): baseUrl/partnerId/signMode + bật/tắt.
// Partner key KHÔNG nhập ở đây dạng lưu trực tiếp — gửi qua luồng duyệt kép
// (PROVIDER_SECRET), được mã hoá AES-GCM ngay khi tạo yêu cầu.
interface ProviderOpt { id: string; code: string; type: string; status: string; config: string | null }

export default function ProviderConfigForm({ providers }: { providers: ProviderOpt[] }) {
  const http = providers.filter((p) => p.code === "HTTP_CHARGING" || p.type === "API");
  const [sel, setSel] = useState(http[0]?.id ?? "");
  const current = http.find((p) => p.id === sel);
  const cfg = (() => { try { return current?.config ? JSON.parse(current.config) : {}; } catch { return {}; } })();
  const [baseUrl, setBaseUrl] = useState(cfg.baseUrl ?? "");
  const [partnerId, setPartnerId] = useState(cfg.partnerId ?? "");
  const [signMode, setSignMode] = useState(cfg.signMode ?? "extended");
  const [partnerKey, setPartnerKey] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function pick(id: string) {
    setSel(id);
    const p = http.find((x) => x.id === id);
    try {
      const c = p?.config ? JSON.parse(p.config) : {};
      setBaseUrl(c.baseUrl ?? ""); setPartnerId(c.partnerId ?? ""); setSignMode(c.signMode ?? "extended");
    } catch { setBaseUrl(""); setPartnerId(""); setSignMode("extended"); }
    setMsg("");
  }

  async function saveConfig() {
    if (!current) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/admin/providers/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: { baseUrl, partnerId, signMode } }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? "Lưu cấu hình thất bại");
      setMsg("Đã lưu cấu hình provider.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi"); }
    setBusy(false);
  }

  async function toggleStatus() {
    if (!current) return;
    setBusy(true); setMsg("");
    try {
      const next = current.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
      const r = await fetch(`/api/admin/providers/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!r.ok) throw new Error("Đổi trạng thái thất bại");
      setMsg(`Đã ${next === "ACTIVE" ? "BẬT" : "TẮT"} provider. Tải lại trang để thấy trạng thái mới.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi"); }
    setBusy(false);
  }

  async function submitKey() {
    if (!current || !partnerKey) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/admin/providers/${current.id}/credentials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "partner_key", secret: partnerKey }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? "Tạo yêu cầu đổi key thất bại");
      setPartnerKey("");
      setMsg("Đã tạo yêu cầu đổi partner key — cần một quản trị khác duyệt ở mục Phê duyệt tài chính mới có hiệu lực.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi"); }
    setBusy(false);
  }

  if (http.length === 0) return null;
  return (
    <div className="card p-5 mt-6 space-y-4">
      <div>
        <div className="font-semibold text-navy">Cấu hình provider gạch thẻ HTTP (chargingws/v2)</div>
        <p className="text-sm text-slate-500 mt-1">SunCard gọi upstream theo chuẩn thị trường: charging/check/getfee, ký MD5. Bật provider và đặt <b>exchange.provider_code = HTTP_CHARGING</b> ở Cài đặt để định tuyến đơn đổi thẻ sang upstream.</p>
      </div>
      <div><label className="label">Provider</label>
        <select className="input" value={sel} onChange={(e) => pick(e.target.value)}>{http.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.status}</option>)}</select></div>
      <div className="grid md:grid-cols-3 gap-3">
        <div><label className="label">Base URL upstream</label><input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.upstream.vn/chargingws/v2" /></div>
        <div><label className="label">Partner ID</label><input className="input" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="Mã đối tác upstream cấp" /></div>
        <div><label className="label">Công thức ký</label>
          <select className="input" value={signMode} onChange={(e) => setSignMode(e.target.value)}>
            <option value="extended">Mở rộng (key + code + serial + card_type + declare…)</option>
            <option value="legacy">Legacy (key + code + serial)</option>
          </select></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={saveConfig} disabled={busy}>Lưu cấu hình</button>
        <button type="button" className="btn-ghost border border-slate-200" onClick={toggleStatus} disabled={busy}>{current?.status === "ACTIVE" ? "Tắt provider" : "Bật provider"}</button>
      </div>
      <div className="border-t border-slate-100 pt-4">
        <label className="label">Partner key mới (mã hoá + duyệt kép)</label>
        <div className="flex gap-2">
          <input className="input" type="password" value={partnerKey} onChange={(e) => setPartnerKey(e.target.value)} placeholder="Nhập partner key do upstream cấp" autoComplete="new-password" />
          <button type="button" className="btn-ghost border border-slate-200 shrink-0" onClick={submitKey} disabled={busy || !partnerKey}>Gửi duyệt key</button>
        </div>
        <p className="text-xs text-slate-500 mt-1">Key được mã hoá AES-256-GCM ngay khi gửi và chỉ áp dụng sau khi một quản trị khác duyệt. Key không bao giờ hiển thị lại.</p>
      </div>
      {msg && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{msg}</div>}
    </div>
  );
}
