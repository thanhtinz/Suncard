import { NextResponse } from "next/server";
import { handleVnpayIpn } from "@/modules/vnpay";

// IPN VNPay (server-to-server) — nguồn sự thật duy nhất để cộng ví.
// Trả JSON {RspCode, Message} đúng đặc tả VNPay.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });
  try {
    const r = await handleVnpayIpn(query);
    return NextResponse.json({ RspCode: r.rspCode, Message: r.message });
  } catch {
    return NextResponse.json({ RspCode: "99", Message: "Lỗi hệ thống" });
  }
}
