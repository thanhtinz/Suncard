import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge, Money } from "@/components/ui";
import { getSession } from "@/modules/security";
import ExchangeForm from "@/components/ExchangeForm";
import FeeTable, { type FeeRow } from "@/components/FeeTable";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams?: { code?: string } }) {
  const session = await getSession().catch(() => null);
  const feeRules = await prisma.exchangeFeeRule.findMany({
    where: { isActive: true },
    orderBy: [{ telco: "asc" }, { faceValueMinor: "asc" }],
  });
  const feeRows: FeeRow[] = feeRules.map((r) => ({
    telco: r.telco, face: Number(r.faceValueMinor), group: r.groupCode, feeBps: r.feeBps, penaltyBps: r.penaltyBps,
  }));

  let lookup: React.ReactNode = null;
  if (searchParams?.code) {
    const order = await prisma.order.findUnique({ where: { code: searchParams.code } });
    if (!order || order.type !== "EXCHANGE")
      lookup = <div className="rounded-lg bg-amber-50 text-amber-700 px-3 py-2 text-sm">Không tìm thấy đơn gạch thẻ với mã này.</div>;
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
    <div className="space-y-8">
      <section className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-navy">Đổi thẻ cào lấy tiền ví</h1>
        <p className="mt-2 text-slate-500">Gạch thẻ Viettel, Mobifone, Vinaphone, Garena, Zing... nhận tiền vào ví SunCard theo bảng phí công khai bên dưới. Sai mệnh giá tính theo mệnh giá thực tế.</p>
      </section>

      <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm max-w-3xl mx-auto">
        Chỉ gạch thẻ có nguồn gốc hợp pháp của chính bạn. Thẻ không rõ nguồn gốc, thẻ đã qua sử dụng hoặc gian lận sẽ bị từ chối và có thể bị giữ lại để đối soát theo điều khoản.
      </div>

      <section className="max-w-3xl mx-auto w-full">
        <ExchangeForm loggedIn={!!session} />
      </section>

      <section className="max-w-3xl mx-auto w-full">
        <h2 className="font-bold text-navy mb-3">Tra cứu đơn gạch thẻ</h2>
        <form method="get" className="card p-5 space-y-3">
          <label className="label">Mã đơn</label>
          <div className="flex gap-2">
            <input name="code" className="input" defaultValue={searchParams?.code ?? ""} placeholder="Nhập mã đơn gạch thẻ" />
            <button className="btn-primary shrink-0">Tra cứu</button>
          </div>
          {lookup}
        </form>
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy mb-3">Bảng phí đổi thẻ cào</h2>
        <FeeTable rows={feeRows} />
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="font-bold text-navy">Nạp game</h3>
          <p className="text-sm text-slate-500 mt-1">Nạp trực tiếp vào tài khoản game bằng UID, xác nhận nickname trước khi nạp.</p>
          <Link href="/nap-game" className="text-primary text-sm font-medium mt-3 inline-block">Vào trang nạp game</Link>
        </div>
        <div className="card p-5">
          <h3 className="font-bold text-navy">Mua thẻ</h3>
          <p className="text-sm text-slate-500 mt-1">Mua mã thẻ cào, game, gift card với chiết khấu theo cấp tài khoản.</p>
          <Link href="/cua-hang-the" className="text-primary text-sm font-medium mt-3 inline-block">Vào cửa hàng thẻ</Link>
        </div>
        <div className="card p-5">
          <h3 className="font-bold text-navy">Đại lý</h3>
          <p className="text-sm text-slate-500 mt-1">Chiết khấu theo cấp bậc, hoa hồng mạng lưới nhiều tầng, hạn mức công nợ.</p>
          <Link href="/dai-ly" className="text-primary text-sm font-medium mt-3 inline-block">Chương trình đại lý</Link>
        </div>
      </section>
    </div>
  );
}
