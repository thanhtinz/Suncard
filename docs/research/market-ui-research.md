# Nghiên cứu giao diện thị trường — SunCard

Ngày khảo sát: 07/11/2026. Phương pháp: chỉ đọc trang chủ công khai (browser search + open), không đăng nhập, không gửi form.
Phạm vi: nhóm đổi thẻ VN (doithe.vn, thesieure.com, gachthe.vn, cardvip.vn, nappay.vn) và nhóm nạp game / sản phẩm số (Codashop VN, UniPin, Divine Shop, napthe.vn – Garena).

> Kết luận một câu: **cả 5 web đổi thẻ VN dùng gần như cùng một template** — khối cảnh báo chữ đỏ/vàng ở đầu trang → tab "Đổi thẻ cào / Đổi nhiều thẻ" → form (loại thẻ, serial, mã thẻ, mệnh giá) → bảng phí dạng tab theo nhà mạng, cột mệnh giá × hàng nhóm người dùng. Khác nhau chủ yếu ở màu nền header và tên nhóm phí. Đây chính là thứ SunCard cần thoát ra.

---

## 1. Nhóm đổi thẻ cào

### 1.1 doithe.vn
- **Bố cục trang chủ (theo thứ tự):** (1) Khối cảnh báo dài chữ in hoa về nguồn thẻ bị cấm (mua Visa/Tiki, game bài, tài xỉu…), khoá vĩnh viễn; (2) lưu ý "điền đúng seri", "sai mệnh giá trừ 50% mệnh giá nhỏ hơn"; (3) link lịch sử/thống kê + chat hỗ trợ; (4) tab Đổi thẻ cào / Đổi nhiều thẻ + form; (5) bảng phí đủ 7 nhà mạng; (6) link phụ: nạp Carot/Teamobi, thông báo mua thẻ.
- **Form:** tab đơn thẻ / nhiều thẻ. Đổi nhiều thẻ yêu cầu số dư > 50.000đ — rào cản được báo ngay trong form.
- **Bảng phí:** tab theo nhà mạng (kèm số "89/86" khó hiểu cạnh tên mạng), bảng ngang: cột = mệnh giá 10k→1tr, hàng = Đại lý (SL 50M) / Thành viên. Viettel thành viên: 10k 20,5% · 50k 15,5% · 100k 14,5% · 500k 17,5%.
- **Màu/typography:** giao diện web đời cũ, chữ nhỏ dày, cảnh báo đỏ/vàng, không có hệ thống nhận diện riêng — nhìn giống "trang công cụ" hơn là thương hiệu.
- **Điểm hay:** phí công khai 100%, không giấu; cảnh báo sai mệnh giá đặt trước form (đúng chỗ khách cần).
- **Điểm dở:** tường chữ cảnh báo chiếm trọn màn hình đầu; không hiển thị "thực nhận" — khách phải tự tính %; không có tra cứu đơn trên trang chủ.

### 1.2 thesieure.com
- **Bố cục:** y hệt doithe.vn (cùng khung template): cảnh báo → tab đổi thẻ → bảng phí → link Teamobi/API.
- **Bảng phí:** nhóm "Thành viên" và "100 giao dịch/tháng" (đặt tên nhóm theo sản lượng thay vì "Đại lý"). Viettel thành viên cao hơn doithe (10k 22,5%, 100k 15,5%).
- **Điểm khác nhỏ:** có thông báo Telegram, link tài liệu API gạch thẻ cho shop.
- **Điểm dở:** trùng lặp gần như toàn bộ với doithe.vn — khách không có lý do nhớ tên miền nào; chữ dày, không điểm nhấn thị giác.

### 1.3 gachthe.vn (Vie Star)
- **Bố cục:** cùng template trên; dưới bảng phí có thêm đoạn giới thiệu dịch vụ mua thẻ + khối "NẠP TOPUP & HÓA ĐƠN" (nạp trả trước/trả sau chiết khấu 3–7%).
- **Bảng phí:** nhóm Đối tác / Thành viên; Vinaphone rẻ hơn hẳn (100k chỉ 10,5%) — cho thấy mỗi nhà phân hoá theo nhà mạng mạnh của mình.
- **Điểm hay:** có tên công ty pháp nhân (CP Trực tuyến Vie Star) tạo chút tin cậy; nêu rõ thẻ trả ngay trên web + email.
- **Điểm dở:** vẫn là template chung; đoạn text SEO ở cuối trang dài và loãng.

### 1.4 cardvip.vn
- **Bố cục:** cùng template; điểm khác duy nhất đáng kể là khái niệm **"bảo hiểm sai mệnh giá"**: hai nhóm phí "Không bảo hiểm / Có bảo hiểm" (bảo hiểm đắt hơn ~0,5%, nhưng sai mệnh giá không bị trừ 50%).
- **Điểm hay:** biến nỗi đau lớn nhất của khách (sai mệnh giá bị phạt nặng) thành một sản phẩm/tính năng có tên riêng — đây là nỗ lực khác biệt hoá hiếm hoi trong nhóm.
- **Điểm dở:** giải thích bảo hiểm chỉ bằng 2 dòng chữ nhỏ trong khối cảnh báo; nếu không đọc kỹ sẽ không hiểu giá trị.

### 1.5 nappay.vn
- **Bố cục:** vẫn template chung (cảnh báo → tab đổi thẻ → bảng phí), nhưng dày thêm tiện ích: xem sản lượng, Telegram, "Tạo web con", tài liệu API (Postman), nạp USDT/Binance/ZaloPay, quảng cáo hosting/VPS cho đại lý dựng web con.
- **Bảng phí:** nhiều tầng nhóm nhất thị trường: Thành viên / Thành viên VIP / Đối tác / Api VIP–Web con / Api Platinum — chiết khấu giảm dần theo tầng. Đây là site duy nhất trình bày **thang cấp bậc** rõ trong bảng phí.
- **Form/ngoại lệ:** yêu cầu xác thực SĐT để nâng hạn mức cho tài khoản chưa xác minh.
- **Điểm hay:** hướng rõ tới hệ sinh thái đại lý/API (web con, tài liệu API, thống kê sản lượng) — phục vụ khách B2B tốt hơn các site còn lại.
- **Điểm dở:** trang chủ quá tải thông tin, quảng cáo dịch vụ ngoài (hosting) làm loãng; phí Viettel thuộc nhóm cao (100k 18%).

---

## 2. Nhóm nạp game / sản phẩm số

### 2.1 Codashop (codashop.com/vn)
- **Bố cục:** trang chủ dạng cổng danh mục: lưới logo game → vào từng game là **một trang nạp duy nhất, tuyến tính**: ① nhập ID người chơi → ② chọn gói (lưới thẻ mệnh giá, giá ₫ rõ) → ③ chọn phương thức thanh toán → Mua ngay. Không cần đăng ký/đăng nhập.
- **Điểm nhấn thị giác:** mỗi game một banner/hero riêng; khối USP có icon riêng: "Thuận tiện và nhanh chóng", "Nhận sản phẩm tức thì", "Nhiều phương thức thanh toán", "Hỗ trợ khách hàng", "Nhiều khuyến mãi".
- **Typography/cảm giác:** sans-serif hiện đại, khoảng trắng rộng, mỗi bước đánh số rõ — cảm giác "sản phẩm quốc tế" khác hẳn nhóm đổi thẻ.
- **Điểm hay đáng học nhất:** (a) luồng 3 bước đánh số, không rẽ nhánh; (b) giá hiển thị bằng tiền thật trên từng gói, không bắt khách tính %; (c) không bắt đăng nhập — giảm ma sát tối đa; (d) USP đặt thành hàng icon ngay trang chủ.
- **Điểm dở đối với SunCard:** mô hình "mỗi game một trang" không có khái niệm ví/đại lý — không bê nguyên được, chỉ học cách trình bày.

### 2.2 UniPin (unipin.com)
- **Bố cục:** banner promo carousel lớn trên cùng (chiến dịch 11.11, cashback) → lưới game theo nhóm (Game Mobile / Game PC / Voucher / Game địa phương / Giải trí) kèm giá từ (starting price) → mục Promo & Sự kiện dạng tin tức → khối "Keunggulan" (ưu điểm) → FAQ dài.
- **Điểm hay:** hệ thống **điểm thưởng + promo theo chiến dịch** tạo lý do quay lại; giá "từ X" trên thẻ game giúp quét nhanh; phân nhóm danh mục rõ.
- **Điểm dở:** trang chủ thiên về khuyến mãi, phần nạp thật bị đẩy xuống dưới; FAQ chiếm rất nhiều diện tích; bản VN dùng chung khung quốc tế nên hơi "xa" với thói quen khách Việt (không có ví, không có đại lý).

### 2.3 Divine Shop (divineshop.vn)
- **Bố cục:** trang chủ kiểu sàn thương mại điện tử: thanh tìm kiếm lớn → banner → "Sản phẩm nổi bật" → "Từ khóa nổi bật" → **chip lọc theo mức giá** (20k/50k/100k/200k/500k/1tr) → lưới sản phẩm theo thương hiệu (Kaspersky, Monkey, Việt Map, Bitdefender…) → "Sản phẩm mới" → khối mời đăng ký tài khoản + hotline 1900.
- **Điểm hay:** tìm kiếm là nhân vật chính (đúng hành vi mua sản phẩm số có tên cụ thể); chip giá giúp lọc theo túi tiền; hotline hiển thị cố định tạo tin cậy; giao hàng tự động qua email là thông điệp lặp lại khắp nơi.
- **Điểm dở:** không liên quan tới đổi thẻ (không có ví gạch thẻ); trang chủ dài kiểu marketplace, khách mua nhanh phải cuộn nhiều.

### 2.4 napthe.vn — Trung tâm nạp thẻ Garena
- **Bố cục:** một trang nạp duy nhất theo bước đánh số: ① Đăng nhập / ID người chơi → ② chọn mệnh giá (thẻ lưới, hiện kèm số Sò nhận được, ví dụ 100.000₫ → 204 Sò) → ③ phương thức thanh toán (ShopeePay, Sò Garena, QR Pay, ATM/iBanking, thẻ quốc tế) kèm nhãn "Hot".
- **Điểm hay:** **quy đổi hiển thị song song**: mỗi mệnh giá tiền đi kèm lượng đơn vị game nhận được — khách không phải tự tính; banner "Gói nạp đặc biệt" có đếm ngược thời gian theo sự kiện.
- **Điểm dở:** chỉ phục vụ một hệ sinh thái (Garena); giao diện utilitarian, không có yếu tố thương hiệu mạnh.

---

## 3. Quy ước thị trường khách đã quen — PHẢI GIỮ

1. **Trang chủ là trang đổi thẻ.** Khách vào là thấy form ngay, không qua landing giới thiệu. Thứ tự quen thuộc: cảnh báo ngắn → form → bảng phí.
2. **Form luôn gồm 4 trường:** loại thẻ (tab/select theo nhà mạng), serial, mã thẻ (PIN), mệnh giá khai báo. Đổi 1 thẻ / đổi nhiều thẻ là 2 tab quen thuộc.
3. **Bảng phí dạng tab theo nhà mạng**, cột = mệnh giá, hàng = nhóm người dùng (Thành viên / Đại lý / API). Khách so giá giữa các site bằng đúng bảng này — bỏ đi hoặc giấu sẽ mất khách.
4. **Hai cảnh báo bắt buộc phải có mặt trước khi gửi:** sai serial không hỗ trợ khiếu nại; sai mệnh giá bị trừ 50% mệnh giá nhỏ hơn (trừ khi có cơ chế khác thay thế rõ ràng).
5. **Cấm thẻ nguồn gốc bất hợp pháp** (ví trả sau, Visa/tín dụng, game bài/tài xỉu) — khối cảnh báo này là "luật bất thành văn", thiếu nó khách lại thấy thiếu tin cậy.
6. **Nhóm phí theo cấp bậc** (thành viên → đại lý → API/đối tác): khách gạch thẻ chuyên nghiệp kỳ vọng sản lượng cao được phí tốt hơn, và muốn *nhìn thấy* thang đó.
7. **Hỗ trợ qua Zalo/Facebook/Telegram + link lịch sử & thống kê** đặt ngay đầu trang — kênh liên lạc quen thuộc của thị trường này.
8. **Với nạp game:** luồng đánh số bước (ID → gói → thanh toán), **hiển thị số nhận được cạnh mệnh giá**, không bắt đăng nhập mới cho nạp (Codashop/Garena là chuẩn tâm lý).

## 4. Khoảng trống khác biệt SunCard có thể chiếm

Cả thị trường đang trống những vị trí sau — SunCard chiếm được vị trí nào cũng tạo bản sắc riêng mà không phá quy ước ở mục 3:

1. **"Thực nhận" tính sẵn, trực tiếp trong form.** 100% site đối thủ chỉ hiện % phí và bắt khách tự tính. SunCard có thể hiện ngay trong form khi chọn mệnh giá: *"Phí 14,5% → Bạn thực nhận 85.500₫"* và trong bảng phí thêm cột thực nhận. Đây là khác biệt nhỏ về công sức, lớn về cảm giác minh bạch.
2. **Tra cứu trạng thái đơn ngay trên trang chủ.** Đối thủ bắt load lại trang/đăng nhập xem lịch sử. Một ô "nhập mã đơn → trạng thái" (kiểu tra cứu vận đơn) ngay dưới form là tiện ích chưa ai làm ở trang chủ.
3. **Bản sắc thị giác riêng.** Toàn bộ đối thủ dùng template xanh/trắng + chữ đỏ cảnh báo, không site nào có hệ màu/nhận diện riêng. Cái tên "SunCard" chứa sẵn một tài sản chưa ai khai thác: **mặt trời / bình minh (cam–vàng)** — khác hẳn biển xanh fintech chung. Đây là khoảng trống nhận diện lớn nhất.
4. **Biến "bảo hiểm sai mệnh giá" thành tính năng có tên + giải thích tử tế.** cardvip.vn đã chứng minh nhu cầu nhưng trình bày rất kém (2 dòng chữ nhỏ). SunCard có thể đặt tên riêng (ví dụ "SunShield — bảo vệ sai mệnh giá"), có toggle trong form và giải thích 1 câu rõ ràng.
5. **Dải số liệu tin cậy thay cho tường chữ cảnh báo.** Đối thủ "doạ" khách bằng khối chữ đỏ dài. SunCard có thể rút cảnh báo còn 2 dòng gọn và thay phần diện tích đó bằng số liệu sống: đơn đã xử lý, thời gian xử lý trung bình, số nhà mạng hỗ trợ, tỉ lệ đúng mệnh giá — học Codashop (USP có icon) và phong cách fintech.
6. **Một trang chủ gộp 3 nghiệp vụ nhưng đổi thẻ là nhân vật chính.** Đối thủ đổi thẻ giấu nạp game/mua thẻ ở link phụ rời rạc; Codashop/Divine lại không có đổi thẻ. SunCard có sẵn cả 3 (đổi thẻ, nạp game, mua thẻ) + đại lý — trình bày dạng "một ví, ba dịch vụ" với 3 thẻ dịch vụ rõ dưới form là cấu trúc chưa site nào có.
7. **Typography và khoảng trắng hiện đại.** Đối thủ dùng chữ nhỏ, dày, sát nhau. Chỉ cần tăng cỡ chữ, khoảng trắng và bo góc nhất quán (phong cách Codashop/Divine) là SunCard đã "trông đắt hơn" cả thị trường mà không cần đổi tính năng.

## 5. Gợi ý định hướng cho mockup

- Giữ khung quy ước: header menu → cảnh báo gọn → form đổi thẻ (kèm thực nhận) → tra cứu đơn → bảng phí tab nhà mạng → 3 thẻ dịch vụ → footer.
- Khác biệt nằm ở: hệ màu/nhận diện (bình minh / navy fintech / dark premium), cách trình bày form (panel nổi bật), dải số liệu tin cậy, và dòng thực nhận trong form.
