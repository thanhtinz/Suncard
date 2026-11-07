"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface ShopVariant { id: string; face: string; price: string; stock: number }
export interface ShopProduct { code: string; name: string; caption: string; wm: string; variants: ShopVariant[] }

const fmt = (s: string | number) => Number(s).toLocaleString("vi-VN");
const pct = (face: string, price: string) => {
  const f = Number(face), p = Number(price);
  if (!f || p >= f) return null;
  return ((f - p) / f * 100).toFixed(1);
};

function Wordmark({ wm, size = "lg" }: { wm: string; size?: "lg" | "sm" }) {
  const cls = size === "lg" ? "text-[15px] sm:text-[17px] lg:text-[19px]" : "text-[15px]";
  switch (wm) {
    case "viettel": return <span className={`${cls} font-black italic text-[#EE0033]`}>viettel</span>;
    case "mobifone": return <span className={`${cls} font-black tracking-tight`}><span className="text-[#005BAC]">mobi</span><span className="text-[#EE0033]">fone</span></span>;
    case "vinaphone": return <span className={`${cls} font-black text-[#0090D4]`}>vinaphone</span>;
    case "garena": return <span className={`${cls} font-black text-[#ED1C24]`}>Garena</span>;
    case "zing": return <span className={`${cls} font-black text-[#7AB929]`}>zing</span>;
    default: return <span className={`${cls} font-black text-navy`}>{wm}</span>;
  }
}

function Tick() {
  return (
    <span className="absolute -top-2 -right-1.5 w-[23px] h-[23px] rounded-full bg-grad-sun flex items-center justify-center shadow-sun z-10">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
    </span>
  );
}

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3.5">
      <span className="w-7 h-7 rounded-full bg-grad-sun text-white font-extrabold text-sm flex items-center justify-center shadow-sun shrink-0">{n}</span>
      <h2 className="text-lg font-bold text-navy">{title}</h2>
    </div>
  );
}

export default function CardShop({ products, loggedIn, fxEnabled, showUsd, vndPerUsd }: {
  products: ShopProduct[]; loggedIn: boolean; fxEnabled: boolean; showUsd: boolean; vndPerUsd: number;
}) {
  const router = useRouter();
  const [productCode, setProductCode] = useState(products[0]?.code ?? "");
  const product = useMemo(() => products.find((p) => p.code === productCode) ?? products[0], [products, productCode]);
  const firstAvail = product?.variants.find((v) => v.stock > 0) ?? product?.variants[0];
  const [variantId, setVariantId] = useState(firstAvail?.id ?? "");
  const variant = product?.variants.find((v) => v.id === variantId) ?? firstAvail;
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; code?: string } | null>(null);

  function chooseProduct(code: string) {
    const p = products.find((x) => x.code === code);
    setProductCode(code);
    const fv = p?.variants.find((v) => v.stock > 0) ?? p?.variants[0];
    setVariantId(fv?.id ?? "");
    setQty(1);
    setMsg(null);
  }

  const unit = variant ? Number(variant.price) : 0;
  const total = unit * qty;
  const discount = variant ? pct(variant.face, variant.price) : null;
  const maxQty = variant ? Math.max(1, Math.min(50, variant.stock)) : 1;

  async function buy() {
    if (!variant) return;
    if (!loggedIn) { setMsg({ ok: false, text: "Bạn chưa đăng nhập — đăng nhập để mua thẻ bằng ví." }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/orders/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId: variant.id, qty, idempotencyKey: crypto.randomUUID() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Mua thẻ thất bại");
      const code = d.code ?? d.data?.code ?? d.order?.code ?? d.data?.order?.code ?? "";
      setMsg({ ok: true, text: `Mua thành công ${qty} thẻ ${product?.name} ${fmt(variant.face)}đ.`, code });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Mua thẻ thất bại" }); }
    setBusy(false);
  }

  if (!product || !variant) return <div className="card p-8 text-center text-slate-500">Chưa có sản phẩm thẻ nào đang bán.</div>;

  return (
    <div>
      {fxEnabled && (
        <div className="mb-4 text-sm">
          {showUsd
            ? <span>Đang hiển thị thêm giá quy đổi USD (tỉ giá {vndPerUsd.toLocaleString("vi-VN")} ₫/$ — chỉ để tham khảo, thanh toán vẫn bằng VND). <Link className="text-sundeep font-semibold" href="/cua-hang-the">Tắt quy đổi</Link></span>
            : <Link className="text-sundeep font-semibold" href="/cua-hang-the?usd=1">Xem thêm giá quy đổi sang USD</Link>}
        </div>
      )}
      <div className="bg-white border border-sunline rounded-[30px] shadow-soft overflow-hidden grid lg:grid-cols-[290px_1fr]">
        <aside className="relative px-6 pt-7 pb-24 lg:pb-28 bg-gradient-to-b from-[#FFFDF8] to-[#FFF6E9] border-b lg:border-b-0 lg:border-r border-[#F7E9D2] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/ban-the-cao.webp" alt="Thẻ cào SunCard" className="w-full max-w-[220px] lg:max-w-none rounded-2xl" />
          <h1 className="text-[26px] lg:text-[31px] font-extrabold text-navy tracking-tight mt-5">Bán thẻ cào</h1>
          <p className="text-muted2 mt-2.5 leading-relaxed text-[15px]">Mua thẻ điện thoại và thẻ game nhanh chóng. Giá tốt – giao mã tự động ngay sau thanh toán.</p>
          <svg className="absolute left-0 right-0 bottom-0 w-full h-[64px] lg:h-[100px]" viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,60 C60,20 120,100 180,70 C230,45 270,60 300,40 L300,110 L0,110 Z" fill="#FFD9A8" opacity=".65" />
            <path d="M0,85 C70,50 140,110 210,85 C250,72 280,82 300,70 L300,110 L0,110 Z" fill="#FFB03A" opacity=".55" />
          </svg>
        </aside>

        <div className="p-5 sm:p-7 lg:p-8 space-y-7">
          <section>
            <StepHead n={1} title="Chọn nhà mạng" />
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
              {products.map((p) => (
                <button key={p.code} type="button" onClick={() => chooseProduct(p.code)}
                  className={`relative min-w-0 rounded-2xl border-2 px-1.5 py-3.5 text-center transition ${p.code === product.code ? "border-[#FF8A3D] bg-[#FFF7EC] shadow-sun" : "border-[#F1E7D7] bg-white hover:border-[#FFB03A]"}`}>
                  {p.code === product.code && <Tick />}
                  <span className="flex items-center justify-center min-h-[24px]"><Wordmark wm={p.wm} /></span>
                  <span className="block mt-1.5 text-[13px] font-semibold text-navy">{p.caption}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <StepHead n={2} title="Chọn mệnh giá" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {product.variants.map((v) => {
                const off = v.stock === 0;
                const d = pct(v.face, v.price);
                const on = v.id === variant.id;
                return (
                  <button key={v.id} type="button" disabled={off} onClick={() => { setVariantId(v.id); setQty(1); setMsg(null); }}
                    className={`relative min-w-0 rounded-2xl border-2 px-4 py-3.5 text-left transition ${on ? "border-[#FF8A3D] bg-[#FFF7EC] shadow-sun" : "border-[#F1E7D7] bg-white hover:border-[#FFB03A]"} ${off ? "opacity-50" : ""}`}>
                    {on && <Tick />}
                    <span className={`block text-[17px] lg:text-[19px] font-extrabold ${on ? "text-sundeep" : "text-navy"} ${off ? "line-through" : ""}`}>{fmt(v.face)}đ</span>
                    <span className={`block text-[13px] mt-0.5 ${on ? "text-sundeep" : "text-muted2"}`}>{off ? "Tạm hết hàng" : `Giá: ${fmt(v.price)}đ`}</span>
                    {d && <span className="inline-block mt-2 bg-[#FFE9D2] text-sundeep text-xs font-extrabold px-2.5 py-0.5 rounded-full">-{d}%</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <StepHead n={3} title="Thông tin đơn hàng" />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-2 border-[#F1E7D7] rounded-2xl px-5 py-4">
              <span className="w-[86px] h-[52px] rounded-full bg-white shadow-soft border border-[#F7E9D2] flex items-center justify-center shrink-0"><Wordmark wm={product.wm} size="sm" /></span>
              <div>
                <b className="text-navy text-[16px] block">Thẻ {product.name}</b>
                <span className="text-[13px] text-muted2">Mệnh giá: {fmt(variant.face)}đ</span>
              </div>
              <div className="sm:border-l sm:border-[#F1E7D7] sm:pl-5">
                <span className="block text-xs text-muted2 mb-0.5">Giá bán{discount ? ` (đã giảm ${discount}%)` : ""}</span>
                <b className="text-sundeep text-lg">{fmt(unit)}đ</b>
              </div>
              <div className="sm:border-l sm:border-[#F1E7D7] sm:pl-5">
                <span className="block text-xs text-muted2 mb-0.5">Số lượng</span>
                <span className="inline-flex items-center border-2 border-sunline rounded-full overflow-hidden">
                  <button type="button" aria-label="Giảm số lượng" onClick={() => setQty(Math.max(1, qty - 1))} className="w-[34px] h-9 bg-[#FFF6E8] text-sundeep font-extrabold text-lg">−</button>
                  <span className="min-w-[32px] text-center font-extrabold text-navy text-[15px]">{qty}</span>
                  <button type="button" aria-label="Tăng số lượng" onClick={() => setQty(Math.min(maxQty, qty + 1))} className="w-[34px] h-9 bg-[#FFF6E8] text-sundeep font-extrabold text-lg">+</button>
                </span>
              </div>
              <div className="sm:border-l sm:border-[#F1E7D7] sm:pl-5">
                <span className="block text-xs text-muted2 mb-0.5">Thành tiền</span>
                <b className="text-sundeep text-[22px]">{fmt(total)}đ</b>
                {showUsd && <span className="block text-xs text-muted2">≈ ${(total / vndPerUsd).toFixed(2)}</span>}
              </div>
            </div>
          </section>

          {!loggedIn && (
            <div className="rounded-xl bg-amber-50 text-amber-700 px-4 py-3 text-sm">Bạn chưa đăng nhập. <Link className="underline font-semibold" href="/dang-nhap">Đăng nhập</Link> để mua thẻ bằng ví SunCard.</div>
          )}
          {msg && (
            <div className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {msg.text} {msg.ok && <>Mã đơn: <b>{msg.code}</b>. <Link className="underline font-semibold" href="/tai-khoan/the-da-mua">Xem thẻ đã mua</Link></>}
            </div>
          )}
          <button type="button" onClick={buy} disabled={busy || variant.stock === 0}
            className="btn-primary w-full !py-4 !text-lg !rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-50">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10.5h18" /></svg>
            {busy ? "Đang xử lý…" : variant.stock === 0 ? "Mệnh giá này tạm hết hàng" : "Mua thẻ ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}
