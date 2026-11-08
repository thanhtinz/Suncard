import {
  SITE, ModuleCards, DocHero, ChipNav, Section, KVTable, ParamTable, SimpleTable, Code, SignBox, Bullets, SubTitle, CodeTabs,
} from "@/components/ApiDocs";

export const dynamic = "force-dynamic";

const SAMPLES = [
  {
    lang: "PHP",
    code: `<?php
$endpoint   = '${SITE}/api/rechargews';
$partnerId  = 'YOUR_PARTNER_ID';
$partnerKey = 'YOUR_PARTNER_KEY';
$requestId  = 'TOPUP_20260403_001';

$payload = [
    'command' => 'topup',
    'partner_id' => $partnerId,
    'request_id' => $requestId,
    'service_code' => 'GAME-LIENQUAN',
    'amount' => 10000,
    'account_info' => json_encode(['uid' => '123456789', 'server' => 'VN']),
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
    ["command"] = "topup",
    ["partner_id"] = partnerId,
    ["request_id"] = requestId,
    ["service_code"] = "GAME-LIENQUAN",
    ["amount"] = 10000,
    ["account_info"] = new Dictionary<string, string>
    {
        ["uid"] = "123456789",
        ["server"] = "VN",
    },
};
payload["sign"] = Md5(partnerKey + partnerId + "topup" + requestId);

var res = await new HttpClient().PostAsJsonAsync(
    "${SITE}/api/rechargews", payload);
Console.WriteLine(await res.Content.ReadAsStringAsync());`,
  },
  {
    lang: "Java",
    code: `String sign = md5(partnerKey + partnerId + "topup" + requestId);

String payload = """
    {
      "command": "topup",
      "partner_id": "%s",
      "request_id": "%s",
      "service_code": "GAME-LIENQUAN",
      "amount": 10000,
      "account_info": {"uid": "123456789", "server": "VN"},
      "sign": "%s"
    }
    """.formatted(partnerId, requestId, sign);
// POST payload JSON tới ${SITE}/api/rechargews`,
  },
  {
    lang: "Node.js",
    code: `const { createHash } = require('crypto');
const md5 = (s) => createHash('md5').update(s).digest('hex');

const payload = {
  command: 'topup',
  partner_id: partnerId,
  request_id: requestId,
  service_code: 'GAME-LIENQUAN',
  amount: 10000,
  account_info: { uid: '123456789', server: 'VN' },
};
payload.sign = md5(partnerKey + partnerId + payload.command + requestId);

const res = await fetch('${SITE}/api/rechargews', {
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
    "command": "topup",
    "partner_id": partner_id,
    "request_id": request_id,
    "service_code": "GAME-LIENQUAN",
    "amount": 10000,
    "account_info": {"uid": "123456789", "server": "VN"},
}
payload["sign"] = md5(partner_key + partner_id + "topup" + request_id)

print(requests.post("${SITE}/api/rechargews", json=payload).json())`,
  },
];

export default function RechargeDocPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <ModuleCards active="recharge" />
      <DocHero
        badge="API RECHARGE"
        title="Hướng dẫn nạp tiền dịch vụ"
        desc="Tài liệu này dùng cho Merchant cần nạp topup, kiểm tra trạng thái giao dịch, lấy số dư, danh sách sản phẩm và bảng phí."
        endpoint={`${SITE}/api/rechargews`}
      />
      <ChipNav items={[
        { id: "tong-quan", label: "Tổng quan" }, { id: "sign", label: "Sign" },
        { id: "cac-lenh", label: "Các lệnh" }, { id: "phan-hoi", label: "Phản hồi" },
        { id: "trang-thai", label: "Trạng thái" }, { id: "code-mau", label: "Code mẫu" },
      ]} />

      <Section no={1} id="tong-quan" title="Tổng quan tích hợp">
        <KVTable rows={[
          ["Endpoint chính", `${SITE}/api/rechargews`],
          ["Method khuyến nghị", "POST"],
          ["Kiểu dữ liệu khuyến nghị", "application/json"],
          ["Lệnh hỗ trợ", "topup, getstatus, getbalance, productlist, canceltopup, feetopup"],
        ]} />
      </Section>

      <Section no={2} id="dieu-kien" title="Điều kiện trước khi gọi API">
        <Bullets items={[
          <>Bạn cần có partner_id và partner_key từ mục <b>Kết nối API</b> trước khi gọi, và kết nối phải được admin duyệt.</>,
          <>Merchant và ví thanh toán phải đang hoạt động; tiền được trừ từ ví VND của tài khoản sở hữu kết nối.</>,
          <>IP gửi request phải nằm trong whitelist đã đăng ký (nếu có).</>,
          <>Với lệnh topup, request_id phải là duy nhất để tránh tạo trùng giao dịch.</>,
          <>Nên gọi productlist trước để biết đúng service_code và cấu trúc account_info cần truyền.</>,
        ]} />
      </Section>

      <Section no={3} id="sign" title="Công thức tạo sign">
        <SignBox title="Topup và getstatus, canceltopup" formula="md5(partner_key . partner_id . command . request_id)" note="Dùng cho các lệnh có request_id bắt buộc." />
        <SignBox title="Getbalance, productlist, feetopup" formula="md5(partner_key . partner_id . command)" note="Các lệnh này không dùng request_id trong bước xác thực sign." />
      </Section>

      <Section no={4} id="cac-lenh" title="Chi tiết từng lệnh">
        <SubTitle>1. Lệnh topup — Tạo giao dịch nạp tiền dịch vụ cho tài khoản đích.</SubTitle>
        <ParamTable rows={[
          { name: "command", required: true, example: "topup", desc: "Tên lệnh gọi API." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "request_id", required: true, example: "TOPUP_20260403_001", desc: "Mã giao dịch phía bạn tự sinh và không được trùng." },
          { name: "service_code", required: true, example: "GAME-LIENQUAN", desc: "Mã dịch vụ/sản phẩm cần nạp (lấy từ productlist)." },
          { name: "amount", required: true, example: "10000", desc: "Mệnh giá gói cần nạp." },
          { name: "account_info", required: true, example: `{"uid": "123456789"}`, desc: "Thông tin tài khoản nhận: uid (hoặc playerId/account/phone), kèm server/zone_id nếu game yêu cầu." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký xác thực request." },
        ]} />
        <Code>{`Ví dụ request:
{
    "command": "topup",
    "partner_id": "YOUR_PARTNER_ID",
    "request_id": "TOPUP_20260403_001",
    "service_code": "GAME-LIENQUAN",
    "amount": 10000,
    "account_info": { "uid": "123456789", "server": "VN" },
    "sign": "md5(partner_key . partner_id . command . request_id)"
}

Ví dụ response:
{
    "status": "success",
    "message": "Thành công",
    "data": {
        "time": "2026-04-03T14:30:00.000Z",
        "request_id": "TOPUP_20260403_001",
        "account": { "uid": "123456789", "server": "VN" },
        "order_code": "SC240403001",
        "pay_amount": 10000,
        "discount": 0,
        "service_code": "GAME-LIENQUAN",
        "amount": 10000,
        "status": "completed"
    }
}`}</Code>

        <SubTitle>2. Lệnh getstatus — Tra cứu trạng thái giao dịch recharge đã tạo trước đó.</SubTitle>
        <ParamTable rows={[
          { name: "command", required: true, example: "getstatus", desc: "Tên lệnh gọi API." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "request_id", required: true, example: "TOPUP_20260403_001", desc: "request_id của giao dịch đã gửi." },
          { name: "order_code", required: false, example: "SC240403001", desc: "Mã đơn hệ thống trả về khi tạo giao dịch (dùng khi không tra theo request_id)." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký xác thực request." },
        ]} />
        <Code>{`Ví dụ response:
{
    "status": "success",
    "message": "Thành công",
    "data": {
        "account": { "uid": "123456789", "server": "VN" },
        "request_value": 10000,
        "amount": 10000,
        "request_id": "TOPUP_20260403_001",
        "order_code": "SC240403001",
        "status": "completed"
    }
}`}</Code>

        <SubTitle>3. Lệnh getbalance — Lấy số dư ví Merchant đang dùng để thanh toán recharge.</SubTitle>
        <ParamTable rows={[
          { name: "command", required: true, example: "getbalance", desc: "Tên lệnh gọi API." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký không dùng request_id." },
        ]} />
        <Code>{`Ví dụ response:
{
    "status": "success",
    "message": "Thành công",
    "data": { "balance": 1200000, "currency": "VND" }
}`}</Code>

        <SubTitle>4. Lệnh productlist — Lấy danh sách dịch vụ, mệnh giá, giá bán và các option cần nhập liệu.</SubTitle>
        <ParamTable rows={[
          { name: "command", required: true, example: "productlist", desc: "Tên lệnh gọi API." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký không dùng request_id." },
        ]} />
        <Code>{`Ví dụ response:
{
    "status": "success",
    "message": "Thành công",
    "data": [
        {
            "name": "Liên Quân Mobile",
            "service_code": "GAME-LIENQUAN",
            "items": [
                { "name": "16 Quân Huy", "value": 10000, "price": 10000, "discount": 0 }
            ],
            "options": [
                { "key": "uid", "name": "UID / tài khoản nhận", "type": "text" },
                { "key": "server", "name": "Máy chủ / zone (nếu game yêu cầu)", "type": "text" }
            ]
        }
    ]
}`}</Code>

        <SubTitle>5. Lệnh canceltopup — Yêu cầu hủy giao dịch recharge khi nghiệp vụ cho phép (đơn chưa được nạp).</SubTitle>
        <ParamTable rows={[
          { name: "command", required: true, example: "canceltopup", desc: "Tên lệnh gọi API." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "request_id", required: true, example: "TOPUP_20260403_001", desc: "request_id của giao dịch cần hủy." },
          { name: "order_code", required: false, example: "SC240403001", desc: "Mã đơn hàng cần hủy." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký theo công thức có request_id." },
        ]} />
        <Code>{`Ví dụ response:
{
    "status": "success",
    "message": "Thành công",
    "data": { "request_id": "TOPUP_20260403_001", "order_code": "SC240403001", "status": "canceled" }
}`}</Code>

        <SubTitle>6. Lệnh feetopup — Lấy bảng giá và chiết khấu theo Merchant.</SubTitle>
        <ParamTable rows={[
          { name: "command", required: true, example: "feetopup", desc: "Tên lệnh gọi API." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký không dùng request_id." },
        ]} />
        <Code>{`Ví dụ response:
{
    "status": "success",
    "message": "Thành công",
    "data": [
        { "key": "GAME-LIENQUAN", "value": 10000, "price": 10000, "discount": 0 }
    ]
}`}</Code>
      </Section>

      <Section no={5} id="phan-hoi" title="Ghi chú về phản hồi">
        <Bullets items={[
          <>Recharge API trả về khung JSON gồm status, message và data.</>,
          <>Trường status có thể là chuỗi hoặc số nguyên tùy nhánh xử lý.</>,
          <>Nên xử lý lượng nghiệp vụ theo status, không chỉ dựa vào message.</>,
          <>Giá thực trả cho mỗi đơn được chốt trong trường pay_amount của response topup (đã áp nhóm giá của tài khoản Merchant).</>,
        ]} />
      </Section>

      <Section no={6} id="trang-thai" title="Trạng thái thường gặp">
        <SimpleTable head={["status (envelope)", "Mô tả"]} rows={[
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">success</span>, "Request hợp lệ và xử lý thành công."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">command_invalid</span>, "Lệnh command không nằm trong danh sách hỗ trợ."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">wrong_post_data</span>, "Thiếu hoặc sai dữ liệu đầu vào bắt buộc."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">product_not_found</span>, "Không tìm thấy service_code tương ứng."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">account_info_not_correct</span>, "account_info không đúng định dạng mong muốn hoặc tài khoản đích không hợp lệ."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">payment_fail</span>, "Thanh toán ví thất bại (thường do không đủ số dư)."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">order_not_found</span>, "Không tìm thấy đơn hàng cần tra cứu hoặc hủy."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">wrong_signature</span>, "Sai chữ ký sign, hoặc kết nối chưa được duyệt/đang bị khoá."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">ip_not_allowed</span>, "IP gọi API không nằm trong whitelist cho phép."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">cannot_cancel</span>, "Đơn đã xử lý xong hoặc đang nạp, không thể hủy."],
        ]} />
        <p>Trạng thái đơn trong trường data.status: <span className="font-mono text-[13px]">pending</span> (đang xử lý / đang xác minh), <span className="font-mono text-[13px]">completed</span> (thành công), <span className="font-mono text-[13px]">failed</span> (thất bại, tiền giữ đã được hoàn), <span className="font-mono text-[13px]">canceled</span> (đã hủy), <span className="font-mono text-[13px]">refunded</span> (đã hoàn tiền).</p>
      </Section>

      <Section no={7} id="code-mau" title="Code mẫu theo ngôn ngữ">
        <CodeTabs samples={SAMPLES} />
        <SubTitle>Lưu ý tích hợp</SubTitle>
        <Bullets items={[
          <>Nên gọi productlist trước khi topup để xác định đúng service_code, mệnh giá và option đầu vào.</>,
          <>Sau khi tạo topup, status trong data thường là pending vì hệ thống chuyển tiếp sang nhà cung cấp — dùng getstatus hoặc callback để biết kết quả cuối.</>,
          <>Lệnh canceltopup chỉ hủy được đơn chưa nạp; đơn UNKNOWN đang xác minh không hủy được cho tới khi có kết quả đối soát.</>,
        ]} />
      </Section>
    </div>
  );
}
