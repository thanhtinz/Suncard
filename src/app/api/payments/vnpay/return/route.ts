import { NextResponse } from "next/server";
import { getVnpayConfig, verifyVnpaySignature } from "@/modules/vnpay";

// Return URL VNPay — CHỈ hiển thị kết quả cho khách, tuyệt đối không cộng tiền ở đây
// (việc cộng ví do IPN đã xác thực chữ ký đảm nhiệm — PAY-01).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });
  let state = "unknown";
  const cfg = await getVnpayConfig().catch(() => null);
  if (cfg && verifyVnpaySignature(cfg.hashSecret, query)) {
    state = query.vnp_ResponseCode === "00" ? "success" : "failed";
  }
  const target = new URL("/tai-khoan/vi", url.origin);
  target.searchParams.set("nap", "vnpay");
  target.searchParams.set("trang_thai", state);
  return NextResponse.redirect(target);
}
