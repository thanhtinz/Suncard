import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, Empty } from "@/components/ui";
import { getSession } from "@/modules/security";
import AgentApplyForm from "./AgentApplyForm";

export const dynamic = "force-dynamic";

export default async function AgentIntroPage() {
  const levels = await prisma.agentLevel.findMany({ where: { isActive: true }, orderBy: { rank: "asc" } });
  const session = await getSession().catch(() => null);
  const me = session ? await prisma.user.findUnique({ where: { id: session.userId } }).catch(() => null) : null;
  const myProfile = session ? await prisma.userProfile.findUnique({ where: { userId: session.userId } }).catch(() => null) : null;
  const myAgent = session ? await prisma.agent.findUnique({ where: { userId: session.userId } }).catch(() => null) : null;
  const myApp = session ? await prisma.agentApplication.findFirst({ where: { userId: session.userId }, orderBy: { createdAt: "desc" } }).catch(() => null) : null;
  return (
    <div className="space-y-8">
      <PageTitle title="Chương trình đại lý SunCard" sub="Kinh doanh sản phẩm số với chiết khấu theo cấp bậc và hoa hồng mạng lưới nhiều tầng" />
      <div className="grid md:grid-cols-3 gap-4">
        {[
          ["Chiết khấu theo cấp", "Giá mua giảm theo cấp bậc đại lý, áp dụng tự động cho mọi đơn trong mạng lưới."],
          ["Hoa hồng nhiều tầng", "Hưởng hoa hồng trên doanh số của tuyến dưới, đối soát minh bạch theo kỳ."],
          ["Công nợ linh hoạt", "Hạn mức tín dụng theo cấp, theo dõi dư nợ và hạn thanh toán ngay trong cổng đại lý."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5"><div className="font-bold text-navy">{t}</div><p className="text-sm text-slate-500 mt-2">{d}</p></div>
        ))}
      </div>
      <section>
        <h2 className="font-bold text-navy mb-3">Các cấp đại lý</h2>
        {levels.length === 0 ? <Empty text="Chưa có cấp đại lý nào" /> : (
          <DataTable cols={["Cấp", "Tên cấp", "Chiết khấu thêm", "Hạn mức công nợ"]} rows={levels.map((l) => [String(l.rank), l.name, `${(l.discountBps / 100).toFixed(2).replace(/\.?0+$/, "")}%`, <Money key={l.id} v={l.creditLimitMinor} />])} />
        )}
      </section>
      <section>
        <h2 className="font-bold text-navy mb-3">Đăng ký làm đại lý</h2>
        {!session ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-slate-600">Đăng nhập để điền form đăng ký làm đại lý. Admin xét duyệt xong, tài khoản của bạn sẽ mở được Cổng đại lý.</p>
            <div className="flex gap-2 justify-center mt-3">
              <Link href="/dang-nhap" className="btn-primary">Đăng nhập</Link>
              <Link href="/dang-ky" className="btn-ghost">Đăng ký tài khoản</Link>
            </div>
          </div>
        ) : myAgent ? (
          <div className="card p-6 flex flex-wrap items-center gap-4 justify-between">
            <div><div className="font-bold text-navy">Bạn đã là đại lý {myAgent.code}</div><p className="text-sm text-slate-500">Vào cổng đại lý để xem mạng lưới, bảng giá và hoa hồng.</p></div>
            <Link href="/dai-ly/portal" className="btn-primary">Cổng đại lý</Link>
          </div>
        ) : myApp?.status === "PENDING" ? (
          <div className="card p-6">
            <div className="font-bold text-navy">Đăng ký của bạn đang chờ admin duyệt</div>
            <p className="text-sm text-slate-500 mt-1">Gửi lúc {myApp.createdAt.toLocaleString("vi-VN")} · {myApp.fullName} · {myApp.phone}. Khi được duyệt, bạn sẽ nhận thông báo và vào được Cổng đại lý.</p>
          </div>
        ) : (
          <>
            {myApp?.status === "REJECTED" && (
              <div className="rounded-xl bg-red-50 text-red-600 px-4 py-3 text-sm mb-4">
                Đăng ký trước chưa được duyệt{myApp.reviewNote ? `: ${myApp.reviewNote}` : ""}. Bạn có thể bổ sung thông tin và gửi lại bên dưới.
              </div>
            )}
            <AgentApplyForm defaultName={myProfile?.fullName ?? ""} defaultEmail={me?.email ?? ""} />
          </>
        )}
      </section>
    </div>
  );
}
