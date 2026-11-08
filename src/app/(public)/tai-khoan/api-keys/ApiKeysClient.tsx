"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_TYPES, apiTypeLabel } from "@/lib/api-types";

export interface ClientRow {
  id: string;
  name: string;
  partnerId: string;
  apiType: string;
  callbackUrl: string | null;
  callbackMethod: string;
  ipAllowlist: string[];
  status: string;
  reviewNote: string | null;
  createdAt: string;
  keyPrefix: string | null;
  keyStatus: string | null;
  lastUsedAt: string | null;
}

const BADGE: Record<string, { cls: string; label: string }> = {
  PENDING: { cls: "bg-amber-100 text-amber-700", label: "Chờ duyệt" },
  ACTIVE: { cls: "bg-green-100 text-green-700", label: "Đang hoạt động" },
  REJECTED: { cls: "bg-red-100 text-red-700", label: "Bị từ chối" },
  SUSPENDED: { cls: "bg-slate-200 text-slate-600", label: "Đã khoá" },
};

const labelCls = "block text-sm font-bold text-navy mb-1.5";
const inputCls = "input w-full !py-2.5";

export default function ApiKeysClient({ clients, balance }: { clients: ClientRow[]; balance: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ apiType: "CHARGING", name: "", callbackMethod: "POST", callbackUrl: "", ipAllowlist: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [revealFor, setRevealFor] = useState<ClientRow | null>(null);
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState<{ partnerId: string; apiKey: string | null; secret: string | null } | null>(null);
  const [revealErr, setRevealErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/account/api-clients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (j.ok) {
      setMsg({ ok: true, text: "Đã gửi đăng ký. Admin sẽ duyệt và cấp Partner ID, API key, partner_key cho bạn — theo dõi trạng thái ở danh sách phía trên." });
      setForm({ apiType: "CHARGING", name: "", callbackMethod: "POST", callbackUrl: "", ipAllowlist: "" });
      router.refresh();
    } else setMsg({ ok: false, text: j.message ?? "Không gửi được đăng ký." });
  }

  async function cancel(id: string) {
    if (!confirm("Huỷ đăng ký kết nối này?")) return;
    await fetch(`/api/account/api-clients?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
    router.refresh();
  }

  async function doReveal(e: React.FormEvent) {
    e.preventDefault();
    if (!revealFor) return;
    setRevealErr("");
    const r = await fetch("/api/account/api-keys/reveal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: revealFor.id, password }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (j.ok) { setRevealed({ partnerId: j.partnerId, apiKey: j.apiKey, secret: j.secret }); setPassword(""); }
    else setRevealErr(j.message ?? "Không mở được thông tin.");
  }

  function copy(text: string) { navigator.clipboard?.writeText(text).catch(() => undefined); }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-bold text-navy mb-3">Danh sách kết nối của bạn</h2>
        {clients.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">Bạn chưa có kết nối API nào. Điền form đăng ký bên dưới — admin duyệt xong hệ thống sẽ cấp Partner ID, API key và partner_key.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead><tr><th>Partner ID</th><th>Loại API</th><th>Thông tin</th><th>Kiểu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {clients.map((c) => {
                  const b = BADGE[c.status] ?? { cls: "bg-blue-100 text-blue-700", label: c.status };
                  return (
                    <tr key={c.id}>
                      <td className="font-semibold text-navy whitespace-nowrap">{c.partnerId}<div className="text-xs font-normal text-slate-400">{c.name}</div></td>
                      <td className="whitespace-nowrap">{apiTypeLabel(c.apiType)}</td>
                      <td className="text-xs leading-5 max-w-[260px]">
                        {c.callbackUrl ? <div className="break-all">Callback: {c.callbackUrl}</div> : <div className="text-slate-400">Chưa có callback</div>}
                        <div className="text-slate-400">IP: {c.ipAllowlist.length ? c.ipAllowlist.join(", ") : "Không giới hạn"}</div>
                        {c.keyPrefix && <div className="text-slate-400">Key: {c.keyPrefix}…{c.lastUsedAt ? ` · dùng ${c.lastUsedAt}` : ""}</div>}
                        {c.status === "REJECTED" && c.reviewNote && <div className="text-red-500">Lý do: {c.reviewNote}</div>}
                      </td>
                      <td>{c.callbackMethod}</td>
                      <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td className="whitespace-nowrap">
                        {c.status === "ACTIVE" && <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => { setRevealFor(c); setRevealed(null); setRevealErr(""); }}>Xem key</button>}
                        {(c.status === "PENDING" || c.status === "REJECTED") && <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => cancel(c.id)}>Huỷ</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-bold text-navy mb-3">Thêm mới — Đăng ký kết nối API</h2>
        <form onSubmit={submit} className="card !rounded-[22px] p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="ak-type">Loại API</label>
              <select id="ak-type" className={inputCls} value={form.apiType} onChange={(e) => setForm({ ...form, apiType: e.target.value })}>
                {API_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ak-name">Tên kết nối (tuỳ chọn)</label>
              <input id="ak-name" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Web bán thẻ của tôi" maxLength={80} />
            </div>
            <div>
              <label className={labelCls} htmlFor="ak-wallet">Chọn ví giao dịch</label>
              <select id="ak-wallet" className={inputCls} value="VND" disabled>
                <option value="VND">Ví VND — {balance}</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Mọi giao dịch API đều trừ và cộng vào ví này.</p>
            </div>
            <div>
              <label className={labelCls} htmlFor="ak-method">Kiểu callback</label>
              <select id="ak-method" className={inputCls} value={form.callbackMethod} onChange={(e) => setForm({ ...form, callbackMethod: e.target.value })}>
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="ak-callback">Đường dẫn nhận dữ liệu (Callback Url)</label>
            <input id="ak-callback" className={inputCls} value={form.callbackUrl} onChange={(e) => setForm({ ...form, callbackUrl: e.target.value })} placeholder="https://website-cua-ban.vn/callback" required={form.apiType === "CHARGING" || form.apiType === "FULL"} />
            <p className="text-xs text-slate-400 mt-1">Hệ thống gửi kết quả giao dịch về địa chỉ này. Bắt buộc với API Đổi thẻ cào và gói Tất cả dịch vụ.</p>
          </div>
          <div>
            <label className={labelCls} htmlFor="ak-ip">Địa chỉ IP (không bắt buộc)</label>
            <input id="ak-ip" className={inputCls} value={form.ipAllowlist} onChange={(e) => setForm({ ...form, ipAllowlist: e.target.value })} placeholder="VD: 113.160.1.20, 42.113.5.9" />
            <p className="text-xs text-slate-400 mt-1">Whitelist IP máy chủ gọi API, cách nhau bằng dấu phẩy. Để trống = không giới hạn IP.</p>
          </div>
          {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
          <button className="btn-primary !px-6" disabled={busy}>{busy ? "Đang gửi…" : "Thêm thông tin kết nối"}</button>
          <p className="text-xs text-slate-400">Đăng ký xong sẽ ở trạng thái <b>Chờ duyệt</b>. Admin duyệt thì hệ thống mới cấp Partner ID, API key và partner_key — bạn không cần là đại lý vẫn đăng ký được.</p>
        </form>
      </section>

      {revealFor && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-3" onClick={() => setRevealFor(null)}>
          <div className="bg-white rounded-[22px] w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-navy">Thông tin kết nối</div>
              <button className="btn-ghost !py-1 !px-2.5 text-xs" onClick={() => setRevealFor(null)}>Đóng</button>
            </div>
            {!revealed ? (
              <form onSubmit={doReveal} className="space-y-3">
                <p className="text-sm text-slate-500">Nhập lại mật khẩu tài khoản để xem API key và partner_key của kết nối <b>{revealFor.partnerId}</b>.</p>
                <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu của bạn" autoFocus />
                {revealErr && <div className="rounded-xl bg-red-50 text-red-600 px-3 py-2 text-sm">{revealErr}</div>}
                <button className="btn-primary w-full">Xem thông tin</button>
              </form>
            ) : (
              <div className="space-y-3 text-sm">
                {[
                  ["Partner ID", revealed.partnerId],
                  ["API key (Partner API /v1)", revealed.apiKey],
                  ["Partner key (ký sign / secret)", revealed.secret],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs font-bold text-[#A08B62] uppercase tracking-wide mb-1">{label}</div>
                    {value ? (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 break-all rounded-xl bg-[#0F1D38] text-[#FFD9A0] px-3 py-2 text-[13px]">{value}</code>
                        <button className="btn-ghost !py-1.5 !px-3 text-xs shrink-0" onClick={() => copy(value)}>Chép</button>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-amber-50 text-amber-700 px-3 py-2">Khoá này được tạo trước khi hệ thống hỗ trợ xem lại. Vui lòng liên hệ hỗ trợ để cấp lại.</div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-slate-400">Giữ bí mật hai khoá này. Partner key dùng để tạo chữ ký sign cho Charging / Recharge / Softcard và ký HMAC cho Partner API /v1.</p>
                <Link href="/tai-lieu/api" className="text-sundeep font-semibold text-sm">Xem tài liệu tích hợp →</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
