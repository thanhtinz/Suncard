import { redirect } from "next/navigation";
import { getSession } from "@/modules/security";
import { NavLink } from "@/components/ui";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6 items-start">
      <aside className="card p-3 md:sticky md:top-20">
        <div className="px-3 py-2 text-sm text-slate-500 truncate">{session.email}</div>
        <NavLink href="/tai-khoan">Tổng quan</NavLink>
        <NavLink href="/tai-khoan/don-hang">Đơn hàng</NavLink>
        <NavLink href="/tai-khoan/vi">Ví của tôi</NavLink>
        <NavLink href="/tai-khoan/the-da-mua">Thẻ đã mua</NavLink>
        <NavLink href="/tai-khoan/doi-the">Đổi thẻ</NavLink>
        <NavLink href="/tai-khoan/ho-tro">Hỗ trợ</NavLink>
        <NavLink href="/tai-khoan/api-keys">API Keys</NavLink>
        <NavLink href="/tai-khoan/thong-bao">Thông báo</NavLink>
        <NavLink href="/tai-khoan/mfa">Bảo mật 2 lớp (MFA)</NavLink>
        <NavLink href="/tai-khoan/phien">Phiên đăng nhập</NavLink>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
