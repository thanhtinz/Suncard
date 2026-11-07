import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge, Empty } from "@/components/ui";
import { getSetting } from "@/modules/settings";

export const dynamic = "force-dynamic";

const pct = (bps: number) => `${(bps / 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;

export default async function AdminCarriersPage() {
  const [rules, providerCode] = await Promise.all([
    prisma.exchangeFeeRule.findMany({ orderBy: [{ telco: "asc" }, { faceValueMinor: "asc" }, { groupCode: "asc" }] }).catch(() => []),
    getSetting<string>("exchange.provider_code", "").catch(() => ""),
  ]);
  const provider = providerCode
    ? await prisma.provider.findUnique({ where: { code: providerCode } }).catch(() => null)
    : null;

  // Ma trận phí: mỗi dòng = 1 nhà mạng × 1 mệnh giá, cột = phí theo nhóm khách.
  type Row = { telco: string; face: bigint; fees: Record<string, number>; penaltyBps: number; active: boolean; count: number };
  const rowMap = new Map<string, Row>();
  const telcoStats = new Map<string, { faces: Set<string>; total: number; active: number }>();
  for (const r of rules) {
    const key = `${r.telco}|${r.faceValueMinor.toString()}`;
    const row: Row = rowMap.get(key) ?? { telco: r.telco, face: r.faceValueMinor, fees: {}, penaltyBps: r.penaltyBps, active: false, count: 0 };
    const groupCode: string = r.groupCode;
    row.fees[groupCode] = r.feeBps;
    row.active = row.active || r.isActive;
    row.count += 1;
    rowMap.set(key, row);
    const st = telcoStats.get(r.telco) ?? { faces: new Set<string>(), total: 0, active: 0 };
    st.faces.add(r.faceValueMinor.toString());
    st.total += 1;
    if (r.isActive) st.active += 1;
    telcoStats.set(r.telco, st);
  }
  const matrix = Array.from(rowMap.values());
  const telcos = Array.from(telcoStats.entries());

  return (
    <div>
      <PageTitle title="Kênh và nhà mạng đổi thẻ" sub={`${telcos.length} nhà mạng · ${rules.length} dòng biểu phí`} />

      <h2 className="font-bold text-navy mb-3">Kênh gửi thẻ đang dùng</h2>
      {provider ? (
        <div className="card p-4 mb-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-semibold text-navy">{provider.name}</span>
          <span className="text-sm text-slate-500">Mã kênh: <b className="text-navy">{provider.code}</b></span>
          <span className="text-sm text-slate-500">Loại: {provider.type}</span>
          <span className="text-sm text-slate-500">Độ ưu tiên: {provider.priority}</span>
          <StatusBadge status={provider.status} />
        </div>
      ) : (
        <div className="mb-8"><Empty text={providerCode ? `Đã cấu hình kênh "${providerCode}" nhưng không tra được nhà cung cấp tương ứng` : "Chưa cấu hình kênh gửi thẻ (setting exchange.provider_code)"} /></div>
      )}

      <h2 className="font-bold text-navy mb-3">Tổng hợp theo nhà mạng</h2>
      <div className="mb-8">
        <DataTable cols={["Nhà mạng", "Số mệnh giá", "Tổng dòng phí", "Đang bật"]} rows={telcos.map(([telco, st]) => [
          telco, String(st.faces.size), String(st.total), String(st.active),
        ])} />
      </div>

      <h2 className="font-bold text-navy mb-3">Biểu phí theo nhà mạng và mệnh giá</h2>
      <DataTable cols={["Nhà mạng", "Mệnh giá", "Phí Thành viên", "Phí Đại lý", "Phí API", "Phạt sai mệnh giá", "Trạng thái"]} rows={matrix.map((r) => [
        r.telco,
        <Money key="f" v={r.face} />,
        r.fees.MEMBER !== undefined ? pct(r.fees.MEMBER) : "—",
        r.fees.AGENT !== undefined ? pct(r.fees.AGENT) : "—",
        r.fees.API !== undefined ? pct(r.fees.API) : "—",
        pct(r.penaltyBps),
        <StatusBadge key="s" status={r.active ? "ACTIVE" : "INACTIVE"} />,
      ])} />
    </div>
  );
}
