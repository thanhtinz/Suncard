import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { ModuleCards, SITE } from "@/components/ApiDocs";

export const dynamic = "force-dynamic";

export default function ApiDocsHubPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageTitle title="Tài liệu API" sub="Hướng dẫn tích hợp cho đối tác — chọn module để xem chi tiết từng lệnh, công thức ký sign và code mẫu" />
      <ModuleCards />
      <div className="card !rounded-[22px] p-5 sm:p-6 text-sm leading-6 text-slate-600 space-y-3">
        <h2 className="font-extrabold text-navy text-base">Trước khi bắt đầu</h2>
        <p>
          Mọi module dùng chung một bộ thông tin kết nối: <b className="text-navy">Partner ID</b>, <b className="text-navy">API key</b> và <b className="text-navy">partner_key</b>.
          Bạn đăng ký tại mục <Link href="/tai-khoan/api-keys" className="text-sundeep font-semibold">Kết nối API</Link> trong tài khoản — không cần là đại lý.
          Đăng ký sẽ ở trạng thái chờ duyệt; admin duyệt xong hệ thống mới cấp khoá và kết nối mới gọi được API.
        </p>
        <p>
          Ba module tương thích (Charging, Recharge, Softcard) ký bằng <b className="text-navy">MD5</b> với partner_key — giữ nguyên cách tích hợp phổ biến của các web gạch thẻ để đối tác chuyển sang SunCard không phải viết lại.
          REST API v1 ký bằng <b className="text-navy">HMAC-SHA256</b> với cùng partner_key (vai trò secret). Máy chủ gốc cho mọi endpoint: <code className="font-mono text-[13px] text-navy">{SITE}</code>
        </p>
        <p>
          Trạng thái <b className="text-navy">đang xác minh / UNKNOWN</b> nghĩa là hệ thống đang đối soát với nhà cung cấp, <b>không phải thất bại</b> — đừng tạo giao dịch mới trùng lặp, hãy tra cứu lại hoặc chờ callback.
          Mọi lệnh tạo giao dịch đều dùng <code className="font-mono text-[13px]">request_id</code> duy nhất: gửi lại cùng request_id sẽ trả về giao dịch cũ, không trừ tiền hai lần.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/tai-khoan/api-keys" className="btn-primary !py-2">Đăng ký kết nối API</Link>
          <a href="/openapi.yaml" className="btn-ghost !py-2">Đặc tả OpenAPI (REST v1)</a>
        </div>
      </div>
    </div>
  );
}
