"use client";
import { useState } from "react";

export interface VariantOpt { id: string; name: string; face: string; price: string }
export interface NamedOpt { code: string; name: string }
const fmt = (s: string) => Number(s).toLocaleString("vi-VN") + " ₫";

export default function TopupForm({ variants, regions, servers, loggedIn }: { variants: VariantOpt[]; regions: NamedOpt[]; servers: NamedOpt[]; loggedIn: boolean }) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [playerId, setPlayerId] = useState("");
  const [regionCode, setRegionCode] = useState(regions[0]?.code ?? "");
  const [serverCode, setServerCode] = useState(servers[0]?.code ?? "");
  const [paymentMethod, setPaymentMethod] = useState("WALLET");
  const [nickname, setNickname] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = variants.find((v) => v.id === variantId);

  async function validate() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/topup/validate?variantId=${encodeURIComponent(variantId)}&playerId=${encodeURIComponent(playerId)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Không kiểm tra được tài khoản");
      setNickname(d.playerName ?? d.nickname ?? d.data?.playerName ?? "Tài khoản hợp lệ");
    } catch (e) { setNickname(null); setMsg(e instanceof Error ? e.message : "Lỗi kiểm tra"); }
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedIn) { setMsg("Vui lòng đăng nhập để đặt đơn."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/orders/topup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, playerId, regionCode: regionCode || undefined, serverCode: serverCode || undefined, idempotencyKey: crypto.randomUUID(), paymentMethod }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Đặt đơn thất bại");
      setMsg(`Đặt đơn thành công. Mã đơn: ${d.code ?? d.data?.code ?? d.id ?? ""}`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Đặt đơn thất bại"); }
    setBusy(false);
  }

  if (variants.length === 0) return <div className="card p-8 text-center text-slate-500">Game này chưa có gói nạp</div>;
  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <div>
        <label className="label">ID người chơi (UID)</label>
        <input className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)} required placeholder="Nhập UID tài khoản game" />
      </div>
      {regions.length > 0 && (
        <div><label className="label">Khu vực</label>
          <select className="input" value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>{regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</select></div>
      )}
      {servers.length > 0 && (
        <div><label className="label">Máy chủ</label>
          <select className="input" value={serverCode} onChange={(e) => setServerCode(e.target.value)}>{servers.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
      )}
      <div>
        <label className="label">Gói nạp</label>
        <div className="grid grid-cols-2 gap-2">
          {variants.map((v) => (
            <button type="button" key={v.id} onClick={() => setVariantId(v.id)} className={`rounded-lg border px-3 py-2 text-left text-sm ${v.id === variantId ? "border-primary bg-blue-50" : "border-slate-200 bg-white"}`}>
              <div className="font-medium">{v.name}</div><div className="text-slate-500">{fmt(v.price)}</div>
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn-ghost w-full" disabled={busy || !playerId} onClick={validate}>Kiểm tra tài khoản</button>
      {nickname && <div className="rounded-lg bg-green-50 text-green-700 px-3 py-2 text-sm">Tên nhân vật: <b>{nickname}</b></div>}
      {selected && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm space-y-1">
          <div className="flex justify-between"><span>Mệnh giá</span><span>{fmt(selected.face)}</span></div>
          <div className="flex justify-between"><span>Giá thanh toán</span><span className="font-semibold text-primary">{fmt(selected.price)}</span></div>
        </div>
      )}
      <div><label className="label">Phương thức thanh toán</label>
        <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="WALLET">Số dư ví</option><option value="CREDIT">Công nợ đại lý</option>
        </select></div>
      {!loggedIn && <div className="rounded-lg bg-amber-50 text-amber-700 px-3 py-2 text-sm">Bạn chưa đăng nhập. <a className="underline font-medium" href="/dang-nhap">Đăng nhập</a> để đặt đơn.</div>}
      {msg && <div className="rounded-lg bg-blue-50 text-blue-700 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn-primary w-full" disabled={busy || !playerId}>Xác nhận nạp</button>
    </form>
  );
}
