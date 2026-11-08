import { PageTitle } from "@/components/ui";
export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle title="Điều khoản sử dụng" />
      <div className="card p-6 space-y-4 text-sm leading-6">
        <p>Chào mừng bạn sử dụng SunCard — nền tảng phân phối sản phẩm số gồm nạp game, mã thẻ cào, gift card và dịch vụ gạch thẻ. Khi đăng ký và sử dụng dịch vụ, bạn đồng ý với các điều khoản dưới đây.</p>
        <h3 className="font-bold text-navy">1. Tài khoản</h3>
        <p>Bạn chịu trách nhiệm bảo mật tài khoản và mọi hoạt động phát sinh từ tài khoản. SunCard có quyền khoá tài khoản khi phát hiện gian lận hoặc vi phạm pháp luật.</p>
        <h3 className="font-bold text-navy">2. Đơn hàng và thanh toán</h3>
        <p>Đơn hàng chỉ được xử lý sau khi hệ thống ghi nhận thanh toán. Với đơn ở trạng thái Đang xác minh, SunCard sẽ tiếp tục tra cứu với nhà cung cấp và hoàn tiền nếu đơn không thành công. Mã thẻ đã hiển thị (reveal) không được hoàn trả.</p>
        <h3 className="font-bold text-navy">3. Gạch thẻ</h3>
        <p>Bạn cam kết thẻ gửi gạch là hợp pháp. Khai sai mệnh giá có thể dẫn đến điều chỉnh số tiền thực nhận theo mệnh giá thực tế hoặc từ chối giao dịch.</p>
        <h3 className="font-bold text-navy">4. Đại lý</h3>
        <p>Đại lý chịu trách nhiệm với hoạt động của mạng lưới tuyến dưới do mình mời và tuân thủ chính sách giá, hoa hồng công bố trên hệ thống.</p>
        <h3 className="font-bold text-navy">5. Thay đổi điều khoản</h3>
        <p>SunCard có thể cập nhật điều khoản và sẽ thông báo trên website trước khi áp dụng. Việc tiếp tục sử dụng dịch vụ đồng nghĩa bạn chấp nhận điều khoản mới.</p>
      </div>
    </div>
  );
}
