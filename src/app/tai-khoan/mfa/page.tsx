import { PageTitle } from "@/components/ui";
import MfaForm from "./mfa-form";
import PasskeyForm from "./passkey-form";

export default function MfaPage() {
  return (
    <div>
      <PageTitle title="Bảo mật tài khoản" sub="Xác thực 2 lớp bắt buộc đối với mọi tài khoản quản trị. Passkey giúp đăng nhập nhanh bằng vân tay/khuôn mặt." />
      <MfaForm />
      <PasskeyForm />
    </div>
  );
}
