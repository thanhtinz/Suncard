import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge, Money } from "@/components/ui";
import { getSession } from "@/modules/security";
import { getNumberSetting } from "@/modules/settings";
import ExchangeForm from "./form";

export const dynamic = "force-dynamic";
const CARRIERS: { key: string; name: string }[] = [
  { key: "viettel", name: "Viettel" }, { key: "mobifone", name: "Mobifone" }, { key: "vinaphone", name: "Vinaphone" },
  { key: "garena", name: "Garena" }, { key: "zing", name: "Zing" },
];

export default async function DoiThePage({ searchParams }: { searchParams?: { code?: string } }) {
  const session = await getSession().catch(() => null);
  const fees = await Promise.all(CARRIERS.map(async (c) => ({ ...c, bps: await getNumberSetting(`exchange.discount.${c.key}`, 0) })));
  let lookup: React.ReactNode = null;
  if (searchParams?.code) {
    const order = await prisma.order.findUnique({ where: { code: searchParams.code } });
    if (!order || order.type !== "EXCHANGE") lookup = <div className="rounded-lg bg-amber-50 text-amber-700 px-3 py-2 text-sm">Không tìm thấy đơn gạch thẻ với mã này.</div>;
    else {
      const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: order.id } });
      lookup = (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm space-y-1">
          <div className="flex justify-between"><span>Mã đơn</span><b>{order.code}</b></div>
          <div className="flex justify-between"><span>Trạng thái</span><StatusBadge status={order.status} /></div>
          {ex && <div className="flex justify-between"><span>Nhà mạng</span><span>{ex.carrier}</span></div>}
          {ex && <div className="flex justify-between"><span>Mệnh giá</span><Money v={ex.faceValueMinor} /></div>}
          {ex?.payoutMinor != null && <div className="flex justify-between"><span>Thực nhận</span><Money v={ex.payoutMinor} /></div>}
        </div>
      );
    }
  }
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <PageTitle title="Gạch thẻ đổi tiền ví" sub="Đổi thẻ cào sang số dư ví SunCard" />
        <ExchangeForm loggedIn={!!session} />
      </div>
      <section>
        <h2 className="font-bold text-navy mb-3">Bảng phí gạch thẻ</h2>
        <DataTable cols={["Loại thẻ", "Phí chiết khấu", "Thực nhận trên 100.000 ₫"]} rows={fees.map((f) => [f.name, `${(f.bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`, <Money key={f.key} v={BigInt(100000) - (BigInt(100000) * BigInt(f.bps)) / BigInt(10000)} />])} />
      </section>
      <section>
        <h2 className="font-bold text-navy mb-3">Tra cứu đơn gạch thẻ</h2>
        <form method="get" className="card p-5 space-y-3">
          <label className="label">Mã đơn</label>
          <div className="flex gap-2"><input name="code" className="input" defaultValue={searchParams?.code ?? ""} placeholder="Nhập mã đơn gạch thẻ" /><button className="btn-primary shrink-0">Tra cứu</button></div>
          {lookup}
        </form>
      </section>
    </div>
  );
}
