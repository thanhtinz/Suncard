import crypto from "crypto";

// Mã hoá thẻ: AES-256-GCM envelope. Key suy từ env CARD_ENCRYPTION_KEY (SHA-256 -> 32 bytes).
// DB chỉ giữ ciphertext dạng: v1.<iv b64>.<tag b64>.<ct b64>
// Fingerprint chống trùng: HMAC-SHA256 bằng CARD_FINGERPRINT_KEY — không thể đảo ngược ra PIN.

function encKey(): Buffer {
  const raw = process.env.CARD_ENCRYPTION_KEY || "dev-card-key-change-me";
  return crypto.createHash("sha256").update(raw).digest();
}
function fpKey(): string {
  return process.env.CARD_FINGERPRINT_KEY || "dev-fingerprint-key-change-me";
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("CIPHERTEXT_FORMAT_INVALID");
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ct = Buffer.from(parts[3], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function fingerprint(value: string): string {
  return crypto.createHmac("sha256", fpKey()).update(value.trim()).digest("hex");
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Mask để log/hiển thị: giữ 4 ký tự cuối. Log KHÔNG bao giờ chứa PIN/serial đầy đủ. */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "****";
  return "*".repeat(Math.max(4, value.length - 4)) + value.slice(-4);
}

export function randomCode(prefix: string): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("hex");
}
