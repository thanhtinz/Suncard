import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFields, loadCompatClient, verifyCompatSign, walletBalanceMinor, CompatError } from "@/modules/compat";
import { createCardOrder } from "@/modules/orders-service";
import { countAvailable } from "@/modules/cards";
import { decryptSecret } from "@/lib/crypto";
import type { DB } from "@/modules/ledger";

// Softcard Compat API — POST/GET /api/cardws
// command: buycard | redownload | checkavailable | getbalance
// Mã trạng thái: 1 thành công · 2 đang chờ xử lý · 3 đơn đã huỷ/hoàn tiền ·
// 102 số dư ví không đủ · 114 IP không được phép · 116 sai chữ ký sign ·
// 118 sản phẩm đã hết hàng · 129 đơn hàng không tồn tại · 130 lỗi hệ thống/nguồn cung cấp.

const MESSAGES: Record<number, string> = {
  1: "Thành công",
  2: "Đơn hàng đang chờ xử lý",
  3: "Đơn hàng đã hủy và hoàn tiền",
  102: "Số dư ví không đủ",
  114: "IP gọi API không nằm trong whitelist cho phép",
  116: "Sai chữ ký ký sign",
  118: "Sản phẩm đã hết hàng",
  129: "Đơn hàng không tồn tại",
  130: "Lỗi lấy thẻ từ nguồn cung cấp",
  104: "Command không hợp lệ",
};

function resp(status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ status, message: MESSAGES[status] ?? "Không rõ trạng thái", ...extra });
}

async function findCardProduct(serviceCode: string) {
  const code = (serviceCode ?? "").trim();
  if (!code) return null;
  let p = await prisma.product.findFirst({ where: { code, type: "CARD_PIN", isActive: true } });
  if (!p) p = await prisma.product.findFirst({ where: { code: `CARD-${code.toUpperCase()}`, type: "CARD_PIN", isActive: true } });
  return p;
}

async function cardsOfOrder(orderId: string) {
  const deliveries = await prisma.cardDelivery.findMany({ where: { orderId } });
  if (!deliveries.length) return [];
  const cards = await prisma.cardInventory.findMany({ where: { id: { in: deliveries.map((d) => d.cardId) } } });
  const item = await prisma.orderItem.findFirst({ where: { orderId } });
  return cards.map((c) => ({
    name: item?.name ?? "Thẻ",
    serial: decryptSecret(c.serialEnc),
    code: decryptSecret(c.pinEnc),
    expired: c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : null,
  }));
}

async function buyResult(order: any, requestId: string) {
  if (order.status === "SUCCESS") {
    return resp(1, { message: "Mua thẻ thành công", data: { cards: await cardsOfOrder(order.id), request_id: requestId, order_code: order.code } });
  }
  if (order.status === "CANCELLED" || order.status === "REFUNDED") return resp(3, { data: { request_id: requestId, order_code: order.code } });
  if (order.status === "FAILED") return resp(130, { data: { request_id: requestId, order_code: order.code } });
  return resp(2, { data: { request_id: requestId, order_code: order.code, status: "pending" } });
}

async function handle(req: Request) {
  const f = await parseFields(req);
  const command = (f.command ?? "").toLowerCase();
  if (!["buycard", "redownload", "checkavailable", "getbalance"].includes(command)) return resp(104);
  try {
    const { client, partnerKey } = await loadCompatClient(req, f.partner_id ?? "", "SOFTCARD");
    const requestId = f.request_id ?? "";
    const needReq = command === "buycard" || command === "redownload";
    if (needReq && !requestId) return resp(116);
    if (!verifyCompatSign(partnerKey, client.clientId, command, needReq ? requestId : null, f.sign ?? "")) return resp(116);
    const userId = client.userId!;

    if (command === "getbalance") {
      return NextResponse.json({ status: 1, message: "Thành công", balance: String(await walletBalanceMinor(userId)), currency_code: "VND" });
    }

    if (command === "checkavailable") {
      const product = await findCardProduct(f.service_code ?? "");
      if (!product) return resp(118);
      const value = Number(f.value ?? "0");
      const qty = Math.max(1, Number(f.qty ?? "1") || 1);
      const variant = await prisma.productVariant.findFirst({ where: { productId: product.id, faceValueMinor: BigInt(value || 0), isActive: true } });
      if (!variant) return resp(118);
      const available = await countAvailable(prisma as unknown as DB, variant.id);
      return NextResponse.json({
        status: 1, message: "Thành công",
        stock_available: available >= qty,
        available_qty: available,
        [`${product.code.replace(/^CARD-/, "")}-${value}`]: available >= qty ? "Còn hàng" : "Hết hàng",
      });
    }

    if (command === "redownload") {
      const order = await prisma.order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: `cardws:${client.clientId}:${requestId}` } },
      });
      if (!order || order.type !== "CARD_PURCHASE") return resp(129);
      return buyResult(order, requestId);
    }

    // buycard
    const product = await findCardProduct(f.service_code ?? "");
    if (!product) return resp(118);
    const value = Number(f.value ?? "0");
    const qty = Number(f.qty ?? "1");
    if (!Number.isInteger(value) || value <= 0 || !Number.isInteger(qty) || qty < 1 || qty > 50) return resp(116);
    const variant = await prisma.productVariant.findFirst({ where: { productId: product.id, faceValueMinor: BigInt(value), isActive: true } });
    if (!variant) return resp(118);
    const available = await countAvailable(prisma as unknown as DB, variant.id);
    if (available < qty) return resp(118);
    try {
      const { order } = await createCardOrder({ userId, variantId: variant.id, qty, idempotencyKey: `cardws:${client.clientId}:${requestId}` });
      return buyResult(order, requestId);
    } catch (e: any) {
      const m = String(e?.message ?? "");
      if (m === "INSUFFICIENT_BALANCE") return resp(102);
      if (m === "PRODUCT_NOT_FOUND") return resp(118);
      console.error("cardws buycard error", e);
      return resp(130);
    }
  } catch (e) {
    if (e instanceof CompatError) return resp(e.code === "ip_not_allowed" ? 114 : 116);
    console.error("cardws error", e);
    return resp(130);
  }
}

export async function POST(req: Request) { return handle(req); }
export async function GET(req: Request) { return handle(req); }
