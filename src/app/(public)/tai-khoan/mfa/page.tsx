import { PageTitle } from "@/components/ui";
import { getSession } from "@/modules/security";
import { prisma } from "@/lib/prisma";
import MfaForm from "./mfa-form";
import PasskeyForm from "./passkey-form";

export default async function MfaPage() {
  // Trang phải biết trạng thái MFA hiện tại: nếu user đã tạo mã thiết lập mà
  // chưa kích hoạt (hay bị Admin chặn quay lại đây) thì vào thẳng bước nhập mã,
  // KHÔNG bắt tạo lại — tạo lại sẽ đè secret mới và làm mã trong app
  // Authenticator của user thành vô hiệu (vòng lặp "tạo rồi vẫn không vào được").
  const s = await getSession().catch(() => null);
  const u = s ? await prisma.user.findUnique({ where: { id: s.userId }, select: { totpEnabled: true, totpSecret: true } }).catch(() => null) : null;
  return (
    <div>
      <PageTitle title="Bảo mật tài khoản" sub="Xác thực 2 lớp bắt buộc đối với mọi tài khoản quản trị. Passkey giúp đăng nhập nhanh bằng vân tay/khuôn mặt." />
      <MfaForm enabled={!!u?.totpEnabled} hasSecret={!!u?.totpSecret} />
      <PasskeyForm />
    </div>
  );
}
