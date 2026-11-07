import {
  SITE, ModuleCards, DocHero, ChipNav, Section, KVTable, ParamTable, SimpleTable, Code, SignBox, Bullets, SubTitle, CodeTabs,
} from "@/components/ApiDocs";

export const dynamic = "force-dynamic";

const SAMPLES = [
  {
    lang: "PHP",
    code: `<?php
$endpoint   = '${SITE}/api/cardws';
$partnerId  = 'YOUR_PARTNER_ID';
$partnerKey = 'YOUR_PARTNER_KEY';
$requestId  = 'CARD_20260403_001';

$payload = [
    'command' => 'buycard',
    'partner_id' => $partnerId,
    'request_id' => $requestId,
    'service_code' => 'CARD-VIETTEL',
    'value' => 100000,
    'qty' => 2,
];
$payload['sign'] = md5($partnerKey . $partnerId . $payload['command'] . $requestId);

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_RETURNTRANSFER => true,
]);
echo curl_exec($ch);`,
  },
  {
    lang: "C#",
    code: `var payload = new Dictionary<string, object>
{
    ["command"] = "buycard",
    ["partner_id"] = partnerId,
    ["request_id"] = requestId,
    ["service_code"] = "CARD-VIETTEL",
    ["value"] = 100000,
    ["qty"] = 2,
};
payload["sign"] = Md5(partnerKey + partnerId + "buycard" + requestId);

var res = await new HttpClient().PostAsJsonAsync(
    "${SITE}/api/cardws", payload);
Console.WriteLine(await res.Content.ReadAsStringAsync());`,
  },
  {
    lang: "Java",
    code: `String sign = md5(partnerKey + partnerId + "buycard" + requestId);

String payload = """
    {
      "command": "buycard",
      "partner_id": "%s",
      "request_id": "%s",
      "service_code": "CARD-VIETTEL",
      "value": 100000,
      "qty": 2,
      "sign": "%s"
    }
    """.formatted(partnerId, requestId, sign);
// POST payload JSON tới ${SITE}/api/cardws`,
  },
  {
    lang: "Node.js",
    code: `const { createHash } = require('crypto');
const md5 = (s) => createHash('md5').update(s).digest('hex');

const payload = {
  command: 'buycard',
  partner_id: partnerId,
  request_id: requestId,
  service_code: 'CARD-VIETTEL',
  value: 100000,
  qty: 2,
};
payload.sign = md5(partnerKey + partnerId + payload.command + requestId);

const res = await fetch('${SITE}/api/cardws', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
console.log(await res.json());`,
  },
  {
    lang: "Python",
    code: `import hashlib, requests

def md5(s): return hashlib.md5(s.encode()).hexdigest()

payload = {
    "command": "buycard",
    "partner_id": partner_id,
    "request_id": request_id,
    "service_code": "CARD-VIETTEL",
    "value": 100000,
    "qty": 2,
}
payload["sign"] = md5(partner_key + partner_id + "buycard" + request_id)

print(requests.post("${SITE}/api/cardws", json=payload).json())`,
  },
];

export default function SoftcardDocPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <ModuleCards active="softcard" />
      <DocHero
        badge="API SOFTCARD"
        title="Hướng dẫn mua mã thẻ điện tử"
        desc="Tài liệu này dùng cho Merchant cần mua mã thẻ điện tử, tải lại đơn, kiểm tra tồn kho, lấy số dư ví và danh sách sản phẩm."
        endpoint={`${SITE}/api/cardws`}
      />
      <ChipNav items={[
        { id: "tong-quan", label: "Tổng quan" }, { id: "sign", label: "Sign" },
        { id: "cac-lenh", label: "Các lệnh" }, { id: "san-pham", label: "Sản phẩm" },
        { id: "trang-thai", label: "Trạng thái" }, { id: "code-mau", label: "Code mẫu" },
      ]} />

      <Section no={1} id="tong-quan" title="Tổng quan tích hợp">
        <KVTable rows={[
          ["Endpoint chính", `${SITE}/api/cardws`],
          ["API danh sách sản phẩm", `${SITE}/api/cardws/products?partner_id=YOUR_PARTNER_ID`],
          ["Method", "POST cho /api/cardws, GET cho /api/cardws/products"],
          ["Kiểu dữ liệu", "application/json"],
          ["Lệnh hỗ trợ", "buycard, redownload, checkavailable, getbalance"],
        ]} />
      </Section>

      <Section no={2} id="dieu-kien" title="Điều kiện trước khi gọi API">
        <Bullets items={[
          <>Merchant phải được cấp quyền dùng module Softcard (loại API Mua mã thẻ hoặc Tất cả dịch vụ) và đang hoạt động.</>,
          <>Nếu bật checksign thì sign phải khớp công thức của từng lệnh.</>,
          <>IP gọi API phải nằm trong whitelist Merchant hoặc whitelist hệ thống.</>,
          <>Với buycard và redownload, request_id phải là mã riêng để tránh trùng đơn.</>,
          <>Tiền mua thẻ trừ trực tiếp từ ví VND của tài khoản sở hữu kết nối — ví phải còn hoạt động và đủ số dư. Tham số wallet_number của một số hệ thống khác không cần gửi sang SunCard.</>,
        ]} />
      </Section>

      <Section no={3} id="sign" title="Công thức tạo sign">
        <SignBox title="Buycard và redownload" formula="md5(partner_key . partner_id . command . request_id)" note="Áp dụng cho các lệnh có request_id bắt buộc." />
        <SignBox title="Checkavailable và getbalance" formula="md5(partner_key . partner_id . command)" note="Dùng cho các lệnh không cần request_id." />
      </Section>

      <Section no={4} id="cac-lenh" title="Chi tiết từng lệnh">
        <SubTitle>1. Lệnh buycard — Mua mã thẻ điện tử và nhận card ngay nếu hệ thống xử lý thành công.</SubTitle>
        <ParamTable rows={[
          { name: "command", required: true, example: "buycard", desc: "Tên lệnh gọi API." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "request_id", required: true, example: "CARD_20260403_001", desc: "Mã giao dịch phía bạn tự sinh và không được trùng." },
          { name: "service_code", required: true, example: "CARD-VIETTEL", desc: "Mã sản phẩm muốn mua." },
          { name: "value", required: true, example: "100000", desc: "Mệnh giá thẻ." },
          { name: "qty", required: false, example: "2", desc: "Số lượng thẻ cần mua, là số nguyên dương (tối đa 50). Mặc định 1." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký xác thực request." },
        ]} />
        <Code>{`Ví dụ request:
{
    "command": "buycard",
    "partner_id": "YOUR_PARTNER_ID",
    "request_id": "CARD_20260403_001",
    "service_code": "CARD-VIETTEL",
    "value": 100000,
    "qty": 2,
    "sign": "md5(partner_key . partner_id . command . request_id)"
}

Ví dụ response:
{
    "status": 1,
    "message": "Mua thẻ thành công",
    "data": {
        "cards": [
            {
                "name": "Thẻ Viettel 100.000đ",
                "serial": "10006139342354",
                "code": "114384960423544",
                "expired": "2027-12-31"
            }
        ],
        "request_id": "CARD_20260403_001",
        "order_code": "SC240403001"
    }
}`}</Code>

        <SubTitle>2. Lệnh redownload — Tải lại thông tin card của đơn hàng đã mua trước đó.</SubTitle>
        <ParamTable rows={[
          { name: "command", required: true, example: "redownload", desc: "Tên lệnh gọi API." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "request_id", required: true, example: "CARD_20260403_001", desc: "request_id đã dùng khi mua thẻ." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký xác thực request." },
        ]} />
        <Code>{`Ví dụ response: giống hệt response buycard của đơn gốc (cùng danh sách cards, cùng order_code).`}</Code>

        <SubTitle>3. Lệnh checkavailable — Kiểm tra tồn kho sản phẩm trước khi mua.</SubTitle>
        <ParamTable rows={[
          { name: "command", required: true, example: "checkavailable", desc: "Tên lệnh gọi API." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "service_code", required: true, example: "CARD-VIETTEL", desc: "Mã sản phẩm cần kiểm tra." },
          { name: "value", required: true, example: "100000", desc: "Mệnh giá thẻ cần kiểm tra." },
          { name: "qty", required: false, example: "5", desc: "Số lượng muốn kiểm tra tồn kho." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký xác thực request." },
        ]} />
        <Code>{`Ví dụ response:
{
    "status": 1,
    "message": "Thành công",
    "stock_available": true,
    "available_qty": 120,
    "VIETTEL-100000": "Còn hàng"
}`}</Code>

        <SubTitle>4. Lệnh getbalance — Lấy số dư ví của Merchant đang dùng để mua card.</SubTitle>
        <ParamTable rows={[
          { name: "command", required: true, example: "getbalance", desc: "Tên lệnh gọi API." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký không dùng request_id." },
        ]} />
        <Code>{`Ví dụ response:
{
    "status": 1,
    "message": "Thành công",
    "balance": "2500000",
    "currency_code": "VND"
}`}</Code>
      </Section>

      <Section no={5} id="san-pham" title="API danh sách sản phẩm">
        <p>Dùng endpoint sau để lấy danh sách sản phẩm và mệnh giá hỗ trợ:</p>
        <Code>{`${SITE}/api/cardws/products?partner_id=YOUR_PARTNER_ID`}</Code>
        <Code>{`Ví dụ response:
[
    {
        "name": "Viettel",
        "slug": "viettel",
        "service_code": "CARD-VIETTEL",
        "image": "/uploads/softcard/viettel.png",
        "cardvalue": [
            { "service_code": "CARD-VIETTEL", "value": 100000, "id": "variant-id" }
        ]
    }
]`}</Code>
      </Section>

      <Section no={6} id="ghi-chu" title="Ghi chú về phản hồi">
        <Bullets items={[
          <>buycard và redownload trả về JSON theo khung status, message, data.</>,
          <>checkavailable trả về JSON trực tiếp gồm stock_available và thông tin tồn kho.</>,
          <>getbalance trả về JSON trực tiếp gồm balance và currency_code.</>,
          <>API /api/cardws/products trả về mảng sản phẩm JSON trực tiếp.</>,
          <>Gửi lại buycard với cùng request_id sẽ trả về đúng đơn đã mua (kèm mã thẻ), không trừ tiền lần hai.</>,
        ]} />
      </Section>

      <Section no={7} id="trang-thai" title="Bảng mã trạng thái">
        <SimpleTable head={["Mã", "Mô tả"]} rows={[
          [<span key="a" className="font-mono text-[#C2438F]">1</span>, "Mua thẻ thành công hoặc tải lại card thành công."],
          [<span key="a" className="font-mono text-[#C2438F]">2</span>, "Đơn hàng đang chờ xử lý (đang xác minh rủi ro hoặc chờ giao thẻ)."],
          [<span key="a" className="font-mono text-[#C2438F]">3</span>, "Đơn hàng đã hủy và hoàn tiền."],
          [<span key="a" className="font-mono text-[#C2438F]">102</span>, "Số dư ví không đủ."],
          [<span key="a" className="font-mono text-[#C2438F]">104</span>, "Command không hợp lệ."],
          [<span key="a" className="font-mono text-[#C2438F]">114</span>, "Merchant gọi sai IP đăng ký."],
          [<span key="a" className="font-mono text-[#C2438F]">116</span>, "Sai chữ ký ký sign, hoặc kết nối chưa được duyệt/đang bị khoá."],
          [<span key="a" className="font-mono text-[#C2438F]">118</span>, "Sản phẩm đã hết hàng."],
          [<span key="a" className="font-mono text-[#C2438F]">129</span>, "Đơn hàng không tồn tại."],
          [<span key="a" className="font-mono text-[#C2438F]">130</span>, "Lỗi lấy thẻ từ nguồn cung cấp."],
        ]} />
      </Section>

      <Section no={8} id="code-mau" title="Code mẫu theo ngôn ngữ">
        <CodeTabs samples={SAMPLES} />
        <SubTitle>Lưu ý tích hợp</SubTitle>
        <Bullets items={[
          <>Nên gọi API products trước để lấy đúng service_code và mệnh giá hợp lệ.</>,
          <>buycard sẽ trừ tiền ví Merchant rồi cố gắng lấy card ngay từ hệ thống hoặc nhà cung cấp.</>,
          <>redownload chỉ nên dùng khi request_id cũ đã mua thành công.</>,
          <>checkavailable thường được dùng để kiểm tra tồn kho trước khi cho phép đặt mua số lượng lớn.</>,
        ]} />
      </Section>
    </div>
  );
}
