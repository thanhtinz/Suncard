import { PageTitle } from "@/components/ui";
import { getSetting } from "@/modules/settings";
import NoiDungForm from "./form";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const initial: Record<string, string | boolean> = {
    "content.announcement_enabled": Boolean(await getSetting<unknown>("content.announcement_enabled", false)),
    "content.announcement_text": String((await getSetting<unknown>("content.announcement_text", "")) ?? ""),
    "content.announcement_link": String((await getSetting<unknown>("content.announcement_link", "")) ?? ""),
    "seo.default_title": String((await getSetting<unknown>("seo.default_title", "")) ?? ""),
    "seo.default_description": String((await getSetting<unknown>("seo.default_description", "")) ?? ""),
    "site.default_language": String((await getSetting<unknown>("site.default_language", "vi")) ?? "vi"),
    "site.footer_note": String((await getSetting<unknown>("site.footer_note", "")) ?? ""),
  };
  return (
    <div>
      <PageTitle title="Nội dung & giao diện" sub="Banner thông báo, SEO mặc định và ngôn ngữ của khu khách hàng — lưu vào Cài đặt hệ thống" />
      <NoiDungForm initial={initial} />
    </div>
  );
}
