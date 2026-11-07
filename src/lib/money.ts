// Tiền tệ: integer minor units (BigInt), KHÔNG dùng float cho tiền.
// VND minor = đồng (1:1). Mọi phép tính tiền đi qua các hàm này.

export type Money = bigint;

export const ZERO: Money = 0n;

export function money(value: number | string | bigint): Money {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error("MONEY_NOT_INTEGER");
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value.trim())) throw new Error("MONEY_NOT_INTEGER");
  return BigInt(value.trim());
}

export function add(a: Money, b: Money): Money { return a + b; }
export function sub(a: Money, b: Money): Money { return a - b; }
export function mulQty(a: Money, qty: number): Money {
  if (!Number.isInteger(qty) || qty < 0) throw new Error("QTY_INVALID");
  return a * BigInt(qty);
}

/** Tính phần theo basis points (1 bps = 0.01%), làm tròn xuống về 0 (có lợi cho nền tảng, tránh âm). */
export function bpsOf(amount: Money, bps: number): Money {
  if (!Number.isInteger(bps)) throw new Error("BPS_NOT_INTEGER");
  return (amount * BigInt(bps)) / 10000n;
}

/** Giá sau chiết khấu bps. */
export function discounted(amount: Money, discountBps: number): Money {
  return amount - bpsOf(amount, discountBps);
}

export function minMoney(a: Money, b: Money): Money { return a < b ? a : b; }
export function maxMoney(a: Money, b: Money): Money { return a > b ? a : b; }

export function formatMoney(v: bigint | number, currency = "VND"): string {
  const n = typeof v === "bigint" ? v : BigInt(Math.trunc(v));
  const neg = n < 0n;
  const abs = (neg ? -n : n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${abs}${currency === "VND" ? " ₫" : " " + currency}`;
}

/** Serialize BigInt an toàn cho JSON API. */
export function moneyToJson(v: bigint): string { return v.toString(); }
