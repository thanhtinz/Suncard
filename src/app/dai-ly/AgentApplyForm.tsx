"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const labelCls = "block text-sm font-bold text-navy mb-1.5";
const inputCls = "input w-full !py-2.5";

export default function AgentApplyForm({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: defaultName, phone: "", email: defaultEmail, region: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/account/agent-applications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (j.ok) {
      setMsg({ ok: true, text: "Đã gửi đăng ký. Admin sẽ xét duyệt — khi được duyệt, tài khoản của bạn trở thành đại lý và mở được Cổng đại lý." });
      router.refresh();
    } else setMsg({ ok: false, text: j.message ?? "Không gửi được đăng ký." });
  }

  return (
    <form onSubmit={submit} className="card !rounded-[22px] p-5 sm:p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="dl-name">Họ và tên *</label>
          <input id="dl-name" className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nguyễn Văn A" required />
        </div>
        <div>
          <label className={labelCls} htmlFor="dl-phone">Số điện thoại *</label>
          <input id="dl-phone" className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xx xxx xxx" inputMode="tel" required />
        </div>
        <div>
          <label className={labelCls} htmlFor="dl-email">Email *</label>
          <input id="dl-email" type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@cuaban.vn" required />
        </div>
        <div>
          <label className={labelCls} htmlFor="dl-region">Khu vực kinh doanh</label>
          <input id="dl-region" className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="VD: TP. Hồ Chí Minh" />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="dl-note">Giới thiệu / nhu cầu hợp tác</label>
        <textarea id="dl-note" className={`${inputCls} min-h-[84px]`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Kênh bán hiện tại, sản lượng dự kiến, mặt hàng quan tâm…" maxLength={500} />
      </div>
      {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
      <button className="btn-primary !px-6" disabled={busy}>{busy ? "Đang gửi…" : "Gửi đăng ký làm đại lý"}</button>
    </form>
  );
}
