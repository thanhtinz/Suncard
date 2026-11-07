import Link from "next/link";
import { PageTitle } from "@/components/ui";
import AuthShell from "@/components/AuthShell";
import LoginForm from "./form";
export default function LoginPage() {
  return (
    <AuthShell>
      <PageTitle title="Đăng nhập" sub="Truy cập tài khoản SunCard của bạn" />
      <LoginForm />
      <p className="text-sm text-slate-500 mt-4 text-center">Chưa có tài khoản? <Link className="text-sundeep font-semibold" href="/dang-ky">Đăng ký</Link></p>
    </AuthShell>
  );
}
