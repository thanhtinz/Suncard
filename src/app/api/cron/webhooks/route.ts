import { ok, fail } from "@/lib/api";
import { deliverDueWebhooks } from "@/modules/webhooks";
export async function POST() {
  try { return ok(await deliverDueWebhooks()); } catch (e) { return fail(e); }
}
export async function GET() {
  try { return ok(await deliverDueWebhooks()); } catch (e) { return fail(e); }
}
