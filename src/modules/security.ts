import { SignJWT, jwtVerify } from "jose";
import { hashPassword as argonHash, verifyPassword as argonVerify } from "./password";
import { verifyTotp } from "./totp";
import { decryptSecret as aesDecrypt } from "@/lib/crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { decryptSecret, hmacSha256Hex, sha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { getNumberSetting } from "./settings";

// Security (doc 10): bcrypt hash, session JWT, RBAC + data-scope, MFA-ready (TOTP fields),
// rate limit, HMAC + chống replay cho Partner API, maker-checker ở tầng nghiệp vụ.

// ACC-01: Argon2id (hash-wasm). Giữ tên export để tương thích các module khác.
export async function hashPassword(plain: string): Promise<string> {
  return argonHash(plain);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return argonVerify(plain, hash);
}

export const ADMIN_ROLES = ["SUPER_ADMIN", "SYSTEM_ADMIN", "ADMIN", "OPS", "FINANCE", "SUPPORT", "PRODUCT_MANAGER", "PROVIDER_MANAGER", "RISK", "AUDITOR"];
export function hasAdminRole(roles: string[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

/** Giải mã TOTP secret của user (lưu mã hoá AES-GCM) và verify mã. */
export async function verifyUserTotp(user: { totpSecret: string | null; totpEnabled: boolean }, code?: string): Promise<boolean> {
  if (!user.totpEnabled || !user.totpSecret || !code) return false;
  try {
    return verifyTotp(aesDecrypt(user.totpSecret), code);
  } catch {
    return false;
  }
}

const jwtSecret = () => new TextEncoder().encode(process.env.JWT_SECRET || "dev-jwt-secret-change-me");
export const SESSION_COOKIE = "suncard_session";

export interface SessionPayload { userId: string; email: string; roles: string[]; agentId?: string | null; sid?: string }

export async function signSession(payload: SessionPayload, ttlSeconds = 7 * 86400): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(jwtSecret());
}

/** TTL theo vai trò: Admin ngắn hơn khách (settings, ACC-07). */
export async function sessionTtlSeconds(roles: string[]): Promise<number> {
  const { getNumberSetting } = await import("./settings");
  if (hasAdminRole(roles)) return (await getNumberSetting("session.admin_ttl_minutes", 120)) * 60;
  return (await getNumberSetting("session.customer_ttl_minutes", 10080)) * 60;
}

/** Tạo bản ghi phiên DB (để thu hồi được) + JWT chứa sid. Rotate: phiên mới mỗi lần đăng nhập/đổi quyền. */
export async function createSessionForUser(user: { id: string; email: string }, roles: string[], agentId: string | null, meta?: { ip?: string; userAgent?: string; deviceId?: string }) {
  const ttl = await sessionTtlSeconds(roles);
  const expiresAt = new Date(Date.now() + ttl * 1000);
  // Thu hồi phiên cũ cùng thiết bị (rotate theo thiết bị)
  if (meta?.deviceId) {
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }).catch(() => undefined);
  }
  const record = await prisma.session.create({
    data: { userId: user.id, tokenHash: `pending:${Date.now()}`, ip: meta?.ip, userAgent: meta?.userAgent, expiresAt },
  });
  const token = await signSession({ userId: user.id, email: user.email, roles, agentId, sid: record.id }, ttl);
  const { sha256Hex } = await import("@/lib/crypto");
  await prisma.session.update({ where: { id: record.id }, data: { tokenHash: sha256Hex(token) } });
  return { token, sessionId: record.id, expiresAt };
}

export async function revokeSession(sessionId: string) {
  await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}
export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  let payload: SessionPayload | null = null;
  if (!token) {
    const auth = headers().get("authorization");
    if (auth?.startsWith("Bearer ")) payload = await verifySessionToken(auth.slice(7));
    if (!payload) return null;
  } else {
    payload = await verifySessionToken(token);
  }
  if (!payload) return null;
  // Kiểm tra thu hồi phiên ở DB (ACC-05/07)
  if (payload.sid) {
    const record = await prisma.session.findUnique({ where: { id: payload.sid } }).catch(() => null);
    if (!record || record.revokedAt || record.expiresAt < new Date()) return null;
  }
  return payload;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new ApiError("AUTH_INVALID", 401, "Chưa đăng nhập");
  return s;
}

export function requireRole(session: SessionPayload, roles: string[]) {
  if (!roles.some((r) => session.roles.includes(r))) throw new ApiError("PERMISSION_DENIED", 403, "Không đủ quyền");
}

export async function userPermissions(userId: string): Promise<string[]> {
  const urs = await prisma.userRole.findMany({ where: { userId } });
  const roleIds = urs.map((r) => r.roleId);
  if (roleIds.length === 0) return [];
  const rps = await prisma.rolePermission.findMany({ where: { roleId: { in: roleIds } } });
  const permIds = [...new Set(rps.map((r) => r.permissionId))];
  const perms = await prisma.permission.findMany({ where: { id: { in: permIds } } });
  return perms.map((p) => p.code);
}

export async function requirePermission(session: SessionPayload, permission: string) {
  // SEC-AC-02: MFA TOTP BẮT BUỘC cho mọi vai trò quản trị — chưa bật TOTP thì chặn mọi API admin.
  const urs = await prisma.userRole.findMany({ where: { userId: session.userId } });
  const roleRows = await prisma.role.findMany({ where: { id: { in: urs.map((r) => r.roleId) } } });
  const dbRoles = roleRows.map((r) => r.code);
  if (hasAdminRole(dbRoles)) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user?.totpEnabled) throw new ApiError("MFA_REQUIRED", 403, "Tài khoản quản trị bắt buộc bật MFA TOTP trước khi dùng API Admin");
  }
  if (session.roles.includes("SUPER_ADMIN")) return;
  const perms = await userPermissions(session.userId);
  if (!perms.includes(permission) && !perms.includes("*")) throw new ApiError("PERMISSION_DENIED", 403, `Thiếu quyền ${permission}`);
}

// ---------- Rate limit (in-memory sliding window) ----------
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < 60000);
  if (arr.length >= limitPerMinute) { buckets.set(key, arr); return false; }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

// ---------- Partner API HMAC ----------
// Signature = HMAC-SHA256(secret, `${method}\n${path}\n${timestamp}\n${nonce}\n${sha256hex(body)}`)
// API key gửi ở Authorization: Bearer <key> (server lưu sha256 hash). Secret ký HMAC lưu mã hoá AES-GCM.

export function partnerSignature(secret: string, method: string, path: string, timestamp: string, nonce: string, rawBody: string): string {
  const bodyHash = sha256Hex(rawBody);
  return hmacSha256Hex(secret, `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`);
}

export interface PartnerContext { client: any; apiKey: any; userId: string | null }

export async function verifyPartnerRequest(req: Request, rawBody: string): Promise<PartnerContext> {
  const clientId = req.headers.get("x-client-id");
  const auth = req.headers.get("authorization");
  const timestamp = req.headers.get("x-timestamp");
  const nonce = req.headers.get("x-nonce");
  const signature = req.headers.get("x-signature");
  if (!clientId || !auth?.startsWith("Bearer ") || !timestamp || !nonce || !signature) {
    throw new ApiError("AUTH_INVALID", 401, "Thiếu header xác thực Partner API");
  }
  const client = await prisma.apiClient.findUnique({ where: { clientId } });
  if (!client || client.status !== "ACTIVE") throw new ApiError("AUTH_INVALID", 401, "Client không hợp lệ");
  const apiKeyPlain = auth.slice(7);
  const keyHash = sha256Hex(apiKeyPlain);
  const apiKey = await prisma.apiKey.findFirst({ where: { clientId: client.id, keyHash, status: "ACTIVE" } });
  if (!apiKey) throw new ApiError("AUTH_INVALID", 401, "API key không hợp lệ");
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) throw new ApiError("AUTH_INVALID", 401, "API key đã hết hạn");

  const skewSeconds = await getNumberSetting("api.signature_skew_seconds", 300);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > skewSeconds) {
    throw new ApiError("REPLAY_DETECTED", 401, "Timestamp ngoài cửa sổ cho phép");
  }
  // Chống replay: nonce chỉ dùng 1 lần trong cửa sổ skew.
  const dupNonce = await prisma.apiNonce.findUnique({ where: { clientId_nonce: { clientId: client.id, nonce } } }).catch(() => null);
  if (dupNonce) throw new ApiError("REPLAY_DETECTED", 401, "Nonce đã được sử dụng");
  await prisma.apiNonce.create({ data: { clientId: client.id, nonce, expiresAt: new Date(Date.now() + skewSeconds * 2000) } });

  if (!apiKey.secretEnc) throw new ApiError("AUTH_INVALID", 401, "API key chưa cấu hình secret ký");
  const secret = decryptSecret(apiKey.secretEnc);
  const url = new URL(req.url);
  const expected = partnerSignature(secret, req.method, url.pathname, timestamp, nonce, rawBody);
  if (!timingSafeEqualHex(expected, signature.toLowerCase())) {
    throw new ApiError("SIGNATURE_INVALID", 401, "Chữ ký không hợp lệ");
  }
  const limit = await getNumberSetting("api.rate_limit_per_minute", 120);
  const { rateLimitDistributed } = await import("./rate-limit");
  if (!(await rateLimitDistributed(`partner:${client.id}`, limit))) throw new ApiError("RATE_LIMITED", 429, "Vượt giới hạn request");

  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
  return { client, apiKey, userId: client.userId ?? null };
}

/** Step-up verify (ACC-02/08): nhập lại mật khẩu HOẶC mã TOTP (nếu đã bật). */
export async function verifyStepUp(userId: string, password?: string, totpCode?: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (totpCode && user.totpEnabled) return verifyUserTotp(user, totpCode);
  if (!password) return false;
  return verifyPassword(password, user.passwordHash);
}
