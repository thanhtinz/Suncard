import { redirect } from "next/navigation";

// Trang chủ chính là trang đổi thẻ — /doi-the giữ lại dưới dạng chuyển hướng
// để các liên kết cũ vẫn tới đúng nơi, không dựng hai trang trùng nhau.
export default function DoiTheRedirect({ searchParams }: { searchParams?: { code?: string } }) {
  redirect(searchParams?.code ? `/?code=${encodeURIComponent(searchParams.code)}` : "/");
}
