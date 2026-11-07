import { PageTitle } from "@/components/ui";
export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle title="Chính sách bảo mật" />
      <div className="card p-6 space-y-4 text-sm leading-6">
        <p>Chính sách này mô tả cách SunCard thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn.</p>
        <h3 className="font-bold text-navy">1. Thông tin thu thập</h3>
        <p>Chúng tôi thu thập email, số điện thoại, họ tên khi bạn đăng ký; dữ liệu giao dịch phục vụ xử lý đơn, đối soát và phòng chống gian lận; và nhật ký truy cập phục vụ bảo mật.</p>
        <h3 className="font-bold text-navy">2. Mục đích sử dụng</h3>
        <p>Thông tin được dùng để cung cấp dịch vụ, xác minh giao dịch, hỗ trợ khách hàng và tuân thủ nghĩa vụ pháp lý. Chúng tôi không bán thông tin cá nhân của bạn cho bên thứ ba.</p>
        <h3 className="font-bold text-navy">3. Bảo vệ dữ liệu</h3>
        <p>Mật khẩu được băm bằng thuật toán mạnh; mã thẻ được mã hoá khi lưu trữ và chỉ hiển thị sau bước xác thực lại. Truy cập dữ liệu nhạy cảm đều được ghi nhật ký kiểm toán.</p>
        <h3 className="font-bold text-navy">4. Quyền của bạn</h3>
        <p>Bạn có quyền yêu cầu xem, chỉnh sửa hoặc xoá thông tin cá nhân bằng cách gửi yêu cầu hỗ trợ tại Trung tâm hỗ trợ.</p>
      </div>
    </div>
  );
}
