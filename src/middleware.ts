import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Web security (Security Spec mục 12):
// - CSRF: request đổi trạng thái qua /api (cookie session) phải cùng Origin (SameSite là lớp 1, Origin check là lớp 2).
//   Bỏ qua: callback ký số (payments/provider), cron, và các API dùng HMAC/Bearer (/v1, /chargingws không nằm dưới /api).
// - Rate limit cơ bản theo IP + path cho /api (bổ trợ cho rate limit nghiệp vụ trong route).
const buckets = new Map<string, { count: number; resetAt: number }>();
function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

const CSRF_SKIP = ["/api/payments/mockpay/callback", "/api/cron/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

  if (pathname.startsWith("/chargingws/")) {
    if (!hit(`charging:${ip}`, 300, 60000)) {
      return NextResponse.json({ status: 102, message: "RATE_LIMITED" }, { status: 429 });
    }
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/auth/login") && isWrite) {
    if (!hit(`login:${ip}`, 30, 60000)) return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Quá nhiều yêu cầu" }, request_id: "mw" }, { status: 429 });
  }
  if (pathname.startsWith("/api/")) {
    if (!hit(`api:${ip}:${pathname}`, 600, 60000)) {
      return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Quá nhiều yêu cầu" }, request_id: "mw" }, { status: 429 });
    }
    if (isWrite && !CSRF_SKIP.some((p) => pathname.startsWith(p))) {
      const origin = req.headers.get("origin");
      if (origin) {
        try {
          const originHost = new URL(origin).host;
          const host = req.headers.get("host");
          if (host && originHost !== host) {
            return NextResponse.json({ error: { code: "CSRF_ORIGIN_MISMATCH", message: "Origin không hợp lệ" }, request_id: "mw" }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: { code: "CSRF_ORIGIN_MISMATCH", message: "Origin không hợp lệ" }, request_id: "mw" }, { status: 403 });
        }
      }
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/chargingws/:path*"] };
