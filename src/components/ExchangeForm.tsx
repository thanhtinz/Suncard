"use client";
import { useState } from "react";

const CARRIER_FACES: Record<string, number[]> = {
  Viettel: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000],
  Mobifone: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  Vinaphone: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  Vietnamobile: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  Garena: [5000, 10000, 20000, 50000, 100000, 200000, 500000],
  Zing: [10000, 20000, 50000, 100000, 200000, 500000, 1000000],
  Vcoin: [10000, 20000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000, 5000000, 10000000],
  Gate: [10000, 20000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000, 5000000, 10000000],
  Scoin: [10000, 20000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000, 5000000],
};
const CARRIER_CODE: Record<string, string> = {
  Viettel: "VIETTEL", Mobifone: "MOBIFONE", Vinaphone: "VINAPHONE", Vietnamobile: "VNMOBI",
  Garena: "GARENA", Zing: "ZING", Vcoin: "VCOIN", Gate: "GATE", Scoin: "SCOIN",
};
const CARRIERS = Object.keys(CARRIER_FACES);
const fmt = (n: number) => `${n.toLocaleString("vi-VN")}₫`;
const pct = (bps: number) => `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;

export type MemberFees = Record<string, Record<string, number>>;

export default function ExchangeForm({ loggedIn, memberFees }: { loggedIn: boolean; memberFees?: MemberFees }) {
  const [carrier, setCarrier] = useState("Viettel");
  const [serial, setSerial] = useState("");
  const [pin, setPin] = useState("");
  const [face, setFace] = useState(100000);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const faces = CARRIER_FACES[carrier] ?? CARRIER_FACES.Viettel;
  const feeBps = memberFees?.[CARRIER_CODE[carrier]]?.[String(face)];
  const receive = feeBps != null ? Math.floor(face * (1 - feeBps / 10000)) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedIn) { setMsg("Vui lòng đăng nhập để gạch thẻ."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carrier, serial, pin, faceValueMinor: face, idempotencyKey: crypto.randomUUID() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Gạch thẻ thất bại");
      setMsg(`Đã gửi thẻ. Mã đơn: ${d.code ?? d.data?.code ?? d.id ?? ""}. Theo dõi tại Tài khoản → Đổi thẻ.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Gạch thẻ thất bại"); }
    setBusy(false);
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full border-2 text-[13px] font-semibold transition ${active ? "bg-grad-sun text-white border-transparent shadow-sun" : "border-sunline bg-white text-ink2 hover:border-sun2"}`;
  const chipMoney = (active: boolean) =>
    `px-3 py-1.5 rounded-full border-2 text-[13px] font-semibold transition ${active ? "bg-navy text-white border-transparent" : "border-sunline bg-white text-ink2 hover:border-sun2"}`;

  return (
    <form onSubmit={submit} className="bg-white rounded-[26px] p-6 md:p-7 shadow-sunsoft border border-white w-full">
      <h2 className="text-xl font-bold text-navy flex items-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E86A17" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10.5h18M7 15.5h4" /></svg>
        Đổi thẻ cào
      </h2>
      <p className="text-[13.5px] text-muted2 mt-1 mb-2">Điền thông tin thẻ — hệ thống kiểm tra & cộng ví tự động.</p>

      <span className="label !mt-4">Loại thẻ</span>
      <div className="flex flex-wrap gap-2">
        {CARRIERS.map((c) => (
          <button type="button" key={c} className={chip(carrier === c)} onClick={() => { setCarrier(c); const fs = CARRIER_FACES[c]; if (!fs.includes(face)) setFace(fs.includes(100000) ? 100000 : fs[0]); }}>{c}</button>
        ))}
      </div>

      <label className="label !mt-5" htmlFor="ex-serial">Số serial</label>
      <input id="ex-serial" className="input !rounded-[14px] !py-3" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Nhập số serial in trên thẻ" required />
      <label className="label !mt-4" htmlFor="ex-pin">Mã thẻ (PIN)</label>
      <input id="ex-pin" className="input !rounded-[14px] !py-3" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Cào lớp phủ bạc và nhập mã thẻ" required />

      <span className="label !mt-5">Mệnh giá khai báo</span>
      <div className="flex flex-wrap gap-2">
        {faces.map((f) => (
          <button type="button" key={f} className={chipMoney(face === f)} onClick={() => setFace(f)}>{fmt(f)}</button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl px-4 py-3.5 flex items-center justify-between" style={{ background: "linear-gradient(90deg,#FFF4E0,#FFE9EC)" }}>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "#8a5a12" }}>Bạn thực nhận</div>
          <div className="text-[22px] font-extrabold text-sundeep leading-tight">{receive != null ? fmt(receive) : "—"}</div>
        </div>
        <div className="text-right text-[12.5px] text-muted2">
          <div>Mệnh giá {fmt(face)}</div>
          <div>{feeBps != null ? `Phí thành viên ${pct(feeBps)}` : "Phí theo bảng phí"}</div>
        </div>
      </div>

      {!loggedIn && <div className="rounded-xl bg-amber-50 text-amber-700 px-3 py-2 text-sm mt-4">Bạn chưa đăng nhập. <a className="underline font-semibold" href="/dang-nhap">Đăng nhập</a> để gạch thẻ — tiền cộng vào ví của bạn.</div>}
      {msg && <div className="rounded-xl bg-orange-50 text-sundeep px-3 py-2 text-sm mt-4">{msg}</div>}
      <button className="btn-primary w-full !rounded-2xl !py-3.5 !text-[17px] mt-4" disabled={busy}>{busy ? "Đang gửi..." : "Gạch thẻ ngay"}</button>
      <p className="text-xs text-muted2 text-center mt-2.5 leading-relaxed">Thực nhận theo phí Thành viên; đại lý/API áp phí nhóm của bạn khi gửi.</p>
    </form>
  );
}
