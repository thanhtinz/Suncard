import { PageTitle } from "@/components/ui";
import { getNumberSetting } from "@/modules/settings";
import LimitsForm from "./form";

export const dynamic = "force-dynamic";

const KEYS = [
  "session.admin_ttl_minutes",
  "session.customer_ttl_minutes",
  "login.max_attempts",
  "login.lock_base_minutes",
  "limits.buy_card_daily_minor",
  "limits.topup_daily_minor",
  "limits.withdraw_daily_minor",
  "limits.transfer_daily_minor",
] as const;

export default async function AdminLimitsPage() {
  const initial: Record<string, string> = {};
  for (const k of KEYS) initial[k] = String(await getNumberSetting(k, 0));
  return (
    <div>
      <PageTitle title="Giới hạn & phiên" sub="Thời hạn phiên, khoá đăng nhập và hạn mức giao dịch theo ngày — lưu vào Cài đặt hệ thống" />
      <LimitsForm initial={initial} />
    </div>
  );
}
