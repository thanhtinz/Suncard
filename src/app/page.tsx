import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import ExchangeForm, { type MemberFees } from "@/components/ExchangeForm";
import FeeTable, { type FeeRow } from "@/components/FeeTable";

export const dynamic = "force-dynamic";

const TRUST = [
  { label: "Xử lý ~30 giây", icon: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z" /> },
  { label: "Mã thẻ mã hoá an toàn", icon: <><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></> },
  { label: "9 nhà mạng & thẻ game", icon: <path d="M4 7h16M4 12h16M4 17h10" /> },
];

export default async function HomePage() {
  const session = await getSession().catch(() => null);
  const feeRules = await prisma.exchangeFeeRule.findMany({
    where: { isActive: true },
    orderBy: [{ telco: "asc" }, { faceValueMinor: "asc" }],
  });
  const feeRows: FeeRow[] = feeRules.map((r) => ({
    telco: r.telco, face: Number(r.faceValueMinor), group: r.groupCode, feeBps: r.feeBps, penaltyBps: r.penaltyBps,
  }));
  const memberFees: MemberFees = {};
  for (const r of feeRules) {
    if (r.groupCode !== "MEMBER") continue;
    (memberFees[r.telco] ??= {})[String(Number(r.faceValueMinor))] = r.feeBps;
  }

  return (
    <div className="space-y-10">
      <section className="bg-hero-sun rounded-b-[36px] rounded-t-[24px] -mt-2 px-5 py-8 md:px-10 md:py-11">
        <div className="grid lg:grid-cols-[1fr_480px] gap-9 items-start">
          <div className="pt-2 order-1 lg:col-start-1 lg:row-start-1">
            <span className="inline-block bg-white text-sundeep font-bold text-[13px] px-3.5 py-1.5 rounded-full shadow-sm">Đổi thẻ cào lấy tiền ví — xử lý tự động 24/7</span>
            <h1 className="text-4xl md:text-[42px] leading-[1.15] font-extrabold text-navy mt-4 tracking-tight">
              Thẻ cào trong tay,<br /><span className="text-grad-sun">nắng vàng</span> trong ví.
            </h1>
            <p className="text-[17px] leading-relaxed mt-3 max-w-[520px]" style={{ color: "#4d5872" }}>
              Đổi thẻ điện thoại & thẻ game sang số dư ví SunCard trong vài giây. Phí minh bạch, tiền thực nhận hiển thị ngay trước khi bạn bấm gửi.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2.5 mt-6">
              {TRUST.map((t) => (
                <span key={t.label} className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E86A17" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
                  {t.label}
                </span>
              ))}
            </div>
            <div className="mt-6 border border-dashed rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed max-w-[520px]" style={{ background: "rgba(255,255,255,.75)", borderColor: "#E8A15C", color: "#8a5a12" }}>
              Lưu ý: chỉ đổi thẻ có nguồn gốc hợp pháp. Sai mệnh giá được tính theo mệnh giá thực — mức trừ cụ thể ghi ở bảng phí bên dưới.
            </div>
            <div className="mt-7 max-w-[520px]">
              <div className="font-bold text-navy text-[15px] mb-3">Đổi thẻ trong 3 bước</div>
              <div className="space-y-2.5">
                {["Chọn loại thẻ và mệnh giá ở form bên cạnh", "Nhập số serial và mã thẻ (PIN)", "Tiền cộng thẳng vào ví của bạn"].map((s, i) => (
                  <div key={s} className="flex items-center gap-3 text-sm font-medium text-ink2">
                    <span className="w-7 h-7 rounded-full bg-grad-sun text-white font-bold text-[13px] flex items-center justify-center shrink-0 shadow-sun">{i + 1}</span>{s}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <ExchangeForm loggedIn={!!session} memberFees={memberFees} />
          </div>
          <div className="order-3 lg:col-start-1 lg:row-start-2">
            <Link href="/tra-cuu" className="flex items-center justify-between gap-3 bg-white/80 hover:bg-white transition rounded-2xl px-5 py-4 shadow-soft border border-white max-w-[520px] lg:max-w-none">
              <span className="text-sm"><b className="text-navy">Đã có mã đơn?</b> <span className="text-muted2">Tra cứu trạng thái & xem lịch sử đổi thẻ</span></span>
              <span className="font-bold text-sundeep text-sm shrink-0">Tra cứu →</span>
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-bold text-navy">Bảng phí đổi thẻ</h2>
          <span className="text-sm text-muted2 hidden sm:block">Phí theo nhóm tài khoản — xem đủ 3 nhóm trong bảng</span>
        </div>
        <FeeTable rows={feeRows} />
      </section>
    </div>
  );
}
