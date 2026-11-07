import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/modules/security";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/modules/settings";
import { NavLink } from "@/components/ui";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "OPS", "FINANCE", "SUPPORT", "PRODUCT_MANAGER", "PROVIDER_MANAGER", "RISK", "AUDITOR"];
const LINKS: [string, string][] = [
  ["/admin", "Tổng quan"], ["/admin/nguoi-dung", "Người dùng"], ["/admin/dai-ly", "Đại lý"], ["/admin/san-pham", "Sản phẩm"],
  ["/admin/kho-the", "Kho thẻ"], ["/admin/doi-the", "Đổi thẻ"], ["/admin/don-nap", "Đơn nạp"], ["/admin/nha-cung-cap", "Nhà cung cấp"],
  ["/admin/dinh-gia", "Định giá"], ["/admin/vi-ledger", "Ví & Ledger"], ["/admin/tai-chinh", "Tài chính"], ["/admin/cong-no", "Công nợ"],
  ["/admin/hoa-hong", "Hoa hồng"], ["/admin/tranh-chap", "Tranh chấp"], ["/admin/doi-soat", "Đối soát"], ["/admin/bao-cao", "Báo cáo"],
  ["/admin/tai-lieu", "Tài liệu"], ["/admin/phan-quyen", "Phân quyền"], ["/admin/nhat-ky", "Nhật ký"], ["/admin/rui-ro", "Hàng chờ rủi ro"], ["/admin/cai-dat", "Cài đặt"],
  ["/admin/api-clients", "API Clients"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  if (!session.roles.some((r) => ADMIN_ROLES.includes(r))) redirect("/tai-khoan");
  // SEC-AC-02: MFA TOTP bắt buộc cho Admin — chưa bật thì ép qua trang thiết lập MFA.
  const dbUser = await prisma.user.findUnique({ where: { id: session.userId } }).catch(() => null);
  if (!dbUser?.totpEnabled) redirect("/tai-khoan/mfa?required=1");
  // IP allowlist Admin (tuỳ chọn — chỉ áp dụng khi Admin đã cấu hình trong settings).
  const allowlist: string[] = (await getSetting<unknown>("security.admin_ip_allowlist", []).catch(() => [])) as string[];
  if (Array.isArray(allowlist) && allowlist.length > 0) {
    const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    if (!allowlist.includes(ip)) redirect("/tai-khoan?admin_ip_blocked=1");
  }
  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6 items-start">
      <aside className="card p-3 md:sticky md:top-20 max-h-[85vh] overflow-y-auto">
        <div className="px-3 py-2">
          <div className="font-semibold text-sm">Quản trị SunCard</div>
          <div className="text-xs text-slate-500 truncate">{session.email}</div>
          <div className="text-xs text-slate-400">{session.roles.join(", ")}</div>
        </div>
        {LINKS.map(([href, label]) => <NavLink key={href} href={href}>{label}</NavLink>)}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
