import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { KYC: "Định danh (KYC)", EMAIL: "Email", PHONE: "Số điện thoại", STEP_UP: "Xác nhận thao tác" };

export default async function AdminVerificationPage() {
  // Hàng chờ: bản ghi PENDING lên đầu (cũ nhất chờ lâu nhất lên trước), sau đó là các bản ghi gần nhất.
  const [pending, others] = await Promise.all([
    prisma.verificationRecord.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 50 }).catch(() => []),
    prisma.verificationRecord.findMany({ where: { status: { not: "PENDING" } }, orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []),
  ]);
  const records = [...pending, ...others];
  const users = records.length ? await prisma.user.findMany({ where: { id: { in: Array.from(new Set(records.map((r) => r.userId))) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return (
    <div>
      <PageTitle title="Xác minh danh tính (KYC)" sub={`${pending.length} bản ghi đang chờ · duyệt KYC thực hiện ở trang chi tiết người dùng`} />
      <DataTable cols={["Khách", "Loại xác minh", "Đối tượng", "Trạng thái", "Hết hạn", "Đã xác minh", "Thời gian tạo"]} rows={records.map((r) => [
        userMap.get(r.userId)?.email ?? r.userId,
        TYPE_LABEL[r.type] ?? r.type,
        r.target ?? "—",
        <StatusBadge key="s" status={r.status} />,
        r.expiresAt ? r.expiresAt.toLocaleString("vi-VN") : "—",
        r.verifiedAt ? r.verifiedAt.toLocaleString("vi-VN") : "—",
        r.createdAt.toLocaleString("vi-VN"),
      ])} />
    </div>
  );
}
