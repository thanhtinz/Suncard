import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFields, loadCompatClient, verifyCompatSign, walletBalanceMinor, rechargeStatus, CompatError } from "@/modules/compat";
import { createTopupOrder, cancelOrder } from "@/modules/orders-service";

// Recharge Compat API — POST/GET /api/rechargews
// command: topup | getstatus | getbalance | productlist | feetopup | canceltopup
// Envelope: { status, message, data }. Sign MD5 (xem modules/compat.ts).

const MESSAGES: Record<string, string> = {
  success: "Thành công",
  command_invalid: "Lệnh command không nằm trong danh sách hỗ trợ",
  wrong_post_data: "Thiếu hoặc sai dữ liệu đầu vào bắt buộc",
  product_not_found: "Không tìm thấy service_code tương ứng",
  account_info_not_correct: "account_info không đúng định dạng mong muốn hoặc tài khoản đích không hợp lệ",
  payment_fail: "Thanh toán ví thất bại",
  order_not_found: "Không tìm thấy đơn hàng cần tra cứu hoặc hủy",
  wrong_signature: "Sai chữ ký sign hoặc kết nối chưa được duyệt",
  ip_not_allowed: "IP gọi API không nằm trong whitelist cho phép",
  cannot_cancel: "Đơn đã xử lý xong hoặc đang nạp, không thể hủy",
};

function resp(status: string, data: unknown = null, httpStatus = 200) {
  return NextResponse.json({ status, message: MESSAGES[status] ?? status, data }, { status: httpStatus });
}

const WITH_REQUEST = ["topup", "getstatus", "canceltopup"];
const NO_REQUEST = ["getbalance", "productlist", "feetopup"];
const COMMANDS = [...WITH_REQUEST, ...NO_REQUEST];

function parseAccountInfo(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === "object") return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v)]));
  } catch { /* không phải JSON */ }
  return {};
}

async function findTopupProduct(serviceCode: string) {
  const code = (serviceCode ?? "").trim();
  if (!code) return null;
  let p = await prisma.product.findFirst({ where: { code, type: "GAME_TOPUP", isActive: true } });
  if (!p) p = await prisma.product.findFirst({ where: { code: `GAME-${code.toUpperCase()}`, type: "GAME_TOPUP", isActive: true } });
  return p;
}

async function handle(req: Request) {
  const f = await parseFields(req);
  const command = (f.command ?? "").toLowerCase();
  if (!COMMANDS.includes(command)) return resp("command_invalid");
  try {
    const { client, partnerKey } = await loadCompatClient(req, f.partner_id ?? "", "RECHARGE");
    const requestId = f.request_id ?? "";
    const needReq = WITH_REQUEST.includes(command);
    if (needReq && !requestId) return resp("wrong_post_data");
    if (!verifyCompatSign(partnerKey, client.clientId, command, needReq ? requestId : null, f.sign ?? "")) return resp("wrong_signature");
    const userId = client.userId!;

    if (command === "getbalance") {
      return resp("success", { balance: Number(await walletBalanceMinor(userId)), currency: "VND" });
    }

    if (command === "productlist" || command === "feetopup") {
      const products = await prisma.product.findMany({ where: { type: "GAME_TOPUP", isActive: true }, orderBy: { name: "asc" } });
      const variants = products.length ? await prisma.productVariant.findMany({ where: { productId: { in: products.map((p) => p.id) }, isActive: true }, orderBy: { faceValueMinor: "asc" } }) : [];
      if (command === "feetopup") {
        return resp("success", variants.map((v) => {
          const p = products.find((x) => x.id === v.productId)!;
          const face = Number(v.faceValueMinor); const price = Number(v.basePriceMinor);
          return { key: p.code, value: face, price, discount: face > 0 ? Math.round((1 - price / face) * 10000) / 100 : 0 };
        }));
      }
      return resp("success", products.map((p) => ({
        name: p.name,
        service_code: p.code,
        items: variants.filter((v) => v.productId === p.id).map((v) => {
          const face = Number(v.faceValueMinor); const price = Number(v.basePriceMinor);
          return { name: v.name, value: face, price, discount: face > 0 ? Math.round((1 - price / face) * 10000) / 100 : 0 };
        }),
        options: [
          { key: "uid", name: "UID / tài khoản nhận", type: "text" },
          { key: "server", name: "Máy chủ / zone (nếu game yêu cầu)", type: "text" },
        ],
      })));
    }

    if (command === "topup") {
      const amount = Number(f.amount ?? "0");
      const account = parseAccountInfo(f.account_info);
      const playerId = account.uid ?? account.playerId ?? account.account ?? account.phone ?? account.id ?? "";
      if (!f.service_code || !Number.isInteger(amount) || amount <= 0 || !playerId) return resp("wrong_post_data");
      const product = await findTopupProduct(f.service_code);
      if (!product) return resp("product_not_found");
      const variant = await prisma.productVariant.findFirst({ where: { productId: product.id, faceValueMinor: BigInt(amount), isActive: true } });
      if (!variant) return resp("product_not_found");
      try {
        const { order } = await createTopupOrder({
          userId, variantId: variant.id, qty: 1, playerId,
          serverCode: account.server ?? account.zone_id ?? account.serverCode,
          regionCode: account.region ?? account.regionCode,
          idempotencyKey: `recharge:${client.clientId}:${requestId}`,
        });
        const face = Number(variant.faceValueMinor); const paid = Number(order!.totalMinor);
        return resp("success", {
          time: order!.createdAt.toISOString(),
          request_id: requestId,
          account,
          order_code: order!.code,
          pay_amount: paid,
          discount: face > 0 ? Math.round((1 - paid / face) * 10000) / 100 : 0,
          service_code: product.code,
          amount: face,
          status: rechargeStatus(order!.status),
        });
      } catch (e: any) {
        const m = String(e?.message ?? "");
        if (m === "PRODUCT_NOT_FOUND") return resp("product_not_found");
        if (m === "PLAYER_INVALID") return resp("account_info_not_correct");
        if (m === "INSUFFICIENT_BALANCE") return resp("payment_fail");
        return resp("payment_fail");
      }
    }

    // getstatus | canceltopup — tra đơn theo request_id (idempotency) hoặc order_code.
    let order = await prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: `recharge:${client.clientId}:${requestId}` } },
    });
    if (!order && f.order_code) order = await prisma.order.findFirst({ where: { code: f.order_code, userId, type: "TOPUP" } });
    if (!order || order.type !== "TOPUP") return resp("order_not_found");

    if (command === "canceltopup") {
      if (!["CREATED", "VALIDATING", "RESERVED", "PENDING", "PROCESSING"].includes(order.status)) return resp("cannot_cancel");
      await cancelOrder(order.id, "partner-api").catch(() => undefined);
      const fresh = await prisma.order.findUnique({ where: { id: order.id } });
      return resp("success", { request_id: requestId, order_code: order.code, status: rechargeStatus(fresh!.status) });
    }

    const item = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
    const topup = await prisma.topupOrder.findUnique({ where: { orderId: order.id } }).catch(() => null);
    return resp("success", {
      account: topup ? { uid: topup.playerId, ...(topup.serverCode ? { server: topup.serverCode } : {}) } : {},
      request_value: item ? Number(item.faceValueMinor) : Number(order.subtotalMinor),
      amount: Number(order.totalMinor),
      request_id: requestId,
      order_code: order.code,
      status: rechargeStatus(order.status),
    });
  } catch (e) {
    if (e instanceof CompatError) return resp(e.code);
    console.error("rechargews error", e);
    return resp("payment_fail", null, 500);
  }
}

export async function POST(req: Request) { return handle(req); }
export async function GET(req: Request) { return handle(req); }
