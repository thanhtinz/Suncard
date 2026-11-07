import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api";
import { cronAuthorized, runOpsCron } from "@/modules/ops";

// Worker nền (Phase 2/4): inquiry đơn tồn đọng + đối soát provider HTTP theo lịch +
// cảnh báo vận hành. Bảo vệ bằng CRON_SECRET qua header (x-cron-secret hoặc
// Authorization: Bearer), so timing-safe, fail-closed — KHÔNG nhận secret qua query.
export async function POST(req: Request) {
  try {
    if (!cronAuthorized(req)) {
      return NextResponse.json({ error: { code: "AUTH_INVALID", message: "Cron secret không hợp lệ" }, request_id: "cron" }, { status: 401 });
    }
    return ok(await runOpsCron());
  } catch (e) { return fail(e); }
}
export async function GET(req: Request) { return POST(req); }
