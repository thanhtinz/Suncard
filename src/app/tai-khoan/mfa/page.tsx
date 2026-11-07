import { PageTitle } from "@/components/ui";
import MfaForm from "./mfa-form";

export default function MfaPage() {
  return (
    <div>
      <PageTitle title="Xác thực 2 lớp (MFA TOTP)" sub="Bắt buộc đối với mọi tài khoản quản trị. Khách hàng nên bật để bảo vệ ví và mã thẻ." />
      <MfaForm />
    </div>
  );
}
