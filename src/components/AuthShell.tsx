const POINTS = [
  "Đổi thẻ cào, nạp game, mua thẻ — chung một ví",
  "Phí minh bạch, thấy số thực nhận trước khi gửi",
  "Xử lý tự động 24/7, tra cứu đơn theo thời gian thực",
];

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
      <aside className="hidden lg:flex flex-col bg-hero-sun rounded-[26px] p-8">
        <div className="flex items-center gap-2.5 font-extrabold text-xl text-navy">
          <span className="inline-flex items-center justify-center rounded-full bg-grad-sun shadow-sun w-[34px] h-[34px]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#fff" /><g stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></g></svg>
          </span>
          SunCard
        </div>
        <h2 className="text-[28px] leading-snug font-extrabold text-navy mt-6">
          Thẻ cào trong tay,<br /><span className="text-grad-sun">nắng vàng</span> trong ví.
        </h2>
        <ul className="mt-6 space-y-3.5">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-2.5 text-sm font-medium text-ink2">
              <svg className="shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E86A17" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-auto pt-8 text-[13px] leading-relaxed" style={{ color: "#8a5a12" }}>
          Mã thẻ được mã hoá khi lưu trữ. SunCard không bao giờ yêu cầu mã thẻ qua Zalo, Telegram hay điện thoại.
        </p>
      </aside>
      <div>{children}</div>
    </div>
  );
}
