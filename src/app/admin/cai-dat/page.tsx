import { prisma } from "@/lib/prisma";
import { PageTitle, Empty } from "@/components/ui";
import SettingRow from "./form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await prisma.setting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
  const groups = Array.from(new Set(settings.map((s) => s.group)));
  return (
    <div>
      <PageTitle title="Cài đặt hệ thống" sub="Mọi cấu hình nghiệp vụ lưu trong cơ sở dữ liệu, giá trị dạng JSON" />
      {settings.length === 0 ? <Empty text="Chưa có cấu hình nào" /> : groups.map((g) => (
        <section key={g} className="mb-8">
          <h2 className="font-bold text-navy mb-3">Nhóm: {g}</h2>
          <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Khoá</th><th>Giá trị (JSON)</th><th></th></tr></thead>
            <tbody>{settings.filter((s) => s.group === g).map((s) => <SettingRow key={s.id} k={s.key} value={JSON.stringify(s.value)} description={s.description} />)}</tbody></table></div>
        </section>
      ))}
    </div>
  );
}
