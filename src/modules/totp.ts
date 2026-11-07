import crypto from "crypto";

// TOTP RFC 6238 (HMAC-SHA1, 30s, 6 số) — triển khai bằng crypto chuẩn, không thêm dependency.
// Secret lưu trong DB dạng mã hoá AES-256-GCM (envelope như card vault).

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(secretB32: string, atMs = Date.now()): string {
  const counter = Math.floor(atMs / 30000);
  const msg = Buffer.alloc(8);
  msg.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secretB32)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Verify với cửa sổ ±2 bước (150s) chống lệch giờ đồng hồ điện thoại. */
export function verifyTotp(secretB32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code ?? "")) return false;
  for (const drift of [0, -30000, 30000, -60000, 60000]) {
    if (totpCode(secretB32, Date.now() + drift) === code) return true;
  }
  return false;
}

export function otpauthUrl(secretB32: string, account: string): string {
  return `otpauth://totp/SunCard:${encodeURIComponent(account)}?secret=${secretB32}&issuer=SunCard&digits=6&period=30`;
}
