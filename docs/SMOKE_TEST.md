# SunCard — Smoke Test (chạy thật trên server production build, PostgreSQL local)

Môi trường: `npm run build` + `npm run start` (port 3100), PostgreSQL portable port 5440,
DB đã `prisma db push` + `tsx prisma/seed.ts`. Ngày chạy: 2026-11-07.
Ngoài smoke HTTP dưới đây, toàn bộ test tự động: `npm test` — 3 suite, 30 nhóm, ALL PASS
(chi tiết ở cuối).

## Luồng khách hàng

| # | Luồng | Kết quả |
|---|---|---|
| 1 | Đăng nhập `khach@suncard.vn` (Argon2id) | 200, cookie HttpOnly/Secure/SameSite, phiên ghi DB |
| 2 | Nạp ví BANK_TRANSFER 2.000.000 → PENDING chờ duyệt | Tạo deposit + FinancialApprovalRequest |
| 3 | Mua thẻ Viettel 10.000 | Đơn SUCCESS, trừ ví đúng giá snapshot, có delivery |
| 4 | Reveal mã (step-up mật khẩu) | Trả serial/PIN + `correlationId`; sai mật khẩu → `STEP_UP_REQUIRED` |
| 5 | Top-up Liên Quân UID đuôi 999 (Mock UNKNOWN) | Đơn UNKNOWN (hiển thị "Đang xác minh") |
| 6 | Admin inquiry đơn UNKNOWN | → SUCCESS, ví bị trừ 1 lần |
| 7 | Gạch thẻ web Viettel 100.000 (nhóm MEMBER) | SUCCESS, cộng ví theo ma trận phí DB |

## Maker-checker + MFA (Security Specification)

| # | Luồng | Kết quả |
|---|---|---|
| 8 | OPS chưa bật MFA gọi API admin | `MFA_REQUIRED` (chặn ở requirePermission) |
| 9 | Thiết lập TOTP (setup → enable bằng mã thật) | `mfaEnabled: true`, phiên được rotate |
| 10 | Đăng nhập lại kèm `totpCode` → GET /admin | 200; fraud queue `/api/admin/fraud` trả 200 |
| 11 | FINANCE (đã MFA) duyệt nạp của khách (maker ≠ checker) | Ví khách 5.000.000 → 7.000.000 |
| 12 | OPS thử duyệt nạp (thiếu quyền finance.approve) | `PERMISSION_DENIED` — đúng phân quyền |
| 13 | Emergency Vault Lock: OPS bật (step-up mật khẩu) | `vault_locked: true`; reserve/deliver/reveal bị chặn ở tầng module (test tự động chứng minh VAULT_LOCKED); tắt khoá trở lại bình thường |

## Partner API /v1 (HMAC)

| # | Luồng | Kết quả |
|---|---|---|
| 14 | GET /v1/wallet/balance ký HMAC (client demo-partner) | 200 — số dư + hạn mức credit đúng |
| 15 | POST /v1/orders thiếu dữ liệu | Error envelope + request_id (không lộ stack) |

## Charging Compat API (/chargingws/v2)

| # | Luồng | Kết quả |
|---|---|---|
| 16 | charging sign legacy MD5, Viettel 50.000 | status 1, amount 43.000 (phí API 14% theo ma trận DB), có callback_sign |
| 17 | check cùng request_id | status 1, serial/code đã mask, cùng trans_id |
| 18 | GET /chargingws/v2/getfee?partner_id=demo-partner | 69 dòng phí (telco/value/fees/penalty) từ DB |

## Trang web (HTTP 200)

`/`, `/nap-game`, `/cua-hang-the`, `/doi-the`, `/tai-lieu`, `/tai-khoan/the-da-mua`,
`/admin` (sau MFA), `/admin/rui-ro`.

## Test tự động (`npm test`) — ALL PASS

- **core (11):** ledger cân bằng/idempotent/hold-release-settle, state machine,
  pricing precedence, idempotency đơn + UNKNOWN/inquiry, RBAC scope, thẻ
  reserve/deliver/reveal, chống trùng fingerprint gạch thẻ, HMAC + replay nonce,
  commission cap theo margin, credit limit.
- **charging-compat (9):** 2 công thức sign + check, status mapping, ma trận phí từ DB,
  payout qua route thật, trùng request_id không trùng đơn/bút toán, mã lỗi
  101/102/104, alias `seri` + sai mệnh giá có penalty, thẻ lỗi không payout, callback payload.
- **security (10):** Argon2id, sign/verify token roundtrip, IDOR + Support reveal bị chặn
  + audit không plaintext, Vault Lock, cổng MFA Admin, login throttling + không lộ tồn tại
  tài khoản, đăng nhập TOTP + phiên DB, webhook sai chữ ký/dedupe, Risk Engine scoring,
  secret không xuất hiện trong response.

## Lỗi thật đã tìm thấy nhờ smoke (đã sửa + có test hồi quy)

- jose `setExpirationTime(number)` hiểu số giây là timestamp epoch tuyệt đối → token hết
  hạn ngay khi ký, mọi request cookie đều bị coi là chưa đăng nhập. Đã sửa thành
  timestamp tương lai + test "session token sign/verify roundtrip".
