import { PageTitle } from "@/components/ui";
import { getSetting } from "@/modules/settings";
import SocialAuthForm from "./form";

export const dynamic = "force-dynamic";

const CHANNELS = ["google", "facebook", "github", "microsoft"] as const;

export default async function AdminSocialAuthPage() {
  const initial: Record<string, string | boolean> = {};
  for (const ch of CHANNELS) {
    initial[`auth.${ch}_enabled`] = Boolean(await getSetting<unknown>(`auth.${ch}_enabled`, false));
    initial[`auth.${ch}_client_id`] = String((await getSetting<unknown>(`auth.${ch}_client_id`, "")) ?? "");
    // Client Secret không đẩy xuống client.
  }
  return (
    <div>
      <PageTitle title="Đăng nhập mạng xã hội" sub="Bật/tắt và cấu hình OAuth cho từng kênh đăng nhập" />
      <SocialAuthForm initial={initial} />
    </div>
  );
}
