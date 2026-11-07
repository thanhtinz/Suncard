import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/modules/security";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/modules/settings";
import { SideNav, type SideGroup } from "@/components/nav";
import { SunMark } from "@/components/SiteHeader";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "OPS", "FINANCE", "SUPPORT", "PRODUCT_MANAGER", "PROVIDER_MANAGER", "RISK", "AUDITOR"];
const ROLE_LINE: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", OPS: "Vận hành", FINANCE: "Tài chính", SUPPORT: "Hỗ trợ", PRODUCT_MANAGER: "Sản phẩm", PROVIDER_MANAGER: "Nhà cung cấp", RISK: "Rủi ro", AUDITOR: "Kiểm toán" };

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
  const riskPending = await prisma.riskReview.count({ where: { status: "PENDING" } }).catch(() => 0);
  const groups: SideGroup[] = [
    {
      label: "Tổng quan",
      items: [
        { href: "/admin", label: "Tổng quan", icon: "grid" },
        { href: "/admin/bao-cao", label: "Báo cáo", icon: "chart" },
      ],
    },
    {
      label: "Vận hành",
      items: [
        { href: "/admin/doi-the", label: "Đổi thẻ", icon: "swap" },
        { href: "/admin/don-nap", label: "Đơn nạp", icon: "download" },
        { href: "/admin/kho-the", label: "Kho thẻ", icon: "layers" },
        { href: "/admin/san-pham", label: "Sản phẩm", icon: "box" },
        { href: "/admin/dinh-gia", label: "Định giá", icon: "tag" },
        { href: "/admin/nha-cung-cap", label: "Nhà cung cấp", icon: "server" },
      ],
    },
    {
      label: "Khách hàng",
      items: [
        { href: "/admin/nguoi-dung", label: "Người dùng", icon: "users" },
        { href: "/admin/dai-ly", label: "Đại lý", icon: "store" },
        { href: "/admin/api-clients", label: "API Clients", icon: "code" },
      ],
    },
    {
      label: "Tài chính",
      items: [
        { href: "/admin/vi-ledger", label: "Ví & Ledger", icon: "book" },
        { href: "/admin/tai-chinh", label: "Tài chính", icon: "trend" },
        { href: "/admin/cong-no", label: "Công nợ", icon: "clock" },
        { href: "/admin/hoa-hong", label: "Hoa hồng", icon: "percent" },
        { href: "/admin/doi-soat", label: "Đối soát", icon: "reconcile" },
      ],
    },
    {
      label: "Hệ thống",
      items: [
        { href: "/admin/tranh-chap", label: "Tranh chấp", icon: "flag" },
        { href: "/admin/rui-ro", label: "Hàng chờ rủi ro", icon: "alert", dot: riskPending > 0 },
        { href: "/admin/phan-quyen", label: "Phân quyền", icon: "lock" },
        { href: "/admin/nhat-ky", label: "Nhật ký", icon: "list" },
        { href: "/admin/tai-lieu", label: "Tài liệu", icon: "file" },
        { href: "/admin/cai-dat", label: "Cài đặt", icon: "gear" },
      ],
    },
  ];
  const roleChip = (cls: string) => (
    <span className={`inline-block mt-1 text-[10.5px] font-extrabold tracking-[0.05em] uppercase text-sundeep bg-[#FFEEDA] px-2 py-[3px] rounded-full ${cls}`}>{session.roles.map((r) => ROLE_LINE[r] ?? r).join(" · ")}</span>
  );
  const profileDesktop = (
    <div className="flex items-center gap-3 px-2 pt-1.5 pb-3.5 border-b border-[#F7EDD8] mb-1.5">
      <SunMark size={42} />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-extrabold text-navy truncate">Quản trị SunCard</span>
        {roleChip("")}
      </span>
    </div>
  );
  const profileMobile = (
    <div className="bg-white border-[1.5px] border-[#F3E5C8] rounded-[18px] p-3.5 flex items-center gap-3 shadow-[0_5px_16px_rgba(120,80,10,0.06)]">
      <SunMark size={42} />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-extrabold text-navy truncate">Quản trị SunCard</span>
        {roleChip("")}
      </span>
    </div>
  );
  return (
    <div className="md:flex md:gap-6 md:items-start">
      <SideNav profile={profileDesktop} mobileProfile={profileMobile} groups={groups} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
