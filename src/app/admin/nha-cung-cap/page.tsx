import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const providers = await prisma.provider.findMany({ orderBy: { priority: "asc" }, skip: (page - 1) * take, take });
  const caps = providers.length ? await prisma.providerCapability.findMany({ where: { providerId: { in: providers.map((p) => p.id) } } }) : [];
  const health = providers.length ? await prisma.providerHealthMetric.findMany({ where: { providerId: { in: providers.map((p) => p.id) } }, orderBy: { windowStart: "desc" } }) : [];
  const latestHealth = new Map<string, (typeof health)[number]>();
  for (const h of health) if (!latestHealth.has(h.providerId)) latestHealth.set(h.providerId, h);
  const capsOf = (pid: string) => caps.filter((c) => c.providerId === pid);
  return (
    <div>
      <PageTitle title="Nhà cung cấp" sub="Năng lực, sức khoẻ và ghi chú định tuyến" />
      <DataTable cols={["Mã", "Tên", "Loại", "Ưu tiên", "Trạng thái", "Năng lực hỗ trợ", "Sức khoẻ mới nhất"]} rows={providers.map((p) => {
        const h = latestHealth.get(p.id);
        return [p.code, p.name, p.type, String(p.priority), <StatusBadge key="s" status={p.status} />,
          <div key="c" className="space-y-0.5">{capsOf(p.id).length === 0 ? "—" : capsOf(p.id).map((c) => <div key={c.id} className="whitespace-nowrap">{c.productType} · {c.region}/{c.currency} {c.supported ? "" : "(không hỗ trợ)"}{c.note ? ` — ${c.note}` : ""}</div>)}</div>,
          h ? `${h.success}/${h.total} thành công · trễ TB ${h.avgLatencyMs}ms · mạch ${h.circuitState}` : "Chưa có dữ liệu"];
      })} />
      <p className="text-sm text-slate-500 mt-4">Định tuyến: hệ thống chọn nhà cung cấp theo thứ tự ưu tiên tăng dần trong nhóm ACTIVE có năng lực phù hợp; khi mạch (circuit) mở do lỗi liên tiếp, nhà cung cấp sẽ tạm bị bỏ qua đến khi hồi phục.</p>
    </div>
  );
}
