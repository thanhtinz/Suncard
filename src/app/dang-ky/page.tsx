import Link from "next/link";
import { PageTitle } from "@/components/ui";
import AuthShell from "@/components/AuthShell";
import RegisterForm from "./form";
export default function RegisterPage() {
  return (
    <AuthShell>
      <PageTitle title="Đăng ký" sub="Tạo tài khoản SunCard miễn phí" />
      <RegisterForm />
      <p className="text-sm text-slate-500 mt-4 text-center">Đã có tài khoản? <Link className="text-sundeep font-semibold" href="/dang-nhap">Đăng nhập</Link></p>
    </AuthShell>
  );
}
