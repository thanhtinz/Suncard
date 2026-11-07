import { prisma } from "@/lib/prisma";
import { randomCode, maskSecret } from "@/lib/crypto";
import { bpsOf } from "@/lib/money";
import {
  ensureWallet, holdFunds, releaseHold, settleHold, getWalletBalances,
  postLedger, PLATFORM_EXCHANGE, walletAvailableCode, providerPayableCode, PLATFORM_MARGIN, type DB,
} from "./ledger";
import { transitionOrder } from "./orders";
import { resolvePrice, snapshotPrice } from "./pricing";
import { reserveCards, deliverCards, releaseReservedCards, exchangeFingerprint } from "./cards";
import { getAdapter, routeProvider, recordProviderResult } from "./providers";
import { computeCommissionForOrder, reverseCommissionForOrder } from "./commission";
import { reserveCredit, settleCredit, releaseCredit, assertCreditAvailable } from "./credit";
import { enqueueWebhookEvent } from "./webhooks";
import { notifyUser } from "./audit";
import { getNumberSetting, getSetting } from "./settings";
import { agentOfUser } from "./agents";
import { logAudit } from "./audit";

/** PAY-08: gói bằng chứng chargeback cho đơn SUCCESS (order + delivery + ledger + audit trail). */
export async function saveEvidencePack(db: DB, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  const [items, deliveries, ledgerTxs, audits] = await Promise.all([
    db.orderItem.findMany({ where: { orderId } }),
    db.cardDelivery.findMany({ where: { orderId } }),
    db.ledgerTransaction.findMany({ where: { refId: orderId } }),
    db.auditLog.count({ where: { entityId: orderId } }),
  ]);
  await db.orderFulfillment.create({
    data: {
      orderId, kind: "EVIDENCE_PACK", status: "COMPLETED",
      detail: {
        order_code: order.code, status: order.status, total_minor: (order.totalMinor as bigint).toString(),
        items: items.map((i: any) => ({ name: i.name, qty: i.qty })),
        delivery_ids: deliveries.map((d: any) => d.id),
        ledger_tx_codes: ledgerTxs.map((t: any) => t.code),
        audit_events: audits, captured_at: new Date().toISOString(),
      } as never,
    },
  }).catch(() => undefined);
}

// Luồng tiền chính (doc 03): validate → giá (precedence + snapshot) → ví/credit →
// tạo đơn bằng idempotency-key → hold → reserve mã / route provider → settle hoặc release/refund →
// commission → webhook + notification.

async function findIdempotentOrder(userId: string, idempotencyKey: string) {
  return prisma.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
}

async function orderWithItems(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  return { order, items };
}

async function failOrder(orderId: string, reason: string) {
  const { order } = await orderWithItems(orderId);
  if (!order) return;
  const hold = await prisma.walletHold.findFirst({ where: { orderId, status: "ACTIVE" } });
  await prisma.$transaction(async (tx) => {
    if (hold) await releaseHold(tx as DB, hold.id, reason);
    await releaseReservedCards(tx as DB, orderId);
    await releaseCredit(tx as DB, { userId: order.userId, amountMinor: order.totalMinor as bigint, refId: orderId, idempotencyKey: `credit-release:${orderId}` }).catch(() => undefined);
  });
  const fresh = await prisma.order.findUnique({ where: { id: orderId } });
  if (fresh && ["RESERVED", "PENDING", "PROCESSING", "VALIDATING", "SUBMITTING"].includes(fresh.status)) {
    await prisma.order.update({ where: { id: orderId }, data: { failReason: reason } });
    await transitionOrder(prisma as unknown as DB, orderId, "FAILED", "system", reason).catch(() => undefined);
  }
  await enqueueWebhookEvent(prisma as unknown as DB, { eventType: "order.failed", resourceId: orderId, userId: order.userId, data: { order_id: orderId, reason } });
  await notifyUser(prisma as unknown as DB, { userId: order.userId, type: "ORDER_FAILED", title: "Đơn hàng thất bại", body: reason, resourceType: "ORDER", resourceId: orderId });
}

async function succeedTopup(orderId: string, costMinor: bigint) {
  const { order } = await orderWithItems(orderId);
  if (!order || order.status === "SUCCESS") return;
  const hold = await prisma.walletHold.findFirst({ where: { orderId, status: "ACTIVE" } });
  let margin = 0n;
  await prisma.$transaction(async (tx) => {
    const db = tx as DB;
    if (hold) {
      const res = await settleHold(db, { holdId: hold.id, providerId: order.providerId ?? undefined, costMinor, orderId });
      margin = (res as any).marginMinor ?? 0n;
    } else {
      // Thanh toán bằng credit: settle credit, ghi nhận cost/margin qua ledger từ tài khoản credit clearing.
      await settleCredit(db, { userId: order.userId, amountMinor: order.totalMinor as bigint, refId: orderId, idempotencyKey: `credit-settle:${orderId}` });
      margin = (order.totalMinor as bigint) - costMinor;
    }
    await tx.order.update({ where: { id: orderId }, data: { metadata: { ...((order.metadata as object) ?? {}), costMinor: costMinor.toString(), marginMinor: margin.toString() } } });
  });
  const fresh = await prisma.order.findUnique({ where: { id: orderId } });
  if (fresh && fresh.status !== "SUCCESS") {
    if (["PENDING", "UNKNOWN", "REVIEW"].includes(fresh.status)) await transitionOrder(prisma as unknown as DB, orderId, "PROCESSING", "system", "inquiry/provider xác nhận").catch(() => undefined);
    await transitionOrder(prisma as unknown as DB, orderId, "SUCCESS", "system");
  }
  const agent = await agentOfUser(prisma as unknown as DB, order.userId);
  await prisma.$transaction(async (tx) => {
    await computeCommissionForOrder(tx as DB, {
      orderId, sellerAgentId: order.agentId ?? agent?.id ?? null,
      marginMinor: margin, revenueMinor: order.totalMinor as bigint, productType: "GAME_TOPUP",
    });
  }).catch(() => undefined);
  await saveEvidencePack(prisma as unknown as DB, orderId);
  await enqueueWebhookEvent(prisma as unknown as DB, { eventType: "order.success", resourceId: orderId, userId: order.userId, data: { order_id: orderId, total_minor: (order.totalMinor as bigint).toString() } });
  await notifyUser(prisma as unknown as DB, { userId: order.userId, type: "ORDER_SUCCESS", title: "Đơn hàng thành công", resourceType: "ORDER", resourceId: orderId });
}

// ---------------- TOPUP ----------------
export interface CreateTopupInput {
  userId: string;
  variantId: string;
  qty?: number;
  playerId: string;
  regionCode?: string;
  serverCode?: string;
  idempotencyKey: string;
  paymentMethod?: "WALLET" | "CREDIT";
  agentId?: string | null;
}

export async function createTopupOrder(input: CreateTopupInput) {
  const dup = await findIdempotentOrder(input.userId, input.idempotencyKey);
  if (dup) return { order: dup, duplicated: true };

  const variant = await prisma.productVariant.findUnique({ where: { id: input.variantId } });
  if (!variant || !variant.isActive) throw new Error("PRODUCT_NOT_FOUND");
  const product = await prisma.product.findUnique({ where: { id: variant.productId } });
  if (!product || product.type !== "GAME_TOPUP") throw new Error("PRODUCT_NOT_FOUND");
  const qty = input.qty ?? 1;
  const agent = input.agentId ? { id: input.agentId } : await agentOfUser(prisma as unknown as DB, input.userId);
  const agentLevelId = agent ? (await prisma.agent.findUnique({ where: { id: agent.id } }))?.levelId : undefined;

  // Validate UID qua provider có capability validate (Mock) trước khi giữ tiền.
  const routePre = await routeProvider(prisma as unknown as DB, { productType: "GAME_TOPUP", variantId: variant.id });
  if (routePre) {
    const adapter = getAdapter(routePre.provider.code);
    if (adapter.validatePlayer) {
      const v = await adapter.validatePlayer(prisma as unknown as DB, { productId: product.id, playerId: input.playerId, region: input.regionCode, server: input.serverCode });
      if (v !== "UNSUPPORTED" && !v.valid) throw new Error("PLAYER_INVALID");
      var playerName = v === "UNSUPPORTED" ? undefined : v.playerName;
    }
  }

  const resolved = await resolvePrice(prisma as unknown as DB, {
    userId: input.userId, agentId: agent?.id, agentLevelId: agentLevelId ?? undefined, variantId: variant.id,
  });
  const total = resolved.unitPriceMinor * BigInt(qty);

  const order = await prisma.$transaction(async (tx) => {
    const db = tx as DB;
    const o = await tx.order.create({
      data: {
        code: randomCode("SC"),
        userId: input.userId,
        agentId: agent?.id ?? undefined,
        type: "TOPUP",
        status: "CREATED",
        currency: variant.currency,
        subtotalMinor: (variant.basePriceMinor as bigint) * BigInt(qty),
        discountMinor: ((variant.basePriceMinor as bigint) - resolved.unitPriceMinor) * BigInt(qty),
        totalMinor: total,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await transitionOrder(db, o.id, "VALIDATING", "system");
    await snapshotPrice(db, o.id, variant.id, qty, resolved, variant.faceValueMinor as bigint);
    await tx.orderItem.create({
      data: {
        orderId: o.id, productId: product.id, variantId: variant.id, name: `${product.name} — ${variant.name}`,
        qty, unitPriceMinor: resolved.unitPriceMinor, faceValueMinor: variant.faceValueMinor as bigint,
        totalMinor: total, targetData: { playerId: input.playerId, region: input.regionCode, server: input.serverCode },
      },
    });
    const game = await tx.gameCatalog.findFirst({ where: { productId: product.id } });
    await tx.topupOrder.create({
      data: { orderId: o.id, gameId: game?.id, playerId: input.playerId, playerName: (typeof playerName !== "undefined" ? playerName : undefined) as string | undefined, regionCode: input.regionCode, serverCode: input.serverCode },
    });
    if ((input.paymentMethod ?? "WALLET") === "CREDIT") {
      await assertCreditAvailable(db, input.userId, total);
      await reserveCredit(db, { userId: input.userId, amountMinor: total, refId: o.id, idempotencyKey: `credit-reserve:${o.id}` });
    } else {
      await ensureWallet(db, input.userId);
      const ttl = await getNumberSetting("cards.hold_ttl_minutes", 15);
      await holdFunds(db, { userId: input.userId, orderId: o.id, amountMinor: total, idempotencyKey: `hold:${o.id}`, ttlMinutes: ttl });
    }
    await transitionOrder(db, o.id, "RESERVED", "system");
    return o;
  });

  await enqueueWebhookEvent(prisma as unknown as DB, { eventType: "order.created", resourceId: order.id, userId: input.userId, data: { order_id: order.id, type: "TOPUP", total_minor: total.toString() } });

  // Route + submit provider (ngoài transaction giữ tiền).
  const route = await routeProvider(prisma as unknown as DB, { productType: "GAME_TOPUP", variantId: variant.id });
  if (!route) {
    await failOrder(order.id, "PROVIDER_UNAVAILABLE");
    throw new Error("PROVIDER_UNAVAILABLE");
  }
  await prisma.order.update({ where: { id: order.id }, data: { providerId: route.provider.id } });
  await transitionOrder(prisma as unknown as DB, order.id, "SUBMITTING", "system", `route: ${route.reason}`);
  const adapter = getAdapter(route.provider.code);
  const started = Date.now();
  const result = await adapter.createOrder(prisma as unknown as DB, {
    orderId: order.id, externalSku: route.providerProduct?.externalSku, playerId: input.playerId, amountMinor: total, variantId: variant.id,
  });
  const latencyMs = Date.now() - started;
  await prisma.providerTransaction.create({
    data: {
      providerId: route.provider.id, orderId: order.id, externalRef: result.externalRef, action: "CREATE",
      status: result.status, responseMasked: { rawStatus: result.rawStatus, message: result.message }, latencyMs: result.latencyMs ?? latencyMs,
    },
  });
  await prisma.topupOrder.update({ where: { orderId: order.id }, data: { providerTxnId: result.externalRef } });
  await prisma.order.update({ where: { id: order.id }, data: { providerRef: result.externalRef } });
  await recordProviderResult(prisma as unknown as DB, route.provider.id, { status: result.status, latencyMs });

  const cost = route.providerProduct ? (route.providerProduct.costMinor as bigint) * BigInt(qty) : result.costMinor ?? 0n;
  if (result.status === "SUCCESS") {
    await succeedTopup(order.id, cost);
  } else if (result.status === "FAILED") {
    await failOrder(order.id, result.message ?? "PROVIDER_FAILED");
  } else if (result.status === "UNKNOWN") {
    // UNKNOWN != FAILED: giữ hold, không failover. Chờ inquiry.
    await transitionOrder(prisma as unknown as DB, order.id, "UNKNOWN", "system", result.message).catch(() => undefined);
  } else {
    await transitionOrder(prisma as unknown as DB, order.id, "PENDING", "system", result.message).catch(() => undefined);
    await enqueueWebhookEvent(prisma as unknown as DB, { eventType: "order.processing", resourceId: order.id, userId: input.userId, data: { order_id: order.id } });
  }
  const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
  return { order: finalOrder, duplicated: false };
}

/** Inquiry cho đơn UNKNOWN/PENDING — chỉ inquiry mới phân giải UNKNOWN, không tự failover. */
export async function inquireOrder(orderId: string, actor = "system") {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!["UNKNOWN", "PENDING", "PROCESSING"].includes(order.status)) return { order, changed: false };
  if (!order.providerId) return { order, changed: false };
  const provider = await prisma.provider.findUnique({ where: { id: order.providerId } });
  if (!provider) return { order, changed: false };
  const adapter = getAdapter(provider.code);
  const topup = await prisma.topupOrder.findUnique({ where: { orderId } });
  const result = await adapter.getOrderStatus(prisma as unknown as DB, order.providerRef ?? topup?.providerTxnId ?? "");
  await prisma.providerTransaction.create({
    data: { providerId: provider.id, orderId, externalRef: order.providerRef, action: "INQUIRY", status: result.status, responseMasked: { rawStatus: result.rawStatus } },
  });
  if (topup) await prisma.topupOrder.update({ where: { orderId }, data: { inquiryCount: { increment: 1 }, lastInquiryAt: new Date() } });
  if (result.status === "SUCCESS") {
    const pp = await prisma.providerProduct.findFirst({ where: { providerId: provider.id, variantId: (await prisma.orderItem.findFirst({ where: { orderId } }))?.variantId ?? "" } });
    const item = await prisma.orderItem.findFirst({ where: { orderId } });
    const cost = pp ? (pp.costMinor as bigint) * BigInt(item?.qty ?? 1) : 0n;
    await succeedTopup(orderId, cost);
  } else if (result.status === "FAILED") {
    await failOrder(orderId, "Inquiry: provider xác nhận thất bại");
  }
  const fresh = await prisma.order.findUnique({ where: { id: orderId } });
  return { order: fresh, changed: true, providerStatus: result.status, actor };
}

// ---------------- CARD PURCHASE ----------------
export async function createCardOrder(input: { userId: string; variantId: string; qty?: number; idempotencyKey: string; agentId?: string | null }) {
  const dup = await findIdempotentOrder(input.userId, input.idempotencyKey);
  if (dup) return { order: dup, duplicated: true };
  const variant = await prisma.productVariant.findUnique({ where: { id: input.variantId } });
  if (!variant || !variant.isActive) throw new Error("PRODUCT_NOT_FOUND");
  const product = await prisma.product.findUnique({ where: { id: variant.productId } });
  if (!product || product.type !== "CARD_PIN") throw new Error("PRODUCT_NOT_FOUND");
  const qty = input.qty ?? 1;
  const agent = input.agentId ? { id: input.agentId } : await agentOfUser(prisma as unknown as DB, input.userId);
  const agentLevelId = agent ? (await prisma.agent.findUnique({ where: { id: agent.id } }))?.levelId : undefined;
  const resolved = await resolvePrice(prisma as unknown as DB, { userId: input.userId, agentId: agent?.id, agentLevelId: agentLevelId ?? undefined, variantId: variant.id });
  const total = resolved.unitPriceMinor * BigInt(qty);

  const order = await prisma.$transaction(async (tx) => {
    const db = tx as DB;
    const o = await tx.order.create({
      data: {
        code: randomCode("SC"), userId: input.userId, agentId: agent?.id ?? undefined, type: "CARD_PURCHASE",
        status: "CREATED", currency: variant.currency,
        subtotalMinor: (variant.basePriceMinor as bigint) * BigInt(qty),
        discountMinor: ((variant.basePriceMinor as bigint) - resolved.unitPriceMinor) * BigInt(qty),
        totalMinor: total, idempotencyKey: input.idempotencyKey,
      },
    });
    await transitionOrder(db, o.id, "VALIDATING", "system");
    await snapshotPrice(db, o.id, variant.id, qty, resolved, variant.faceValueMinor as bigint);
    await tx.orderItem.create({
      data: { orderId: o.id, productId: product.id, variantId: variant.id, name: `${product.name} — ${variant.name}`, qty, unitPriceMinor: resolved.unitPriceMinor, faceValueMinor: variant.faceValueMinor as bigint, totalMinor: total },
    });
    await tx.cardPurchaseOrder.create({ data: { orderId: o.id, variantId: variant.id, qty } });
    await ensureWallet(db, input.userId);
    await holdFunds(db, { userId: input.userId, orderId: o.id, amountMinor: total, idempotencyKey: `hold:${o.id}` });
    await reserveCards(db, { orderId: o.id, variantId: variant.id, qty, userId: input.userId });
    await transitionOrder(db, o.id, "RESERVED", "system");
    return o;
  });

  // Risk Engine (spec mục 9): HIGH/CRITICAL -> giữ giao mã, chuyển REVIEW + fraud queue.
  const { evaluateRisk } = await import("./risk");
  const risk = await evaluateRisk(prisma as unknown as DB, { userId: input.userId, action: "CARD_DELIVERY", orderId: order.id, amountMinor: total });
  if (risk.level === "HIGH" || risk.level === "CRITICAL") {
    await transitionOrder(prisma as unknown as DB, order.id, "REVIEW", "risk-engine", `Risk ${risk.level} score=${risk.score}`);
    const held = await prisma.order.findUnique({ where: { id: order.id } });
    return { order: held, duplicated: false, riskHeld: true, riskScore: risk.score, riskLevel: risk.level };
  }

  // Settle + giao mã ngay (kho nội bộ).
  const meta = (variant.metadata as any) ?? {};
  const costBps = typeof meta.costBps === "number" ? meta.costBps : 9500;
  const cost = bpsOf((variant.faceValueMinor as bigint) * BigInt(qty), costBps);
  const hold = await prisma.walletHold.findFirst({ where: { orderId: order.id, status: "ACTIVE" } });
  let margin = total - cost;
  await prisma.$transaction(async (tx) => {
    const db = tx as DB;
    if (hold) {
      const res = await settleHold(db, { holdId: hold.id, costMinor: cost, orderId: order.id });
      margin = (res as any).marginMinor ?? margin;
    }
    await deliverCards(db, { orderId: order.id, userId: input.userId });
    await tx.cardPurchaseOrder.update({ where: { orderId: order.id }, data: { deliveredAt: new Date() } });
    await tx.order.update({ where: { id: order.id }, data: { metadata: { costMinor: cost.toString(), marginMinor: margin.toString() } } });
  });
  await transitionOrder(prisma as unknown as DB, order.id, "SUBMITTING", "system").catch(() => undefined);
  await transitionOrder(prisma as unknown as DB, order.id, "SUCCESS", "system");
  await prisma.$transaction(async (tx) => {
    await computeCommissionForOrder(tx as DB, { orderId: order.id, sellerAgentId: order.agentId ?? agent?.id ?? null, marginMinor: margin, revenueMinor: total, productType: "CARD_PIN" });
  }).catch(() => undefined);
  await saveEvidencePack(prisma as unknown as DB, order.id);
  await enqueueWebhookEvent(prisma as unknown as DB, { eventType: "card.delivery.completed", resourceId: order.id, userId: input.userId, data: { order_id: order.id, qty } });
  await enqueueWebhookEvent(prisma as unknown as DB, { eventType: "order.success", resourceId: order.id, userId: input.userId, data: { order_id: order.id } });
  await notifyUser(prisma as unknown as DB, { userId: input.userId, type: "ORDER_SUCCESS", title: "Mua thẻ thành công", body: "Mã thẻ đã được giao vào mục Thẻ đã mua.", resourceType: "ORDER", resourceId: order.id });
  const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
  return { order: finalOrder, duplicated: false };
}

// ---------------- EXCHANGE (gạch thẻ) ----------------
export async function submitExchange(input: {
  userId: string; carrier: string; serial: string; pin: string; faceValueMinor: bigint; idempotencyKey: string;
  feeGroup?: string; deferProcessing?: boolean; compatMeta?: Record<string, unknown>;
}) {
  const dup = await findIdempotentOrder(input.userId, input.idempotencyKey);
  if (dup) return { order: dup, duplicated: true };
  if (!input.serial || input.serial.trim().length < 6) throw new Error("VALIDATION_SERIAL_INVALID");
  if (!input.pin || input.pin.trim().length < 6) throw new Error("VALIDATION_PIN_INVALID");
  const minFace = BigInt(await getNumberSetting("exchange.min_face_minor", 10000));
  const maxFace = BigInt(await getNumberSetting("exchange.max_face_minor", 5000000));
  if (input.faceValueMinor < minFace || input.faceValueMinor > maxFace) throw new Error("VALIDATION_FACE_VALUE");
  const fp = exchangeFingerprint(input.carrier, input.serial, input.pin);
  const dupCard = await prisma.exchangeOrder.findFirst({ where: { pinFingerprint: fp } });
  if (dupCard) throw new Error("DUPLICATE_REQUEST");
  const { getExchangeFee } = await import("./charging");
  const group = input.feeGroup ?? ((await agentOfUser(prisma as unknown as DB, input.userId)) ? "AGENT" : "MEMBER");
  const matrixFee = await getExchangeFee(prisma as unknown as DB, input.carrier, input.faceValueMinor, group);
  const feeBps = matrixFee ? matrixFee.feeBps : await getNumberSetting(`exchange.discount.${input.carrier.toLowerCase()}`, 1500);
  const fee = bpsOf(input.faceValueMinor, feeBps);
  const payout = input.faceValueMinor - fee;
  const providerCode = String(await getSetting("exchange.provider_code", "MOCK"));

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        code: randomCode("SC"), userId: input.userId, type: "EXCHANGE", status: "CREATED", currency: "VND",
        subtotalMinor: input.faceValueMinor, feeMinor: fee, totalMinor: payout, idempotencyKey: input.idempotencyKey,
        metadata: (input.compatMeta ? { compat: input.compatMeta, feeGroup: group } : { feeGroup: group }) as never,
      },
    });
    await transitionOrder(tx as DB, o.id, "VALIDATING", "system");
    const provider = await tx.provider.findUnique({ where: { code: providerCode } });
    await tx.exchangeOrder.create({
      data: {
        orderId: o.id, carrier: input.carrier, faceValueMinor: input.faceValueMinor,
        serialMasked: maskSecret(input.serial), pinFingerprint: fp, declaredValueMinor: input.faceValueMinor,
        feeBps, providerId: provider?.id,
      },
    });
    await tx.order.update({ where: { id: o.id }, data: { providerId: provider?.id } });
    await transitionOrder(tx as DB, o.id, "RESERVED", "system");
    await transitionOrder(tx as DB, o.id, "PENDING", "system", providerCode === "MANUAL" ? "Chờ xử lý thủ công" : "Đang xác minh với nhà mạng (mock)");
    return o;
  });

  if (providerCode === "MOCK" && !input.deferProcessing) {
    // Mock verify: PIN kết thúc "000" -> thẻ lỗi; "111" -> sai mệnh giá (mệnh giá thật = mệnh giá ma trận thấp hơn gần nhất); còn lại đúng mệnh giá.
    if (input.pin.endsWith("000")) {
      await failOrder(order.id, "Thẻ sai hoặc đã sử dụng (mock)");
    } else if (input.pin.endsWith("111")) {
      const { denominationsOf } = await import("./charging");
      const denoms = await denominationsOf(prisma as unknown as DB, input.carrier);
      const lower = denoms.filter((d) => d < input.faceValueMinor);
      if (lower.length === 0) await failOrder(order.id, "Thẻ sai mệnh giá không xác định được (mock)");
      else await settleExchange(order.id, lower[lower.length - 1]);
    } else {
      await settleExchange(order.id, input.faceValueMinor);
    }
  }
  const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
  return { order: finalOrder, duplicated: false };
}

/** Chốt gạch thẻ thành công: cộng ví theo payout đã snapshot. Dùng cho cả Mock lẫn duyệt thủ công ở Admin. */
export async function settleExchange(orderId: string, acceptedValueMinor: bigint, actor = "system") {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === "SUCCESS") return order;
  const ex = await prisma.exchangeOrder.findUnique({ where: { orderId } });
  if (!ex) throw new Error("EXCHANGE_NOT_FOUND");
  const { getExchangeFee } = await import("./charging");
  const group = ((order.metadata as any)?.feeGroup as string) ?? "MEMBER";
  const matrixFee = await getExchangeFee(prisma as unknown as DB, ex.carrier, acceptedValueMinor, group);
  const feeBps = matrixFee ? matrixFee.feeBps : ex.feeBps;
  const fee = bpsOf(acceptedValueMinor, feeBps);
  const declared = ex.declaredValueMinor as bigint;
  const wrongValue = acceptedValueMinor !== declared;
  let penalty = 0n;
  if (wrongValue) {
    const penaltyBps = matrixFee ? matrixFee.penaltyBps : await getNumberSetting("exchange.wrong_value_penalty_bps", 5000);
    const smaller = acceptedValueMinor < declared ? acceptedValueMinor : declared;
    penalty = bpsOf(smaller, penaltyBps);
  }
  const payout = acceptedValueMinor - fee - penalty;
  await prisma.$transaction(async (tx) => {
    const db = tx as DB;
    await ensureWallet(db, order.userId);
    await postLedger(db, {
      type: "EXCHANGE_PAYOUT", refType: "ORDER", refId: orderId, idempotencyKey: `exchange-payout:${orderId}`,
      description: `Gạch thẻ ${ex.carrier} cộng ví`, createdBy: actor === "system" ? undefined : actor,
      entries: [
        { accountCode: PLATFORM_EXCHANGE, ownerType: "PLATFORM", kind: "EXCHANGE", direction: "DEBIT", amountMinor: payout },
        { accountCode: walletAvailableCode(order.userId), ownerType: "USER", ownerId: order.userId, kind: "AVAILABLE", direction: "CREDIT", amountMinor: payout },
      ],
    });
    await tx.exchangeOrder.update({ where: { orderId }, data: { acceptedValueMinor, payoutMinor: payout, feeBps, wrongValue, penaltyMinor: penalty } });
    await tx.order.update({ where: { id: orderId }, data: { totalMinor: payout, feeMinor: fee } });
  });
  await transitionOrder(prisma as unknown as DB, orderId, "PROCESSING", actor).catch(() => undefined);
  await transitionOrder(prisma as unknown as DB, orderId, "SUCCESS", actor);
  await notifyUser(prisma as unknown as DB, { userId: order.userId, type: "EXCHANGE_SUCCESS", title: "Gạch thẻ thành công", resourceType: "ORDER", resourceId: orderId });
  await saveEvidencePack(prisma as unknown as DB, orderId);
  if ((order.metadata as any)?.compat) {
    const { sendChargingCallbackForOrder } = await import("./charging");
    await sendChargingCallbackForOrder(prisma as unknown as DB, orderId).catch(() => undefined);
  }
  return prisma.order.findUnique({ where: { id: orderId } });
}

export async function rejectExchange(orderId: string, reason: string, actor = "admin") {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  await prisma.order.update({ where: { id: orderId }, data: { failReason: reason } });
  if (["PENDING", "PROCESSING", "RESERVED"].includes(order.status)) {
    if (order.status === "RESERVED") await transitionOrder(prisma as unknown as DB, orderId, "PENDING", actor).catch(() => undefined);
    await transitionOrder(prisma as unknown as DB, orderId, "PROCESSING", actor).catch(() => undefined);
    await transitionOrder(prisma as unknown as DB, orderId, "FAILED", actor, reason);
  }
  await saveEvidencePack(prisma as unknown as DB, orderId);
  if ((order.metadata as any)?.compat) {
    const { sendChargingCallbackForOrder } = await import("./charging");
    await sendChargingCallbackForOrder(prisma as unknown as DB, orderId).catch(() => undefined);
  }
  return prisma.order.findUnique({ where: { id: orderId } });
}

// ---------------- CANCEL & REFUND ----------------
export async function cancelOrder(orderId: string, actor: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!["CREATED", "VALIDATING", "RESERVED"].includes(order.status)) throw new Error("ORDER_CANNOT_CANCEL");
  const hold = await prisma.walletHold.findFirst({ where: { orderId, status: "ACTIVE" } });
  await prisma.$transaction(async (tx) => {
    const db = tx as DB;
    if (hold) await releaseHold(db, hold.id, "cancel");
    await releaseReservedCards(db, orderId);
    await releaseCredit(db, { userId: order.userId, amountMinor: order.totalMinor as bigint, refId: orderId, idempotencyKey: `credit-release:${orderId}` }).catch(() => undefined);
  });
  await transitionOrder(prisma as unknown as DB, orderId, "CANCELLED", actor);
  return prisma.order.findUnique({ where: { id: orderId } });
}

/**
 * Refund (doc 03): tham chiếu đơn gốc, ≤ số đã thu, idempotent.
 * Đơn top-up SUCCESS không tự hoàn — hàm này chỉ được gọi từ Admin/Dispute đã có quyết định (API layer kiểm quyền).
 */
export async function refundOrder(params: { orderId: string; amountMinor: bigint; reason?: string; idempotencyKey: string; actorId: string }) {
  const existing = await prisma.refund.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (existing) return { refund: existing, duplicated: true };
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.status !== "SUCCESS") throw new Error("ORDER_NOT_REFUNDABLE");
  const done = await prisma.refund.aggregate({ where: { orderId: order.id, status: "COMPLETED" }, _sum: { amountMinor: true } });
  const refundedSoFar = (done._sum.amountMinor as bigint | null) ?? 0n;
  if (refundedSoFar + params.amountMinor > (order.totalMinor as bigint)) throw new Error("REFUND_EXCEEDS_PAID");
  const meta = (order.metadata as any) ?? {};
  const cost = BigInt(meta.costMinor ?? "0");
  const margin = BigInt(meta.marginMinor ?? "0");
  const total = order.totalMinor as bigint;
  const ratioCost = total > 0n ? (cost * params.amountMinor) / total : 0n;
  const ratioMargin = params.amountMinor - ratioCost > margin ? margin : params.amountMinor - ratioCost;

  const refund = await prisma.$transaction(async (tx) => {
    const db = tx as DB;
    const r = await tx.refund.create({
      data: { orderId: order.id, amountMinor: params.amountMinor, reason: params.reason, idempotencyKey: params.idempotencyKey, createdBy: params.actorId, status: "PENDING" },
    });
    await ensureWallet(db, order.userId);
    const entries: any[] = [
      { accountCode: walletAvailableCode(order.userId), ownerType: "USER", ownerId: order.userId, kind: "AVAILABLE", direction: "CREDIT", amountMinor: params.amountMinor },
    ];
    if (ratioCost > 0n) entries.push({ accountCode: order.providerId ? providerPayableCode(order.providerId) : PLATFORM_EXCHANGE, ownerType: "PROVIDER", ownerId: order.providerId, kind: "COST", direction: "DEBIT", amountMinor: ratioCost });
    if (ratioMargin > 0n) entries.push({ accountCode: PLATFORM_MARGIN, ownerType: "PLATFORM", kind: "REVENUE", direction: "DEBIT", amountMinor: ratioMargin });
    const rest = params.amountMinor - ratioCost - ratioMargin;
    if (rest > 0n) entries.push({ accountCode: PLATFORM_MARGIN, ownerType: "PLATFORM", kind: "REVENUE", direction: "DEBIT", amountMinor: rest });
    const posted = await postLedger(db, {
      type: "REFUND", refType: "ORDER", refId: order.id, idempotencyKey: `refund:${r.id}`,
      description: `Hoàn tiền đơn ${order.code}`, createdBy: params.actorId, entries,
    });
    await tx.refund.update({ where: { id: r.id }, data: { status: "COMPLETED", ledgerTxId: posted.tx.id } });
    return r;
  });

  const isFull = refundedSoFar + params.amountMinor >= total;
  if (isFull) {
    await transitionOrder(prisma as unknown as DB, order.id, "REFUND_PENDING", params.actorId).catch(() => undefined);
    await transitionOrder(prisma as unknown as DB, order.id, "REFUNDED", params.actorId).catch(() => undefined);
    await prisma.$transaction(async (tx) => { await reverseCommissionForOrder(tx as DB, order.id); }).catch(() => undefined);
    await enqueueWebhookEvent(prisma as unknown as DB, { eventType: "order.refunded", resourceId: order.id, userId: order.userId, data: { order_id: order.id, amount_minor: params.amountMinor.toString() } });
  }
  return { refund, duplicated: false };
}

/** Giao mã cho đơn CARD_PURCHASE đang bị giữ ở REVIEW sau khi fraud review APPROVED. */
export async function deliverHeldCardOrder(orderId: string, actorId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.type !== "CARD_PURCHASE" || order.status !== "REVIEW") throw new Error("ORDER_NOT_HELD");
  const cpo = await prisma.cardPurchaseOrder.findUnique({ where: { orderId } });
  if (!cpo) throw new Error("ORDER_NOT_FOUND");
  const variant = await prisma.productVariant.findUnique({ where: { id: cpo.variantId } });
  const meta = (variant?.metadata as any) ?? {};
  const costBps = typeof meta.costBps === "number" ? meta.costBps : 9500;
  const cost = bpsOf(((variant?.faceValueMinor as bigint) ?? 0n) * BigInt(cpo.qty), costBps);
  const hold = await prisma.walletHold.findFirst({ where: { orderId, status: "ACTIVE" } });
  let margin = (order.totalMinor as bigint) - cost;
  await prisma.$transaction(async (tx) => {
    const db = tx as DB;
    if (hold) {
      const res = await settleHold(db, { holdId: hold.id, costMinor: cost, orderId });
      margin = (res as any).marginMinor ?? margin;
    }
    await deliverCards(db, { orderId, userId: order.userId });
    await tx.cardPurchaseOrder.update({ where: { orderId }, data: { deliveredAt: new Date() } });
    await tx.order.update({ where: { id: orderId }, data: { metadata: { ...((order.metadata as object) ?? {}), costMinor: cost.toString(), marginMinor: margin.toString() } } });
  });
  await transitionOrder(prisma as unknown as DB, orderId, "PROCESSING", actorId, "Fraud review approved — giao mã");
  await transitionOrder(prisma as unknown as DB, orderId, "SUCCESS", actorId);
  await saveEvidencePack(prisma as unknown as DB, orderId);
  await logAudit(prisma as unknown as DB, { actorId, action: "CARD_DELIVERY_AFTER_REVIEW", entityType: "ORDER", entityId: orderId, result: "SUCCESS" });
  await enqueueWebhookEvent(prisma as unknown as DB, { eventType: "card.delivery.completed", resourceId: orderId, userId: order.userId, data: { order_id: orderId } });
  return prisma.order.findUnique({ where: { id: orderId } });
}

export async function getOrderForUser(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) return null;
  return orderWithItems(orderId).then(({ items }) => ({ ...order, items }));
}

export { getWalletBalances };
