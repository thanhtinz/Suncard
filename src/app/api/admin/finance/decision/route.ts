import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission, ApiError } from "@/modules/security";
import { postDeposit, releaseHold, postLedger, walletAvailableCode, ensureWallet, PLATFORM_CASH, type DB } from "@/modules/ledger";
import { logAudit, notifyUser } from "@/modules/audit";
import { enqueueWebhookEvent } from "@/modules/webhooks";

// Maker-checker: checker KHÔNG được là maker. kind=DEPOSIT|WITHDRAWAL|ADJUSTMENT, decision=APPROVE|REJECT.
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "finance.approve");
    const b = await readJson(req);
    const approval = await prisma.financialApprovalRequest.findFirst({ where: { kind: b.kind, refId: b.id, status: "PENDING" } });
    if (!approval) throw new ApiError("NOT_FOUND", 404, "Không thấy yêu cầu duyệt đang chờ");
    if (approval.makerId === s.userId) throw new ApiError("PERMISSION_DENIED", 403, "Maker không được tự duyệt (maker-checker)");
    const approve = b.decision === "APPROVE";

    if (b.kind === "DEPOSIT") {
      const dep = await prisma.deposit.findUnique({ where: { id: b.id } });
      if (!dep || dep.status !== "PENDING") throw new Error("VALIDATION_DEPOSIT_STATE");
      await prisma.$transaction(async (tx) => {
        const db = tx as DB;
        if (approve) {
          await ensureWallet(db, dep.userId);
          const posted = await postDeposit(db, { userId: dep.userId, amountMinor: dep.amountMinor as bigint, depositId: dep.id, createdBy: s.userId });
          await tx.deposit.update({ where: { id: dep.id }, data: { status: "APPROVED", checkerId: s.userId, ledgerTxId: posted.tx.id } });
        } else {
          await tx.deposit.update({ where: { id: dep.id }, data: { status: "REJECTED", checkerId: s.userId } });
        }
        await tx.financialApprovalRequest.update({ where: { id: approval.id }, data: { status: approve ? "APPROVED" : "REJECTED", checkerId: s.userId } });
      });
      if (approve) {
        await enqueueWebhookEvent(prisma as unknown as DB, { eventType: "wallet.deposit.success", resourceId: dep.id, userId: dep.userId, data: { deposit_id: dep.id, amount_minor: (dep.amountMinor as bigint).toString() } });
        await notifyUser(prisma as unknown as DB, { userId: dep.userId, type: "DEPOSIT_SUCCESS", title: "Nạp tiền thành công", resourceType: "DEPOSIT", resourceId: dep.id });
      }
    } else if (b.kind === "WITHDRAWAL") {
      const w = await prisma.withdrawalRequest.findUnique({ where: { id: b.id } });
      if (!w || w.status !== "PENDING") throw new Error("VALIDATION_WITHDRAWAL_STATE");
      await prisma.$transaction(async (tx) => {
        const db = tx as DB;
        if (approve) {
          // Settle hold: HELD -> PLATFORM:CASH (chi ra ngoài hệ thống)
          if (w.holdId) {
            const hold = await tx.walletHold.findUnique({ where: { id: w.holdId } });
            if (hold && hold.status === "ACTIVE") {
              await postLedger(db, {
                type: "WITHDRAWAL", refType: "WITHDRAWAL", refId: w.id, idempotencyKey: `withdraw-settle:${w.id}`, createdBy: s.userId,
                entries: [
                  { accountCode: `WALLET:${w.userId}:HELD`, ownerType: "USER", ownerId: w.userId, kind: "HELD", direction: "DEBIT", amountMinor: hold.amountMinor },
                  { accountCode: PLATFORM_CASH, ownerType: "PLATFORM", kind: "CASH", direction: "CREDIT", amountMinor: hold.amountMinor },
                ],
              });
              await tx.walletHold.update({ where: { id: hold.id }, data: { status: "SETTLED" } });
            }
          }
          await tx.withdrawalRequest.update({ where: { id: w.id }, data: { status: "PAID", checkerId: s.userId } });
        } else {
          if (w.holdId) await releaseHold(db, w.holdId, "withdrawal rejected");
          await tx.withdrawalRequest.update({ where: { id: w.id }, data: { status: "REJECTED", checkerId: s.userId } });
        }
        await tx.financialApprovalRequest.update({ where: { id: approval.id }, data: { status: approve ? "APPROVED" : "REJECTED", checkerId: s.userId } });
      });
    } else if (b.kind === "REFUND") {
      // Hoàn tiền vượt ngưỡng — duyệt kép (PAY-07). Maker tạo ở /api/admin/refund khi vượt ngưỡng.
      const payload = (approval.payload as any) ?? {};
      if (approve) {
        const { refundOrder } = await import("@/modules/orders-service");
        await refundOrder({ orderId: payload.orderId, amountMinor: BigInt(payload.amountMinor), reason: payload.reason, idempotencyKey: payload.idempotencyKey, actorId: s.userId });
      }
      await prisma.financialApprovalRequest.update({ where: { id: approval.id }, data: { status: approve ? "APPROVED" : "REJECTED", checkerId: s.userId } });
    } else if (b.kind === "ROLE_CHANGE") {
      // Đổi role — duyệt kép, checker không được là maker và không áp dụng cho chính checker tự nâng mình qua đường vòng.
      const payload = (approval.payload as any) ?? {};
      if (payload.userId === s.userId) throw new ApiError("PERMISSION_DENIED", 403, "Không được duyệt thay đổi quyền của chính mình");
      if (approve) {
        const role = await prisma.role.findUnique({ where: { code: payload.roleCode } });
        if (!role) throw new Error("NOT_FOUND");
        if ((payload.action ?? "GRANT") === "GRANT") {
          const exists = await prisma.userRole.findFirst({ where: { userId: payload.userId, roleId: role.id } });
          if (!exists) await prisma.userRole.create({ data: { userId: payload.userId, roleId: role.id } });
        } else {
          await prisma.userRole.deleteMany({ where: { userId: payload.userId, roleId: role.id } });
        }
        // Đổi quyền -> thu hồi mọi phiên của user bị đổi (ACC-05)
        await prisma.session.updateMany({ where: { userId: payload.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await prisma.financialApprovalRequest.update({ where: { id: approval.id }, data: { status: approve ? "APPROVED" : "REJECTED", checkerId: s.userId } });
    } else if (b.kind === "CARD_EXPORT") {
      // Xuất mã — duyệt kép. Mã xuất ra bị VOIDED (không bán lại được), plaintext chỉ trả 1 lần trong response này + audit (không plaintext).
      const payload = (approval.payload as any) ?? {};
      let exported: { serial: string; pin: string }[] = [];
      if (approve) {
        const { getSetting } = await import("@/modules/settings");
        const enabled = await getSetting<boolean>("cards.export_enabled", false);
        if (!enabled) throw new ApiError("PERMISSION_DENIED", 403, "Xuất mã đang TẮT theo chính sách");
        const { decryptSecret } = await import("@/lib/crypto");
        const cards = await prisma.cardInventory.findMany({ where: { variantId: payload.variantId, status: "AVAILABLE" }, take: Number(payload.qty) });
        if (cards.length < Number(payload.qty)) throw new ApiError("VALIDATION_ERROR", 422, "Không còn đủ mã AVAILABLE");
        for (const c of cards) {
          await prisma.cardInventory.update({ where: { id: c.id }, data: { status: "VOIDED" } });
          exported.push({ serial: decryptSecret(c.serialEnc), pin: decryptSecret(c.pinEnc) });
        }
        await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "CARD_EXPORT_APPROVED", entityType: "CARD_EXPORT", entityId: approval.id, result: "SUCCESS", approvalId: approval.id, summary: `Xuất ${exported.length} mã theo duyệt kép (mã đã VOIDED, không bán lại)` });
      }
      await prisma.financialApprovalRequest.update({ where: { id: approval.id }, data: { status: approve ? "APPROVED" : "REJECTED", checkerId: s.userId } });
      return ok(serialize({ approvalId: approval.id, decision: b.decision, exported: approve ? exported : undefined }));
    } else if (b.kind === "PROVIDER_SECRET") {
      const payload = (approval.payload as any) ?? {};
      if (approve) {
        // secretEnc (nếu có) đã được mã hoá AES-GCM ngay từ lúc tạo yêu cầu — plaintext không nằm trong payload.
        await prisma.providerCredential.create({ data: { providerId: payload.providerId, name: payload.name, secretRef: payload.secretRef, secretEnc: payload.secretEnc ?? null } });
      }
      await prisma.financialApprovalRequest.update({ where: { id: approval.id }, data: { status: approve ? "APPROVED" : "REJECTED", checkerId: s.userId } });
    } else if (b.kind === "ADJUSTMENT") {
      const payload = (approval.payload as any) ?? {};
      await prisma.$transaction(async (tx) => {
        const db = tx as DB;
        if (approve) {
          const amount = BigInt(payload.amountMinor);
          await ensureWallet(db, payload.userId);
          const entries = amount > 0n
            ? [
                { accountCode: PLATFORM_CASH, ownerType: "PLATFORM", kind: "CASH", direction: "DEBIT" as const, amountMinor: amount },
                { accountCode: walletAvailableCode(payload.userId), ownerType: "USER", ownerId: payload.userId, kind: "AVAILABLE", direction: "CREDIT" as const, amountMinor: amount },
              ]
            : [
                { accountCode: walletAvailableCode(payload.userId), ownerType: "USER", ownerId: payload.userId, kind: "AVAILABLE", direction: "DEBIT" as const, amountMinor: -amount },
                { accountCode: PLATFORM_CASH, ownerType: "PLATFORM", kind: "CASH", direction: "CREDIT" as const, amountMinor: -amount },
              ];
          await postLedger(db, { type: "ADJUSTMENT", refType: "ADJUSTMENT", refId: approval.id, idempotencyKey: `adjust:${approval.id}`, description: payload.reason, createdBy: s.userId, entries });
        }
        await tx.financialApprovalRequest.update({ where: { id: approval.id }, data: { status: approve ? "APPROVED" : "REJECTED", checkerId: s.userId } });
      });
    } else {
      throw new Error("VALIDATION_KIND");
    }
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: `FINANCE_${b.kind}_${b.decision}`, entityType: b.kind, entityId: b.id });
    return ok(serialize({ approvalId: approval.id, decision: b.decision }));
  } catch (e) { return fail(e); }
}
