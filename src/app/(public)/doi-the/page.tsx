import { redirect } from "next/navigation";

// Trang chủ chính là trang đổi thẻ — /doi-the giữ lại dưới dạng chuyển hướng
// để các liên kết cũ vẫn tới đúng nơi, không dựng hai trang trùng nhau.
// (Mã đơn cũ dạng ?code= nay xem trong Lịch sử đổi thẻ — tìm theo mã đơn.)
export default function DoiTheRedirect() {
  redirect("/tra-cuu");
}
