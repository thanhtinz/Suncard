import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle } from "@/components/ui";
import ApiKeysClient, { type ClientRow } from "./ApiKeysClient";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const [clients, avail] = await Promise.all([
    prisma.apiClient.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" } }),
    prisma.ledgerAccount.findUnique({ where: { code: `WALLET:${session.userId}:AVAILABLE` } }).catch(() => null),
  ]);
  const keys = clients.length ? await prisma.apiKey.findMany({ where: { clientId: { in: clients.map((c) => c.id) } }, orderBy: { createdAt: "desc" } }) : [];
  const keyOf = (clientDbId: string) => keys.find((k) => k.clientId === clientDbId);
  const rows: ClientRow[] = clients.map((c) => {
    const k = keyOf(c.id);
    return {
      id: c.id,
      name: c.name,
      partnerId: c.clientId,
      apiType: c.apiType ?? "FULL",
      callbackUrl: c.callbackUrl,
      callbackMethod: c.callbackMethod ?? "POST",
      ipAllowlist: Array.isArray(c.ipAllowlist) ? (c.ipAllowlist as string[]) : [],
      status: c.status,
      reviewNote: c.reviewNote,
      createdAt: c.createdAt.toLocaleString("vi-VN"),
      keyPrefix: k?.keyPrefix ?? null,
      keyStatus: k?.status ?? null,
      lastUsedAt: k?.lastUsedAt ? k.lastUsedAt.toLocaleDateString("vi-VN") : null,
    };
  });
  const balance = `${Number(avail?.balanceMinor ?? BigInt(0)).toLocaleString("vi-VN")}₫`;
  return (
    <div>
      <PageTitle
        title="Danh sách API"
        sub="Đăng ký kết nối API — admin duyệt xong mới được cấp Partner ID, API key và partner_key"
        action={<Link href="/tai-lieu/api" className="btn-ghost !py-2 whitespace-nowrap">Tài liệu API</Link>}
      />
      <ApiKeysClient clients={rows} balance={balance} />
    </div>
  );
}
