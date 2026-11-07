import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const profiles = users.length ? await prisma.userProfile.findMany({ where: { userId: { in: users.map((u) => u.id) } } }) : [];
  const pMap = new Map(profiles.map((p) => [p.userId, p]));
  const urs = users.length ? await prisma.userRole.findMany({ where: { userId: { in: users.map((u) => u.id) } } }) : [];
  const roles = urs.length ? await prisma.role.findMany({ where: { id: { in: urs.map((r) => r.roleId) } } }) : [];
  const rMap = new Map(roles.map((r) => [r.id, r]));
  const rolesOf = (uid: string) => urs.filter((r) => r.userId === uid).map((r) => rMap.get(r.roleId)?.code ?? "").filter(Boolean).join(", ");
  return (
    <div>
      <PageTitle title="Người dùng" sub={`Tổng ${total} · Trang ${page}`} />
      <DataTable cols={["Email", "Họ tên", "Điện thoại", "Vai trò", "KYC", "Trạng thái", "Đăng nhập cuối", "Ngày tạo"]} rows={users.map((u) => [
        u.email, pMap.get(u.id)?.fullName ?? "", u.phone ?? "", rolesOf(u.id), u.kycStatus, <StatusBadge key="s" status={u.status} />, u.lastLoginAt ? u.lastLoginAt.toLocaleString("vi-VN") : "—", u.createdAt.toLocaleDateString("vi-VN"),
      ])} />
    </div>
  );
}
