import { PageTitle } from "@/components/ui";
import { getSetting } from "@/modules/settings";
import RoutingRow from "./form";

export const dynamic = "force-dynamic";

const MODE_OPTIONS = [
  { value: "THU_TU", label: "Lần lượt theo thứ tự" },
  { value: "TI_LE", label: "Chia theo tỉ lệ" },
  { value: "PHI_THAP", label: "Phí thấp nhất trước" },
  { value: "XOAY_VONG", label: "Xoay vòng" },
];
const ERROR_OPTIONS = [
  { value: "CHUYEN_NCC", label: "Chuyển nhà cung cấp tiếp theo" },
  { value: "TU_XU_LY", label: "Chuyển web tự xử lý" },
  { value: "TU_CHOI", label: "Từ chối đơn" },
];

export default async function AdminRoutingPage() {
  const [topupMode, topupOnError, exchangeMode] = await Promise.all([
    getSetting<string>("routing.topup_mode", "THU_TU").catch(() => "THU_TU"),
    getSetting<string>("routing.topup_on_error", "CHUYEN_NCC").catch(() => "CHUYEN_NCC"),
    getSetting<string>("routing.exchange_mode", "THU_TU").catch(() => "THU_TU"),
  ]);
  return (
    <div>
      <PageTitle title="Định tuyến nạp cước/game" sub="Cách hệ thống chọn nhà cung cấp cho từng đơn — mọi giá trị lưu vào Cài đặt (settings)" />
      <div className="max-w-2xl">
        <RoutingRow
          k="routing.topup_mode"
          label="Cách chia đơn nạp cước/game"
          description="Quyết định đơn nạp được gửi tới nhà cung cấp nào khi có nhiều nhà cung cấp cùng phục vụ một sản phẩm."
          value={topupMode}
          options={MODE_OPTIONS}
        />
        <RoutingRow
          k="routing.topup_on_error"
          label="Khi nhà cung cấp nạp báo lỗi"
          description="Cách xử lý đơn nạp khi nhà cung cấp đang chọn trả lỗi hoặc không phản hồi."
          value={topupOnError}
          options={ERROR_OPTIONS}
        />
        <RoutingRow
          k="routing.exchange_mode"
          label="Cách chọn kênh gửi thẻ đổi thẻ"
          description="Quyết định thẻ khách gửi đổi được đẩy qua kênh nhà cung cấp nào khi có nhiều kênh cùng nhận một nhà mạng."
          value={exchangeMode}
          options={MODE_OPTIONS}
        />
      </div>
    </div>
  );
}
