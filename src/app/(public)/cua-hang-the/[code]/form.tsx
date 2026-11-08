"use client";
import { useState } from "react";
export interface VariantOpt { id: string; name: string; price: string; stock: number }
const fmt = (s: string) => Number(s).toLocaleString("vi-VN") + " ₫";
export default function BuyCardForm({ variants, loggedIn }: { variants: VariantOpt[]; loggedIn: boolean }) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = variants.find((v) => v.id === variantId);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedIn) { setMsg("Vui lòng đăng nhập để mua thẻ."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/orders/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, qty, idempotencyKey: crypto.randomUUID() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Mua thẻ thất bại");
      setMsg(`Mua thành công. Mã đơn: ${d.code ?? d.data?.code ?? d.id ?? ""}. Xem mã tại mục Thẻ đã mua.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Mua thẻ thất bại"); }
    setBusy(false);
  }
  if (variants.length === 0) return <div className="card p-8 text-center text-slate-500">Sản phẩm chưa có mệnh giá</div>;
  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <div><label className="label">Mệnh giá</label>
        <div className="grid grid-cols-2 gap-2">
          {variants.map((v) => (
            <button type="button" key={v.id} disabled={v.stock === 0} onClick={() => setVariantId(v.id)} className={`rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50 ${v.id === variantId ? "border-primary bg-blue-50" : "border-slate-200"}`}>
              <div className="font-medium">{v.name}</div><div className="text-slate-500">{fmt(v.price)} · còn {v.stock}</div>
            </button>
          ))}
        </div></div>
      <div><label className="label">Số lượng</label>
        <input type="number" min={1} max={50} className="input" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} /></div>
      {selected && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm flex justify-between"><span>Tổng thanh toán</span><span className="font-semibold text-primary">{(Number(selected.price) * qty).toLocaleString("vi-VN")} ₫</span></div>}
      {!loggedIn && <div className="rounded-lg bg-amber-50 text-amber-700 px-3 py-2 text-sm">Bạn chưa đăng nhập. <a className="underline font-medium" href="/dang-nhap">Đăng nhập</a> để mua thẻ.</div>}
      {msg && <div className="rounded-lg bg-blue-50 text-blue-700 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn-primary w-full" disabled={busy || (selected?.stock ?? 0) === 0}>Mua ngay</button>
    </form>
  );
}
