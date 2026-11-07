import { prisma, makeFundedUser, assert, assertEq, assertThrows, uniq } from "./helpers";
import {
  postLedger, holdFunds, releaseHold, settleHold, getWalletBalances, assertGlobalBalance,
  walletAvailableCode, PLATFORM_CASH, type DB,
} from "../src/modules/ledger";
import { canTransition, assertTransition } from "../src/modules/orders";
import { resolvePrice } from "../src/modules/pricing";
import { createTopupOrder, inquireOrder, getOrderForUser } from "../src/modules/orders-service";
import { importCardBatch, reserveCards, deliverCards, revealCard, exchangeFingerprint } from "../src/modules/cards";
import { submitExchange } from "../src/modules/orders-service";
import { partnerSignature, verifyPartnerRequest } from "../src/modules/security";
import { computeCommissionForOrder } from "../src/modules/commission";
import { ensureCreditAccount, assertCreditAvailable, reserveCredit } from "../src/modules/credit";
import { agentOfUser, branchAgentIds, isInBranch } from "../src/modules/agents";
import { sha256Hex } from "../src/lib/crypto";

const db = prisma as unknown as DB;

export async function run() {
  // 1) Ledger cân bằng + không trừ 2 lần (idempotency) + tổng toàn cục = 0
  {
    const user = await makeFundedUser(1_000_000n);
    const before = await getWalletBalances(db, user.id);
    assertEq(before.available, 1_000_000n, "số dư sau nạp");
    const key = uniq("txkey");
    const input = {
      type: "TRANSFER", idempotencyKey: key,
      entries: [
        { accountCode: walletAvailableCode(user.id), ownerType: "USER", ownerId: user.id, kind: "AVAILABLE", direction: "DEBIT" as const, amountMinor: 100_000n },
        { accountCode: PLATFORM_CASH, ownerType: "PLATFORM", kind: "CASH", direction: "CREDIT" as const, amountMinor: 100_000n },
      ],
    };
    const r1 = await prisma.$transaction((tx) => postLedger(tx as DB, input));
    const r2 = await prisma.$transaction((tx) => postLedger(tx as DB, input));
    assert(!r1.duplicated && r2.duplicated, "postLedger trùng key phải duplicated");
    assertEq(r1.tx.id, r2.tx.id, "trùng key trả cùng tx");
    const after = await getWalletBalances(db, user.id);
    assertEq(after.available, 900_000n, "chỉ trừ đúng 1 lần");
    await assertThrows(() => prisma.$transaction((tx) => postLedger(tx as DB, {
      type: "TRANSFER",
      entries: [
        { accountCode: walletAvailableCode(user.id), direction: "DEBIT" as const, amountMinor: 5n },
        { accountCode: PLATFORM_CASH, direction: "CREDIT" as const, amountMinor: 6n },
      ],
    })), "LEDGER_UNBALANCED", "tx không cân bằng phải bị chặn");
    const global = await assertGlobalBalance(db);
    assertEq(global, 0n, "tổng balance toàn hệ thống = 0");
    // hold -> release trả đủ; hold -> settle trừ held
    const { hold } = await prisma.$transaction((tx) => holdFunds(tx as DB, { userId: user.id, amountMinor: 200_000n, idempotencyKey: uniq("hold") }));
    let bal = await getWalletBalances(db, user.id);
    assertEq(bal.available, 700_000n, "hold trừ available");
    assertEq(bal.held, 200_000n, "hold cộng held");
    await prisma.$transaction((tx) => releaseHold(tx as DB, hold.id, "test"));
    await prisma.$transaction((tx) => releaseHold(tx as DB, hold.id, "test again")); // idempotent
    bal = await getWalletBalances(db, user.id);
    assertEq(bal.available, 900_000n, "release trả lại đúng 1 lần");
    const { hold: hold2 } = await prisma.$transaction((tx) => holdFunds(tx as DB, { userId: user.id, amountMinor: 300_000n, idempotencyKey: uniq("hold") }));
    await prisma.$transaction((tx) => settleHold(tx as DB, { holdId: hold2.id, costMinor: 250_000n }));
    bal = await getWalletBalances(db, user.id);
    assertEq(bal.available, 600_000n, "settle không đụng available");
    assertEq(bal.held, 0n, "settle hết held");
    console.log("PASS ledger: cân bằng, idempotent, hold/release/settle");
  }

  // 2) State machine chặn transition sai
  {
    assert(canTransition("CREATED", "VALIDATING"), "CREATED->VALIDATING hợp lệ");
    assert(!canTransition("SUCCESS", "FAILED"), "SUCCESS->FAILED bị chặn");
    assert(!canTransition("UNKNOWN", "CANCELLED"), "UNKNOWN->CANCELLED bị chặn");
    assert(!canTransition("REFUNDED", "SUCCESS"), "REFUNDED là terminal");
    try { assertTransition("FAILED", "SUCCESS"); throw new Error("no throw"); }
    catch (e: any) { assert(String(e.message).includes("INVALID_TRANSITION"), "assertTransition ném INVALID_TRANSITION"); }
    console.log("PASS state machine");
  }

  // 3) Pricing precedence: ACCOUNT override thắng AGENT_LEVEL thắng DEFAULT
  {
    const user = await makeFundedUser(0n);
    const variant = await prisma.productVariant.findFirst({ where: { sku: "VIETTEL-100000" } });
    assert(variant, "có variant VIETTEL-100000");
    const base = await resolvePrice(db, { userId: user.id, variantId: variant!.id });
    assertEq(base.unitPriceMinor, variant!.basePriceMinor, "mặc định = basePrice");
    const plan = await prisma.pricingPlan.create({ data: { code: uniq("ACC"), name: "Override test", scopeType: "ACCOUNT", scopeId: user.id, priority: 1 } });
    await prisma.priceRule.create({ data: { planId: plan.id, variantId: variant!.id, fixedPriceMinor: 77_000n } });
    const over = await resolvePrice(db, { userId: user.id, variantId: variant!.id });
    assertEq(over.unitPriceMinor, 77_000n, "account override thắng");
    assertEq(over.source, "ACCOUNT_OVERRIDE", "source ACCOUNT_OVERRIDE");
    const agentUser = await prisma.user.findUnique({ where: { email: "agent@suncard.vn" } });
    const agent = await agentOfUser(db, agentUser!.id);
    const withLevel = await resolvePrice(db, { userId: user.id, agentId: agent!.id, agentLevelId: agent!.levelId, variantId: variant!.id });
    assertEq(withLevel.source, "ACCOUNT_OVERRIDE", "account vẫn thắng khi có cả level (precedence đúng thứ tự)");
    const otherUser = await makeFundedUser(0n);
    const levelPrice = await resolvePrice(db, { userId: otherUser.id, agentId: agent!.id, agentLevelId: agent!.levelId, variantId: variant!.id });
    assertEq(levelPrice.source, "AGENT_LEVEL", "không override thì dùng cấp đại lý");
    assert(levelPrice.unitPriceMinor < (variant!.basePriceMinor as bigint), "giá cấp < giá gốc");
    console.log("PASS pricing precedence");
  }

  // 4) Idempotency đơn hàng + 5) UNKNOWN không failover, inquiry phân giải
  {
    const user = await makeFundedUser(5_000_000n);
    const game = await prisma.gameCatalog.findUnique({ where: { slug: "lien-quan-mobile" } });
    const variant = await prisma.productVariant.findFirst({ where: { productId: (await prisma.gameCatalog.findUnique({ where: { slug: "lien-quan-mobile" } }))!.productId, basePriceMinor: 50000n } });
    assert(variant, "có gói LQ 50k");
    const key = uniq("idem");
    const r1 = await createTopupOrder({ userId: user.id, variantId: variant!.id, playerId: "12345678", idempotencyKey: key });
    const r2 = await createTopupOrder({ userId: user.id, variantId: variant!.id, playerId: "12345678", idempotencyKey: key });
    assert(r2.duplicated, "trùng key -> duplicated");
    assertEq(r1.order!.id, r2.order!.id, "trùng key -> cùng 1 order");
    const count = await prisma.order.count({ where: { userId: user.id, idempotencyKey: key } });
    assertEq(count, 1, "chỉ có đúng 1 order");
    assertEq(r1.order!.status, "SUCCESS", "UID thường -> SUCCESS");
    const balAfter = await getWalletBalances(db, user.id);
    assertEq(balAfter.available, 5_000_000n - (variant!.basePriceMinor as bigint), "trừ ví đúng 1 lần theo giá");

    const unknownRes = await createTopupOrder({ userId: user.id, variantId: variant!.id, playerId: "998877999", idempotencyKey: uniq("unk") });
    assertEq(unknownRes.order!.status, "UNKNOWN", "UID đuôi 999 -> UNKNOWN");
    const balUnknown = await getWalletBalances(db, user.id);
    assertEq(balUnknown.held, variant!.basePriceMinor as bigint, "UNKNOWN vẫn giữ hold, không release/failover");
    const inq = await inquireOrder(unknownRes.order!.id);
    assertEq(inq.order!.status, "SUCCESS", "inquiry phân giải UNKNOWN -> SUCCESS");
    const balFinal = await getWalletBalances(db, user.id);
    assertEq(balFinal.held, 0n, "sau inquiry held = 0");
    console.log("PASS idempotency order + UNKNOWN/inquiry");
  }

  // 6) RBAC scope: customer không xem đơn người khác; agent scope theo closure
  {
    const u1 = await makeFundedUser(100_000n);
    const u2 = await makeFundedUser(100_000n);
    const order = await prisma.order.create({ data: { code: uniq("SC"), userId: u1.id, type: "TOPUP", totalMinor: 1000n, idempotencyKey: uniq("k") } });
    assertEq(await getOrderForUser(order.id, u2.id), null, "customer khác không xem được đơn");
    assert((await getOrderForUser(order.id, u1.id)) !== null, "chủ đơn xem được");
    const goldUser = await prisma.user.findUnique({ where: { email: "agent@suncard.vn" } });
    const gold = await agentOfUser(db, goldUser!.id);
    const sub1 = await prisma.agent.findUnique({ where: { code: "AGSILVER01" } });
    const ids = await branchAgentIds(db, gold!.id);
    assert(ids.includes(sub1!.id), "scope Gold chứa sub Silver");
    assert(!(await branchAgentIds(db, sub1!.id)).includes(gold!.id), "scope Silver không chứa Gold (chiều ngược)");
    assert(await isInBranch(db, gold!.id, sub1!.id), "isInBranch đúng");
    console.log("PASS RBAC/scope");
  }

  // 7) Cards: fingerprint trùng -> quarantine; reserve->deliver 1 lần; reveal step-up + audit + limit policy
  {
    const variant = await prisma.productVariant.findFirst({ where: { sku: "VIETTEL-10000" } });
    const user = await makeFundedUser(1_000_000n);
    const pin2 = `88${Date.now()}`;
    const imp1 = await importCardBatch(db, { code: uniq("B"), variantId: variant!.id, cards: [{ serial: uniq("S"), pin: uniq("P") }, { serial: uniq("S"), pin: pin2 }] });
    assertEq(imp1.imported, 2, "import 2 thẻ mới");
    const imp2 = await importCardBatch(db, { code: uniq("B"), variantId: variant!.id, cards: [{ serial: uniq("S"), pin: pin2 }] });
    assertEq(imp2.imported, 0, "trùng PIN fingerprint không import lại");
    assertEq(imp2.duplicates, 1, "trùng được đếm vào quarantine/duplicates");

    const order = await prisma.order.create({ data: { code: uniq("SC"), userId: user.id, type: "CARD_PURCHASE", status: "SUCCESS", totalMinor: 9700n, idempotencyKey: uniq("k") } });
    const reserved = await prisma.$transaction((tx) => reserveCards(tx as DB, { orderId: order.id, variantId: variant!.id, qty: 1, userId: user.id }));
    assertEq(reserved.length, 1, "reserve 1 thẻ");
    const delivered = await prisma.$transaction((tx) => deliverCards(tx as DB, { orderId: order.id, userId: user.id }));
    assertEq(delivered.length, 1, "deliver 1 thẻ");
    const delivered2 = await prisma.$transaction((tx) => deliverCards(tx as DB, { orderId: order.id, userId: user.id }));
    assertEq(delivered2.length, 0, "deliver lần 2 không giao thêm (giao MỘT lần)");
    const card = await prisma.cardInventory.findUnique({ where: { id: reserved[0].id } });
    assertEq(card!.status, "DELIVERED", "thẻ đã giao không về AVAILABLE");
    await assertThrows(() => revealCard(db, { deliveryId: delivered[0].id, userId: user.id, stepUpVerified: false }), "STEP_UP_REQUIRED", "reveal không step-up bị chặn");
    const revealed = await revealCard(db, { deliveryId: delivered[0].id, userId: user.id, stepUpVerified: true });
    assert(revealed.pin.length >= 6, "reveal có step-up trả PIN");
    const stranger = await makeFundedUser(0n);
    await assertThrows(() => revealCard(db, { deliveryId: delivered[0].id, userId: stranger.id, stepUpVerified: true }), "PERMISSION_DENIED", "người khác reveal bị chặn");
    const audits = await prisma.cardAccessAudit.count({ where: { cardId: card!.id, action: "REVEAL" } });
    assert(audits >= 3, "mọi lần reveal (kể cả DENIED) đều có audit");
    console.log("PASS cards reserve/deliver/reveal");
  }

  // 8) Exchange fingerprint trùng -> DUPLICATE_REQUEST
  {
    const user = await makeFundedUser(0n);
    const serial = uniq("SER"), pin = uniq("PIN") + "12345";
    const fp = exchangeFingerprint("VIETTEL", serial, pin);
    const r1 = await submitExchange({ userId: user.id, carrier: "VIETTEL", serial, pin, faceValueMinor: 50000n, idempotencyKey: uniq("ex") });
    assertEq(r1.order!.status, "SUCCESS", "gạch thẻ mock thành công");
    const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: r1.order!.id } });
    assertEq(ex!.pinFingerprint, fp, "fingerprint lưu đúng");
    await assertThrows(
      () => submitExchange({ userId: user.id, carrier: "VIETTEL", serial, pin, faceValueMinor: 50000n, idempotencyKey: uniq("ex") }),
      "DUPLICATE_REQUEST", "nộp trùng thẻ bị reject"
    );
    console.log("PASS exchange fingerprint duplicate");
  }

  // 9) HMAC Partner API: đúng chữ ký pass; sai -> SIGNATURE_INVALID; replay nonce -> REPLAY_DETECTED
  {
    const client = await prisma.apiClient.findUnique({ where: { clientId: "demo-partner" } });
    const apiKey = await prisma.apiKey.findFirst({ where: { clientId: client!.id } });
    assert(client && apiKey, "có demo partner");
    const secret = "sc_demo_secret_0001";
    const path = "/v1/wallet/balance";
    const body = "";
    const ts = String(Math.floor(Date.now() / 1000));
    const nonce = uniq("nonce");
    const sig = partnerSignature(secret, "GET", path, ts, nonce, body);
    const mkReq = (signature: string, n: string, t = ts) => new Request(`http://localhost${path}`, {
      method: "GET",
      headers: { "x-client-id": "demo-partner", authorization: "Bearer sc_demo_key_0001", "x-timestamp": t, "x-nonce": n, "x-signature": signature },
    });
    const ctx = await verifyPartnerRequest(mkReq(sig, nonce), body);
    assertEq(ctx.client.clientId, "demo-partner", "HMAC đúng -> verify pass");
    await assertThrows(() => verifyPartnerRequest(mkReq(sha256Hex("sai"), uniq("nonce")), body), "SIGNATURE_INVALID", "sai chữ ký bị reject");
    await assertThrows(() => verifyPartnerRequest(mkReq(sig, nonce), body), "REPLAY_DETECTED", "dùng lại nonce -> replay reject");
    console.log("PASS HMAC partner + replay");
  }

  // 10) Commission cap: tổng commission <= cap% margin
  {
    const goldUser = await prisma.user.findUnique({ where: { email: "agent@suncard.vn" } });
    const sub1 = await prisma.agent.findUnique({ where: { code: "AGSILVER01" } });
    const order = await prisma.order.create({ data: { code: uniq("SC"), userId: goldUser!.id, type: "TOPUP", totalMinor: 100000n, idempotencyKey: uniq("k") } });
    const entries = await prisma.$transaction((tx) => computeCommissionForOrder(tx as DB, {
      orderId: order.id, sellerAgentId: sub1!.id, marginMinor: 100_000n, revenueMinor: 1_000_000n, productType: "GAME_TOPUP",
    }));
    const total = entries.reduce((s, e) => s + (e.amountMinor as bigint), 0n);
    assert(entries.length >= 2, "có commission cho seller + upline");
    assert(total <= 80_000n, `tổng commission ${total} <= cap 80% margin`);
    assertEq(total, 40_000n, "30% self (Silver) + 10% upline depth1 (Gold) = 40% margin");
    console.log("PASS commission cap");
  }

  // 11) Credit vượt limit -> reject
  {
    const user = await makeFundedUser(0n);
    await ensureCreditAccount(db, user.id);
    await prisma.creditAccount.update({ where: { userId: user.id }, data: { limitMinor: 100_000n } });
    await assertThrows(() => assertCreditAvailable(db, user.id, 100_001n), "CREDIT_LIMIT_EXCEEDED", "vượt limit bị reject");
    await reserveCredit(db, { userId: user.id, amountMinor: 60_000n, refId: "t1", idempotencyKey: uniq("cr") });
    await assertThrows(() => reserveCredit(db, { userId: user.id, amountMinor: 50_000n, refId: "t2", idempotencyKey: uniq("cr") }), "CREDIT_LIMIT_EXCEEDED", "reserve cộng dồn vượt limit bị reject");
    console.log("PASS credit limit");
  }
}
