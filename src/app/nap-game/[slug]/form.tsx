"use client";
import { useState } from "react";
import Link from "next/link";
import { gameMeta } from "@/lib/game-meta";

export interface VariantOpt { id: string; name: string; face: string; price: string }
export interface NamedOpt { code: string; name: string }
const fmt = (s: string) => Number(s).toLocaleString("vi-VN") + " ₫";

function Gem({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 26 / 30)} viewBox="0 0 30 26" aria-hidden="true" className="shrink-0">
      <path d="M15 1 L28 9 L15 25 L2 9 Z" fill="#38BDF8" />
      <path d="M15 1 L21 9 L15 25 L9 9 Z" fill="#0284C7" />
      <path d="M2 9 H28" stroke="#BAE6FD" strokeWidth="1.6" />
      <path d="M9 9 L15 1 L21 9" fill="none" stroke="#E0F2FE" strokeWidth="1.4" />
    </svg>
  );
}

function Tick() {
  return (
    <span className="absolute -top-2 -right-1.5 w-6 h-6 rounded-full bg-grad-sun flex items-center justify-center shadow-sun z-10">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
    </span>
  );
}

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-[11px] mb-3.5">
      <span className="w-7 h-7 rounded-full bg-grad-sun text-white font-extrabold text-sm flex items-center justify-center shadow-sun shrink-0">{n}</span>
      <h2 className="text-lg font-bold text-navy">{title}</h2>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 bg-[#FFFDF8] border-[1.5px] border-[#FFD9AE] text-sundeep text-[12.5px] font-bold px-3 py-[5px] rounded-full">{children}</span>;
}

export default function TopupForm({ slug, gameName, publisher, currencyName, variants, regions, servers, loggedIn, usdRate }: {
  slug: string; gameName: string; publisher: string; currencyName: string;
  variants: VariantOpt[]; regions: NamedOpt[]; servers: NamedOpt[]; loggedIn: boolean; usdRate?: number;
}) {
  const meta = gameMeta(slug, gameName);
  const [showUsd, setShowUsd] = useState(false);
  const usd = (vnd: string) => (usdRate && usdRate > 0 ? `≈ $${(Number(vnd) / usdRate).toFixed(2)}` : "");
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [playerId, setPlayerId] = useState("");
  const [regionCode, setRegionCode] = useState(regions[0]?.code ?? "");
  const [serverCode, setServerCode] = useState(servers[0]?.code ?? "");
  const [paymentMethod, setPaymentMethod] = useState("WALLET");
  const [nickname, setNickname] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = variants.find((v) => v.id === variantId);
  const serverName = servers.find((s) => s.code === serverCode)?.name;
  const regionName = regions.find((r) => r.code === regionCode)?.name;

  async function validate() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/topup/validate?variantId=${encodeURIComponent(variantId)}&playerId=${encodeURIComponent(playerId)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Không kiểm tra được tài khoản");
      setNickname(d.playerName ?? d.nickname ?? d.data?.playerName ?? "Tài khoản hợp lệ");
    } catch (e) { setNickname(null); setMsg({ ok: false, text: e instanceof Error ? e.message : "Lỗi kiểm tra" }); }
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedIn) { setMsg({ ok: false, text: "Vui lòng đăng nhập để đặt đơn." }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/orders/topup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, playerId, regionCode: regionCode || undefined, serverCode: serverCode || undefined, idempotencyKey: crypto.randomUUID(), paymentMethod }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Đặt đơn thất bại");
      setMsg({ ok: true, text: "Đặt đơn thành công.", code: d.code ?? d.data?.code ?? d.id ?? "" });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Đặt đơn thất bại" }); }
    setBusy(false);
  }

  const strip = (
    <div className="relative rounded-[18px] overflow-hidden border border-[#F7E3C2] min-h-[112px] flex items-center" style={{ background: "linear-gradient(90deg,#FFF6E9,#FFE7CB)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/nap-game-hero.webp" alt="" aria-hidden="true" className="absolute top-0 right-0 h-full w-[170px] sm:w-[300px] object-cover object-right opacity-60 sm:opacity-100" style={{ WebkitMaskImage: "linear-gradient(90deg,transparent,#000 55%)", maskImage: "linear-gradient(90deg,transparent,#000 55%)" }} />
      <div className="relative flex items-center gap-3 sm:gap-4 px-4 py-4 sm:px-5">
        <span className={`w-[56px] h-[56px] sm:w-[66px] sm:h-[66px] flex-none rounded-[14px] bg-gradient-to-br ${meta.art} flex items-center justify-center text-white font-black text-lg sm:text-[21px] shadow-[0_8px_18px_rgba(234,88,12,.35)]`} style={{ textShadow: "0 2px 8px rgba(0,0,0,.3)" }}>{meta.initials}</span>
        <div className="min-w-0">
          <h2 className="text-navy font-extrabold text-lg sm:text-[21px] tracking-tight leading-tight">{gameName}</h2>
          <div className="text-muted2 text-sm mt-0.5">{publisher}</div>
          <div className="flex gap-2 flex-wrap mt-2.5">
            {currencyName && (
              <Badge>
                <svg width="13" height="13" viewBox="0 0 30 26" aria-hidden="true"><path d="M15 1 L28 9 L15 25 L2 9 Z" fill="#38BDF8" /><path d="M15 1 L21 9 L15 25 L9 9 Z" fill="#0284C7" /></svg>
                Nạp {currencyName}
              </Badge>
            )}
            <Badge>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#E86A17" aria-hidden="true"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z" /></svg>
              Tự động 24/7
            </Badge>
            <Badge>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E86A17" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              Nhận ngay
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="bg-white border border-sunline rounded-[28px] shadow-soft overflow-hidden mt-1">
      {/* Dải cam trên cùng của thẻ chi tiết */}
      <div className="flex items-center gap-3.5 px-4 py-[13px] sm:px-6 sm:py-[15px]" style={{ background: "linear-gradient(90deg,#FF7A1A,#FF9E3D)" }}>
        <Link href="/nap-game" aria-label="Quay lại danh sách game" className="w-[38px] h-[38px] rounded-full bg-white flex items-center justify-center flex-none shadow-[0_4px_12px_rgba(180,60,0,.25)] hover:bg-orange-50 transition">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E86A17" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <h1 className="text-white font-extrabold text-lg sm:text-xl tracking-tight">Nạp game</h1>
        <div className="ml-auto flex items-center gap-2 text-white font-extrabold text-[17px]">
          <span className="w-[27px] h-[27px] rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="#fff" /><g stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></g></svg>
          </span>
          <span className="hidden sm:inline">SunCard</span>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6 lg:px-[30px] lg:py-6">
        {strip}

        {variants.length === 0 ? (
          <div className="text-center text-muted2 py-10">Game này chưa có gói nạp</div>
        ) : (
          <>
            {/* Bước 1: thông tin tài khoản */}
            <section className="mt-7">
              <StepHead n={1} title="Nhập thông tin tài khoản" />
              <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                <div className="flex-1 min-w-0">
                  <label className="block text-[13.5px] font-bold text-navy mb-[7px]">UID / ID game <span className="text-[#E30613]">*</span></label>
                  <div className="flex items-center gap-2 border-2 border-sunline rounded-[13px] px-3.5 bg-[#FFFDF9] h-12">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AA5BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" /></svg>
                    <input value={playerId} onChange={(e) => { setPlayerId(e.target.value); setNickname(null); }} required placeholder="Nhập UID tài khoản game" aria-label="UID game" className="border-0 outline-none bg-transparent text-[15px] font-semibold text-navy w-full min-w-0 placeholder:text-[#9AA5BC] placeholder:font-normal" />
                  </div>
                </div>
                {regions.length > 0 && (
                  <div className="flex-1 min-w-0">
                    <label className="block text-[13.5px] font-bold text-navy mb-[7px]">Khu vực <span className="text-[#E30613]">*</span></label>
                    <div className="flex items-center gap-2 border-2 border-sunline rounded-[13px] px-3.5 bg-[#FFFDF9] h-12">
                      <select value={regionCode} onChange={(e) => { setRegionCode(e.target.value); setNickname(null); }} aria-label="Khu vực" className="border-0 outline-none bg-transparent text-[15px] font-semibold text-navy w-full min-w-0">
                        {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {servers.length > 0 && (
                  <div className="flex-1 min-w-0">
                    <label className="block text-[13.5px] font-bold text-navy mb-[7px]">Máy chủ <span className="text-[#E30613]">*</span></label>
                    <div className="flex items-center gap-2 border-2 border-sunline rounded-[13px] px-3.5 bg-[#FFFDF9] h-12">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AA5BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="5" width="18" height="6" rx="2" /><rect x="3" y="13" width="18" height="6" rx="2" /><path d="M7 8h.01M7 16h.01" /></svg>
                      <select value={serverCode} onChange={(e) => { setServerCode(e.target.value); setNickname(null); }} aria-label="Máy chủ" className="border-0 outline-none bg-transparent text-[15px] font-semibold text-navy w-full min-w-0">
                        {servers.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <button type="button" disabled={busy || !playerId} onClick={validate} className="h-12 px-[22px] rounded-[13px] border-2 border-sun1 bg-[#FFF7EC] text-sundeep font-extrabold text-[15px] inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 hover:bg-orange-100 transition">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></svg>
                  Kiểm tra
                </button>
              </div>

              {nickname && (
                <div className="mt-3.5 bg-[#FFF6E8] border border-[#F7E3C2] rounded-[14px] px-4 py-3 flex items-center gap-3.5 flex-wrap">
                  <span className="flex items-center gap-2 font-bold text-[#1d6b34] text-sm">
                    <span className="w-6 h-6 rounded-full bg-[#22C55E] flex items-center justify-center flex-none">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                    Thông tin người chơi
                  </span>
                  <span className={`w-[38px] h-[38px] rounded-[11px] bg-gradient-to-br ${meta.art} text-white font-black text-[13px] flex items-center justify-center flex-none`}>{meta.initials}</span>
                  <div className="min-w-0">
                    <b className="text-navy text-[15px] block leading-tight">{nickname}</b>
                    <span className="text-[13px] text-muted2">UID: {playerId}{serverName ? ` · Máy chủ: ${serverName}` : ""}{regionName ? ` · Khu vực: ${regionName}` : ""}</span>
                  </div>
                </div>
              )}
            </section>

            {/* Bước 2: chọn gói */}
            <section className="mt-7">
              <StepHead n={2} title={currencyName ? `Chọn gói nạp ${currencyName}` : "Chọn gói nạp"} />
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {variants.map((v) => {
                  const on = v.id === variantId;
                  return (
                    <button type="button" key={v.id} onClick={() => setVariantId(v.id)} className={`relative border-2 rounded-2xl p-4 flex items-center gap-3 text-left min-w-0 transition ${on ? "border-sun1 bg-[#FFF7EC] shadow-[0_8px_20px_rgba(255,138,61,.14)]" : "border-[#EDF0F5] bg-white hover:border-sunline"}`}>
                      {on && <Tick />}
                      <Gem />
                      <span className="min-w-0">
                        <span className="block font-extrabold text-navy text-[15.5px] leading-tight">{v.name}</span>
                        <span className={`block text-sm mt-0.5 ${on ? "text-sundeep font-extrabold" : "text-muted2 font-semibold"}`}>{fmt(v.price)}</span>
                        {showUsd && usdRate ? <span className="block text-xs text-muted2">{usd(v.price)}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-5">
                <label className="flex items-center gap-2 text-sm text-ink2">
                  <span className="font-semibold text-navy">Thanh toán bằng</span>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="rounded-[10px] border-2 border-sunline bg-white px-2.5 py-1.5 text-sm font-semibold text-navy outline-none">
                    <option value="WALLET">Số dư ví</option>
                    <option value="CREDIT">Công nợ đại lý</option>
                  </select>
                </label>
                {usdRate ? (
                  <label className="flex items-center gap-2 text-sm text-muted2 cursor-pointer">
                    <input type="checkbox" checked={showUsd} onChange={(e) => setShowUsd(e.target.checked)} className="accent-[#E86A17]" />
                    Hiển thị thêm giá quy đổi USD (ước tính, thanh toán vẫn bằng VND)
                  </label>
                ) : null}
              </div>
            </section>

            {!loggedIn && (
              <div className="rounded-xl bg-amber-50 text-amber-700 px-4 py-2.5 text-sm mt-6">Bạn chưa đăng nhập. <Link className="underline font-semibold" href="/dang-nhap">Đăng nhập</Link> để đặt đơn.</div>
            )}
            {msg && (
              <div className={`rounded-xl px-4 py-2.5 text-sm mt-6 ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {msg.ok ? <>Đặt đơn thành công{msg.code ? <> — mã đơn <b>{msg.code}</b></> : ""}. <Link className="underline font-semibold" href="/tai-khoan/don-hang">Xem đơn hàng</Link></> : msg.text}
              </div>
            )}

            {/* Hàng chốt đơn */}
            <div className="mt-7 border-t border-dashed border-[#EBD9BE] pt-[22px] flex items-center gap-4 sm:gap-5 flex-wrap">
              <span className="hidden sm:flex items-center" aria-hidden="true">
                <Gem size={26} /><span className="-ml-2.5"><Gem size={26} /></span><span className="-ml-2.5"><Gem size={26} /></span>
              </span>
              <div>
                <span className="block text-[13px] text-muted2">Gói đang chọn</span>
                <b className="text-[17px] sm:text-[19px] text-navy leading-tight">{selected?.name ?? "—"}</b>
              </div>
              <div className="sm:ml-auto sm:text-right">
                <span className="block text-[13px] text-muted2">Giá bán</span>
                <b className="text-[21px] sm:text-[23px] text-sundeep leading-tight">{selected ? fmt(selected.price) : "—"}</b>
                {showUsd && usdRate && selected ? <span className="block text-xs text-muted2">{usd(selected.price)}</span> : null}
              </div>
              <button type="submit" disabled={busy || !playerId} className="btn-primary rounded-2xl px-6 py-3.5 sm:px-9 sm:py-[15px] text-[16px] sm:text-[17px] font-extrabold flex-1 sm:flex-none disabled:opacity-50">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z" /></svg>
                Nạp ngay
              </button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}
