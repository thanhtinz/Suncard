import crypto from "crypto";
import { prisma, assert, assertEq, uniq } from "./helpers";
import {
  md5Hex, legacySign, extendedSign, checkSign, verifyChargingSign, verifyCheckSign,
  toChargingStatus, buildChargingResponse, callbackSign, getExchangeFee,
} from "../src/modules/charging";
import { POST as chargingPOST } from "../src/app/chargingws/v2/route";
import type { DB } from "../src/modules/ledger";

const db = prisma as unknown as DB;
const PARTNER_ID = "demo-partner";
const PARTNER_KEY = "sc_demo_secret_0001";

function formReq(fields: Record<string, string>) {
  return new Request("http://localhost/chargingws/v2", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}
async function call(fields: Record<string, string>) {
  const res = await chargingPOST(formReq(fields));
  return { status: res.status, json: (await res.json()) as any };
}

export async function run() {
  // 1) Sign legacy đúng/sai, extended đúng, check đúng — mức hàm
  {
    const f = { command: "charging", partner_id: PARTNER_ID, request_id: "r1", telco: "VIETTEL", amount: "100000", serial: "100088001234567", code: "1234567890123", sign: "" };
    const legacy = legacySign(PARTNER_KEY, f.code, f.serial);
    assertEq(legacy, md5Hex(`${PARTNER_KEY}${f.code}${f.serial}`), "legacy = md5(key+code+serial)");
    assert(verifyChargingSign(PARTNER_KEY, { ...f, sign: legacy }), "legacy sign đúng -> pass");
    assert(!verifyChargingSign(PARTNER_KEY, { ...f, sign: md5Hex("sai") }), "legacy sign sai -> fail");
    const ext = extendedSign(PARTNER_KEY, { code: f.code, command: "charging", partnerId: PARTNER_ID, requestId: "r1", serial: f.serial, telco: "VIETTEL" });
    assert(verifyChargingSign(PARTNER_KEY, { ...f, sign: ext }), "extended sign đúng -> pass");
    const chk = checkSign(PARTNER_KEY, { command: "check", partnerId: PARTNER_ID, requestId: "r1" });
    assert(verifyCheckSign(PARTNER_KEY, { command: "check", partner_id: PARTNER_ID, request_id: "r1", sign: chk }), "check sign đúng -> pass");
    assert(!verifyCheckSign(PARTNER_KEY, { command: "check", partner_id: PARTNER_ID, request_id: "r1", sign: md5Hex("sai") }), "check sign sai -> fail");
    console.log("PASS charging sign formulas (legacy/extended/check)");
  }

  // 2) Status mapping hai chiều
  {
    assertEq(toChargingStatus("SUCCESS", { wrongValue: false }), 1, "SUCCESS đúng mệnh giá -> 1");
    assertEq(toChargingStatus("SUCCESS", { wrongValue: true }), 2, "SUCCESS sai mệnh giá -> 2");
    assertEq(toChargingStatus("FAILED"), 3, "FAILED -> 3");
    assertEq(toChargingStatus("PENDING"), 99, "PENDING -> 99");
    assertEq(toChargingStatus("UNKNOWN"), 99, "UNKNOWN -> 99 (không hiển thị thất bại)");
    assertEq(toChargingStatus("REVIEW"), 99, "REVIEW -> 99");
    console.log("PASS charging status mapping");
  }

  // 3) Bảng phí ma trận từ DB (số liệu nghiên cứu): Viettel 100k MEMBER 14.5%, API thấp hơn, penalty 50%
  {
    const member = await getExchangeFee(db, "VIETTEL", 100000n, "MEMBER");
    assertEq(member!.feeBps, 1450, "Viettel 100k MEMBER fee 14.5%");
    assertEq(member!.penaltyBps, 5000, "penalty 50%");
    const api = await getExchangeFee(db, "VIETTEL", 100000n, "API");
    assertEq(api!.feeBps, 1300, "Viettel 100k API fee 13% (thấp hơn MEMBER 1.5 điểm)");
    const vn = await getExchangeFee(db, "VNMOBI", 10000n, "MEMBER");
    assertEq(vn!.feeBps, 3800, "Vietnamobile 38% phẳng");
    console.log("PASS exchange fee matrix from DB");
  }

  // 4) Route: charging bằng legacy sign -> SUCCESS status 1, payout đúng phí API
  const reqId1 = uniq("req");
  const serial1 = `100088${Date.now().toString().slice(-7)}`;
  const code1 = `555666777${Date.now().toString().slice(-4)}`;
  {
    const sign = legacySign(PARTNER_KEY, code1, serial1);
    const r = await call({ command: "charging", partner_id: PARTNER_ID, request_id: reqId1, telco: "VIETTEL", amount: "100000", serial: serial1, code: code1, sign });
    assertEq(r.json.status, 1, "charging legacy sign -> status 1");
    assertEq(r.json.declared_value, 100000, "declared 100000");
    assertEq(r.json.value, 100000, "value 100000");
    // API fee Viettel 100k = 13% -> nhận 87000
    assertEq(r.json.amount, 87000, "amount = 100000 x (1 - 13%)");
    assertEq(r.json.callback_sign, callbackSign(PARTNER_KEY, code1, serial1), "callback_sign = md5(key+code+serial)");
    assert(r.json.trans_id, "có trans_id");
    console.log("PASS charging route legacy sign + payout");
  }

  // 5) Route: request_id trùng -> không tạo đơn trùng, trả cùng trans_id
  {
    const sign = legacySign(PARTNER_KEY, code1, serial1);
    const r = await call({ command: "charging", partner_id: PARTNER_ID, request_id: reqId1, telco: "VIETTEL", amount: "100000", serial: serial1, code: code1, sign });
    assertEq(r.json.status, 1, "trùng request_id trả trạng thái cũ");
    const client = await prisma.apiClient.findUnique({ where: { clientId: PARTNER_ID } });
    const count = await prisma.order.count({ where: { userId: client!.userId!, idempotencyKey: `charging:${PARTNER_ID}:${reqId1}` } });
    assertEq(count, 1, "trùng request_id -> đúng 1 order");
    const payoutEntries = await prisma.ledgerTransaction.count({ where: { idempotencyKey: `exchange-payout:${r.json.trans_id}` } });
    assertEq(payoutEntries, 1, "chỉ 1 bút toán payout");
    console.log("PASS charging duplicate request_id idempotent");
  }

  // 6) Route: sai sign -> 102; sai command -> 104; check không thấy -> 101; check thấy -> trạng thái đúng
  {
    const bad = await call({ command: "charging", partner_id: PARTNER_ID, request_id: uniq("req"), telco: "VIETTEL", amount: "100000", serial: "100088001111111", code: "1112223334445", sign: md5Hex("sai") });
    assertEq(bad.json.status, 102, "sai sign -> 102");
    const badCmd = await call({ command: "refund", partner_id: PARTNER_ID, request_id: "x", sign: "x" });
    assertEq(badCmd.json.status, 104, "sai command -> 104");
    const notFoundId = uniq("nope");
    const chkSign = checkSign(PARTNER_KEY, { command: "check", partnerId: PARTNER_ID, requestId: notFoundId });
    const notFound = await call({ command: "check", partner_id: PARTNER_ID, request_id: notFoundId, sign: chkSign });
    assertEq(notFound.json.status, 101, "check không thấy giao dịch -> 101");
    const chkSign2 = checkSign(PARTNER_KEY, { command: "check", partnerId: PARTNER_ID, requestId: reqId1 });
    const found = await call({ command: "check", partner_id: PARTNER_ID, request_id: reqId1, sign: chkSign2 });
    assertEq(found.json.status, 1, "check giao dịch đã có -> status 1");
    assertEq(found.json.trans_id, (await call({ command: "check", partner_id: PARTNER_ID, request_id: reqId1, sign: chkSign2 })).json.trans_id, "check ổn định trans_id");
    console.log("PASS charging error codes 102/104/101 + check");
  }

  // 7) Route: extended sign + alias "seri" + sai mệnh giá (PIN đuôi 111) -> status 2, tính theo mệnh giá thật trừ penalty 50% mệnh giá nhỏ
  {
    const reqId = uniq("req");
    const serial = `100088${Date.now().toString().slice(-7)}9`;
    const code = `777888999111`; // đuôi 111 -> mock sai mệnh giá: khai 100k, thật 50k
    const sign = extendedSign(PARTNER_KEY, { code, command: "charging", partnerId: PARTNER_ID, requestId: reqId, serial, telco: "VIETTEL" });
    const r = await call({ command: "charging", partner_id: PARTNER_ID, request_id: reqId, telco: "VIETTEL", amount: "100000", seri: serial, code, sign });
    assertEq(r.json.status, 2, "sai mệnh giá -> status 2");
    assertEq(r.json.value, 50000, "value = mệnh giá thật 50k");
    // amount = 50000 - fee API của 50k (1550-150=1400 bps -> 7000) - penalty 50% x min(100000,50000)=25000 -> 18000
    assertEq(r.json.amount, 18000, "amount sau phí mệnh giá thật + penalty 50% mệnh giá nhỏ");
    const order = await prisma.order.findFirst({ where: { idempotencyKey: `charging:${PARTNER_ID}:${reqId}` } });
    const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: order!.id } });
    assert(ex!.wrongValue, "exchange ghi wrongValue");
    assertEq(ex!.penaltyMinor, 25000n, "penalty = 50% mệnh giá nhỏ hơn");
    console.log("PASS charging extended sign + seri alias + wrong value penalty");
  }

  // 8) Route: thẻ lỗi (PIN đuôi 000) -> status 3, không có payout ledger
  {
    const reqId = uniq("req");
    const serial = `100088${Date.now().toString().slice(-7)}8`;
    const code = `444555666000`;
    const sign = legacySign(PARTNER_KEY, code, serial);
    const r = await call({ command: "charging", partner_id: PARTNER_ID, request_id: reqId, telco: "VIETTEL", amount: "50000", serial, code, sign });
    assertEq(r.json.status, 3, "thẻ lỗi -> status 3");
    assertEq(r.json.amount, 0, "thẻ lỗi amount 0");
    const order = await prisma.order.findFirst({ where: { idempotencyKey: `charging:${PARTNER_ID}:${reqId}` } });
    assertEq(order!.status, "FAILED", "order FAILED");
    const payout = await prisma.ledgerTransaction.count({ where: { idempotencyKey: `exchange-payout:${order!.id}` } });
    assertEq(payout, 0, "không post ledger cho thẻ lỗi");
    console.log("PASS charging failed card no payout");
  }

  // 9) buildChargingResponse: callback_sign trong payload khớp công thức thị trường
  {
    const order = await prisma.order.findFirst({ where: { idempotencyKey: `charging:${PARTNER_ID}:${reqId1}` } });
    const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: order!.id } });
    const res = buildChargingResponse({ partnerKey: PARTNER_KEY, order, exchange: ex, serial: serial1, code: code1 });
    assertEq(res.callback_sign, md5Hex(`${PARTNER_KEY}${code1}${serial1}`), "payload callback_sign đúng công thức");
    assertEq(res.status, 1, "payload status đúng");
    console.log("PASS charging callback payload");
  }
}
