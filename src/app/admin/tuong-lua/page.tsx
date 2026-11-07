import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Empty } from "@/components/ui";
import { getSetting } from "@/modules/settings";
import FirewallForm from "./form";

export const dynamic = "force-dynamic";

function asLines(v: unknown): string {
  return Array.isArray(v) ? v.map((x) => String(x)).join("\n") : "";
}

export default async function AdminFirewallPage() {
  const allowlist = asLines(await getSetting<unknown>("security.admin_ip_allowlist", []));
  const blacklist = asLines(await getSetting<unknown>("security.ip_blacklist", []));
  const throttles = await prisma.loginThrottle.findMany({ orderBy: { lastFailAt: "desc" }, take: 20 });
  const now = Date.now();
  return (
    <div className="space-y-8">
      <PageTitle title="Tường lửa IP" sub="Danh sách IP trắng cho khu Admin và danh sách IP đen phục vụ kiểm tra rủi ro" />
      <FirewallForm allowlist={allowlist} blacklist={blacklist} />
      <section>
        <h2 className="font-bold text-navy mb-3">Khoá đăng nhập tạm gần đây</h2>
        <p className="text-sm text-slate-500 mb-3">Hệ thống chỉ lưu khoá băm của (email · IP · thiết bị) nên bảng dưới đây hiển thị mã băm rút gọn, không hiển thị IP gốc.</p>
        {throttles.length === 0 ? <Empty text="Chưa có lần đăng nhập sai nào bị ghi nhận" /> : (
          <DataTable cols={["Khoá băm (email·IP·thiết bị)", "Số lần sai", "Số lần bị khoá", "Đang khoá đến", "Lần sai gần nhất"]} rows={throttles.map((t) => [
            <span key="k" className="font-mono text-xs">{t.throttleKey.slice(0, 16)}…</span>,
            String(t.fails),
            String(t.lockCount),
            t.lockedUntil ? (t.lockedUntil.getTime() > now ? t.lockedUntil.toISOString().slice(0, 19).replace("T", " ") : "Đã hết hạn") : "—",
            t.lastFailAt ? t.lastFailAt.toISOString().slice(0, 19).replace("T", " ") : "—",
          ])} />
        )}
      </section>
    </div>
  );
}
