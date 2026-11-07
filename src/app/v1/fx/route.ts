import { ok, fail } from "@/lib/api";
import { withPartner } from "@/lib/partner";
import { getFxRates } from "@/modules/fx";

// GET /v1/fx — tỉ giá quy đổi hiển thị (Phase 5 nền đa tiền tệ).
// Tiền thật vẫn là VND; tỉ giá này chỉ phục vụ hiển thị ước tính.
export async function GET(req: Request) {
  return withPartner(req, async () => {
    try {
      const fx = await getFxRates();
      return ok({ base: fx.base, rates: { USD: 1 / fx.vndPerUsd, VND: 1 }, vnd_per_usd: fx.vndPerUsd, display_enabled: fx.displayEnabled, note: "Quy đổi ước tính để hiển thị; giao dịch thật tính bằng VND" });
    } catch (e) { return fail(e); }
  });
}
