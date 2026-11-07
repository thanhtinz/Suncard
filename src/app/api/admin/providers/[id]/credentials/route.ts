import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Đổi provider secret (spec bảng 8): duyệt kép, secret không bao giờ hiển thị lại.
// Hai cách cung cấp:
//  a) secretRef (env:/vault:) — chỉ lưu tham chiếu như trước.
//  b) secret (plaintext qua kênh admin đã xác thực) — MÃ HOÁ AES-GCM ngay tại đây,
//     payload duyệt kép chỉ chứa bản mã hoá (secretEnc), áp vào ProviderCredential khi duyệt.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "providers.manage");
    const b = await readJson(req);
    if (!b.name) throw new Error("VALIDATION_NAME_REQUIRED");
    let secretRef: string;
    let secretEnc: string | null = null;
    if (b.secret) {
      const { encryptSecret } = await import("@/lib/crypto");
      secretEnc = encryptSecret(String(b.secret));
      secretRef = `vault:provider:${params.id}:${String(b.name)}`;
    } else {
      if (!b.secretRef || !/^(env|vault):/.test(String(b.secretRef))) throw new Error("VALIDATION_SECRET_REF_FORMAT");
      secretRef = String(b.secretRef);
    }
    const provider = await prisma.provider.findUnique({ where: { id: params.id } });
    if (!provider) throw new Error("NOT_FOUND");
    const approval = await prisma.financialApprovalRequest.create({
      data: { kind: "PROVIDER_SECRET", makerId: s.userId, payload: { providerId: params.id, name: b.name, secretRef, secretEnc } },
    });
    await prisma.financialApprovalRequest.update({ where: { id: approval.id }, data: { refId: approval.id } });
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "PROVIDER_SECRET_CHANGE_REQUESTED", entityType: "PROVIDER", entityId: params.id, result: "PENDING", approvalId: approval.id, summary: `Đổi credential ${b.name} (chỉ reference, không lưu plaintext)` });
    return ok(serialize({ approval }), 201);
  } catch (e) { return fail(e); }
}
