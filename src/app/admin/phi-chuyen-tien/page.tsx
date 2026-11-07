import { PageTitle } from "@/components/ui";
import { getNumberSetting } from "@/modules/settings";
import TransferFeeForm from "./form";

export const dynamic = "force-dynamic";

export default async function AdminTransferFeePage() {
  const [feeBps, feeMinMinor, transferMinMinor, dailyLimitMinor] = await Promise.all([
    getNumberSetting("wallet.transfer_fee_bps", 0),
    getNumberSetting("wallet.transfer_fee_min_minor", 0),
    getNumberSetting("wallet.transfer_min_minor", 0),
    getNumberSetting("wallet.transfer_daily_limit_minor", 0),
  ]);
  return (
    <div>
      <PageTitle title="Phí chuyển tiền" sub="Cấu hình phí và giới hạn chuyển tiền nội bộ giữa các ví thành viên (lưu vào Cài đặt hệ thống)" />
      <div className="card p-4 mb-4 text-sm text-slate-600 flex gap-2">
        <i className="fa-solid fa-circle-info text-sundeep mt-0.5" aria-hidden="true" />
        <span>API chuyển ví hiện tại đang áp dụng <b>phí theo %</b> (đọc từ key <span className="font-mono">wallet.transfer_fee_bps</span>). Các mức phí tối thiểu, số tiền chuyển tối thiểu và hạn mức ngày dưới đây được lưu vào cấu hình hệ thống để sẵn sàng áp dụng — bản hiện tại chưa dùng các mức này để chặn giao dịch.</span>
      </div>
      <TransferFeeForm feeBps={feeBps} feeMinMinor={feeMinMinor} transferMinMinor={transferMinMinor} dailyLimitMinor={dailyLimitMinor} />
    </div>
  );
}
