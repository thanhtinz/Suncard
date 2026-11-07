import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/modules/security";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/modules/settings";
import type { SideGroup } from "@/components/nav";
import AdminShell from "@/components/AdminShell";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "OPS", "FINANCE", "SUPPORT", "PRODUCT_MANAGER", "PROVIDER_MANAGER", "RISK", "AUDITOR"];
const ROLE_LINE: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", OPS: "Vận hành", FINANCE: "Tài chính", SUPPORT: "Hỗ trợ", PRODUCT_MANAGER: "Sản phẩm", PROVIDER_MANAGER: "Nhà cung cấp", RISK: "Rủi ro", AUDITOR: "Kiểm toán" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  if (!session) {
    // Chưa đăng nhập -> về trang đăng nhập, xong quay lại đúng trang admin đang mở.
    const p = headers().get("x-pathname") ?? "/admin";
    redirect(`/dang-nhap?next=${encodeURIComponent(p.startsWith("/admin") ? p : "/admin")}`);
  }
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
  const [riskPending, profile] = await Promise.all([
    prisma.riskReview.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.userProfile.findUnique({ where: { userId: session.userId } }).catch(() => null),
  ]);
  const groups: SideGroup[] = [
    {
      items: [{ href: "/admin", label: "Bảng quản trị", icon: "grid" }],
    },
    {
      label: "Dịch vụ",
      items: [
        { href: "/admin/doi-the", label: "Đổi thẻ cào", icon: "swap" },
        { href: "/admin/kenh-nha-mang", label: "Kênh và nhà mạng", icon: "network" },
        { href: "/admin/nha-cung-cap", label: "Nhà cung cấp", icon: "server" },
        { href: "/admin/dinh-gia", label: "Biểu phí", icon: "percent" },
        { href: "/admin/danh-muc", label: "Danh mục", icon: "layers" },
        { href: "/admin/san-pham", label: "Sản phẩm", icon: "box" },
        { href: "/admin/kho-the", label: "Kho thẻ", icon: "card" },
        { href: "/admin/don-ban-the", label: "Đơn bán thẻ", icon: "receipt" },
        { href: "/admin/don-nap", label: "Đơn nạp cước/game", icon: "download" },
        { href: "/admin/dinh-tuyen", label: "Định tuyến nạp", icon: "network" },
      ],
    },
    {
      label: "Người dùng",
      items: [
        { href: "/admin/nguoi-dung", label: "Tài khoản", icon: "users" },
        { href: "/admin/phan-quyen", label: "Nhóm, vai trò, quản trị viên", icon: "lock" },
        { href: "/admin/xac-minh", label: "Xác minh danh tính", icon: "shield" },
        { href: "/admin/rui-ro", label: "Cảnh báo", icon: "alert", dot: riskPending > 0 },
        { href: "/admin/nhat-ky-dang-nhap", label: "Nhật ký đăng nhập", icon: "list" },
        { href: "/admin/ho-tro", label: "Hỗ trợ", icon: "headset" },
        { href: "/admin/tranh-chap", label: "Tranh chấp", icon: "flag" },
      ],
    },
    {
      label: "Ví và thanh toán",
      items: [
        { href: "/admin/tai-chinh", label: "Yêu cầu nạp / rút", icon: "wallet" },
        { href: "/admin/vi-ledger", label: "Biến động số dư", icon: "book" },
        { href: "/admin/cong-no", label: "Công nợ", icon: "clock" },
        { href: "/admin/phi-chuyen-tien", label: "Phí chuyển tiền", icon: "percent" },
        { href: "/admin/ngan-hang", label: "Tài khoản ngân hàng", icon: "card" },
        { href: "/admin/lich-su-ngan-hang", label: "Lịch sử ngân hàng", icon: "list" },
        { href: "/admin/hoa-don", label: "Hoá đơn", icon: "file" },
        { href: "/admin/cong-thanh-toan", label: "Cổng thanh toán", icon: "server" },
        { href: "/admin/doi-soat", label: "Đối soát", icon: "reconcile" },
      ],
    },
    {
      label: "Đối tác",
      items: [
        { href: "/admin/dai-ly", label: "Đại lý", icon: "store" },
        { href: "/admin/api-clients", label: "Kết nối API của khách", icon: "code" },
        { href: "/admin/hoa-hong", label: "Hoa hồng giới thiệu", icon: "trend" },
        { href: "/admin/ai-agent", label: "Kết nối AI Agent", icon: "robot" },
      ],
    },
    {
      label: "Nội dung",
      items: [
        { href: "/admin/tai-lieu", label: "Tin tức, trang tĩnh, tài liệu", icon: "file" },
        { href: "/admin/noi-dung", label: "Banner, SEO & ngôn ngữ", icon: "layers" },
      ],
    },
    {
      label: "Báo cáo",
      items: [
        { href: "/admin/bao-cao", label: "Báo cáo tổng hợp", icon: "chart" },
      ],
    },
    {
      label: "Hệ thống",
      items: [
        { href: "/admin/cai-dat", label: "Cài đặt chung", icon: "gear" },
        { href: "/admin/he-thong-email", label: "Email & mẫu email", icon: "mail" },
        { href: "/admin/dang-nhap-mxh", label: "Đăng nhập mạng xã hội", icon: "user" },
        { href: "/admin/gioi-han", label: "Giới hạn & phiên", icon: "shield" },
        { href: "/admin/tuong-lua", label: "Tường lửa IP", icon: "lock" },
        { href: "/admin/tac-vu", label: "Tác vụ tự động", icon: "clock" },
        { href: "/admin/nhat-ky", label: "Nhật ký hệ thống", icon: "list" },
        { href: "/admin/don-dep", label: "Cache & dọn dữ liệu", icon: "trash" },
      ],
    },
  ];
  const displayName = profile?.fullName ?? session.email.split("@")[0];
  return (
    <AdminShell
      user={{
        email: session.email,
        displayName,
        initial: (displayName.trim().charAt(0) || "A").toUpperCase(),
        roleLine: session.roles.map((r) => ROLE_LINE[r] ?? r).join(" · "),
      }}
      groups={groups}
      alertCount={riskPending}
    >
      {children}
    </AdminShell>
  );
}
