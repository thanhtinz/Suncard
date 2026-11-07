import Link from "next/link";
import { PageTitle } from "@/components/ui";
import RegisterForm from "./form";
export default function RegisterPage() {
  return (
    <div className="max-w-md mx-auto">
      <PageTitle title="Đăng ký" sub="Tạo tài khoản SunCard miễn phí" />
      <RegisterForm />
      <p className="text-sm text-slate-500 mt-4 text-center">Đã có tài khoản? <Link className="text-primary font-medium" href="/dang-nhap">Đăng nhập</Link></p>
    </div>
  );
}
