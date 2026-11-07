import { redirect } from "next/navigation";

// Lịch sử đổi thẻ nay là một trang trong khu Tài khoản (cùng style với Đơn hàng
// và Thẻ đã mua): /tai-khoan/lich-su-doi-the. Đường dẫn /tra-cuu cũ giữ dạng
// chuyển hướng (mang theo tham số lọc) để liên kết cũ vẫn tới đúng nơi.
export default function TraCuuRedirect({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (typeof v === "string" && v) p.set(k, v);
  }
  const s = p.toString();
  redirect(`/tai-khoan/lich-su-doi-the${s ? `?${s}` : ""}`);
}
