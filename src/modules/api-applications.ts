import { prisma } from "@/lib/prisma";
import type { DB } from "./ledger";
import { encryptSecret, sha256Hex, randomToken } from "@/lib/crypto";
import { logAudit, notifyUser } from "./audit";
import { notifyAdmins } from "./ops";

// ============================================================================
// Đăng ký kết nối API: người dùng nộp form -> ApiClient PENDING (chưa có key)
// -> Admin duyệt -> sinh ApiKey (dùng chung cho Charging compat, Recharge,
// Softcard và Partner API /v1 HMAC) -> client ACTIVE. Từ chối -> REJECTED.
// Không cần là đại lý: mọi tài khoản đăng nhập đều đăng ký được.
// ============================================================================

export { API_TYPES, apiTypeLabel, apiTypeShort, apiTypeAllows } from "@/lib/api-types";
import { API_TYPES, apiTypeLabel } from "@/lib/api-types";

async function genPartnerId(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const candidate = "SC" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const exists = await prisma.apiClient.findUnique({ where: { clientId: candidate } });
    if (!exists) return candidate;
  }
  return "SC" + Date.now().toString().slice(-10);
}

function parseIps(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(/[,\n]/);
  return [...new Set(parts.map((s) => s.trim()).filter((s) => s.length >= 3 && s.length <= 45))].slice(0, 10);
}

export async function applyForApiClient(userId: string, input: {
  apiType: string; name?: string; callbackUrl?: string; callbackMethod?: string; ipAllowlist?: string | string[] | null;
}) {
  const apiType = API_TYPES.some((t) => t.key === input.apiType) ? input.apiType : "FULL";
  const callbackUrl = (input.callbackUrl ?? "").trim();
  if (callbackUrl) {
    let ok = false;
    try { const u = new URL(callbackUrl); ok = u.protocol === "http:" || u.protocol === "https:"; } catch { ok = false; }
    if (!ok) throw new Error("CALLBACK_URL_INVALID");
  } else if (apiType === "CHARGING" || apiType === "FULL") {
    throw new Error("CALLBACK_URL_REQUIRED");
  }
  const pending = await prisma.apiClient.count({ where: { userId, status: "PENDING" } });
  if (pending >= 3) throw new Error("TOO_MANY_PENDING");
  const total = await prisma.apiClient.count({ where: { userId, status: { in: ["PENDING", "ACTIVE", "SUSPENDED"] } } });
  if (total >= 5) throw new Error("TOO_MANY_CLIENTS");

  const client = await prisma.apiClient.create({
    data: {
      userId,
      name: (input.name ?? "").trim().slice(0, 80) || apiTypeLabel(apiType),
      clientId: await genPartnerId(),
      status: "PENDING",
      environment: "LIVE",
      apiType,
      callbackUrl: callbackUrl || null,
      callbackMethod: input.callbackMethod === "GET" ? "GET" : "POST",
      ipAllowlist: parseIps(input.ipAllowlist),
      feeGroup: "API",
    },
  });
  await notifyAdmins(prisma as unknown as DB, {
    type: "API_CLIENT_PENDING", title: "Đăng ký kết nối API chờ duyệt",
    body: `${apiTypeLabel(apiType)} · Partner ID ${client.clientId}`,
    resourceType: "API_CLIENT", resourceId: client.id,
  }).catch(() => undefined);
  await logAudit(prisma as unknown as DB, {
    actorId: userId, action: "API_CLIENT_APPLY", entityType: "API_CLIENT", entityId: client.id,
    summary: `Đăng ký kết nối API ${apiType} (${client.clientId})`,
  }).catch(() => undefined);
  return client;
}

/** Duyệt đăng ký: sinh cặp khoá mới (key dùng cho /v1 Bearer, secret = partner_key MD5 compat + HMAC). */
export async function approveApiClient(adminId: string, clientDbId: string, note?: string) {
  const client = await prisma.apiClient.findUnique({ where: { id: clientDbId } });
  if (!client) throw new Error("NOT_FOUND");
  if (client.status !== "PENDING") throw new Error("NOT_PENDING");
  const keyPlain = `sc_live_${randomToken(18)}`;
  const secretPlain = randomToken(32);
  const key = await prisma.$transaction(async (tx) => {
    const k = await tx.apiKey.create({
      data: {
        clientId: client.id,
        keyPrefix: keyPlain.slice(0, 12),
        keyHash: sha256Hex(keyPlain),
        keyEnc: encryptSecret(keyPlain),
        secretHash: sha256Hex(secretPlain),
        secretEnc: encryptSecret(secretPlain),
        scopes: ["orders", "wallet", "cards", "exchange", "agents"],
        status: "ACTIVE",
      },
    });
    await tx.apiClient.update({
      where: { id: client.id },
      data: { status: "ACTIVE", reviewedAt: new Date(), reviewedBy: adminId, reviewNote: note?.trim() || null },
    });
    return k;
  });
  if (client.userId) {
    await notifyUser(prisma as unknown as DB, {
      userId: client.userId, type: "API_CLIENT_APPROVED", title: "Đăng ký API đã được duyệt",
      body: `Kết nối "${client.name}" (Partner ID ${client.clientId}) đã hoạt động. Vào Kết nối API để xem API key và partner_key.`,
      resourceType: "API_CLIENT", resourceId: client.id,
    }).catch(() => undefined);
  }
  await logAudit(prisma as unknown as DB, {
    actorId: adminId, action: "API_CLIENT_APPROVE", entityType: "API_CLIENT", entityId: client.id,
    summary: `Duyệt kết nối API ${client.clientId}, cấp key ${key.keyPrefix}…`,
  }).catch(() => undefined);
  return client;
}

export async function rejectApiClient(adminId: string, clientDbId: string, note?: string) {
  const client = await prisma.apiClient.findUnique({ where: { id: clientDbId } });
  if (!client) throw new Error("NOT_FOUND");
  if (client.status !== "PENDING") throw new Error("NOT_PENDING");
  await prisma.apiClient.update({
    where: { id: client.id },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: adminId, reviewNote: note?.trim() || null },
  });
  if (client.userId) {
    await notifyUser(prisma as unknown as DB, {
      userId: client.userId, type: "API_CLIENT_REJECTED", title: "Đăng ký API chưa được duyệt",
      body: note?.trim() ? `Lý do: ${note.trim()}` : "Vui lòng kiểm tra lại thông tin kết nối và đăng ký lại.",
      resourceType: "API_CLIENT", resourceId: client.id,
    }).catch(() => undefined);
  }
  await logAudit(prisma as unknown as DB, {
    actorId: adminId, action: "API_CLIENT_REJECT", entityType: "API_CLIENT", entityId: client.id,
    summary: `Từ chối kết nối API ${client.clientId}${note ? `: ${note}` : ""}`,
  }).catch(() => undefined);
  return client;
}

export async function setApiClientStatus(adminId: string, clientDbId: string, next: "ACTIVE" | "SUSPENDED", note?: string) {
  const client = await prisma.apiClient.findUnique({ where: { id: clientDbId } });
  if (!client) throw new Error("NOT_FOUND");
  if (!["ACTIVE", "SUSPENDED"].includes(client.status)) throw new Error("INVALID_STATE");
  await prisma.apiClient.update({
    where: { id: client.id },
    data: { status: next, reviewedAt: new Date(), reviewedBy: adminId, reviewNote: note?.trim() || client.reviewNote },
  });
  if (next === "SUSPENDED") {
    await prisma.apiKey.updateMany({ where: { clientId: client.id, status: "ACTIVE" }, data: { status: "SUSPENDED" } });
  } else {
    await prisma.apiKey.updateMany({ where: { clientId: client.id, status: "SUSPENDED" }, data: { status: "ACTIVE" } });
  }
  await logAudit(prisma as unknown as DB, {
    actorId: adminId, action: next === "SUSPENDED" ? "API_CLIENT_SUSPEND" : "API_CLIENT_ACTIVATE",
    entityType: "API_CLIENT", entityId: client.id, summary: `${next === "SUSPENDED" ? "Khoá" : "Mở lại"} kết nối API ${client.clientId}`,
  }).catch(() => undefined);
  return client;
}
