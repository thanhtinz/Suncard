import { PageTitle } from "@/components/ui";
import MaintenanceActions from "./form";

export const dynamic = "force-dynamic";

export default function AdminMaintenancePage() {
  return (
    <div>
      <PageTitle title="Cache & dọn dữ liệu" sub="Xoá cache dựng trang và dọn thông báo, nhật ký kiểm toán đã cũ" />
      <MaintenanceActions />
    </div>
  );
}
