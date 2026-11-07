import { PageTitle } from "@/components/ui";
import { getSetting } from "@/modules/settings";
import PaymentGatewaysForm from "./form";

export const dynamic = "force-dynamic";

export default async function AdminPaymentGatewaysPage() {
  const [tmnCode, enabled, returnUrl, secretEnc, bankName, accountNumber, accountName, notePrefix] = await Promise.all([
    getSetting<string>("vnpay.tmn_code", ""),
    getSetting<boolean>("vnpay.enabled", false),
    getSetting<string>("vnpay.return_url", ""),
    // Chỉ kiểm tra secret ĐÃ tồn tại hay chưa — không đưa giá trị mã hoá xuống client.
    getSetting<string>("vnpay.hash_secret_enc", ""),
    getSetting<string>("deposit.bank_name", ""),
    getSetting<string>("deposit.bank_account_number", ""),
    getSetting<string>("deposit.bank_account_name", ""),
    getSetting<string>("deposit.bank_note_prefix", ""),
  ]);
  return (
    <div>
      <PageTitle title="Cổng thanh toán" sub="Cấu hình VNPay và tài khoản ngân hàng nội địa nhận tiền nạp (lưu vào Cài đặt hệ thống)" />
      <PaymentGatewaysForm
        vnpay={{ tmnCode: tmnCode || "", enabled: !!enabled, returnUrl: returnUrl || "", hasSecret: !!(secretEnc && String(secretEnc).length > 0) }}
        bank={{ bankName: bankName || "", accountNumber: accountNumber || "", accountName: accountName || "", notePrefix: notePrefix || "" }}
      />
    </div>
  );
}
