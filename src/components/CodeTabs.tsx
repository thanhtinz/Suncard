"use client";
import { useState } from "react";

export interface CodeSample { lang: string; code: string }

export default function CodeTabs({ samples }: { samples: CodeSample[] }) {
  const [active, setActive] = useState(0);
  const cur = samples[Math.min(active, samples.length - 1)];
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {samples.map((s, i) => (
          <button key={s.lang} type="button" onClick={() => setActive(i)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${i === active ? "bg-grad-sun text-white shadow-sun" : "bg-[#EEF3FF] text-[#2B4C9B] hover:bg-[#DCE7FF]"}`}>
            {s.lang}
          </button>
        ))}
      </div>
      <div className="text-sm font-bold text-navy mb-1.5">{cur.lang}</div>
      <pre className="rounded-2xl bg-[#0F1D38] text-[#DCE7FA] px-4 py-3.5 text-[12.5px] leading-6 overflow-x-auto whitespace-pre font-mono">{cur.code}</pre>
    </div>
  );
}
