import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api";
import { deliverDueWebhooks } from "@/modules/webhooks";
import { cronAuthorized } from "@/modules/ops";

// Giao webhook đến hạn (retry backoff). Cùng cơ chế bảo vệ như cron ops:
// CRON_SECRET qua header, timing-safe, fail-closed.
export async function POST(req: Request) {
  try {
    if (!cronAuthorized(req)) {
      return NextResponse.json({ error: { code: "AUTH_INVALID", message: "Cron secret không hợp lệ" }, request_id: "cron" }, { status: 401 });
    }
    return ok(await deliverDueWebhooks());
  } catch (e) { return fail(e); }
}
export async function GET(req: Request) { return POST(req); }
