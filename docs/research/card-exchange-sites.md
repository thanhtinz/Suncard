# Nghiên cứu web gạch thẻ / đổi thẻ cào Việt Nam — tài liệu tham chiếu cho SunCard

> Ngày khảo sát: 06/11/2026 (giờ New York) / 07/11/2026 (giờ VN).
> Phương pháp: chỉ đọc trang công khai (trang chủ, bảng phí hiển thị công khai, trang tài
> liệu API/Postman công khai) bằng công cụ đọc web. Không đăng ký, không đăng nhập,
> không gửi form, không gửi thẻ thật lên bất kỳ site nào.
> Mọi con số dưới đây đều lấy từ trang thật đã đọc, có ghi URL nguồn ở từng mục.
> Mục nào không đọc được ghi rõ "không lấy được" — không suy đoán.

---

## 0. Kết luận nhanh

Nhận xét "đa phần các web gạch thẻ dùng tài liệu như nhau" là **đúng và chứng minh được**:

1. **Cùng một giao diện/mẫu trang chủ**: doithe.vn, thesieure.com, gachthe.vn, cardvip.vn
   dùng cùng bố cục: cảnh báo nguồn thẻ → form "Đổi thẻ cào / Đổi nhiều thẻ" → "Bảng phí
   đổi thẻ cào" dạng tab theo nhà mạng, cột mệnh giá giống hệt nhau, dòng nhóm người dùng
   (Thành viên / Đại lý / Đối tác…) chỉ khác tên gọi và số % một chút.
2. **Cùng một hợp đồng API**: endpoint `/chargingws/v2`, hai lệnh `charging` / `check`,
   cùng bộ field, cùng bảng status 99/1/2/3, cùng `callback_sign = md5(partner_key + code
   + serial)`. Tài liệu của apidoithe.com, naptudong.com, ppay.vn, telcovn.com và bộ
   "CARD PARTNER API" trên Postman gần như chép cùng một văn bản (thậm chí cùng ví dụ
   `request_id=989876`, cùng mã thẻ ví dụ `314688440422676`).
3. **Số liệu phí cũng trùng**: hàng "Thành viên" của doithe.vn và thesieure.com **giống
   hệt từng con số** ở bảng Viettel; hàng "Đại lý (SL 50M)" của doithe.vn trùng hệt hàng
   "100 giao dịch/tháng" của thesieure.com. Khả năng cao các site này dùng chung một
   upstream/template hoặc đồng bộ phí từ cùng một nguồn.

Ngoại lệ đáng kể: doithegiatot.com dùng API kiểu khác hẳn (ApiKey + REST `/api/card`,
loại thẻ bằng ID số) và Nappay.vn viết lại tài liệu theo hướng "merchant" hiện đại hơn
(nhưng vẫn giữ nguyên lõi chargingws/v2).

---

## 1. Các site đã khảo sát

| Site | Vào được? | Nội dung lấy được | URL đã đọc |
|---|---|---|---|
| Nappay (docs) | Có — tài liệu API đầy đủ nhất | Charging v2, Recharge, Softcard, bảng status/mã lỗi | https://docs.nappay.vn/ |
| Nappay (storefront mẫu) | Có (qua kết quả tìm kiếm) | Bảng phí Viettel 3 nhóm: Thành viên / Đại lý / Webcon-API | https://lrv.nappay.vn/doithecao |
| doithe.vn | Có | Bảng phí 7 loại thẻ, quy định phạt sai mệnh giá, tính năng bề mặt | https://doithe.vn/ |
| thesieure.com | Có | Bảng phí 8 loại thẻ, tính năng bề mặt, link tài liệu API | https://thesieure.com/ |
| gachthe.vn | Có (Cty CP Trực tuyến Vie Star) | Bảng phí 7 loại thẻ, topup 3–7%, mua thẻ | https://gachthe.vn/ |
| cardvip.vn | Có | Bảng phí 7 loại thẻ + cơ chế "bảo hiểm" sai mệnh giá | https://cardvip.vn/ |
| apidoithe.com | Có — qua tài liệu Postman công khai | Tài liệu API chargingws/v2 đầy đủ | https://documenter.gw.postman.com/api/collections/5472976/2s8YzQV3Ua |
| "CARD PARTNER API" (Postman) | Có | Tài liệu đổi thẻ + mua thẻ, ví dụ request/callback | http://documenter.getpostman.com/view/5740908/TVYJ5Ggr |
| Telcovn.com | Có — qua tài liệu Postman công khai | API + bảng status + endpoint lấy giá | https://documenter.gw.postman.com/api/collections/11751107/Szzn6GKJ |
| TheSieuRe (tài liệu tích hợp) | Có — qua Postman công khai + thư viện mã nguồn mở | Endpoint, callback, sign | https://documenter.gw.postman.com/api/collections/17343942/U16etnTH ; https://deepwiki.com/minevn/dotman/4.2-payment-providers |
| naptudong.com / ppay.vn | Có — trang hướng dẫn API V2 (cùng một văn bản) | Status, callback mẫu | https://api.naptudong.com/news/instructions-for-integrating-api-to-change-cards-in-english.html ; https://ppay.vn/news/instructions-for-integrating-api-to-change-cards-in-english |
| doithegiatot.com | Có — qua PDF hướng dẫn tích hợp API | API kiểu ApiKey (khác chuẩn chung) | https://doithegiatot.com/Data/files/Hướng%20dẫn%20tích%20hợp%20API%20doithegiatot_com%20(1).pdf (đọc qua trích xuất tìm kiếm) |
| doithe1s.vn | Vào được nhưng chỉ còn trang thông báo | Đã chuyển sang tên miền **Pay1s.com**; cảnh báo doithe1s.com.vn / doithe1s.net là giả mạo | https://doithe1s.vn/ |
| napthe.vn | Vào được nhưng **không phải web đổi thẻ** | Hiện là "Trung tâm nạp thẻ Garena" chính hãng (nạp Sò bằng ShopeePay/QR/ATM/thẻ tín dụng) — khác loại hình, không dùng làm mẫu gạch thẻ | https://napthe.vn/ |
| doithecao.vn | **Không lấy được** | Công cụ đọc web không fetch được trang (không kết luận site còn sống hay đã chết) | — |
| muathe.vn | **Không lấy được** | Công cụ đọc web không fetch được trang (như trên) | — |
| doithe5s.vn | **Không lấy được** | Công cụ đọc web không fetch được trang (như trên) | — |

---

## 2. API gạch thẻ — chuẩn chung

### 2.1 Endpoint và lệnh

| Hạng mục | Chuẩn chung | Nguồn |
|---|---|---|
| Endpoint gửi thẻ | `POST https://<domain>/chargingws/v2` (nhiều site ghi chấp nhận cả GET và POST) | docs.nappay.vn; apidoithe; CARD PARTNER API |
| Method / dữ liệu | POST khuyến nghị; `application/x-www-form-urlencoded` hoặc `JSON` | docs.nappay.vn |
| Lệnh | `command=charging` (gửi thẻ), `command=check` (tra trạng thái bằng lại đúng `request_id` đã gửi) | Tất cả tài liệu |
| Endpoint biểu phí | `GET /chargingws/v2/getfee?partner_id=<id>` | docs.nappay.vn; CARD PARTNER API |
| Biến thể endpoint phí đã gặp | `/chargingws/price?partner_id=` (Telcovn), `/api/discount?partner_id=` (apidoithe) | Postman Telcovn; Postman apidoithe |
| Điều kiện | Có `partner_id` + `partner_key` cấp ở khu vực Merchant/API; một số site hỗ trợ **IP whitelist**; `request_id` phải **duy nhất theo partner_id** | docs.nappay.vn |

Ví dụ endpoint thật theo từng nhà: `https://nappay.vn/chargingws/v2`,
`https://thesieure.com/chargingws/v2`, `https://apidoithe.com/chargingws/v2`,
`https://ppay.vn/chargingws/v2`, `https://naptudong.com/chargingws/v2`,
`https://telcovn.com/chargingws/v2`.

### 2.2 Field của request `charging`

| Field | Bắt buộc | Ý nghĩa (theo tài liệu) |
|---|---|---|
| `command` | Có | `charging` hoặc `check` |
| `partner_id` | Có | Mã đối tác/merchant được cấp |
| `request_id` | Có | ID giao dịch phía đối tác tự sinh, không được trùng — dùng để đối soát và nhận callback |
| `telco` | Có | Mã nhà mạng viết hoa (xem mục 3) |
| `amount` | Có | Mệnh giá đối tác **khai báo** |
| `serial` | Có | Số serial của thẻ |
| `code` | Có | Mã thẻ / PIN dưới lớp cào |
| `sign` | Có | Chữ ký MD5 (xem 2.3) |

Với `check`: chỉ bắt buộc `command`, `partner_id`, `request_id`, `sign`
(`telco/serial/code` không bắt buộc, có thể truyền thêm để tương thích ngược).
Nguồn: https://docs.nappay.vn/ (mục 04, 05); CARD PARTNER API (Postman).

### 2.3 Công thức chữ ký `sign` — có 2 thế hệ cùng tồn tại

**Thế hệ legacy (phổ biến nhất, gần như mọi tài liệu đều có):**

```
sign = md5(partner_key + code + serial)
```

Nguồn: CARD PARTNER API (Postman), apidoithe.com, tài liệu tích hợp TheSieuRe,
thư viện tích hợp mã nguồn mở (Card2K/TheSieuRe đều dùng `md5(partnerKey + pin + seri)`).

**Thế hệ mở rộng (Nappay khuyến nghị dùng, Telcovn cũng dùng cho lệnh check):**

```
sign(charging) = md5(partner_key + code + command + partner_id + request_id + serial + telco)
sign(check)    = md5(partner_key + command + partner_id + request_id)
```

Nappay vẫn chấp nhận công thức legacy "để tương thích ngược với client legacy".
Nguồn: https://docs.nappay.vn/ (mục 03); Postman Telcovn.

**Chữ ký callback — mọi site thống nhất:**

```
callback_sign = md5(partner_key + code + serial)
```

### 2.4 Response và callback

Response JSON (cả trả trực tiếp và nội dung callback) gồm:

| Field | Ý nghĩa |
|---|---|
| `trans_id` | ID giao dịch phía hệ thống gạch thẻ |
| `request_id` | ID giao dịch phía đối tác gửi sang |
| `status` | Trạng thái thẻ / mã lỗi (bảng 2.5) |
| `message` | Mô tả trạng thái/lỗi |
| `value` | Mệnh giá **thật** xác nhận được sau xử lý |
| `declared_value` | Mệnh giá đối tác khai báo lúc gửi |
| `amount` | Số tiền thực nhận về ví sau chiết khấu (và sau phạt nếu sai mệnh giá) |
| `telco`, `serial`, `code` | Thông tin thẻ |
| `callback_sign` | `md5(partner_key + code + serial)` để phía nhận kiểm chứng |

Callback: hệ thống gọi về URL đối tác đã cấu hình ở mục Kết nối API, bằng **POST hoặc
GET** (tùy cấu hình), dữ liệu dạng JSON hoặc query string cùng các field trên.
Nguồn: https://docs.nappay.vn/ (mục 07, 08); naptudong/ppay (mục CALL BACK);
Postman Telcovn (ví dụ callback dạng query string).

⚠️ **Không nhất quán cần lưu ý khi tích hợp**: một số tài liệu/ví dụ callback dùng tên
field `seri` thay vì `serial` (ví dụ callback TheSieuRe trong bộ tích hợp PHP công khai
dùng `seri`; naptudong dùng `serial`). Bên nhận callback nên chấp nhận cả hai.

### 2.5 Bảng status của thẻ (lõi chung)

| Status | Ý nghĩa | Nguồn |
|---|---|---|
| **99** | PENDING — thẻ đã gửi thành công, đang chờ xử lý | Mọi tài liệu |
| **1** | Thành công **đúng mệnh giá** | Mọi tài liệu |
| **2** | Thành công nhưng **sai mệnh giá** khai báo (tính theo mệnh giá thật) | Mọi tài liệu |
| **3** | Thẻ lỗi / thẻ không dùng được / thẻ sai hoặc đã sử dụng | Mọi tài liệu (Telcovn ghi rõ "incorrect or used") |
| **4** | MAINTENANCE — nhà mạng/cổng đang bảo trì | Chỉ thấy ở docs.nappay.vn (mở rộng của Nappay) |

Ngay khi gửi thẻ, response tức thời thường là `status=99, message="Thẻ đã gửi thành
công và đang chờ xử lý"`; kết quả cuối cùng (1/2/3) đến qua **callback** hoặc gọi
`command=check`. Response gửi thẻ bị từ chối ngay (trùng thẻ, sai định dạng…) trả các
status khác kèm `message` mô tả — ví dụ apidoithe: thẻ/serial đã tồn tại và đang ở
trạng thái failed thì báo lại trong `message`.

### 2.6 Mã lỗi ở mức request (không phải trạng thái thẻ)

Nappay công bố rõ nhất (https://docs.nappay.vn/ mục 10):

| Mã | Ý nghĩa |
|---|---|
| 100 | Lỗi xử lý chung / không tạo được giao dịch |
| 101 | Không tìm thấy giao dịch khi gọi `check` |
| 102 | Sai xác thực: sai sign, sai IP, dữ liệu đầu vào không hợp lệ (ví dụ response lỗi trả `status=102, message="Dữ liệu xác thực không hợp lệ hoặc chữ ký sign sai."`) |
| 103 | Ngoại lệ trong quá trình xử lý request |
| 104 | `command` không hợp lệ (chỉ hỗ trợ `charging`, `check`) |

Hai module API phụ của Nappay dùng thêm các mã: 109 = `request_id` đã tồn tại,
114 = IP không nằm whitelist, 116 = sai chữ ký, 118 = hết hàng, 129 = đơn không tồn
tại, 130 = lỗi lấy thẻ từ nguồn (module mua thẻ); module nạp dịch vụ dùng status dạng
chuỗi (`wrong_signature`, `product_not_found`, `payment_fail`, `order_not_found`…).
Xem mục 6.

### 2.7 API biểu phí `getfee`

`GET /chargingws/v2/getfee?partner_id=<id>` trả về danh sách theo từng telco/mệnh giá
gồm các trường `telco`, `value`, `fees` (phí %) và `penalty` (mức phạt sai mệnh giá).
Đây là cách các web con/đối tác **đồng bộ bảng phí tự động** thay vì nhập tay — ví dụ
một site tích hợp TheSieuRe ghi rõ "Bảng tỷ giá trực tiếp TheSieuRe.com — tự động đồng
bộ từ API `chargingws/v2/getfee`" (https://mmosoft.me/).

---

## 3. Nhà mạng / loại thẻ và mệnh giá chuẩn

### 3.1 Mã telco trong API

| Mã | Loại thẻ | Ghi chú nguồn |
|---|---|---|
| `VIETTEL` | Viettel | Có ở mọi tài liệu |
| `MOBIFONE` | Mobifone | Có ở mọi tài liệu |
| `VINAPHONE` | Vinaphone | Có ở mọi tài liệu |
| `VNMOBI` | Vietnamobile | apidoithe ghi `VNMOBI`; storefront ghi "Vietnamobile"/"Vietnammobi" |
| `ZING` | Thẻ Zing (Zing Xu) | apidoithe + mọi storefront |
| `GATE` | Thẻ Gate (FPT) | apidoithe + cardvip.vn |
| `GARENA` | Thẻ Garena | Các storefront (tab bảng phí); tài liệu apidoithe không liệt kê ở phần telco nhưng có ở các bộ tích hợp khác |
| `VCOIN` | Vcoin (VTC) | Các storefront (tab bảng phí) |
| `SCOIN` | Scoin | Chỉ thấy ở thesieure.com |

Tập telco trong tài liệu chargingws/v2 của apidoithe: `VIETTEL, MOBIFONE, VINAPHONE,
VNMOBI, ZING, GATE`. Tài liệu Telcovn chỉ nhận 3 mạng di động: `VIETTEL, VINAPHONE,
MOBIFONE`. doithegiatot dùng ID số thay cho mã chữ: 1=Viettel, 2=MobiFone, 3=VinaPhone,
4=Vcoin-VTC Game, 6=Garena (chậm), 14=Zing, 15=Gate, 16=Vietnamobile, 23=… (danh sách
bị cắt ở nguồn trích xuất — phần sau số 23 **không lấy được**).

### 3.2 Mệnh giá chuẩn theo loại thẻ (rút từ chính các bảng phí công khai)

| Loại thẻ | Mệnh giá (VNĐ) |
|---|---|
| Viettel | 10.000, 20.000, 30.000, 50.000, 100.000, 200.000, 300.000, 500.000, 1.000.000 |
| Vinaphone | 10.000, 20.000, 30.000, 50.000, 100.000, 200.000, 300.000, 500.000 |
| Mobifone | 10.000, 20.000, 30.000, 50.000, 100.000, 200.000, 300.000, 500.000 |
| Vietnamobile | 10.000, 20.000, 30.000, 50.000, 100.000, 200.000, 300.000, 500.000 |
| Zing | 10.000, 20.000, 50.000, 100.000, 200.000, 500.000, 1.000.000 (không có 30.000/300.000) |
| Garena | **5.000**, 10.000, 20.000, 50.000, 100.000, 200.000, 500.000 (có mệnh giá 5.000) |
| Vcoin | 10.000, 20.000, 50.000, 100.000, 200.000, 300.000, 500.000, 1.000.000, 2.000.000, 5.000.000, 10.000.000 |
| Gate | 10.000 … 10.000.000 (theo bảng cardvip.vn: 10k, 20k, 50k, 100k, 200k, 300k, 500k, 1M, 2M, 5M, 10M) |
| Scoin | 10.000 … 5.000.000 (theo bảng thesieure.com) |

Telcovn công bố tập mệnh giá khai báo hợp lệ: `10000, 20000, 50000, 100000, 200000,
300000, 500000, 1000000`.

---

## 4. Bảng phí / chiết khấu

### 4.1 Cấu trúc bảng (giống nhau ở mọi storefront)

- Bảng tách **theo tab nhà mạng/loại thẻ**; cột là **mệnh giá**; hàng là **nhóm người
  dùng** (cấp tài khoản). Số trong bảng là **% phí bị trừ** (không phải % nhận).
- Nhóm người dùng điển hình: `Thành viên` (mặc định) → nhóm tốt hơn theo sản lượng:
  `Đại lý (SL 50M)` (doithe), `100 giao dịch/tháng` (thesieure), `Đối tác` (gachthe),
  `Webcon/Api` (nappay). Nhóm càng cao phí càng thấp, chênh nhau khoảng 0,1–1 điểm %.
- Mẫu số liệu đầy đủ được máy gạch thẻ trả qua API `getfee` (mục 2.7) gồm cả trường
  `penalty` — tức cấu trúc dữ liệu gốc là: **telco × mệnh giá × nhóm → fees% + penalty%**.

### 4.2 Số liệu thật — bảng Viettel, hàng Thành viên (để đối chiếu chéo)

| Mệnh giá | doithe.vn | thesieure.com | gachthe.vn | cardvip.vn (không bảo hiểm) | nappay storefront |
|---|---|---|---|---|---|
| 10.000 | 20,5% | 20,5% | 21% | 19,5% | 17% |
| 20.000 | 20,5% | 20,5% | 21% | 19,5% | 17% |
| 30.000 | 20,5% | 20,5% | 21% | 19,5% | 17% |
| 50.000 | 15,5% | 15,5% | 15,5% | 16% | 14,2% |
| 100.000 | 14,5% | 14,5% | 15,5% | 15% | 14,2% |
| 200.000 | 14,5% | 14,5% | 15,5% | 15% | 14,2% |
| 300.000 | 14,5% | 14,5% | 15,5% | 15% | 14,2% |
| 500.000 | 17,5% | 17,5% | 16,5% | 17% | 15% |
| 1.000.000 | 17,5% | 17,5% | 16,5% | 17% | 15% |

Nguồn: trang chủ từng site (URL ở mục 1). Hàng nhóm tốt hơn của doithe ("Đại lý SL
50M": 20/20/20/15/14/14/14/17/17) **trùng hệt** hàng "100 giao dịch/tháng" của
thesieure; hàng Thành viên của hai site trùng hệt nhau — bằng chứng mạnh nhất cho
việc dùng chung nguồn phí/template. Nappay thấp nhất (có thêm nhóm Webcon/API: Viettel
15,2% ở mệnh giá nhỏ, 13,1% ở 50k–300k, 13,7% ở 500k–1M).

### 4.3 Khoảng phí điển hình theo loại thẻ (hàng Thành viên, gộp các site đã đọc)

| Loại thẻ | Khoảng phí điển hình | Nhận xét |
|---|---|---|
| Viettel | 14,2–21% | Mệnh giá 50k–300k rẻ nhất (~14–15,5%); 10k–30k đắt nhất (~17–21%); 500k–1M nhích lên (~15–17,5%) |
| Vinaphone | 9–19% | Rẻ nhất trong các mạng di động ở cardvip (9–15%); các site khác 11–19% |
| Mobifone | 16,5–19,5% | Thường phẳng theo mệnh giá (gachthe 17,5% phẳng; cardvip 16,5% phẳng) |
| Vietnamobile | **37–39%** | Ngoại lệ đắt vượt trội ở **mọi** site — gần như gấp đôi Viettel |
| Zing | 13–15% | Tương đối rẻ và phẳng |
| Garena | 13,5–15,5% | Rẻ, phẳng |
| Vcoin | 14–20% | Mệnh giá càng lớn phí càng tăng ở thesieure (16% → 20% ở 10M); cardvip ngược lại, 2M/5M giảm còn 14% |
| Gate | 17,5–18,5% | Theo cardvip.vn |
| Scoin | 26–27% | Theo thesieure.com |

### 4.4 Phí/phạt khi khai sai mệnh giá

- Quy định chung (doithe.vn, gachthe.vn ghi ngay trên form): **"Điền sai giá trị thẻ
  sẽ bị trừ đi 50% số tiền của mệnh giá nhỏ hơn"** — tức thẻ vẫn được duyệt theo mệnh
  giá thật (status=2), tiền nhận = mệnh giá thật trừ chiết khấu, rồi **trừ thêm 50%**
  (phạt tính trên mệnh giá nhỏ hơn giữa khai báo và mệnh giá thật).
- thesieure (qua site tích hợp mmosoft.me): "Sai mệnh giá bị nhà mạng phạt 50%" và ví
  dụ thẻ Viettel 50.000đ chiết khấu 15,5% → thực nhận 84,5% khi đúng mệnh giá.
- cardvip.vn biến điều này thành sản phẩm **"bảo hiểm"**: nhóm **có bảo hiểm** (phí
  cao hơn ~0,5 điểm %) thì khi sai mệnh giá chỉ tính theo mệnh giá nhỏ × chiết khấu
  của mệnh giá đó, **không bị trừ 50%**; nhóm **không bảo hiểm** bị trừ 50% mệnh giá
  nhỏ như thông lệ. Nguồn: https://cardvip.vn/
- Trường `penalty` trong response `getfee` của Nappay cho thấy mức phạt là **dữ liệu
  cấu hình theo telco/mệnh giá**, không phải hằng số cứng toàn hệ thống.

### 4.5 Phí mua thẻ / nạp điện thoại (bề mặt bán lẻ)

- gachthe.vn: nạp topup trả trước/trả sau Viettel/Vina/Mobi/Vietnamobile **chiết khấu
  3–7%**; mua thẻ trả mã ngay trên web + gửi email, thanh toán bằng ví điện tử, ngân
  hàng VN, Visa/Master.
- Các site còn lại đều có mục mua thẻ/topup nhưng **không lấy được** bảng giá mua thẻ
  chi tiết từ trang đã đọc (chỉ thấy thông báo quy trình: "Mua thẻ thông báo Chờ xử lý
  tức là giao dịch thất bại, hệ thống sẽ hoàn lại tiền").

---

## 5. Tính năng bề mặt chung

| Tính năng | doithe.vn | thesieure.com | gachthe.vn | cardvip.vn | nappay.vn |
|---|---|---|---|---|---|
| Form gạch 1 thẻ ngay trang chủ (chọn telco, mệnh giá, serial, mã thẻ) | Có | Có | Có | Có | Có (hướng merchant) |
| Gạch **nhiều thẻ** cùng lúc | Có — yêu cầu tài khoản số dư > 50.000đ | Có — điều kiện giống hệt | Có — điều kiện giống hệt | Có — điều kiện giống hệt | Không thấy ở docs |
| Tra cứu/lịch sử + thống kê gạch thẻ | Có (link "Lịch sử", "Thống kê") | Có (+ thông báo Telegram) | Có | Có ("Thống kê sản lượng") | Có — qua `command=check` |
| Mua mã thẻ điện thoại/game | Có | Có | Có (trả mã ngay + email) | Có | Có — API Softcard riêng |
| Nạp điện thoại / topup game | Có (Carot/Teamobi, topup game) | Có (topup ĐT, game Teamobi, data) | Có (topup 3–7%, hóa đơn) | Không lấy được | Có — API Recharge riêng |
| Cấp/nhóm người dùng theo sản lượng | Thành viên / Đại lý (SL 50M) | Thành viên / 100 GD-tháng | Đối tác / Thành viên | Nhóm bảo hiểm / không bảo hiểm | Thành viên / Đại lý / Webcon-API |
| API cho đối tác | Có — liên hệ fanpage, sản lượng 20M/ngày được nâng Đại lý | Có — tài liệu tích hợp riêng cho shop | Không lấy được từ trang chủ | Không lấy được từ trang chủ | Có — docs công khai đầy đủ |
| Rút tiền về ngân hàng/ví | **Không lấy được** chi tiết từ trang đã đọc | **Không lấy được** | **Không lấy được** | **Không lấy được** | **Không lấy được** |

Ghi chú về "gạch thẻ không cần đăng nhập": cả 4 storefront đều **hiển thị form gạch
thẻ công khai ngay trang chủ** và không thấy rào đăng nhập trước khi điền form trong
nội dung đã đọc; riêng gạch **nhiều thẻ** thì bắt buộc tài khoản có số dư trên
50.000đ. Việc submit thật có yêu cầu đăng nhập hay không **không kiểm chứng được**
(vì không gửi form theo phạm vi khảo sát) — ghi nhận ở mức "form công khai, điều kiện
đăng nhập khi gửi: không lấy được".

Các quy định bề mặt giống nhau đến từng câu chữ ở cả 4 storefront: cấm thẻ nguồn gốc
từ ví trả sau MoMo/Visa/thẻ tín dụng/game bài/tài xỉu/lừa đảo (phát hiện khóa vĩnh
viễn, không hoàn), điền sai serial thì khiếu nại không được xử lý, load lại trang để
cập nhật trạng thái thẻ.

---

## 6. Hai module API phụ (chỉ Nappay công bố đầy đủ — đáng tham khảo cho SunCard)

Nguồn: https://docs.nappay.vn/

**Recharge API** — `POST https://nappay.vn/api/rechargews`, lệnh `topup`, `getstatus`,
`getbalance`, `productlist`, `canceltopup`, `feetopup`. Sign:
`md5(partner_key + partner_id + command + request_id)` cho lệnh có request_id;
`md5(partner_key + partner_id + command)` cho lệnh không có. Request topup gồm
`service_code` (lấy từ productlist), `amount`, `account_info` dạng JSON (ví dụ
`{"phone":"..."}`). Response theo khung `{status, message, data}`.

**Softcard API (mua mã thẻ)** — `POST https://nappay.vn/api/cardws`, lệnh `buycard`,
`redownload`, `checkavailable`, `getbalance`; danh sách sản phẩm
`GET /api/cardws/products?partner_id=`. Sign cùng công thức Recharge. `buycard` gồm
`service_code` (ví dụ `VIETTEL`), `value`, `qty`, `wallet_number`; thành công trả
`status=1` và mảng `cards[{name, serial, code, expired}]`.

Điểm đáng chú ý: ở 2 module này công thức sign **khác** chargingws — thứ tự là
`partner_key + partner_id + command (+ request_id)`, không chứa code/serial/telco.

---

## 7. Điểm khác nhau đáng chú ý giữa các site

1. **doithegiatot.com là ngoại lệ lớn nhất**: API REST riêng — `POST
   https://doithegiatot.com/api/card` (JSON, xác thực bằng `ApiKey` duy nhất, loại thẻ
   bằng ID số), tra trạng thái bằng `GET /api/card/{TaskId}` hoặc theo `requestid`,
   lấy tỷ lệ bằng `GET /api/cardrate?apikey=`, kết quả trả qua GET hoặc WebHook.
   Không dùng họ chargingws/v2. (Nguồn: PDF hướng dẫn tích hợp của doithegiatot.)
2. **cardvip.vn** thêm cơ chế **bảo hiểm sai mệnh giá** thành 2 nhóm giá (mục 4.4) —
   không site nào khác trong nhóm khảo sát có.
3. **Nappay** là bên duy nhất viết tài liệu kiểu merchant hiện đại: tách 3 module API,
   có IP whitelist, mã lỗi request riêng (100–104), status 4 = bảo trì, và công thức
   sign mở rộng được "khuyến nghị" thay cho legacy — nhưng vẫn giữ tương thích legacy.
4. **thesieure.com** có thêm telco **Scoin** và nhóm theo số giao dịch/tháng; là upstream
   được nhiều web con/Minecraft server tích hợp (tài liệu + thư viện tích hợp công khai
   nhiều nhất).
5. **doithe1s.vn** đã bỏ tên miền, chuyển sang Pay1s.com và cảnh báo tên miền nhái —
   rủi ro thương hiệu/nhái tên là chuyện có thật trong ngành này.
6. **napthe.vn** không còn là web đổi thẻ: hiện là trung tâm nạp Garena chính hãng.
7. Cách gọi nhóm giá khác nhau (Đại lý/Đối tác/100 GD-tháng/Webcon-API) nhưng **cấu
   trúc 2–3 tầng giá và khoảng chênh 0,1–1 điểm %** là thống nhất.

---

## 8. Chuẩn chung rút ra cho SunCard

### 8.1 Hợp đồng API tương thích đề xuất (để web/đối tác cũ cắm vào là chạy)

Triển khai song song với Partner API `/v1` dùng HMAC của SunCard (theo BUILD_BRIEF),
thêm **một adapter tương thích chargingws** đặt ở module providers/compat:

- `POST /chargingws/v2` — chấp nhận cả GET, cả `application/x-www-form-urlencoded`
  lẫn JSON. Lệnh `charging` và `check`.
- Field giữ nguyên 1:1: `command, partner_id, request_id, telco, amount, serial,
  code, sign`. Nhận cả alias `seri` → `serial` (vì tài liệu ngoài đời không thống nhất).
- **Chấp nhận cả 2 công thức sign** khi verify (ghi cấu hình theo từng partner, mặc
  định thử extended trước, legacy sau):
  - extended: `md5(partner_key + code + command + partner_id + request_id + serial + telco)`
  - check: `md5(partner_key + command + partner_id + request_id)`
  - legacy: `md5(partner_key + code + serial)`
- `GET /chargingws/v2/getfee?partner_id=` — trả mảng `{telco, value, fees, penalty}`
  lấy từ `price_rules` của chính partner đó (đúng precedence giá của SunCard).
- Response/callback giữ nguyên field: `trans_id, request_id, status, message, value,
  declared_value, amount, telco, serial, code, callback_sign` với
  `callback_sign = md5(partner_key + code + serial)`. Callback cho phép cấu hình
  POST/GET theo từng partner, retry như webhook thường của SunCard.
- `partner_id`/`partner_key` ánh xạ vào `api_clients` hiện có của SunCard (key chỉ
  hiện 1 lần, lưu hash — như brief đã chốt); hỗ trợ IP whitelist theo client.
- Về sau có thể bổ sung 2 adapter tương tự cho mua thẻ/topup theo mẫu Nappay
  (`/api/cardws`, `/api/rechargews` với họ sign `partner_key + partner_id + command
  + request_id`) — chỉ làm khi có đối tác cần, không làm trước.

### 8.2 Bảng telco / mệnh giá chốt cho seed

| Mã telco | Tên hiển thị | Mệnh giá seed (VNĐ) |
|---|---|---|
| VIETTEL | Viettel | 10k, 20k, 30k, 50k, 100k, 200k, 300k, 500k, 1.000k |
| VINAPHONE | Vinaphone | 10k, 20k, 30k, 50k, 100k, 200k, 300k, 500k |
| MOBIFONE | Mobifone | 10k, 20k, 30k, 50k, 100k, 200k, 300k, 500k |
| VNMOBI | Vietnamobile | 10k, 20k, 30k, 50k, 100k, 200k, 300k, 500k |
| ZING | Zing | 10k, 20k, 50k, 100k, 200k, 500k, 1.000k |
| GARENA | Garena | 5k, 10k, 20k, 50k, 100k, 200k, 500k |
| VCOIN | Vcoin | 10k, 20k, 50k, 100k, 200k, 300k, 500k, 1.000k, 2.000k, 5.000k, 10.000k |
| GATE | Gate | 10k, 20k, 50k, 100k, 200k, 300k, 500k, 1.000k, 2.000k, 5.000k, 10.000k |
| SCOIN | Scoin | 10k, 20k, 50k, 100k, 200k, 300k, 500k, 1.000k, 2.000k, 5.000k (để tắt mặc định, bật khi có nguồn) |

### 8.3 Cấu trúc bảng phí chốt

- Lưu trong `price_rules` đúng mô hình dữ liệu gốc của ngành: **telco × mệnh giá ×
  nhóm người dùng → fees% + penalty%**, sửa được ở Admin (đúng luật "không hard-code
  cấu hình nghiệp vụ" của SunCard). Nhóm mặc định: Thành viên / Đại lý / API
  (tương ứng Member / Agent / Webcon-API ngoài thị trường).
- Giá trị seed khởi điểm đề xuất (lấy khoảng giữa các site đã khảo sát — **chỉ là số
  mẫu để chạy thử, phải thay bằng giá nguồn thật khi có hợp đồng provider**):

| Telco | Thành viên | Đại lý | API | Penalty sai mệnh giá |
|---|---|---|---|---|
| VIETTEL | 20,5% (10–30k) · 15,5% (50k) · 14,5% (100–300k) · 17,5% (500k–1M) | thấp hơn 0,5 điểm % | thấp hơn ~1–2 điểm % | 50% mệnh giá nhỏ hơn |
| VINAPHONE | 19% (10k) · 16% (20–30k) · 12% (50–300k) · 13% (500k) | −0,5–1 | −1–2 | 50% |
| MOBIFONE | ~18% phẳng (riêng 20k: 19%) | −0,5 | −1 | 50% |
| VNMOBI | 38% phẳng | 37% | — | 50% |
| ZING | 13% (10–20k) · 13% (50–500k) · 13,5% (1M) | −0,5 | −1 | 50% |
| GARENA | 14% phẳng | 13,5% | — | 50% |
| VCOIN | 15% (10–500k) · 16% (1M) · 17% (2M) · 19% (5M+) | −0,5–1 | −1 | 50% |
| GATE | 17,5% phẳng | −0,5 | — | 50% |

- Tính năng "bảo hiểm sai mệnh giá" của cardvip đáng học: một cờ `wrong_value_insured`
  theo nhóm giá — nhóm có bảo hiểm trả phí cao hơn ~0,5 điểm % và **không** bị áp
  penalty 50%. Đề xuất đưa thành option của pricing plan, không bật mặc định.

### 8.4 Ánh xạ status/callback → state machine của SunCard

State machine SunCard (BUILD_BRIEF): `CREATED → VALIDATING → RESERVED → SUBMITTING →
PENDING → PROCESSING → SUCCESS | FAILED | UNKNOWN | REVIEW | REFUND_PENDING →
REFUNDED | CANCELLED`.

| Status chargingws | Xử lý trong SunCard (khi SunCard là bên NHẬN thẻ từ đối tác) | Khi SunCard gọi provider ngoài (provider trả status này) |
|---|---|---|
| Response tức thời `99` khi gửi | Order → `PENDING` (đã qua `SUBMITTING`); trả ngay cho đối tác `status=99` | Order giữ `PENDING/PROCESSING`, **không** coi là thành công |
| Callback/check `1` (đúng mệnh giá) | `SUCCESS`; post ledger cộng `amount = value × (1 − fees%)` | `SUCCESS`; settle hold theo `value` |
| Callback/check `2` (sai mệnh giá) | `SUCCESS` với `value` = mệnh giá thật; `amount = value × (1 − fees% của mệnh giá thật) − penalty` (penalty mặc định 50% mệnh giá nhỏ hơn, trừ khi nhóm có bảo hiểm) | Tương tự — ghi `declared_value` vs `value` vào snapshot, chênh lệch vào reconciliation nếu lệch kỳ vọng |
| Callback/check `3` (thẻ lỗi/đã dùng) | `FAILED`; không post ledger | `FAILED`; release hold/refund theo luồng refund hiện có |
| `4` (bảo trì — chỉ Nappay) | Nếu **chưa** submit: giữ `PENDING`, xếp hàng thử lại. Nếu đã submit mà không rõ kết quả: `UNKNOWN` | Như cột trái — tuyệt đối không failover khi chưa inquiry (đúng luật UNKNOWN của brief) |
| Lỗi request `100/103` | Không tạo order; trả lỗi đồng bộ cho đối tác | Nếu xảy ra **sau** submit → `UNKNOWN` + tạo reconciliation case; trước submit → `FAILED` |
| Lỗi `101` (check không thấy giao dịch) | Trả `101` cho đối tác | Order → `REVIEW`, tạo case đối soát |
| Lỗi `102` (sai sign/IP/dữ liệu) | Từ chối request, không tạo order, ghi audit | Kiểm tra lại cấu hình credential của provider; không retry mù |
| Lỗi `104` (sai command) | Từ chối request | — |
| Trùng `request_id` / trùng fingerprint thẻ | Trả lỗi đồng bộ (kèm trạng thái cũ nếu có, theo cách apidoithe làm); không tạo order/bút toán mới — đúng idempotency của SunCard | Provider báo trùng → tra lại bằng `check` thay vì gửi mới |

Nguyên tắc giữ nguyên từ tài liệu gốc của SunCard: callback chỉ được xử lý sau khi
**verify `callback_sign`**, dedupe theo `(partner_id, request_id)` và theo fingerprint
thẻ; status `99` không bao giờ được hiển thị cho khách là "thất bại" (hiển thị "Đang
xác minh" như brief đã chốt cho UNKNOWN/PENDING).

---

## 9. Nguồn đã dùng (URL đầy đủ)

- https://docs.nappay.vn/ — tài liệu API Nappay (Charging v2, Recharge, Softcard)
- https://lrv.nappay.vn/doithecao — bảng phí storefront Nappay (qua kết quả tìm kiếm)
- https://doithe.vn/ — trang chủ + bảng phí doithe.vn
- https://thesieure.com/ — trang chủ + bảng phí thesieure.com
- https://gachthe.vn/ — trang chủ + bảng phí gachthe.vn
- https://cardvip.vn/ — trang chủ + bảng phí + cơ chế bảo hiểm cardvip.vn
- https://documenter.gw.postman.com/api/collections/5472976/2s8YzQV3Ua — tài liệu API apidoithe.com
- http://documenter.getpostman.com/view/5740908/TVYJ5Ggr — CARD PARTNER API
- https://documenter.gw.postman.com/api/collections/11751107/Szzn6GKJ — Card Charging API Telcovn.com
- https://documenter.gw.postman.com/api/collections/17343942/U16etnTH — tài liệu tích hợp TheSieuRe
- https://deepwiki.com/minevn/dotman/4.2-payment-providers — mã nguồn tích hợp Card2K/TheSieuRe
- https://api.naptudong.com/news/instructions-for-integrating-api-to-change-cards-in-english.html — hướng dẫn API V2 naptudong
- https://ppay.vn/news/instructions-for-integrating-api-to-change-cards-in-english — cùng văn bản tại ppay.vn
- https://mmosoft.me/ — ví dụ site con đồng bộ phí từ TheSieuRe qua getfee
- https://doithe1s.vn/ — thông báo chuyển tên miền sang Pay1s.com
- https://napthe.vn/ — trung tâm nạp Garena (đối chiếu loại hình)

Không lấy được: doithecao.vn, muathe.vn, doithe5s.vn (công cụ đọc web không fetch
được — không đồng nghĩa site đã chết); chi tiết rút tiền/đại lý của từng site (không
công bố ở trang đã đọc); phần danh sách CardType sau ID 23 của doithegiatot.
