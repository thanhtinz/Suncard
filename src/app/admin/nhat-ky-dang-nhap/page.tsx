import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const LOGIN_ACTIONS = ["LOGIN_SUCCESS", "LOGIN_FAILED", "LOGIN_MFA_FAILED", "NEW_DEVICE_LOGIN"];
const ACTION_LABEL: Record<string, string> = {
  LOGIN_SUCCESS: "Đăng nhập thành công",
  LOGIN_FAILED: "Đăng nhập thất bại",
  LOGIN_MFA_FAILED: "Sai mã xác thực 2 lớp",
  NEW_DEVICE_LOGIN: "Đăng nhập từ thiết bị mới",
};

export default async function AdminLoginLogPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const where = { action: { in: LOGIN_ACTIONS } };
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const actorIds = Array.from(new Set(logs.map((l) => l.actorId).filter((x): x is string => !!x)));
  const users = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const totalPages = Math.max(1, Math.ceil(total / take));
  return (
    <div>
      <PageTitle title="Nhật ký đăng nhập" sub={`Tổng ${total} sự kiện · Trang ${page}/${totalPages}`} />
      <DataTable cols={["Thời gian", "Tài khoản", "Hành động", "Kết quả", "IP", "Tóm tắt"]} rows={logs.map((l) => [
        l.createdAt.toLocaleString("vi-VN"),
        l.actorId ? (userMap.get(l.actorId)?.email ?? l.actorId) : "—",
        ACTION_LABEL[l.action] ?? l.action,
        l.result ? <StatusBadge key="s" status={l.result} /> : "—",
        l.ip ?? "—",
        l.summary ?? "—",
      ])} />
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          {page > 1 && <Link className="btn-ghost" href={`/admin/nhat-ky-dang-nhap?page=${page - 1}`}>Trang trước</Link>}
          <span className="text-slate-500">Trang {page}/{totalPages}</span>
          {page < totalPages && <Link className="btn-ghost" href={`/admin/nhat-ky-dang-nhap?page=${page + 1}`}>Trang sau</Link>}
        </div>
      )}
    </div>
  );
}
