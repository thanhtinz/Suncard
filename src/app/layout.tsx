import "./globals.css";
import { headers } from "next/headers";

export const metadata = { title: "SunCard — Đổi thẻ cào, nạp game, mua thẻ số", description: "Đổi thẻ cào lấy tiền ví, nạp game, mua thẻ — phí minh bạch, xử lý tự động 24/7." };

const FA_CSS = "/fontawesome/css/all.min.css";

// Root layout tối giản: KHÔNG chứa header/footer của bất kỳ khu nào.
// Web bán hàng dùng khung riêng ở (public)/layout.tsx, khu quản trị dùng
// admin/layout.tsx — tách theo route group để cả khi điều hướng phía client
// (bấm link, không tải lại trang) khung vẫn đổi đúng theo khu.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");
  return (
    <html lang="vi">
      <head>
        <link rel="stylesheet" href={FA_CSS} />
      </head>
      <body className={isAdmin ? "bg-[#F4F6FA]" : undefined}>{children}</body>
    </html>
  );
}
