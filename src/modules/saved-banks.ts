import { prisma } from "@/lib/prisma";

// Ngân hàng đã lưu của người dùng — dùng cho rút tiền chọn nhanh.
// LƯU Ý: client Prisma trong môi trường local chưa được generate lại cho model
// SavedBankAccount (deploy build sẽ chạy `prisma generate`); điểm cast duy nhất
// nằm ở đây, mọi nơi khác dùng type đầy đủ qua module này.
export interface SavedBankAccountRow {
  id: string;
  userId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SavedBankDelegate {
  findMany(args: { where: { userId: string }; orderBy?: unknown }): Promise<SavedBankAccountRow[]>;
  findFirst(args: { where: Record<string, unknown> }): Promise<SavedBankAccountRow | null>;
  create(args: { data: { userId: string; bankName: string; accountNumber: string; accountName: string; isDefault: boolean } }): Promise<SavedBankAccountRow>;
  update(args: { where: { id: string }; data: { isDefault?: boolean } }): Promise<SavedBankAccountRow>;
  updateMany(args: { where: Record<string, unknown>; data: { isDefault: boolean } }): Promise<{ count: number }>;
  delete(args: { where: { id: string } }): Promise<SavedBankAccountRow>;
  count(args: { where: { userId: string } }): Promise<number>;
}

type ClientWithSavedBanks = { savedBankAccount: SavedBankDelegate };
const delegateOf = (client: unknown) => (client as ClientWithSavedBanks).savedBankAccount;

export const MAX_SAVED_BANKS = 10;

export async function listSavedBanks(userId: string): Promise<SavedBankAccountRow[]> {
  return delegateOf(prisma).findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function createSavedBank(
  userId: string,
  data: { bankName: string; accountNumber: string; accountName: string; isDefault?: boolean },
): Promise<SavedBankAccountRow> {
  const d = delegateOf(prisma);
  const total = await d.count({ where: { userId } });
  if (total >= MAX_SAVED_BANKS) throw new Error("TOO_MANY_BANKS");
  const makeDefault = !!data.isDefault || total === 0;
  return prisma.$transaction(async (tx: unknown) => {
    const td = delegateOf(tx);
    if (makeDefault) await td.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return td.create({
      data: { userId, bankName: data.bankName, accountNumber: data.accountNumber, accountName: data.accountName, isDefault: makeDefault },
    });
  });
}

export async function setDefaultSavedBank(userId: string, id: string): Promise<SavedBankAccountRow | null> {
  const d = delegateOf(prisma);
  const bank = await d.findFirst({ where: { id, userId } });
  if (!bank) return null;
  if (bank.isDefault) return bank;
  return prisma.$transaction(async (tx: unknown) => {
    const td = delegateOf(tx);
    await td.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return td.update({ where: { id }, data: { isDefault: true } });
  });
}

export async function deleteSavedBank(userId: string, id: string): Promise<boolean> {
  const d = delegateOf(prisma);
  const bank = await d.findFirst({ where: { id, userId } });
  if (!bank) return false;
  await d.delete({ where: { id } });
  // Xoá mất ngân hàng mặc định thì nâng ngân hàng cũ nhất còn lại lên làm mặc định.
  if (bank.isDefault) {
    const rest = await d.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }] });
    if (rest[0]) await d.update({ where: { id: rest[0].id }, data: { isDefault: true } });
  }
  return true;
}
