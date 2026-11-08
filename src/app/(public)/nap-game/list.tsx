"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { GAME_GENRES, gameMeta } from "@/lib/game-meta";

export interface GameItem {
  slug: string;
  name: string;
  publisher: string;
  currencyName: string;
}

function SunMark({ size = 17 }: { size?: number }) {
  return <i className="fa-solid fa-sun text-white" style={{ fontSize: size }} aria-hidden="true" />;
}

const GENRE_FA: Record<string, string> = {
  "MOBA": "fa-bullseye",
  "Battle Royale": "fa-crosshairs",
  "RPG": "fa-star",
  "Khác": "fa-table-cells-large",
};

function GenreIcon({ genre, on }: { genre: string; on: boolean }) {
  return <i className={`fa-solid ${GENRE_FA[genre] ?? "fa-bolt"} text-[13px] ${on ? "text-white" : "text-sundeep"}`} aria-hidden="true" />;
}

export default function GameList({ games }: { games: GameItem[] }) {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string>("Tất cả");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of games) {
      const gr = gameMeta(g.slug, g.name).genre;
      m.set(gr, (m.get(gr) ?? 0) + 1);
    }
    return m;
  }, [games]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return games.filter((g) => {
      if (genre !== "Tất cả" && gameMeta(g.slug, g.name).genre !== genre) return false;
      if (needle && !`${g.name} ${g.publisher}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [games, q, genre]);

  function resetAll() { setQ(""); setGenre("Tất cả"); }

  return (
    <div>
      {/* Banner hero */}
      <section className="relative mt-1 rounded-[30px] overflow-hidden min-h-[208px] lg:min-h-[252px] shadow-sunsoft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/nap-game-hero.webp" alt="Nạp game SunCard" className="absolute inset-0 w-full h-full object-cover object-right" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(255,110,20,.9) 0%, rgba(255,110,20,.55) 34%, rgba(255,110,20,0) 62%)" }} />
        <div className="relative px-6 py-6 lg:px-[42px] lg:py-9 max-w-[88%] sm:max-w-[520px]">
          <div className="flex items-center gap-2 text-white font-extrabold text-lg">
            <span className="w-[30px] h-[30px] rounded-full bg-white/20 flex items-center justify-center shrink-0"><SunMark /></span>
            SunCard
          </div>
          <h1 className="text-white font-extrabold text-[28px] lg:text-[37px] leading-tight tracking-tight mt-4" style={{ textShadow: "0 2px 14px rgba(180,60,0,.35)" }}>Nạp game trực tuyến</h1>
          <p className="text-white/95 text-[15px] lg:text-base mt-2 leading-relaxed" style={{ textShadow: "0 1px 8px rgba(180,60,0,.35)" }}>Chọn game bạn muốn nạp, thanh toán nhanh và nhận ngay.</p>
        </div>
      </section>

      {/* Panel trắng đè lên hero: tìm kiếm + lọc + lưới game */}
      <div className="relative bg-white border border-sunline rounded-[28px] shadow-soft px-4 py-5 sm:px-6 lg:px-[30px] lg:py-[26px] -mt-6 lg:-mt-[34px]">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[220px] flex items-center gap-2.5 border-2 border-sunline rounded-[13px] px-4 bg-[#FFFDF9] h-[50px]">
            <i className="fa-solid fa-magnifying-glass text-[16px] text-[#9AA5BC] shrink-0" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm game (VD: Liên Quân, Free Fire, Genshin...)" aria-label="Tìm game" className="border-0 outline-none bg-transparent text-[15px] text-navy w-full min-w-0 placeholder:text-[#9AA5BC]" />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Xoá tìm kiếm" className="shrink-0 text-[#9AA5BC] hover:text-navy leading-none"><i className="fa-solid fa-xmark text-[16px]" aria-hidden="true" /></button>
            )}
          </div>
          <button type="button" onClick={resetAll} className="inline-flex items-center justify-center gap-2 h-[50px] px-[18px] border-2 border-sunline rounded-[13px] bg-white text-sm font-bold text-navy hover:bg-orange-50 transition flex-1 sm:flex-none">
            <i className="fa-solid fa-table-cells-large text-[15px] text-sundeep" aria-hidden="true" />
            Tất cả game
            <span className="text-xs font-semibold text-muted2">({games.length})</span>
          </button>
        </div>

        <div className="flex gap-2 flex-wrap mt-[18px]">
          {GAME_GENRES.map((gr) => {
            const on = genre === gr;
            const n = gr === "Tất cả" ? games.length : counts.get(gr) ?? 0;
            if (gr !== "Tất cả" && n === 0) return null;
            return (
              <button key={gr} type="button" onClick={() => setGenre(gr)} className={`inline-flex items-center gap-1.5 px-4 py-[9px] rounded-full border-2 text-sm font-bold transition ${on ? "bg-grad-sun text-white border-transparent shadow-sun" : "border-sunline bg-white text-ink2 hover:bg-orange-50"}`}>
                <GenreIcon genre={gr} on={on} />
                {gr}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted2">Không tìm thấy game phù hợp{q ? <> với từ khoá “<b className="text-navy">{q}</b>”</> : ""}.</p>
            <button type="button" onClick={resetAll} className="btn-ghost mt-4">Xem tất cả game</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mt-6">
            {visible.map((g) => {
              const meta = gameMeta(g.slug, g.name);
              return (
                <Link key={g.slug} href={`/nap-game/${g.slug}`} className="group min-w-0">
                  <div className={`relative aspect-[4/3] rounded-[14px] overflow-hidden bg-gradient-to-br ${meta.art} flex items-center justify-center transition group-hover:shadow-[0_12px_26px_rgba(20,33,61,.18)]`}>
                    <span className="absolute inset-0" style={{ background: "radial-gradient(circle at 85% 10%, rgba(255,255,255,.35), transparent 55%)" }} />
                    <b className="relative text-white font-black text-[30px] lg:text-[34px] tracking-wide" style={{ textShadow: "0 3px 12px rgba(0,0,0,.35)" }}>{meta.initials}</b>
                  </div>
                  <div className="mt-2.5 font-bold text-navy text-[15.5px] leading-snug">{g.name}</div>
                  <div className="text-[13px] text-muted2 mt-0.5">{g.publisher}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
