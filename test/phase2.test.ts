import http from "node:http";
import crypto from "node:crypto";
import { prisma, makeFundedUser, assert, assertEq, assertThrows, uniq } from "./helpers";
import { getWalletBalances, type DB } from "../src/modules/ledger";
import { setSetting } from "../src/modules/settings";
import { encryptSecret } from "../src/lib/crypto";
import { submitExchange, inquireOrder } from "../src/modules/orders-service";
import { fetchUpstreamFees } from "../src/modules/http-charging";
import { runReconciliation } from "../src/modules/reconciliation";
import { cronSecretMatches, runOpsCron } from "../src/modules/ops";
import { incrementRateCounter, rateLimitDistributed } from "../src/modules/rate-limit";
import { createVnpayDeposit, handleVnpayIpn, vnpaySecureHash, verifyVnpaySignature } from "../src/modules/vnpay";
import { startPasskeyRegistration, startPasskeyLogin, consumeChallenge, finishPasskeyLogin } from "../src/modules/webauthn";
import { getFxRates, vndToUsd } from "../src/modules/fx";

const db = prisma as unknown as DB;
const PARTNER_KEY = "stub-partner-key-0123456789";

// ---- Stub upstream gạch thẻ theo chuẩn /chargingws/v2 ----
// Hành vi theo tiền tố serial: OK* -> 1 ngay; WRONG* -> 2 (chấp nhận 10.000);
// BAD* -> 3; LATER* -> charging 99, check -> 1; GARBAGE* -> charging trả rác, check -> 1.
function startStubUpstream() {
  const seen = new Map<string, { serial: string; declare: string }>();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname.endsWith("/getfee")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([{ telco: "Viettel", value: 10000, fees: 12 }, { telco: "Viettel", value: 50000, fees: 10 }]));
      return;
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        const p = new URLSearchParams(body);
        const g = (k: string) => p.get(k) ?? "";
        // Ký mở rộng đúng chuẩn repo (charging.ts extendedSign / checkSign).
        const expect = g("command") === "check"
          ? crypto.createHash("md5").update(PARTNER_KEY + "check" + g("partner_id") + g("request_id")).digest("hex")
          : crypto.createHash("md5").update(PARTNER_KEY + g("code") + "charging" + g("partner_id") + g("request_id") + g("serial") + g("telco")).digest("hex");
        res.writeHead(200, { "Content-Type": "application/json" });
        if (g("sign") !== expect) { res.end(JSON.stringify({ status: 100, message: "sign error" })); return; }
        if (g("command") === "check") {
          const rec = seen.get(g("request_id"));
          if (!rec) { res.end(JSON.stringify({ status: 101, message: "unknown request" })); return; }
          if (rec.serial.startsWith("BAD")) { res.end(JSON.stringify({ status: 3, trans_id: `UT-${g("request_id")}` })); return; }
          if (rec.serial.startsWith("WRONG")) { res.end(JSON.stringify({ status: 2, value: 10000, amount: 10000, trans_id: `UT-${g("request_id")}` })); return; }
          res.end(JSON.stringify({ status: 1, value: Number(rec.declare), amount: Number(rec.declare), trans_id: `UT-${g("request_id")}` }));
          return;
        }
        // command=charging
        const serial = g("serial");
        seen.set(g("request_id"), { serial, declare: g("amount") });
        if (serial.startsWith("GARBAGE")) { res.end("upstream dang bao tri - khong phai JSON"); return; }
        if (serial.startsWith("BAD")) { res.end(JSON.stringify({ status: 3, message: "the sai", trans_id: `UT-${g("request_id")}` })); return; }
        if (serial.startsWith("WRONG")) { res.end(JSON.stringify({ status: 2, value: 10000, amount: 10000, trans_id: `UT-${g("request_id")}`, message: "sai menh gia" })); return; }
        if (serial.startsWith("LATER")) { res.end(JSON.stringify({ status: 99, trans_id: `UT-${g("request_id")}`, message: "pending" })); return; }
        res.end(JSON.stringify({ status: 1, value: Number(g("amount")), amount: Number(g("amount")), trans_id: `UT-${g("request_id")}`, message: "ok" }));
      });
      return;
    }
    res.writeHead(404); res.end();
  });
  return new Promise<{ server: http.Server; port: number }>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as any).port }));
  });
}

export async function run() {
  const suiteStart = new Date();
  const { server, port } = await startStubUpstream();
  try {
    await setSetting("security.allow_private_egress", true);

    // ---- Setup provider HTTP_CHARGING trỏ vào stub + credential mã hoá + phí xác định ----
    const baseUrl = `http://127.0.0.1:${port}/chargingws/v2`;
    let provider = await prisma.provider.findUnique({ where: { code: "HTTP_CHARGING" } });
    if (!provider) {
      provider = await prisma.provider.create({ data: { code: "HTTP_CHARGING", name: "Stub upstream (test)", type: "API", priority: 50, status: "ACTIVE", config: "{}" } });
      await prisma.providerCapability.create({ data: { providerId: provider.id, productType: "EXCHANGE", region: "VN", currency: "VND", supported: true } });
    }
    await prisma.provider.update({ where: { id: provider.id }, data: { status: "ACTIVE", config: JSON.stringify({ baseUrl, partnerId: "STUBPARTNER", signMode: "extended" }) } });
    provider = (await prisma.provider.findUnique({ where: { code: "HTTP_CHARGING" } }))!;
    await prisma.providerCredential.deleteMany({ where: { providerId: provider.id, name: "partner_key" } });
    await prisma.providerCredential.create({ data: { providerId: provider.id, name: "partner_key", secretRef: "vault:test", secretEnc: encryptSecret(PARTNER_KEY) } });
    await setSetting("exchange.provider_code", "HTTP_CHARGING");
    // Phí MEMBER VIETTEL: 10% cả 2 mệnh giá dùng trong test; phạt sai mệnh giá 50% mệnh giá nhỏ hơn.
    for (const face of [50000n, 10000n]) {
      await prisma.exchangeFeeRule.upsert({
        where: { telco_faceValueMinor_groupCode: { telco: "VIETTEL", faceValueMinor: face, groupCode: "MEMBER" } },
        create: { telco: "VIETTEL", faceValueMinor: face, groupCode: "MEMBER", feeBps: 1000, penaltyBps: 5000, isActive: true },
        update: { feeBps: 1000, penaltyBps: 5000, isActive: true },
      });
    }
    console.log("PASS setup HTTP_CHARGING -> stub upstream");

    // ---- 1) E2E: charging status 1 -> SUCCESS + ví cộng đúng thực nhận 1 lần ----
    {
      const user = await makeFundedUser(0n);
      const serial = uniq("OKSER");
      const r = await submitExchange({ userId: user.id, carrier: "VIETTEL", serial, pin: uniq("PIN") + "999", faceValueMinor: 50000n, idempotencyKey: uniq("ex") });
      assertEq(r.order!.status, "SUCCESS", "HTTP charging status 1 -> SUCCESS");
      const bal = await getWalletBalances(db, user.id);
      assertEq(bal.available, 45000n, "ví cộng 45.000 (50.000 - phí 10%)");
      const tx = await prisma.providerTransaction.findFirst({ where: { orderId: r.order!.id, action: "CREATE" } });
      assert(tx && tx.status === "SUCCESS", "provider transaction CREATE/SUCCESS đã ghi");
      console.log("PASS HTTP_CHARGING e2e charging -> SUCCESS + credit once");
    }

    // ---- 2) Sai mệnh giá: status 2 -> SUCCESS theo mệnh giá chấp nhận + phạt ----
    {
      const user = await makeFundedUser(0n);
      const serial = uniq("WRONGSER");
      const r = await submitExchange({ userId: user.id, carrier: "VIETTEL", serial, pin: uniq("PIN") + "888", faceValueMinor: 50000n, idempotencyKey: uniq("ex") });
      assertEq(r.order!.status, "SUCCESS", "sai mệnh giá upstream vẫn SUCCESS");
      const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: r.order!.id } });
      assertEq(ex!.acceptedValueMinor, 10000n, "mệnh giá chốt = mệnh giá upstream chấp nhận 10.000");
      assertEq(ex!.wrongValue, true, "đánh dấu sai mệnh giá");
      const bal = await getWalletBalances(db, user.id);
      // 10.000 - phí 10% (1.000) - phạt 50% mệnh giá nhỏ hơn (5.000) = 4.000
      assertEq(bal.available, 4000n, "thực nhận sai mệnh giá = 4.000");
      console.log("PASS HTTP_CHARGING wrong denomination (status 2 + penalty)");
    }

    // ---- 3) Thẻ sai: status 3 -> FAILED, không cộng ví ----
    {
      const user = await makeFundedUser(0n);
      const r = await submitExchange({ userId: user.id, carrier: "VIETTEL", serial: uniq("BADSER"), pin: uniq("PIN") + "777", faceValueMinor: 50000n, idempotencyKey: uniq("ex") });
      assertEq(r.order!.status, "FAILED", "status 3 -> FAILED");
      const bal = await getWalletBalances(db, user.id);
      assertEq(bal.available, 0n, "thẻ sai không cộng ví");
      console.log("PASS HTTP_CHARGING bad card (status 3 -> FAILED)");
    }

    // ---- 4) 99 -> PENDING; inquiry (check) chốt SUCCESS, cộng đúng 1 lần dù hỏi 2 lần ----
    {
      const user = await makeFundedUser(0n);
      const r = await submitExchange({ userId: user.id, carrier: "VIETTEL", serial: uniq("LATERSER"), pin: uniq("PIN") + "666", faceValueMinor: 50000n, idempotencyKey: uniq("ex") });
      assertEq(r.order!.status, "PENDING", "status 99 -> PENDING chờ xử lý");
      const q1 = await inquireOrder(r.order!.id, "test");
      assertEq(q1.order!.status, "SUCCESS", "check chốt SUCCESS cho đơn PENDING");
      let bal = await getWalletBalances(db, user.id);
      assertEq(bal.available, 45000n, "inquiry cộng đúng thực nhận");
      const q2 = await inquireOrder(r.order!.id, "test");
      assertEq(q2.order!.status, "SUCCESS", "inquiry lần 2 không đổi trạng thái");
      bal = await getWalletBalances(db, user.id);
      assertEq(bal.available, 45000n, "inquiry lần 2 KHÔNG cộng thêm");
      console.log("PASS HTTP_CHARGING pending -> inquiry resolves once");
    }

    // ---- 5) getfee từ upstream ----
    {
      const fees = await fetchUpstreamFees(db, provider);
      assert(Array.isArray(fees) && fees.some((f) => f.faceValueMinor === 50000n && f.feeBps === 1000), "getfee trả bảng phí upstream (50.000 -> 10%)");
      console.log("PASS HTTP_CHARGING getfee");
    }

    // ---- 6) Đối soát tự động với stub: không lệch cho các đơn đã chốt ----
    {
      const runRec = await runReconciliation(db, { providerId: provider.id, from: suiteStart, to: new Date(), createdBy: "test" });
      assert(runRec.totalItems >= 3, `đối soát kiểm >= 3 đơn (được ${runRec.totalItems})`);
      assertEq(runRec.mismatched, 0, "đối soát stub: 0 lệch");
      console.log("PASS reconciliation HTTP_CHARGING vs stub");
    }

    // ---- 7) Cron: secret timing-safe fail-closed + inquiry đơn UNKNOWN tồn đọng ----
    {
      const prev = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;
      assertEq(cronSecretMatches("anything"), false, "chưa đặt CRON_SECRET -> fail-closed");
      process.env.CRON_SECRET = "cron-test-secret";
      assertEq(cronSecretMatches("cron-test-secret"), true, "cron secret đúng -> pass");
      assertEq(cronSecretMatches("sai-secret"), false, "cron secret sai -> reject");
      assertEq(cronSecretMatches(null), false, "thiếu header -> reject");

      const user = await makeFundedUser(0n);
      const r = await submitExchange({ userId: user.id, carrier: "VIETTEL", serial: uniq("GARBAGESER"), pin: uniq("PIN") + "555", faceValueMinor: 50000n, idempotencyKey: uniq("ex") });
      assertEq(r.order!.status, "UNKNOWN", "upstream trả rác -> UNKNOWN (không failover, không FAILED)");
      const staleAt = new Date(Date.now() - 2 * 3600 * 1000);
      await prisma.order.update({ where: { id: r.order!.id }, data: { createdAt: staleAt, updatedAt: staleAt } });
      const summary = await runOpsCron();
      assert(summary.inquired >= 1, "cron đã inquiry các đơn tồn đọng");
      const fresh = await prisma.order.findUnique({ where: { id: r.order!.id } });
      assertEq(fresh!.status, "SUCCESS", "cron: UNKNOWN -> SUCCESS theo check upstream");
      const bal = await getWalletBalances(db, user.id);
      assertEq(bal.available, 45000n, "cron inquiry cộng ví đúng 1 lần");
      if (prev === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prev;
      console.log("PASS cron secret + ops cron inquiry/reconcile");
    }

    // ---- 8) Rate limit phân tán: đếm đúng dưới gọi song song ----
    {
      const key = uniq("rl:");
      const counts = await Promise.all(Array.from({ length: 20 }, () => incrementRateCounter(key)));
      const sorted = [...counts].sort((a, b) => a - b);
      assertEq(JSON.stringify(sorted), JSON.stringify(Array.from({ length: 20 }, (_, i) => i + 1)), "20 lần tăng song song cho đúng dãy 1..20 (nguyên tử)");
      const key2 = uniq("rl2:");
      const results: boolean[] = [];
      for (let i = 0; i < 7; i++) results.push(await rateLimitDistributed(key2, 5));
      assertEq(JSON.stringify(results), JSON.stringify([true, true, true, true, true, false, false]), "giới hạn 5/phút giữ nguyên ngưỡng");
      console.log("PASS distributed rate limit (atomic under parallel calls)");
    }

    // ---- 9) VNPay: ký/kiểm chữ ký + IPN cộng đúng 1 lần + sai chữ ký bị từ chối ----
    {
      await setSetting("vnpay.enabled", true);
      await setSetting("vnpay.tmn_code", "TESTTMN01");
      const { encryptVnpaySecret } = await import("../src/modules/vnpay");
      await setSetting("vnpay.hash_secret_enc", encryptVnpaySecret("vnpay-test-hash-secret"));
      const user = await makeFundedUser(0n);
      const { intent, url } = await createVnpayDeposit(user.id, 200000n, "http://localhost:3000/api/payments/vnpay/return");
      const u = new URL(url);
      const params: Record<string, string> = {};
      u.searchParams.forEach((v, k) => { params[k] = v; });
      assertEq(params.vnp_TmnCode, "TESTTMN01", "URL có vnp_TmnCode");
      assertEq(params.vnp_Amount, "20000000", "vnp_Amount = tiền x 100");
      assert(verifyVnpaySignature("vnpay-test-hash-secret", params), "secure hash trên URL tự kiểm đúng");
      assert(!verifyVnpaySignature("secret-khac", params), "secret khác -> chữ ký không khớp");

      const ipn: Record<string, string> = {
        vnp_TmnCode: "TESTTMN01", vnp_TxnRef: intent.id, vnp_Amount: "20000000",
        vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: "14000001",
        vnp_OrderInfo: "test", vnp_PayDate: "20261107000000",
      };
      ipn.vnp_SecureHash = vnpaySecureHash("vnpay-test-hash-secret", ipn);
      const r1 = await handleVnpayIpn(ipn);
      assertEq(r1.rspCode, "00", "IPN hợp lệ -> RspCode 00");
      assert(r1.credited, "IPN hợp lệ cộng ví");
      let bal = await getWalletBalances(db, user.id);
      assertEq(bal.available, 200000n, "ví +200.000 từ IPN");
      const r2 = await handleVnpayIpn(ipn);
      assertEq(r2.rspCode, "02", "IPN trùng -> RspCode 02 (đã xác nhận)");
      bal = await getWalletBalances(db, user.id);
      assertEq(bal.available, 200000n, "IPN trùng KHÔNG cộng lại");
      const bad = { ...ipn, vnp_SecureHash: "0".repeat(128) };
      const r3 = await handleVnpayIpn(bad);
      assertEq(r3.rspCode, "97", "IPN sai chữ ký -> RspCode 97");
      const wrongAmt: Record<string, string> = { ...ipn, vnp_Amount: "100" };
      wrongAmt.vnp_SecureHash = vnpaySecureHash("vnpay-test-hash-secret", wrongAmt);
      // intent đã PAID nên mã 02 có trước kiểm tiền — tạo intent mới để test 04
      const second = await createVnpayDeposit(user.id, 50000n, "http://localhost:3000/api/payments/vnpay/return");
      const wrongAmt2: Record<string, string> = { ...ipn, vnp_TxnRef: second.intent.id, vnp_Amount: "100" };
      wrongAmt2.vnp_SecureHash = vnpaySecureHash("vnpay-test-hash-secret", wrongAmt2);
      const r4 = await handleVnpayIpn(wrongAmt2);
      assertEq(r4.rspCode, "04", "IPN sai số tiền -> RspCode 04");
      bal = await getWalletBalances(db, user.id);
      assertEq(bal.available, 200000n, "IPN sai tiền không cộng ví");
      console.log("PASS VNPay sign/verify + IPN credit-once + reject bad signature/amount");
    }

    // ---- 10) WebAuthn: options + vòng đời challenge + đường lỗi ----
    {
      const user = await makeFundedUser(0n);
      const regOptions: any = await startPasskeyRegistration(user as any);
      assert(typeof regOptions.challenge === "string" && regOptions.challenge.length > 10, "registration options có challenge");
      assertEq(await consumeChallenge(regOptions.challenge, "LOGIN"), false, "challenge REGISTER không dùng được cho LOGIN");
      assertEq(await consumeChallenge(regOptions.challenge, "REGISTER"), true, "consume challenge đúng mục đích -> true");
      assertEq(await consumeChallenge(regOptions.challenge, "REGISTER"), false, "challenge dùng lần 2 -> false (single-use)");
      // Challenge hết hạn
      await prisma.webAuthnChallenge.create({ data: { challenge: uniq("expired"), purpose: "LOGIN", email: user.email, expiresAt: new Date(Date.now() - 1000) } });
      const expired = await prisma.webAuthnChallenge.findFirst({ where: { email: user.email, purpose: "LOGIN" }, orderBy: { createdAt: "desc" } });
      assertEq(await consumeChallenge(expired!.challenge, "LOGIN"), false, "challenge hết hạn -> false");
      // Login options cho user chưa có passkey: vẫn sinh options (không lộ thông tin)
      const loginOptions: any = await startPasskeyLogin(user.email);
      assert(Array.isArray(loginOptions.allowCredentials) && loginOptions.allowCredentials.length === 0, "chưa có passkey -> allowCredentials rỗng");
      // Credential lạ -> lỗi rõ ràng
      await assertThrows(
        () => finishPasskeyLogin(user.email, { id: "cred-la-khong-ton-tai", rawId: "cred-la-khong-ton-tai", type: "public-key", response: { clientDataJSON: "e30", authenticatorData: "e30", signature: "e30" } } as any),
        "PASSKEY_UNKNOWN_CREDENTIAL", "credential lạ bị reject"
      );
      console.log("PASS WebAuthn options + challenge lifecycle + error paths");
    }

    // ---- 11) FX: tỉ giá từ DB + quy đổi hiển thị ----
    {
      await setSetting("fx.vnd_per_usd", 20000);
      const fx = await getFxRates();
      assertEq(fx.vndPerUsd, 20000, "tỉ giá đọc từ setting DB");
      assertEq(vndToUsd(40000n, 20000), 2, "40.000 ₫ / 20.000 = $2");
      console.log("PASS FX rates from DB + conversion");
    }
  } finally {
    server.close();
    // Trả cấu hình về mặc định an toàn cho các lần chạy sau.
    await setSetting("exchange.provider_code", "MOCK").catch(() => undefined);
  }
}
