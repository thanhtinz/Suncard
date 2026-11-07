import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge, Money } from "@/components/ui";
import { getSession } from "@/modules/security";
import ExchangeForm, { type MemberFees } from "@/components/ExchangeForm";
import FeeTable, { type FeeRow } from "@/components/FeeTable";

export const dynamic = "force-dynamic";

const TRUST = [
  { label: "Xử lý ~30 giây", icon: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z" /> },
  { label: "Mã thẻ mã hoá an toàn", icon: <><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></> },
  { label: "9 nhà mạng & thẻ game", icon: <path d="M4 7h16M4 12h16M4 17h10" /> },
];

const HIGHLIGHTS = [
  { code: "VIETTEL", name: "Viettel" },
  { code: "GARENA", name: "Garena" },
  { code: "ZING", name: "Zing" },
];

const SERVICES = [
  {
    href: "/nap-game", title: "Nạp game", bg: "#FFF1E0",
    desc: "Nạp trực tiếp bằng UID cho Liên Quân, Free Fire, Genshin… Hiện đúng số nhận được trước khi thanh toán.",
    icon: <><path d="M6 9h12l1.5 9a2 2 0 0 1-2 2.3h-11A2 2 0 0 1 4.5 18L6 9z" /><path d="M9 9V7a3 3 0 0 1 6 0v2M9.5 14.5h.01M14.5 14.5h.01" /></>,
  },
  {
    href: "/cua-hang-the", title: "Mua thẻ", bg: "#FFE9EC",
    desc: "Mua thẻ điện thoại, thẻ game, gift card bằng số dư ví. Nhận mã ngay trên web, bảo hành mã lỗi.",
    icon: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10.5h18M7 15.5h4" /></>,
  },
  {
    href: "/dai-ly", title: "Đại lý", bg: "#FFF7E0",
    desc: "Phí tốt hơn theo sản lượng, hoa hồng nhiều tầng, API gạch thẻ sẵn sàng cho shop và web con của bạn.",
    icon: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M16.5 5.5a3.2 3.2 0 0 1 0 5.8M18.6 15.4c1.2.8 2 2.3 2.3 4.6" /></>,
  },
];

export default async function HomePage({ searchParams }: { searchParams?: { code?: string } }) {
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

  let lookup: React.ReactNode = null;
  if (searchParams?.code) {
    const order = await prisma.order.findUnique({ where: { code: searchParams.code } });
    if (!order || order.type !== "EXCHANGE")
      lookup = <div className="rounded-xl bg-amber-50 text-amber-700 px-3 py-2 text-sm">Không tìm thấy đơn gạch thẻ với mã này.</div>;
    else {
      const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: order.id } });
      lookup = (
        <div className="rounded-xl bg-orange-50/70 px-4 py-3 text-sm space-y-1 w-full">
          <div className="flex justify-between"><span>Mã đơn</span><b>{order.code}</b></div>
          <div className="flex justify-between"><span>Trạng thái</span><StatusBadge status={order.status} /></div>
          {ex && <div className="flex justify-between"><span>Nhà mạng</span><span>{ex.carrier}</span></div>}
          {ex && <div className="flex justify-between"><span>Mệnh giá</span><Money v={ex.faceValueMinor} /></div>}
          {ex?.payoutMinor != null && <div className="flex justify-between"><span>Thực nhận</span><Money v={ex.payoutMinor} /></div>}
        </div>
      );
    }
  }

  return (
    <div className="space-y-10">
      <section className="bg-hero-sun rounded-b-[36px] rounded-t-[24px] -mt-2 px-5 py-8 md:px-10 md:py-11">
        <div className="grid lg:grid-cols-[1fr_480px] gap-9 items-start">
          <div className="pt-2">
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
              Lưu ý: chỉ đổi thẻ có nguồn gốc hợp pháp. Sai mệnh giá được tính theo mệnh giá thực (trừ 50% mệnh giá nhỏ hơn); sai serial sẽ không được hỗ trợ khiếu nại.
            </div>
            <div className="mt-7 max-w-[520px]">
              <div className="font-bold text-navy text-[15px] mb-3">Đổi thẻ trong 3 bước</div>
              <div className="space-y-2.5">
                {["Chọn loại thẻ và mệnh giá ở form bên cạnh", "Nhập số serial và mã thẻ (PIN)", "Tiền cộng vào ví sau khoảng 30 giây"].map((s, i) => (
                  <div key={s} className="flex items-center gap-3 text-sm font-medium text-ink2">
                    <span className="w-7 h-7 rounded-full bg-grad-sun text-white font-bold text-[13px] flex items-center justify-center shrink-0 shadow-sun">{i + 1}</span>{s}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-7 max-w-[520px] rounded-2xl px-4 py-2" style={{ background: "rgba(255,255,255,.75)" }}>
              {HIGHLIGHTS.map((h) => {
                const bps = memberFees[h.code]?.["100000"];
                if (bps == null) return null;
                const recv = Math.floor(100000 * (1 - bps / 10000));
                return (
                  <div key={h.code} className="flex items-center justify-between py-2 border-b border-orange-100 last:border-0 text-sm">
                    <span className="font-semibold text-navy">Thẻ {h.name} 100.000₫</span>
                    <span className="text-muted2">thực nhận <b className="text-sundeep">{recv.toLocaleString("vi-VN")}₫</b></span>
                  </div>
                );
              })}
            </div>
          </div>
          <ExchangeForm loggedIn={!!session} memberFees={memberFees} />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-navy mb-4">Tra cứu đơn đổi thẻ</h2>
        <form method="get" className="card !rounded-[22px] p-5 flex flex-col md:flex-row gap-3 md:items-center">
          <input name="code" className="input flex-1 !py-3" defaultValue={searchParams?.code ?? ""} placeholder="Nhập mã đơn, ví dụ SC-8F42KQ" aria-label="Mã đơn gạch thẻ" />
          <button className="btn-primary shrink-0 !px-6 !py-3">Tra cứu</button>
          {lookup}
        </form>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-bold text-navy">Bảng phí đổi thẻ</h2>
          <span className="text-sm text-muted2 hidden sm:block">Phí theo nhóm tài khoản — xem đủ 3 nhóm trong bảng</span>
        </div>
        <FeeTable rows={feeRows} />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-navy mb-4">Một ví — ba dịch vụ</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {SERVICES.map((s) => (
            <div key={s.href} className="card !rounded-[22px] p-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3.5" style={{ background: s.bg }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E86A17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
              </div>
              <h3 className="text-lg font-bold text-navy">{s.title}</h3>
              <p className="text-sm text-muted2 leading-relaxed mt-1.5">{s.desc}</p>
              <Link href={s.href} className="inline-block mt-3 font-bold text-sm text-sundeep">{s.title} →</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
