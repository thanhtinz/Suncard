import { ok, fail, readJson, serialize } from "@/lib/api";
import { handleMockPayCallback } from "@/modules/payments";
export async function POST(req: Request) {
  try {
    const b = await readJson(req);
    const result = await handleMockPayCallback({ intentId: b.intentId, status: b.status, signature: b.signature ?? "", externalRef: b.externalRef });
    return ok(serialize({ intentId: result.intent.id, status: result.intent.status, duplicated: result.duplicated }));
  } catch (e) { return fail(e); }
}
