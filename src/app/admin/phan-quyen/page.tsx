import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const [roles, perms, rps] = await Promise.all([
    prisma.role.findMany({ orderBy: { code: "asc" } }),
    prisma.permission.findMany({ orderBy: { group: "asc" } }),
    prisma.rolePermission.findMany(),
  ]);
  const permMap = new Map(perms.map((p) => [p.id, p]));
  const permsOf = (roleId: string) => rps.filter((r) => r.roleId === roleId).map((r) => permMap.get(r.permissionId)?.code ?? "").filter(Boolean);
  const groups = Array.from(new Set(perms.map((p) => p.group)));
  return (
    <div className="space-y-8">
      <PageTitle title="Phân quyền" sub="Ma trận vai trò và quyền (chỉ xem)" />
      {roles.length === 0 ? <Empty text="Chưa có vai trò nào" /> : (
        <div className="space-y-4">
          {roles.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-navy">{r.code}</span><span className="text-sm text-slate-500">{r.name}</span>{r.isSystem && <span className="badge bg-slate-100 text-slate-600">Hệ thống</span>}</div>
              {r.description && <p className="text-sm text-slate-500 mt-1">{r.description}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {permsOf(r.id).length === 0 ? <span className="text-sm text-slate-400">Chưa gán quyền</span> : permsOf(r.id).map((code) => <span key={code} className="badge bg-blue-50 text-primary">{code}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
      <h2 className="font-bold text-navy">Danh mục quyền theo nhóm</h2>
      <DataTable cols={["Nhóm", "Quyền"]} rows={groups.map((g) => [g, perms.filter((p) => p.group === g).map((p) => `${p.code} (${p.name})`).join(", ")])} />
    </div>
  );
}
