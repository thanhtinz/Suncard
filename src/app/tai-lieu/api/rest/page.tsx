import {
  SITE, ModuleCards, DocHero, ChipNav, Section, KVTable, ParamTable, SimpleTable, Code, SignBox, Bullets, SubTitle,
} from "@/components/ApiDocs";

export const dynamic = "force-dynamic";

export default function RestDocPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <ModuleCards active="rest" />
      <DocHero
        badge="PARTNER API V1"
        title="REST API ký HMAC-SHA256"
        desc="API tổng hợp cho đối tác: tạo đơn nạp game, mua thẻ, gạch thẻ, tra cứu đơn, ví và webhook — dùng chung bộ khoá với ba module tương thích."
        endpoint={`${SITE}/v1`}
      />
      <ChipNav items={[
        { id: "tong-quan", label: "Tổng quan" }, { id: "xac-thuc", label: "Xác thực" },
        { id: "endpoint", label: "Endpoint" }, { id: "trang-thai", label: "Trạng thái" },
        { id: "webhook", label: "Webhook" },
      ]} />

      <Section no={1} id="tong-quan" title="Tổng quan tích hợp">
        <KVTable rows={[
          ["Base URL", `${SITE}/v1`],
          ["Method", "GET / POST tuỳ endpoint"],
          ["Kiểu dữ liệu", "application/json"],
          ["Envelope thành công", "{ data, request_id }"],
          ["Envelope lỗi", "{ error: { code, message }, request_id }"],
        ]} />
        <p>Nếu hệ thống của bạn đang dùng chuẩn gạch thẻ phổ biến (MD5), hãy dùng ba module tương thích Charging / Recharge / Softcard thay vì REST v1 — kết quả và số dư ví là một.</p>
      </Section>

      <Section no={2} id="xac-thuc" title="Xác thực và chữ ký">
        <p>Mọi request gửi kèm các header:</p>
        <ParamTable rows={[
          { name: "X-Client-Id", required: true, example: "SC12345678", desc: "Partner ID của kết nối đã được duyệt." },
          { name: "Authorization", required: true, example: "Bearer sc_live_…", desc: "API key của kết nối." },
          { name: "X-Timestamp", required: true, example: "1767225600", desc: "Unix timestamp (giây). Lệch quá cửa sổ cho phép (mặc định 300 giây) sẽ bị từ chối." },
          { name: "X-Nonce", required: true, example: "n-8f42kq", desc: "Chuỗi ngẫu nhiên duy nhất cho mỗi request — dùng lại nonce sẽ bị chặn (chống replay)." },
          { name: "X-Signature", required: true, example: "hex(hmac-sha256)", desc: "Chữ ký HMAC-SHA256 theo công thức bên dưới." },
        ]} />
        <SignBox title="Chuỗi ký (string to sign)" formula={"HMAC-SHA256(secret, METHOD \\n PATH \\n TIMESTAMP \\n NONCE \\n sha256hex(body))"} note="secret chính là partner_key của kết nối. METHOD viết hoa, PATH là đường dẫn tuyệt đối (ví dụ /v1/orders), body là raw body (GET dùng chuỗi rỗng)." />
        <Code>{`Ví dụ tính chữ ký (Node.js):
const crypto = require('crypto');
const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
const stringToSign = ['POST', '/v1/orders', timestamp, nonce, bodyHash].join('\\n');
const signature = crypto.createHmac('sha256', partnerKey).update(stringToSign).digest('hex');`}</Code>
      </Section>

      <Section no={3} id="idempotency" title="Idempotency">
        <Bullets items={[
          <>Mọi request tạo đơn bắt buộc có trường <span className="font-mono text-[13px]">idempotencyKey</span> duy nhất cho mỗi lần đặt; gửi lại cùng key sẽ trả về đơn đã tạo, không trừ tiền hai lần.</>,
          <>Giới hạn tốc độ mặc định 120 request/phút cho mỗi kết nối (cấu hình được ở Admin → Cài đặt).</>,
        ]} />
      </Section>

      <Section no={4} id="endpoint" title="Các endpoint chính">
        <SimpleTable head={["Endpoint", "Mô tả"]} rows={[
          [<span key="a" className="font-mono text-[13px]">POST /v1/card-exchange/submissions</span>, "Gửi thẻ cào để quy đổi vào ví."],
          [<span key="a" className="font-mono text-[13px]">GET /v1/card-exchange/submissions/[id]</span>, "Tra trạng thái một lượt gửi thẻ."],
          [<span key="a" className="font-mono text-[13px]">POST /v1/topups/validate</span>, "Kiểm tra UID/tài khoản nhận trước khi nạp."],
          [<span key="a" className="font-mono text-[13px]">GET /v1/games, /v1/games/[id]/packages</span>, "Danh sách game và các gói nạp."],
          [<span key="a" className="font-mono text-[13px]">GET /v1/cards/products · POST /v1/cards/purchases</span>, "Danh sách thẻ bán và mua thẻ."],
          [<span key="a" className="font-mono text-[13px]">GET /v1/cards/orders/[id]</span>, "Chi tiết đơn mua thẻ (gồm mã đã giao)."],
          [<span key="a" className="font-mono text-[13px]">POST /v1/orders · GET /v1/orders/[id] · POST /v1/orders/[id]/cancel</span>, "Tạo đơn tổng hợp, tra cứu và hủy đơn."],
          [<span key="a" className="font-mono text-[13px]">GET /v1/wallet/balance · /v1/wallet/statement · /v1/wallet/transactions</span>, "Số dư, sao kê và biến động ví."],
          [<span key="a" className="font-mono text-[13px]">GET /v1/products · /v1/prices · /v1/categories · /v1/regions</span>, "Danh mục, sản phẩm, bảng giá và khu vực."],
          [<span key="a" className="font-mono text-[13px]">GET /v1/fx</span>, "Tỉ giá FX tham khảo (khi hệ thống bật)."],
          [<span key="a" className="font-mono text-[13px]">GET /v1/agents/*</span>, "Mạng lưới, bảng giá, hoa hồng và báo cáo cho tài khoản đại lý."],
        ]} />
        <p>Đặc tả đầy đủ từng trường: <a className="text-sundeep font-semibold" href="/openapi.yaml">/openapi.yaml</a></p>
      </Section>

      <Section no={5} id="trang-thai" title="Trạng thái đơn">
        <Bullets items={[
          <><span className="font-mono text-[13px]">SUCCESS</span> — hoàn tất; <span className="font-mono text-[13px]">FAILED</span> — thất bại (tiền giữ được hoàn tự động).</>,
          <><span className="font-mono text-[13px]">UNKNOWN</span> nghĩa là đang xác minh với nhà cung cấp, <b>không phải thất bại</b>. Đối tác nên chờ webhook hoặc tra cứu lại thay vì tạo đơn mới.</>,
          <><span className="font-mono text-[13px]">PENDING / PROCESSING / REVIEW</span> — đang xử lý hoặc đang rà soát rủi ro.</>,
        ]} />
      </Section>

      <Section no={6} id="webhook" title="Webhook">
        <p>Khi trạng thái đơn thay đổi, hệ thống gửi sự kiện (order.success, order.processing, card.delivery.completed, charging.callback…) về endpoint webhook của kết nối. Webhook có chữ ký để bạn xác thực nguồn gửi, giao không thành công sẽ được thử lại theo backoff. Với module Charging, callback dùng format tương thích thị trường và callback_sign = md5(partner_key . code . serial) như tài liệu Charging.</p>
      </Section>
    </div>
  );
}
