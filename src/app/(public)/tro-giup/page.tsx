import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { getSession } from "@/modules/security";
import TicketForm from "./form";

export const dynamic = "force-dynamic";
const FAQ: [string, string][] = [
  ["Đơn ở trạng thái Đang xác minh nghĩa là gì?", "Nhà cung cấp chưa trả kết quả cuối cùng. Hệ thống sẽ tự tra cứu lại; tiền của bạn vẫn được giữ an toàn và sẽ hoàn nếu đơn thất bại."],
  ["Mua thẻ xong xem mã ở đâu?", "Vào Tài khoản → Thẻ đã mua, bấm Xem mã và nhập lại mật khẩu để hiển thị serial và PIN."],
  ["Gạch thẻ bao lâu thì nhận tiền?", "Thẻ đúng mệnh giá thường được duyệt trong vài phút. Thẻ cần kiểm tra thủ công có thể lâu hơn và sẽ có thông báo khi hoàn tất."],
  ["Nạp tiền vào ví như thế nào?", "Vào Tài khoản → Ví, chọn Nạp tiền và làm theo hướng dẫn của phương thức bạn chọn."],
  ["Làm sao trở thành đại lý?", "Xem chương trình và các cấp đại lý tại trang Đại lý, sau đó liên hệ bộ phận kinh doanh để được duyệt hồ sơ."],
];

export default async function HelpPage() {
  const session = await getSession().catch(() => null);
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <PageTitle title="Trung tâm hỗ trợ" sub="Câu hỏi thường gặp và gửi yêu cầu hỗ trợ" />
      <section className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="card p-4"><summary className="font-medium cursor-pointer">{q}</summary><p className="text-sm text-slate-500 mt-2">{a}</p></details>
        ))}
      </section>
      <section>
        <h2 className="font-bold text-navy mb-3">Gửi yêu cầu hỗ trợ</h2>
        {session ? <TicketForm /> : (
          <div className="card p-6 text-sm text-slate-500">Vui lòng <Link className="text-primary font-medium" href="/dang-nhap">đăng nhập</Link> để gửi yêu cầu hỗ trợ và theo dõi phản hồi.</div>
        )}
      </section>
    </div>
  );
}
