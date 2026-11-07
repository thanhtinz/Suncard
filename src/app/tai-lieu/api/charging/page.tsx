import { prisma } from "@/lib/prisma";
import type { DB } from "@/modules/ledger";
import { feeTableForGroup } from "@/modules/charging";
import {
  SITE, ModuleCards, DocHero, ChipNav, Section, KVTable, ParamTable, SimpleTable, Code, SignBox, Bullets, SubTitle, CodeTabs,
} from "@/components/ApiDocs";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("vi-VN");

const SAMPLES = [
  {
    lang: "PHP",
    code: `<?php
$endpoint   = '${SITE}/chargingws/v2';
$partnerId  = 'YOUR_PARTNER_ID';
$partnerKey = 'YOUR_PARTNER_KEY';
$requestId  = 'NAPTHE_20260403_001';

$payload = [
    'command'    => 'charging',
    'partner_id' => $partnerId,
    'request_id' => $requestId,
    'telco'      => 'VIETTEL',
    'amount'     => '100000',
    'serial'     => '10006139342354',
    'code'       => '114384960423544',
];
$payload['sign'] = md5(
    $partnerKey .
    $payload['code'] .
    $payload['command'] .
    $payload['partner_id'] .
    $payload['request_id'] .
    $payload['serial'] .
    $payload['telco']
);

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query($payload),
    CURLOPT_RETURNTRANSFER => true,
]);
echo curl_exec($ch);`,
  },
  {
    lang: "C#",
    code: `string Md5(string s) =>
    Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(s))).ToLower();

var sign = Md5(
    partnerKey + code + "charging" + partnerId + requestId + serial + telco
);

var payload = new Dictionary<string, string>
{
    ["command"] = "charging",
    ["partner_id"] = partnerId,
    ["request_id"] = requestId,
    ["telco"] = telco,
    ["amount"] = "100000",
    ["serial"] = serial,
    ["code"] = code,
    ["sign"] = sign,
};
var res = await new HttpClient().PostAsync(
    "${SITE}/chargingws/v2", new FormUrlEncodedContent(payload));
Console.WriteLine(await res.Content.ReadAsStringAsync());`,
  },
  {
    lang: "Java",
    code: `String sign = md5(
    partnerKey + code + "charging" + partnerId + requestId + serial + telco
);

Map<String, String> payload = new LinkedHashMap<>();
payload.put("command", "charging");
payload.put("partner_id", partnerId);
payload.put("request_id", requestId);
payload.put("telco", telco);
payload.put("amount", "100000");
payload.put("serial", serial);
payload.put("code", code);
payload.put("sign", sign);
// POST payload dạng application/x-www-form-urlencoded
// tới ${SITE}/chargingws/v2`,
  },
  {
    lang: "Node.js",
    code: `const { createHash } = require('crypto');
const md5 = (s) => createHash('md5').update(s).digest('hex');

const sign = md5(
  partnerKey + code + 'charging' + partnerId + requestId + serial + telco
);

const payload = {
  command: 'charging',
  partner_id: partnerId,
  request_id: requestId,
  telco,
  amount: '100000',
  serial,
  code,
  sign,
};

const res = await fetch('${SITE}/chargingws/v2', {
  method: 'POST',
  body: new URLSearchParams(payload),
});
console.log(await res.json());`,
  },
  {
    lang: "Python",
    code: `import hashlib, requests

def md5(s): return hashlib.md5(s.encode()).hexdigest()

sign = md5(partner_key + code + "charging" + partner_id + request_id + serial + telco)

payload = {
    "command": "charging",
    "partner_id": partner_id,
    "request_id": request_id,
    "telco": telco,
    "amount": "100000",
    "serial": serial,
    "code": code,
    "sign": sign,
}
print(requests.post("${SITE}/chargingws/v2", data=payload).json())`,
  },
];

export default async function ChargingDocPage() {
  const fees = await feeTableForGroup(prisma as unknown as DB, "MEMBER").catch(() => []);
  const byTelco = new Map<string, typeof fees>();
  for (const r of fees) {
    const arr = byTelco.get(r.telco) ?? [];
    arr.push(r);
    byTelco.set(r.telco, arr);
  }
  const telcoName: Record<string, string> = {
    VIETTEL: "Viettel", VINAPHONE: "Vinaphone", MOBIFONE: "Mobifone", VNMOBI: "Vietnamobile",
    ZING: "Zing", GARENA: "Garena", VCOIN: "Vcoin", GATE: "Gate", SCOIN: "Scoin",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <ModuleCards active="charging" />
      <DocHero
        badge="API CHARGING V2"
        title="Hướng dẫn kết nối gửi thẻ cào"
        desc="Tài liệu này dùng cho Merchant cần gửi thẻ, kiểm tra trạng thái giao dịch và lấy biểu phí theo tài khoản."
        endpoint={`${SITE}/chargingws/v2`}
      />
      <ChipNav items={[
        { id: "tong-quan", label: "Tổng quan" }, { id: "sign", label: "Chữ ký sign" },
        { id: "tham-so", label: "Tham số" }, { id: "phan-hoi", label: "Phản hồi" },
        { id: "getfee", label: "Getfee" }, { id: "code-mau", label: "Code mẫu" },
      ]} />

      <Section no={1} id="tong-quan" title="Tổng quan tích hợp">
        <KVTable rows={[
          ["Endpoint chính", `${SITE}/chargingws/v2`],
          ["API biểu phí", `${SITE}/chargingws/v2/getfee?partner_id=YOUR_PARTNER_ID`],
          ["Method", "POST"],
          ["Kiểu dữ liệu", "application/x-www-form-urlencoded hoặc JSON"],
          ["Lệnh hỗ trợ", "charging, check"],
        ]} />
      </Section>

      <Section no={2} id="dieu-kien" title="Điều kiện trước khi gọi API">
        <Bullets items={[
          <>Bạn cần có partner_id và partner_key từ mục <b>Kết nối API</b> trong tài khoản, và kết nối phải được admin <b>duyệt</b> trước khi gọi.</>,
          <>Nếu Merchant bật IP whitelist thì request phải gửi từ đúng IP đã đăng ký.</>,
          <>Với command charging, request_id phải là duy nhất theo từng partner_id.</>,
          <>Với command check, hãy dùng lại đúng request_id của giao dịch đã gửi.</>,
          <>Nên gửi telco, serial, code ở dạng sạch, đúng chuẩn để hệ thống xử lý nhanh và dễ đối soát.</>,
        ]} />
      </Section>

      <Section no={3} id="sign" title="Công thức tạo sign">
        <SignBox title="Công thức khuyến nghị cho charging" formula="md5(partner_key . code . command . partner_id . request_id . serial . telco)" note="Đây là công thức nên ưu tiên dùng khi gửi thẻ." />
        <SignBox title="Công thức khuyến nghị cho check" formula="md5(partner_key . command . partner_id . request_id)" note="Phù hợp cho lệnh kiểm tra trạng thái giao dịch." />
        <SignBox title="Công thức tương thích cũ" formula="md5(partner_key . code . serial)" note="API vẫn hỗ trợ để tương thích ngược với client legacy." />
      </Section>

      <Section no={4} id="tham-so" title="Tham số cho lệnh charging">
        <ParamTable rows={[
          { name: "command", required: true, example: "charging", desc: "Lệnh gửi thẻ lên hệ thống." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "request_id", required: true, example: "NAPTHE_20260403_001", desc: "Mã giao dịch phía bạn tự sinh và không được trùng." },
          { name: "telco", required: true, example: "VIETTEL", desc: "Mã nhà mạng." },
          { name: "amount", required: true, example: "100000", desc: "Mệnh giá bạn khai báo." },
          { name: "serial", required: true, example: "10006139342354", desc: "Serial của thẻ." },
          { name: "code", required: true, example: "114384960423544", desc: "Mã nạp (PIN) của thẻ. Trường seri được chấp nhận thay cho serial." },
          { name: "sign", required: true, example: "md5(...)", desc: "Chữ ký xác thực request." },
        ]} />
      </Section>

      <Section no={5} id="tham-so-check" title="Tham số cho lệnh check">
        <ParamTable rows={[
          { name: "command", required: true, example: "check", desc: "Lệnh kiểm tra trạng thái giao dịch." },
          { name: "partner_id", required: true, example: "YOUR_PARTNER_ID", desc: "Mã Merchant của bạn." },
          { name: "request_id", required: true, example: "NAPTHE_20260403_001", desc: "request_id đã dùng khi charging." },
          { name: "sign", required: true, example: "md5(...)", desc: "Khuyến nghị dùng md5(partner_key . command . partner_id . request_id)." },
          { name: "telco / serial / code", required: false, example: "VIETTEL / 10006139342354 / 114384960423544", desc: "Có thể gửi thêm để tương thích công thức sign legacy." },
        ]} />
      </Section>

      <Section no={6} id="payload" title="Ví dụ payload">
        <SubTitle>command=charging</SubTitle>
        <Code>{`{
    "command": "charging",
    "partner_id": "YOUR_PARTNER_ID",
    "request_id": "NAPTHE_20260403_001",
    "telco": "VIETTEL",
    "amount": "100000",
    "serial": "10006139342354",
    "code": "114384960423544",
    "sign": "md5(partner_key . code . command . partner_id . request_id . serial . telco)"
}`}</Code>
        <SubTitle>command=check</SubTitle>
        <Code>{`{
    "command": "check",
    "partner_id": "YOUR_PARTNER_ID",
    "request_id": "NAPTHE_20260403_001",
    "sign": "md5(partner_key . command . partner_id . request_id)"
}`}</Code>
      </Section>

      <Section no={7} id="phan-hoi" title="Cấu trúc phản hồi">
        <SimpleTable head={["Trường", "Mô tả"]} rows={[
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">trans_id</span>, "ID giao dịch trong hệ thống."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">request_id</span>, "Mã giao dịch phía Merchant gửi sang."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">amount</span>, "Số tiền thực nhận về ví sau khi xử lý."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">value</span>, "Mệnh giá thật được xác nhận."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">declared_value</span>, "Mệnh giá Merchant khai báo lúc gửi thẻ."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">telco</span>, "Nhà mạng của thẻ."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">serial</span>, "Serial thẻ đã gửi."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">code</span>, "Mã thẻ đã gửi."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">status</span>, "Trạng thái thẻ hoặc mã lỗi."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">callback_sign</span>, "Chữ ký phản hồi: md5(partner_key . code . serial)."],
          [<span key="a" className="font-mono text-[13px] text-[#C2438F]">message</span>, "Mô tả trạng thái hoặc lỗi."],
        ]} />
      </Section>

      <Section no={8} id="vi-du-response" title="Ví dụ response">
        <SubTitle>Pending</SubTitle>
        <Code>{`{
    "trans_id": "cmk8x2ab0001",
    "request_id": "NAPTHE_20260403_001",
    "amount": 0,
    "value": 0,
    "declared_value": "100000",
    "telco": "VIETTEL",
    "serial": "10006139342354",
    "code": "114384960423544",
    "status": 99,
    "callback_sign": "md5(partner_key . code . serial)",
    "message": "PENDING"
}`}</Code>
        <SubTitle>Success</SubTitle>
        <Code>{`{
    "trans_id": "cmk8x2ab0001",
    "request_id": "NAPTHE_20260403_001",
    "amount": 81000,
    "value": 100000,
    "declared_value": 100000,
    "telco": "VIETTEL",
    "serial": "10006139342354",
    "code": "114384960423544",
    "status": 1,
    "callback_sign": "1d55e0d5f8b4e8f815a3ef...",
    "message": "VALID_CARD"
}`}</Code>
        <SubTitle>Error</SubTitle>
        <Code>{`{
    "status": 102,
    "message": "Dữ liệu xác thực không hợp lệ"
}`}</Code>
      </Section>

      <Section no={9} id="trang-thai" title="Trạng thái thẻ">
        <SimpleTable head={["Status", "Tên", "Mô tả"]} rows={[
          [<span key="a" className="font-mono text-[#C2438F]">99</span>, <span key="b" className="font-mono">PENDING</span>, "Thẻ đang chờ xử lý hoặc nhà cung cấp trả kết quả."],
          [<span key="a" className="font-mono text-[#C2438F]">1</span>, <span key="b" className="font-mono">VALID_CARD</span>, "Thẻ đúng, giao dịch thành công."],
          [<span key="a" className="font-mono text-[#C2438F]">2</span>, <span key="b" className="font-mono">CARD_WRONG_VALUE</span>, "Thẻ đúng nhưng sai mệnh giá khai báo — tính theo mệnh giá thật và trừ phạt 50% mệnh giá nhỏ hơn."],
          [<span key="a" className="font-mono text-[#C2438F]">3</span>, <span key="b" className="font-mono">INVALID_CARD</span>, "Thẻ không hợp lệ hoặc dữ liệu thẻ sai."],
          [<span key="a" className="font-mono text-[#C2438F]">4</span>, <span key="b" className="font-mono">MAINTENANCE</span>, "Nhà mạng hoặc cổng xử lý đang bảo trì."],
        ]} />
      </Section>

      <Section no={10} id="ma-loi" title="Mã lỗi ở mức request">
        <SimpleTable head={["Mã", "Mô tả"]} rows={[
          [<span key="a" className="font-mono text-[#C2438F]">100</span>, "Lỗi xử lý chung hoặc không thể tạo giao dịch."],
          [<span key="a" className="font-mono text-[#C2438F]">101</span>, "Không tìm thấy giao dịch khi gọi command check."],
          [<span key="a" className="font-mono text-[#C2438F]">102</span>, "Sai xác thực request, sai IP, sai sign hoặc dữ liệu không hợp lệ."],
          [<span key="a" className="font-mono text-[#C2438F]">103</span>, "Có ngoại lệ trong quá trình xử lý request."],
          [<span key="a" className="font-mono text-[#C2438F]">104</span>, "Command không hợp lệ. Chỉ hỗ trợ charging và check."],
        ]} />
      </Section>

      <Section no={11} id="getfee" title="API biểu phí và mệnh giá hỗ trợ">
        <p>Dùng endpoint sau để lấy biểu phí theo Merchant:</p>
        <Code>{`${SITE}/chargingws/v2/getfee?partner_id=YOUR_PARTNER_ID`}</Code>
        <p>Response là mảng gồm các trường telco, value, fees (phần trăm phí) và penalty (phần trăm phạt sai mệnh giá). Biểu phí tham khảo cho nhóm Thành viên đang áp dụng:</p>
        <div className="space-y-4">
          {[...byTelco.entries()].map(([telco, rows]) => (
            <div key={telco} className="rounded-2xl border border-[#E7EDF7] p-4">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div>
                  <span className="font-bold text-navy">{telcoName[telco] ?? telco}</span>
                  <span className="block font-mono text-xs text-[#C2438F]">{telco}</span>
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Có gửi mệnh giá</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {rows.map((r) => (
                  <span key={r.value} className="rounded-lg bg-[#F2F6FD] px-2.5 py-1 text-[12.5px] font-semibold text-navy">{fmt(r.value)} · phí {r.fees}%</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <SubTitle>Lưu ý tích hợp</SubTitle>
        <Bullets items={[
          <>Trường status trong response có thể là trạng thái thẻ hoặc mã lỗi ở mức request, nên cần đọc cả message.</>,
          <>Nếu Merchant bật kiểm tra chữ ký thì sign sai sẽ bị từ chối ngay.</>,
          <>Nên gọi API getfee trước khi dựng form nạp phía frontend để lấy đúng biểu phí và mệnh giá hỗ trợ.</>,
          <>Kết quả cuối cùng cũng được gửi về Callback Url đã đăng ký (kiểu GET hoặc POST theo đăng ký), ký bằng callback_sign.</>,
        ]} />
      </Section>

      <Section no={12} id="code-mau" title="Code mẫu theo ngôn ngữ">
        <CodeTabs samples={SAMPLES} />
      </Section>
    </div>
  );
}
