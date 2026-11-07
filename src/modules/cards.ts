import { encryptSecret, decryptSecret, fingerprint, maskSecret } from "@/lib/crypto";
import { randomUUID } from "crypto";
import { getNumberSetting, getSetting } from "./settings";
import { logAudit } from "./audit";
import type { DB } from "./ledger";

// Vòng đời mã thẻ (Security Spec bảng 9):
// IMPORTED -> VALIDATED -> AVAILABLE -> RESERVED -> DELIVERED
// QUARANTINED -> AVAILABLE / VOIDED (theo phê duyệt). DELIVERED không bao giờ quay lại AVAILABLE.

export async function assertVaultOpen(db: DB) {
  const locked = await getSetting<boolean>("cards.vault_locked", false);
  if (locked) throw new Error("VAULT_LOCKED");
}

// Kho thẻ: PIN/serial mã hoá AES-256-GCM; chống trùng bằng HMAC fingerprint;
// reserve trong transaction có lock (SELECT ... FOR UPDATE); giao mã MỘT lần;
// mã đã lộ không quay lại AVAILABLE. Mọi truy cập đều ghi card_access_audit; log chỉ mask/hash.

export interface ImportCardInput { serial: string; pin: string; expiresAt?: Date }

export async function importCardBatch(
  db: DB,
  params: { code: string; variantId: string; providerId?: string; importedBy?: string; cards: ImportCardInput[]; note?: string }
) {
  const result = { imported: 0, duplicates: 0, quarantined: 0 };
  const batch = await db.cardBatch.create({
    data: { code: params.code, variantId: params.variantId, providerId: params.providerId, importedBy: params.importedBy, note: params.note },
  });
  for (const c of params.cards) {
    const pinFp = fingerprint(`pin:${params.variantId}:${c.pin}`);
    const serialFp = fingerprint(`serial:${c.serial}`);
    const dup = await db.cardInventory.findFirst({ where: { variantId: params.variantId, pinFingerprint: pinFp } });
    if (dup) { result.duplicates++; result.quarantined++; continue; } // trùng fingerprint -> cách ly (không tạo bản ghi trùng vì unique fingerprint)
    const formatOk = c.serial.trim().length >= 6 && c.pin.trim().length >= 6;
    const card = await db.cardInventory.create({
      data: {
        batchId: batch.id,
        variantId: params.variantId,
        serialEnc: encryptSecret(c.serial),
        pinEnc: encryptSecret(c.pin),
        serialFingerprint: serialFp,
        pinFingerprint: pinFp,
        status: "IMPORTED",
        expiresAt: c.expiresAt,
      },
    });
    // VALIDATED: kiểm tra định dạng + trùng lặp xong mới AVAILABLE; sai định dạng -> QUARANTINED.
    await db.cardInventory.update({ where: { id: card.id }, data: { status: formatOk ? "AVAILABLE" : "QUARANTINED" } });
    if (formatOk) result.imported++; else result.quarantined++;
  }
  await db.cardBatch.update({ where: { id: batch.id }, data: { totalCards: result.imported } });
  return { batch, ...result };
}

export async function countAvailable(db: DB, variantId: string): Promise<number> {
  return db.cardInventory.count({ where: { variantId, status: "AVAILABLE" } });
}

/**
 * Reserve mã cho đơn trong transaction có row lock.
 * Phải được gọi bên trong prisma.$transaction. Dùng raw query FOR UPDATE SKIP LOCKED để tránh tranh chấp.
 */
export async function reserveCards(db: DB, params: { orderId: string; variantId: string; qty: number; userId: string }) {
  await assertVaultOpen(db);
  const ttlMinutes = await getNumberSetting("cards.hold_ttl_minutes", 15);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60000);
  const rows: { id: string }[] = await db.$queryRawUnsafe(
    `SELECT id FROM card_inventory WHERE "variantId" = $1 AND status = 'AVAILABLE' ORDER BY "createdAt" ASC LIMIT $2 FOR UPDATE SKIP LOCKED`,
    params.variantId,
    params.qty
  );
  if (rows.length < params.qty) throw new Error("CARD_OUT_OF_STOCK");
  const cards = [];
  for (const row of rows) {
    const card = await db.cardInventory.update({
      where: { id: row.id },
      data: { status: "RESERVED", reservedOrderId: params.orderId, reservedAt: new Date(), reserveExpiresAt: expiresAt },
    });
    await db.cardReservation.create({ data: { cardId: card.id, orderId: params.orderId, status: "ACTIVE", expiresAt } });
    await db.cardAccessAudit.create({ data: { cardId: card.id, userId: params.userId, action: "RESERVE", result: "OK" } });
    cards.push(card);
  }
  return cards;
}

/** Giao mã: RESERVED -> DELIVERED, tạo card_deliveries. Chỉ giao 1 lần (unique cardId+orderId, status check). */
export async function deliverCards(db: DB, params: { orderId: string; userId: string }) {
  await assertVaultOpen(db);
  const reservations = await db.cardReservation.findMany({ where: { orderId: params.orderId, status: "ACTIVE" } });
  const delivered = [];
  for (const r of reservations) {
    const card = await db.cardInventory.findUnique({ where: { id: r.cardId } });
    if (!card || card.status !== "RESERVED" || card.reservedOrderId !== params.orderId) continue;
    await db.cardInventory.update({
      where: { id: card.id },
      data: { status: "DELIVERED", soldOrderId: params.orderId, deliveredAt: new Date() },
    });
    await db.cardReservation.update({ where: { id: r.id }, data: { status: "DELIVERED" } });
    const delivery = await db.cardDelivery.create({
      data: { cardId: card.id, orderId: params.orderId, userId: params.userId },
    });
    await db.cardAccessAudit.create({ data: { cardId: card.id, userId: params.userId, action: "DELIVER", result: "OK" } });
    delivered.push(delivery);
  }
  return delivered;
}

/** Nhả mã đã reserve khi đơn fail/huỷ — CHỈ mã chưa từng deliver/reveal mới về AVAILABLE. */
export async function releaseReservedCards(db: DB, orderId: string) {
  const reservations = await db.cardReservation.findMany({ where: { orderId, status: "ACTIVE" } });
  for (const r of reservations) {
    const card = await db.cardInventory.findUnique({ where: { id: r.cardId } });
    if (card && card.status === "RESERVED") {
      await db.cardInventory.update({
        where: { id: card.id },
        data: { status: "AVAILABLE", reservedOrderId: null, reservedAt: null, reserveExpiresAt: null },
      });
    }
    await db.cardReservation.update({ where: { id: r.id }, data: { status: "RELEASED" } });
  }
}

/**
 * Secure Reveal — đủ 9 bước (Security Spec 7.2):
 * 1) Phiên xác thực (tầng route) 2) Kiểm chủ sở hữu đơn 3) Kiểm trạng thái thanh toán TỪ SERVER
 * (đơn phải SUCCESS) 4) Kiểm trạng thái mã (DELIVERED) 5) Risk Engine 6) Chỉ giải mã đúng mã yêu cầu
 * 7) Không đưa mã vào URL (POST body) 8) Audit actor/order/card/purpose/correlation_id — KHÔNG plaintext
 * 9) Đánh dấu giao nhất quán trong transaction.
 */
export async function revealCard(db: DB, params: { deliveryId: string; userId: string; stepUpVerified: boolean; ip?: string; purpose?: string; correlationId?: string; deviceId?: string }) {
  const correlationId = params.correlationId ?? randomUUID();
  const auditDeny = async (cardId: string, reason: string) => {
    await db.cardAccessAudit.create({ data: { cardId, userId: params.userId, action: "REVEAL", result: "DENIED", ip: params.ip, purpose: params.purpose ?? "CUSTOMER_REVEAL", correlationId, deviceId: params.deviceId } }).catch(() => undefined);
    await logAudit(db, { actorId: params.userId, action: "CARD_REVEAL", entityType: "CARD", entityId: cardId, result: "DENIED", ip: params.ip, deviceId: params.deviceId, correlationId, reason, summary: "Reveal bị từ chối" }).catch(() => undefined);
  };
  // Emergency Vault Lock: khóa vault -> ngừng MỌI reveal (fail secure)
  const locked = await getSetting<boolean>("cards.vault_locked", false);
  const delivery = await db.cardDelivery.findUnique({ where: { id: params.deliveryId } });
  if (locked) {
    if (delivery) await auditDeny(delivery.cardId, "VAULT_LOCKED");
    throw new Error("VAULT_LOCKED");
  }
  // Bước 2: chủ sở hữu
  if (!delivery || delivery.userId !== params.userId) {
    if (delivery) await auditDeny(delivery.cardId, "NOT_OWNER");
    throw new Error("PERMISSION_DENIED");
  }
  if (!params.stepUpVerified) {
    await auditDeny(delivery.cardId, "STEP_UP_REQUIRED");
    throw new Error("STEP_UP_REQUIRED");
  }
  // Bước 3: trạng thái thanh toán từ nguồn server — đơn phải SUCCESS
  const order = await db.order.findUnique({ where: { id: delivery.orderId } });
  if (!order || order.status !== "SUCCESS") {
    await auditDeny(delivery.cardId, "PAYMENT_NOT_VERIFIED");
    throw new Error("PAYMENT_NOT_VERIFIED");
  }
  // Bước 4: trạng thái mã
  const card = await db.cardInventory.findUnique({ where: { id: delivery.cardId } });
  if (!card) throw new Error("CARD_NOT_FOUND");
  if (card.status !== "DELIVERED") {
    await auditDeny(card.id, `CARD_STATE_${card.status}`);
    throw new Error("CARD_NOT_DELIVERED");
  }
  const maxReveal = await getNumberSetting("cards.max_reveal_per_card", 20);
  if (delivery.revealCount >= maxReveal) {
    await auditDeny(card.id, "REVEAL_LIMIT_EXCEEDED");
    throw new Error("REVEAL_LIMIT_EXCEEDED");
  }
  // Bước 5: Risk Engine — HIGH giữ lại chờ duyệt, CRITICAL chặn
  const { evaluateRisk, hasApprovedReview } = await import("./risk");
  const risk = await evaluateRisk(db, { userId: params.userId, action: "REVEAL", orderId: delivery.orderId, ip: params.ip, deviceId: params.deviceId });
  if (risk.level === "CRITICAL") {
    await auditDeny(card.id, "RISK_CRITICAL");
    throw new Error("RISK_BLOCKED");
  }
  if (risk.level === "HIGH" && !(await hasApprovedReview(db, params.userId, delivery.orderId))) {
    await auditDeny(card.id, "RISK_HIGH_HELD");
    throw new Error("RISK_HELD");
  }
  // Bước 6 + 8 + 9: giải mã đúng mã này; ghi nhận reveal + audit nhất quán
  const serial = decryptSecret(card.serialEnc);
  const pin = decryptSecret(card.pinEnc);
  const doAudit = async (tx: DB) => {
    await tx.cardDelivery.update({ where: { id: delivery.id }, data: { revealCount: { increment: 1 }, lastRevealAt: new Date() } });
    await tx.cardAccessAudit.create({ data: { cardId: card.id, userId: params.userId, action: "REVEAL", result: "OK", ip: params.ip, orderId: delivery.orderId, purpose: params.purpose ?? "CUSTOMER_REVEAL", correlationId, deviceId: params.deviceId } });
  };
  if (typeof db.$transaction === "function") await db.$transaction(async (tx: DB) => doAudit(tx));
  else await doAudit(db);
  await logAudit(db, { actorId: params.userId, action: "CARD_REVEAL", entityType: "CARD", entityId: card.id, result: "SUCCESS", ip: params.ip, deviceId: params.deviceId, correlationId, summary: `Reveal mã cho đơn ${order.code}, mục đích ${params.purpose ?? "CUSTOMER_REVEAL"}` });
  return { serial, pin, serialMasked: maskSecret(serial), revealCount: delivery.revealCount + 1, correlationId };
}

/** Phê duyệt mã QUARANTINED -> AVAILABLE hoặc VOIDED (spec bảng 9). Có audit. */
export async function reviewQuarantinedCard(db: DB, params: { cardId: string; decision: "AVAILABLE" | "VOIDED"; actorId: string; reason?: string }) {
  const card = await db.cardInventory.findUnique({ where: { id: params.cardId } });
  if (!card || card.status !== "QUARANTINED") throw new Error("CARD_NOT_QUARANTINED");
  const updated = await db.cardInventory.update({ where: { id: card.id }, data: { status: params.decision } });
  await logAudit(db, { actorId: params.actorId, action: "CARD_QUARANTINE_DECISION", entityType: "CARD", entityId: card.id, result: "SUCCESS", reason: params.reason, summary: `QUARANTINED -> ${params.decision}` });
  return updated;
}

/** Kiểm tra trùng thẻ gạch (fingerprint) — dùng cho exchange chống nộp trùng. */
export function cardFingerprint(variantScope: string, pin: string): string {
  return fingerprint(`pin:${variantScope}:${pin}`);
}
export function exchangeFingerprint(carrier: string, serial: string, pin: string): string {
  return fingerprint(`exchange:${carrier.toLowerCase()}:${serial.trim()}:${pin.trim()}`);
}
