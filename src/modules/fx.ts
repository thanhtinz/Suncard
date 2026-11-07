import { getNumberSetting, getSetting } from "./settings";

// ============================================================================
// Nền đa tiền tệ (Phase 5 — CHỈ phần nền):
// - Tỉ giá VND/USD cấu hình trong DB (Admin -> Cài đặt), KHÔNG hardcode.
// - Tiền thật của hệ thống vẫn là VND (ledger, đơn, ví không đổi). USD ở đây
//   CHỈ là giá quy đổi ƯỚC TÍNH để hiển thị cho khách quốc tế khi khách chọn xem.
// ============================================================================

export interface FxRates { base: "VND"; vndPerUsd: number; displayEnabled: boolean; updatedAt: string }

export async function getFxRates(): Promise<FxRates> {
  const vndPerUsd = await getNumberSetting("fx.vnd_per_usd", 25000);
  const displayEnabled = await getSetting<boolean>("fx.display_enabled", true);
  return { base: "VND", vndPerUsd, displayEnabled, updatedAt: new Date().toISOString() };
}

/** Quy đổi VND (minor = đồng) sang USD để hiển thị, làm tròn 2 chữ số. */
export function vndToUsd(amountMinor: bigint, vndPerUsd: number): number {
  if (!vndPerUsd || vndPerUsd <= 0) return 0;
  return Math.round((Number(amountMinor) / vndPerUsd) * 100) / 100;
}

export function formatUsdEstimate(amountMinor: bigint, vndPerUsd: number): string {
  return `≈ $${vndToUsd(amountMinor, vndPerUsd).toFixed(2)}`;
}
