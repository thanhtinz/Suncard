import crypto from "crypto";
import { prisma, makeFundedUser, assert, assertEq, assertThrows, uniq } from "./helpers";
import type { DB } from "../src/modules/ledger";
import { hashPassword, verifyPassword, requirePermission, signSession, verifySessionToken, type SessionPayload } from "../src/modules/security";
import { importCardBatch, reserveCards, deliverCards, revealCard } from "../src/modules/cards";
import { setSetting } from "../src/modules/settings";
import { evaluateRisk, scoreFromSignals } from "../src/modules/risk";
import { totpCode } from "../src/modules/totp";
import { POST as loginPOST } from "../src/app/api/auth/login/route";
import { POST as webhookPOST } from "../src/app/v1/webhooks/[provider]/route";
import { createTopupOrder } from "../src/modules/orders-service";
import { sha256Hex } from "../src/lib/crypto";

const db = prisma as unknown as DB;

function loginReq(email: string, password: string, extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "10.1.2.3", "user-agent": "test-agent" },
    body: JSON.stringify({ email, password, deviceId: "dev-test-1", ...extra }),
  });
}

export async function run() {
  // Regression: token ký xong phải verify được ngay (exp là timestamp tương lai, không phải số giây thô)
  {
    const token = await signSession({ userId: "u-test", email: "t@suncard.vn", roles: ["CUSTOMER"], sid: "s-test" }, 3600);
    const payload = await verifySessionToken(token);
    assert(payload && payload.userId === "u-test", "sign/verify token roundtrip");
    console.log("PASS session token sign/verify roundtrip");
  }

  // SEC-AC-01: mật khẩu hash Argon2id, không plaintext, verify đúng/sai
  {
    const hash = await hashPassword("Suncard@123");
    assert(hash.startsWith("$argon2id$"), "hash phải là Argon2id PHC");
    assert(!hash.includes("Suncard@123"), "hash không chứa plaintext");
    assert(await verifyPassword("Suncard@123", hash), "verify đúng mật khẩu");
    assert(!(await verifyPassword("sai-mat-khau", hash)), "verify sai mật khẩu -> false");
    console.log("PASS SEC-AC-01 Argon2id password hashing");
  }

  // IDOR: khách B reveal mã của khách A -> bị chặn; Support (không phải chủ) reveal -> bị chặn (SEC-CV-02)
  {
    const userA = await makeFundedUser(1_000_000n);
    const userB = await makeFundedUser(1_000_000n);
    const support = await prisma.user.findUnique({ where: { email: "ops@suncard.vn" } });
    const variant = await prisma.productVariant.findFirst({ where: { sku: "VIETTEL-10000" } });
    await importCardBatch(db, { code: uniq("B"), variantId: variant!.id, cards: [{ serial: uniq("S"), pin: `66${Date.now()}` }] });
    const order = await prisma.order.create({ data: { code: uniq("SC"), userId: userA.id, type: "CARD_PURCHASE", status: "SUCCESS", totalMinor: 9700n, idempotencyKey: uniq("k") } });
    await prisma.$transaction((tx) => reserveCards(tx as DB, { orderId: order.id, variantId: variant!.id, qty: 1, userId: userA.id }));
    const delivered = await prisma.$transaction((tx) => deliverCards(tx as DB, { orderId: order.id, userId: userA.id }));
    await assertThrows(() => revealCard(db, { deliveryId: delivered[0].id, userId: userB.id, stepUpVerified: true }), "PERMISSION_DENIED", "IDOR: khách B reveal mã khách A bị chặn");
    await assertThrows(() => revealCard(db, { deliveryId: delivered[0].id, userId: support!.id, stepUpVerified: true }), "PERMISSION_DENIED", "SEC-CV-02: Support không xem được plaintext mã của khách");
    const okReveal = await revealCard(db, { deliveryId: delivered[0].id, userId: userA.id, stepUpVerified: true, purpose: "TEST" });
    assert(okReveal.pin.length >= 6, "chủ mã reveal được");
    assert(okReveal.correlationId, "reveal có correlation_id");
    // SEC-CV-03: audit reveal không chứa plaintext
    const audits = await prisma.cardAccessAudit.findMany({ where: { userId: userA.id, action: "REVEAL", result: "OK" } });
    assert(audits.length >= 1 && audits.every((a) => a.correlationId), "mọi audit reveal có correlation_id");
    const auditLogs = await prisma.auditLog.findMany({ where: { action: "CARD_REVEAL" } });
    assert(!JSON.stringify(auditLogs).includes(okReveal.pin), "SEC-CV-03: audit không chứa plaintext mã");
    console.log("PASS IDOR + Support reveal blocked + audit no plaintext (SEC-CV-02/03)");
  }

  // Emergency Vault Lock: bật -> reveal + deliver bị chặn; tắt -> chạy lại
  {
    const user = await makeFundedUser(1_000_000n);
    const variant = await prisma.productVariant.findFirst({ where: { sku: "VIETTEL-10000" } });
    await importCardBatch(db, { code: uniq("B"), variantId: variant!.id, cards: [{ serial: uniq("S"), pin: `77${Date.now()}` }] });
    const order = await prisma.order.create({ data: { code: uniq("SC"), userId: user.id, type: "CARD_PURCHASE", status: "SUCCESS", totalMinor: 9700n, idempotencyKey: uniq("k") } });
    await prisma.$transaction((tx) => reserveCards(tx as DB, { orderId: order.id, variantId: variant!.id, qty: 1, userId: user.id }));
    const delivered = await prisma.$transaction((tx) => deliverCards(tx as DB, { orderId: order.id, userId: user.id }));
    await setSetting("cards.vault_locked", true, "test");
    try {
      await assertThrows(() => revealCard(db, { deliveryId: delivered[0].id, userId: user.id, stepUpVerified: true }), "VAULT_LOCKED", "Vault Lock bật -> reveal bị chặn");
      const order2 = await prisma.order.create({ data: { code: uniq("SC"), userId: user.id, type: "CARD_PURCHASE", status: "SUCCESS", totalMinor: 9700n, idempotencyKey: uniq("k") } });
      await assertThrows(() => prisma.$transaction((tx) => deliverCards(tx as DB, { orderId: order2.id, userId: user.id })), "VAULT_LOCKED", "Vault Lock bật -> delivery bị chặn");
    } finally {
      await setSetting("cards.vault_locked", false, "test");
    }
    const again = await revealCard(db, { deliveryId: delivered[0].id, userId: user.id, stepUpVerified: true });
    assert(again.pin.length >= 6, "tắt Vault Lock -> reveal lại được");
    console.log("PASS Emergency Vault Lock");
  }

  // SEC-AC-02: Admin chưa bật MFA -> requirePermission chặn MFA_REQUIRED; bật MFA -> qua
  {
    const ops = await prisma.user.findUnique({ where: { email: "ops@suncard.vn" } });
    const before = await prisma.user.findUnique({ where: { id: ops!.id }, select: { totpEnabled: true, totpSecret: true } });
    await prisma.user.update({ where: { id: ops!.id }, data: { totpEnabled: false } });
    const session: SessionPayload = { userId: ops!.id, email: ops!.email, roles: ["OPS"] };
    await assertThrows(() => requirePermission(session, "orders.view"), "MFA_REQUIRED", "Admin chưa MFA bị chặn khỏi API admin");
    await prisma.user.update({ where: { id: ops!.id }, data: { totpEnabled: true } });
    try {
      await requirePermission(session, "orders.view");
    } finally {
      await prisma.user.update({ where: { id: ops!.id }, data: { totpEnabled: before!.totpEnabled, totpSecret: before!.totpSecret } });
    }
    console.log("PASS SEC-AC-02 Admin MFA gate");
  }

  // ACC-03/04: login throttling — sai nhiều lần -> khóa; lỗi không tiết lộ tài khoản tồn tại
  {
    const email = `throttle${Date.now()}@suncard.vn`;
    const u = await prisma.user.create({ data: { email, passwordHash: await hashPassword("Suncard@123"), kycStatus: "VERIFIED" } });
    await prisma.userProfile.create({ data: { userId: u.id, fullName: "Throttle" } });
    let lastStatus = 0;
    for (let i = 0; i < 5; i++) {
      const res = await loginPOST(loginReq(email, "sai-mat-khau"));
      lastStatus = res.status;
      const j = await res.json();
      assertEq(j.error.code, "AUTH_INVALID", "lỗi đăng nhập sai dùng mã chung");
      assert(!JSON.stringify(j).includes("tồn tại"), "không tiết lộ tài khoản tồn tại");
    }
    assertEq(lastStatus, 401, "sai mật khẩu -> 401");
    const locked = await loginPOST(loginReq(email, "Suncard@123"));
    assertEq(locked.status, 429, "sau 5 lần sai -> khóa tạm (429) dù đúng mật khẩu");
    const ghost = await loginPOST(loginReq(`khong-ton-tai${Date.now()}@suncard.vn`, "bat-ky"));
    const gj = await ghost.json();
    assertEq(gj.error.code, "AUTH_INVALID", "email không tồn tại cũng trả AUTH_INVALID giống hệt");
    assertEq(gj.error.message, "Email hoặc mật khẩu không đúng", "message giống hệt trường hợp sai mật khẩu");
    console.log("PASS ACC-03/04 login throttling + no enumeration");
  }

  // Đăng nhập đúng + TOTP: user bật MFA phải nhập mã mới vào được; phiên có sid và thu hồi được
  {
    const email = `mfa${Date.now()}@suncard.vn`;
    const { generateTotpSecret } = await import("../src/modules/totp");
    const { encryptSecret } = await import("../src/lib/crypto");
    const secret = generateTotpSecret();
    const u = await prisma.user.create({ data: { email, passwordHash: await hashPassword("Suncard@123"), kycStatus: "VERIFIED", totpEnabled: true, totpSecret: encryptSecret(secret) } });
    await prisma.userProfile.create({ data: { userId: u.id, fullName: "MFA" } });
    const noCode = await loginPOST(loginReq(email, "Suncard@123"));
    assertEq(noCode.status, 403, "bật MFA mà không nhập mã -> MFA_REQUIRED");
    const withCode = await loginPOST(loginReq(email, "Suncard@123", { totpCode: totpCode(secret) }));
    assertEq(withCode.status, 200, "nhập đúng TOTP -> đăng nhập được");
    const sessions = await prisma.session.findMany({ where: { userId: u.id, revokedAt: null } });
    assert(sessions.length >= 1, "phiên được ghi DB");
    await prisma.session.updateMany({ where: { userId: u.id }, data: { revokedAt: new Date() } });
    console.log("PASS login TOTP + DB session");
  }

  // SEC-PY-01: webhook sai chữ ký -> reject; đúng chữ ký + trùng event -> dedupe, không xử lý 2 lần
  {
    const user = await makeFundedUser(5_000_000n);
    const variant = await prisma.productVariant.findFirst({ where: { sku: "LIEN-QUAN-MOBILE-2-50000" } });
    assert(variant, "có variant LQ 50k");
    const { order } = await createTopupOrder({ userId: user.id, variantId: variant!.id, playerId: "112233999", idempotencyKey: uniq("wh") });
    assertEq(order!.status, "UNKNOWN", "đơn UNKNOWN chờ webhook/inquiry");
    const secret = process.env.PROVIDER_WEBHOOK_SECRET || "suncard-local-provider-secret";
    const payload = JSON.stringify({ event_id: uniq("evt"), external_ref: order!.providerRef, status: "SUCCESS" });
    const badSig = crypto.createHmac("sha256", "sai-secret").update(payload).digest("hex");
    const bad = await webhookPOST(new Request("http://localhost/v1/webhooks/mock", { method: "POST", headers: { "content-type": "application/json", "x-provider-signature": badSig }, body: payload }), { params: { provider: "mock" } });
    assertEq(bad.status, 401, "webhook sai chữ ký -> 401");
    const badJson = await bad.json();
    assertEq(badJson.error.code, "SIGNATURE_INVALID", "mã lỗi SIGNATURE_INVALID");
    const evCount0 = await prisma.providerWebhookEvent.count();
    const goodSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const mk = () => webhookPOST(new Request("http://localhost/v1/webhooks/mock", { method: "POST", headers: { "content-type": "application/json", "x-provider-signature": goodSig }, body: payload }), { params: { provider: "mock" } });
    const first = await mk();
    assertEq(first.status, 200, "webhook đúng chữ ký -> 200");
    const second = await mk();
    const secondJson = await second.json();
    assert(secondJson.data?.deduped === true, "webhook trùng event -> deduped");
    const evCount1 = await prisma.providerWebhookEvent.count();
    assertEq(evCount1, evCount0 + 1, "chỉ ghi đúng 1 event");
    const finalOrder = await prisma.order.findUnique({ where: { id: order!.id } });
    assertEq(finalOrder!.status, "SUCCESS", "webhook hợp lệ phân giải UNKNOWN -> SUCCESS đúng 1 lần");
    console.log("PASS SEC-PY-01 webhook signature + dedupe");
  }

  // Risk Engine: chấm điểm theo tín hiệu; shared IP chỉ cộng điểm nhỏ, không tự thành HIGH
  {
    assertEq(scoreFromSignals([{ key: "shared_ip", points: 5, detail: "" }]), 5, "shared IP đơn lẻ = 5 điểm (LOW)");
    const fresh = await makeFundedUser(0n);
    const r = await evaluateRisk(db, { userId: fresh.id, action: "REVEAL", amountMinor: 9_000_000n, deviceId: "brand-new-device" });
    // new_account 15 + new_device 15 + large_amount 15 = 45 -> MEDIUM
    assertEq(r.score, 45, "tổng điểm từ 3 tín hiệu");
    assertEq(r.level, "MEDIUM", "45 điểm -> MEDIUM (step-up, chưa giữ)");
    console.log("PASS Risk Engine scoring + levels");
  }

  // SEC-API-01: secret không xuất hiện trong response đăng nhập / dữ liệu user serialize
  {
    const khach = await prisma.user.findUnique({ where: { email: "khach@suncard.vn" } });
    const serialized = JSON.stringify(khach, (k, v) => (k === "passwordHash" || k === "totpSecret" ? undefined : v));
    assert(!serialized.includes("passwordHash"), "không lộ passwordHash khi serialize an toàn");
    const loginRes = await loginPOST(loginReq("khach@suncard.vn", "Suncard@123"));
    const text = await loginRes.text();
    assert(!text.includes("passwordHash") && !text.includes("$argon2id$") && !text.includes("sc_demo_secret"), "response đăng nhập không chứa hash/secret");
    assertEq(loginRes.status, 200, "khách đăng nhập được bằng Argon2id (sau re-seed)");
    console.log("PASS SEC-API-01 no secret in responses");
  }
}
