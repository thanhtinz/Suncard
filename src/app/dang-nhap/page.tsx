import Link from "next/link";
import { PageTitle } from "@/components/ui";
import AuthShell from "@/components/AuthShell";
import LoginForm from "./form";
export default function LoginPage({ searchParams }: { searchParams?: { next?: string } }) {
  // Đích quay lại sau đăng nhập (vd: trang admin vừa mở) — chỉ nhận đường dẫn nội bộ.
  const raw = searchParams?.next ?? "";
  const next = raw.startsWith("/") && !raw.startsWith("//") && raw.length <= 200 ? raw : undefined;
  return (
    <AuthShell>
      <PageTitle title="Đăng nhập" sub={next?.startsWith("/admin") ? "Đăng nhập để vào trang quản trị SunCard" : "Truy cập tài khoản SunCard của bạn"} />
      <LoginForm next={next} />
      <p className="text-sm text-slate-500 mt-4 text-center">Chưa có tài khoản? <Link className="text-sundeep font-semibold" href="/dang-ky">Đăng ký</Link></p>
    </AuthShell>
  );
}
