import { PageTitle } from "@/components/ui";
import { getSetting } from "@/modules/settings";
import MailForm from "./form";

export const dynamic = "force-dynamic";

export default async function AdminMailPage() {
  const str = async (key: string, fallback = "") => String((await getSetting<unknown>(key, fallback)) ?? fallback);
  const initial: Record<string, string> = {
    "mail.provider": await str("mail.provider"),
    "mail.from_name": await str("mail.from_name"),
    "mail.from_email": await str("mail.from_email"),
    "mail.smtp_host": await str("mail.smtp_host"),
    "mail.smtp_port": String((await getSetting<unknown>("mail.smtp_port", "")) ?? ""),
    "mail.smtp_user": await str("mail.smtp_user"),
    "mail.smtp_pass": "", // không bao giờ đẩy mật khẩu đã lưu xuống client
    "mail.template_welcome": await str("mail.template_welcome"),
    "mail.template_order_done": await str("mail.template_order_done"),
  };
  return (
    <div>
      <PageTitle title="Email & mẫu email" sub="Cấu hình dịch vụ gửi mail và mẫu nội dung email hệ thống — lưu vào Cài đặt hệ thống" />
      <MailForm initial={initial} />
    </div>
  );
}
