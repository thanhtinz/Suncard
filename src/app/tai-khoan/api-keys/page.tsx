import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const clients = await prisma.apiClient.findMany({ where: { userId: session.userId } });
  const keys = clients.length ? await prisma.apiKey.findMany({ where: { clientId: { in: clients.map((c) => c.id) } }, orderBy: { createdAt: "desc" } }) : [];
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  return (
    <div>
      <PageTitle title="API Keys" sub="Khoá tích hợp Partner API thuộc tài khoản của bạn" />
      <div className="rounded-lg bg-amber-50 text-amber-700 px-4 py-3 text-sm mb-4">API key và secret chỉ hiển thị đúng một lần khi tạo tại trang quản trị/đối tác. Tại đây bạn chỉ xem được tiền tố, trạng thái và thời gian tạo.</div>
      <DataTable cols={["Client", "Client ID", "Tiền tố key", "Môi trường", "Trạng thái", "Tạo lúc", "Dùng lần cuối"]} rows={keys.map((k) => {
        const c = clientMap.get(k.clientId);
        return [c?.name ?? "", c?.clientId ?? "", k.keyPrefix, c?.environment ?? "", <StatusBadge key="s" status={k.status} />, k.createdAt.toLocaleString("vi-VN"), k.lastUsedAt ? k.lastUsedAt.toLocaleString("vi-VN") : "Chưa dùng"];
      })} />
    </div>
  );
}
