import { argon2id, argon2Verify } from "hash-wasm";
import crypto from "crypto";

// ACC-01 (Security Spec): hash mật khẩu bằng Argon2id (qua hash-wasm — WASM, không native build).
// Tham số theo khuyến nghị OWASP cho Argon2id: m=19MiB, t=2, p=1. Salt ngẫu nhiên 16 byte, output encoded PHC.

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return argon2id({
    password: plain,
    salt,
    parallelism: 1,
    iterations: 2,
    memorySize: 19456, // KiB ~19 MiB
    hashLength: 32,
    outputType: "encoded",
  });
}

export async function verifyPassword(plain: string, encoded: string): Promise<boolean> {
  if (!encoded?.startsWith("$argon2id$")) return false; // chỉ chấp nhận Argon2id; hash cũ (bcrypt) không còn hiệu lực
  try {
    return await argon2Verify({ password: plain, hash: encoded });
  } catch {
    return false;
  }
}
