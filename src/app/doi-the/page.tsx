import { prisma } from "@/lib/prisma";
import { PageTitle, StatusBadge, Money } from "@/components/ui";
import { getSession } from "@/modules/security";
import ExchangeForm, { type MemberFees } from "@/components/ExchangeForm";
import FeeTable, { type FeeRow } from "@/components/FeeTable";

export const dynamic = "force-dynamic";

export default async function DoiThePage({ searchParams }: { searchParams?: { code?: string } }) {
  const session = await getSession().catch(() => null);
  const feeRules = await prisma.exchangeFeeRule.findMany({
    where: { isActive: true },
    orderBy: [{ telco: "asc" }, { faceValueMinor: "asc" }],
  });
  const feeRows: FeeRow[] = feeRules.map((r) => ({
    telco: r.telco, face: Number(r.faceValueMinor), group: r.groupCode, feeBps: r.feeBps, penaltyBps: r.penaltyBps,
  }));
  const memberFees: MemberFees = {};
  for (const r of feeRules) {
    if (r.groupCode !== "MEMBER") continue;
    (memberFees[r.telco] ??= {})[String(Number(r.faceValueMinor))] = r.feeBps;
  }
  let lookup: React.ReactNode = null;
  if (searchParams?.code) {
    const order = await prisma.order.findUnique({ where: { code: searchParams.code } });
    if (!order || order.type !== "EXCHANGE") lookup = <div className="rounded-xl bg-amber-50 text-amber-700 px-3 py-2 text-sm">Không tìm thấy đơn gạch thẻ với mã này.</div>;
    else {
      const ex = await prisma.exchangeOrder.findUnique({ where: { orderId: order.id } });
      lookup = (
        <div className="rounded-xl bg-orange-50/70 px-4 py-3 text-sm space-y-1">
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
        <PageTitle title="Đổi thẻ cào lấy tiền ví" sub="Trang chính của SunCard cũng là trang đổi thẻ — trang này giữ nguyên đầy đủ tính năng để bạn dùng theo thói quen." />
        <ExchangeForm loggedIn={!!session} memberFees={memberFees} />
      </div>
      <section>
        <h2 className="font-bold text-navy mb-3">Tra cứu đơn gạch thẻ</h2>
        <form method="get" className="card p-5 space-y-3">
          <label className="label">Mã đơn</label>
          <div className="flex gap-2"><input name="code" className="input" defaultValue={searchParams?.code ?? ""} placeholder="Nhập mã đơn gạch thẻ" /><button className="btn-primary shrink-0">Tra cứu</button></div>
          {lookup}
        </form>
      </section>
      <section>
        <h2 className="font-bold text-navy mb-3">Bảng phí đổi thẻ</h2>
        <FeeTable rows={feeRows} />
      </section>
    </div>
  );
}
