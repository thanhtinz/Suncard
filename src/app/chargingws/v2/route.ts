import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DB } from "@/modules/ledger";
import {
  partnerKeyOf, verifyChargingSign, verifyCheckSign, normalizeTelco, denominationsOf,
  buildChargingResponse, chargingMessage, ipAllowed, callbackSign,
} from "@/modules/charging";
import { maskSecret } from "@/lib/crypto";
import { submitExchange, finalizeExchangeViaProvider } from "@/modules/orders-service";

// Charging Compat API — POST (và GET) /chargingws/v2, command=charging|check.
// Response JSON đúng format thị trường (không bọc envelope của SunCard).

function resp(body: Record<string, unknown>) {
  return NextResponse.json(body);
}
function errResp(status: number, request_id = "") {
  return resp({ trans_id: "", request_id, status, message: chargingMessage(status), value: 0, declared_value: 0, amount: 0, telco: "", serial: "", code: "", callback_sign: "" });
}

async function parseFields(req: Request): Promise<Record<string, string>> {
  const url = new URL(req.url);
  const out: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { out[k] = v; });
  if (req.method === "POST") {
    const ct = req.headers.get("content-type") ?? "";
    try {
      if (ct.includes("application/json")) {
        const j = await req.json();
        for (const [k, v] of Object.entries(j)) out[k] = String(v);
      } else {
        const text = await req.text();
        new URLSearchParams(text).forEach((v, k) => { out[k] = v; });
      }
    } catch { /* giữ query params */ }
  }
  if (!out.serial && out.seri) out.serial = out.seri; // biến thể field "seri"
  return out;
}

async function handle(req: Request) {
  const f = await parseFields(req);
  const command = (f.command ?? "").toLowerCase();
  const requestId = f.request_id ?? "";
  try {
    if (command !== "charging" && command !== "check") return errResp(104, requestId);
    const client = await prisma.apiClient.findUnique({ where: { clientId: f.partner_id ?? "" } });
    if (!client || client.status !== "ACTIVE") return errResp(102, requestId);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    if (!ipAllowed(client, ip)) return errResp(102, requestId);
    const partnerKey = await partnerKeyOf(prisma as unknown as DB, client);
    if (!partnerKey) return errResp(102, requestId);
    if (!client.userId) return errResp(100, requestId);

    if (command === "check") {
      if (!verifyCheckSign(partnerKey, { command, partner_id: client.clientId, request_id: requestId, sign: f.sign ?? "", serial: f.serial, code: f.code })) {
        return errResp(102, requestId);
      }
      const order = await prisma.order.findUnique({
        where: { userId_idempotencyKey: { userId: client.userId, idempotencyKey: `charging:${client.clientId}:${requestId}` } },
      });
      if (!order) return errResp(101, requestId);
      const exchange = await prisma.exchangeOrder.findUnique({ where: { orderId: order.id } });
      const compat = (order.metadata as any)?.compat ?? {};
      return resp({ ...buildChargingResponse({ partnerKey, order, exchange, serial: f.serial ?? compat.serial_masked ?? "", code: f.code ?? compat.code_masked ?? "" }) });
    }

    // command=charging
    const serial = f.serial ?? "";
    const code = f.code ?? "";
    const telco = normalizeTelco(f.telco ?? "");
    const amount = Number(f.amount ?? "0");
    if (!requestId || !telco || !serial || !code || !Number.isInteger(amount) || amount <= 0) return errResp(102, requestId);
    if (!verifyChargingSign(partnerKey, { command, partner_id: client.clientId, request_id: requestId, telco, amount: String(amount), serial, code, sign: f.sign ?? "" })) {
      return errResp(102, requestId);
    }
    const denoms = await denominationsOf(prisma as unknown as DB, telco);
    if (!denoms.includes(BigInt(amount))) return errResp(102, requestId);

    const compatMeta = {
      partner_id: client.clientId, request_id: requestId,
      serial_masked: maskSecret(serial), code_masked: maskSecret(code),
      callback_sign: callbackSign(partnerKey, code, serial),
    };
    const { order, duplicated } = await submitExchange({
      userId: client.userId, carrier: telco, serial, pin: code, faceValueMinor: BigInt(amount),
      idempotencyKey: `charging:${client.clientId}:${requestId}`,
      feeGroup: client.feeGroup ?? "API", deferProcessing: true, compatMeta,
    });
    if (!order) return errResp(100, requestId);

    if (!duplicated) {
      // MOCK: kịch bản sandbox; HTTP_CHARGING: đẩy tiếp sang upstream thật;
      // MANUAL: giữ PENDING (99), Admin duyệt ở hàng chờ gạch thẻ.
      await finalizeExchangeViaProvider(order.id, { carrier: telco, serial, pin: code, faceValueMinor: BigInt(amount) }, "charging");
    }
    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    const exchange = await prisma.exchangeOrder.findUnique({ where: { orderId: order.id } });
    return resp({ ...buildChargingResponse({ partnerKey, order: fresh!, exchange, serial, code }) });
  } catch (e) {
    console.error("chargingws error", e);
    return errResp(103, requestId);
  }
}

export async function POST(req: Request) { return handle(req); }
export async function GET(req: Request) { return handle(req); }
