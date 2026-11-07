import Link from "next/link";
import { PageTitle } from "@/components/ui";

export default function ApiDocsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitle title="Partner API" sub="Tài liệu tích hợp dành cho đối tác" />
      <div className="card p-6 space-y-4 text-sm leading-6">
        <p>Partner API cho phép đối tác tạo đơn nạp game, mua thẻ, tra cứu trạng thái đơn và nhận webhook khi trạng thái thay đổi. Mọi request phải ký bằng HMAC-SHA256 với secret của API key; API key chỉ hiển thị một lần khi tạo.</p>
        <div>
          <h3 className="font-bold text-navy mb-1">Xác thực</h3>
          <p>Gửi kèm các header: <code>X-Client-Id</code>, <code>Authorization: Bearer &lt;apiKey&gt;</code>, <code>X-Timestamp</code>, <code>X-Nonce</code>, <code>X-Signature</code>. Chữ ký tính trên method, path, timestamp, nonce và hash của body.</p>
        </div>
        <div>
          <h3 className="font-bold text-navy mb-1">Idempotency</h3>
          <p>Mọi request tạo đơn bắt buộc có <code>idempotencyKey</code> duy nhất cho mỗi lần đặt; gửi lại cùng key sẽ trả về đơn đã tạo, không trừ tiền hai lần.</p>
        </div>
        <div>
          <h3 className="font-bold text-navy mb-1">Trạng thái đơn</h3>
          <p>Trạng thái <code>UNKNOWN</code> nghĩa là đang xác minh với nhà cung cấp, không phải thất bại. Đối tác nên chờ webhook hoặc tra cứu lại thay vì tạo đơn mới.</p>
        </div>
        <div>
          <h3 className="font-bold text-navy mb-1">Đặc tả OpenAPI</h3>
          <p>Tải file đặc tả đầy đủ: <a className="text-primary underline" href="/openapi.yaml">/openapi.yaml</a></p>
        </div>
      </div>
      <Link href="/tai-lieu" className="text-sm text-primary">Quay lại danh sách tài liệu</Link>
    </div>
  );
}
