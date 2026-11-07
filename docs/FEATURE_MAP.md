# SunCard — Bản đồ tính năng (FEATURE MAP)

Ánh xạ yêu cầu chức năng FR-01..FR-17 (PRD, tài liệu 01) sang module / trang / API
trong repo, kèm trạng thái trung thực tại thời điểm bàn giao Phase 1.

Quy ước trạng thái:

- **Đã làm (Phase 1 lõi)** — luồng chính chạy thật trên dữ liệu thật, có kiểm chứng.
- **Một phần** — khung/lõi đã có, thiếu phần ghi rõ.
- **Chưa làm** — chưa triển khai, ghi rõ điều kiện để làm.

## Bảng ánh xạ FR

| FR | Tính năng | Module / Trang / API | Trạng thái |
|---|---|---|---|
| FR-01 | Auth & RBAC: đăng ký/đăng nhập, session JWT, vai trò + quyền, data-scope theo nhánh đại lý | `src/modules/security.ts`, `src/modules/audit.ts`; trang `/dang-nhap`, `/dang-ky`; Admin `/admin` mục Vai trò/Quyền | ĐÃ LÀM đầy đủ theo Security Spec: **TOTP bắt buộc cho mọi vai trò quản trị** (chưa bật → không vào /admin), step-up mật khẩu/TOTP cho thao tác nhạy cảm, phiên DB có thu hồi, login throttling, trang quản lý phiên — xem `docs/SECURITY_CHECKLIST.md` |
| FR-02 | Catalog: danh mục, sản phẩm, biến thể mệnh giá, game + gói nạp, region/server, trường nhập (UID/server) | `prisma/schema.prisma` (Category/Product/ProductVariant/GameCatalog...); trang `/nap-game`, `/cua-hang-the`; API `GET /v1/categories`, `/v1/products`, `/v1/games` | Đã làm (Phase 1 lõi) |
| FR-03 | Pricing: bảng giá theo precedence (tài khoản → nhánh → cấp đại lý → nhóm khách → mặc định), snapshot giá khi chốt đơn | `src/modules/pricing.ts`; API `GET /v1/prices`; Admin trang Pricing | Đã làm (Phase 1 lõi) |
| FR-04 | Ví & Ledger: ví người dùng, sổ kép double-entry append-only, hold/settle/release, sao kê | `src/modules/ledger.ts`; trang `/tai-khoan` mục Ví; API `/v1/wallet/*` | Đã làm (Phase 1 lõi) |
| FR-05 | Nạp ví maker-checker: tạo yêu cầu nạp → người khác duyệt → post ledger | `src/modules/ledger.ts`, model `Deposit` + `FinancialApprovalRequest`; Admin mục Nạp/Rút tiền | Đã làm (Phase 1 lõi) với phương thức chuyển khoản thủ công + MockPay. **Cổng thanh toán thật: chưa làm** (xem ghi chú dưới) |
| FR-06 | Rút tiền: yêu cầu rút, kiểm KYC/hold/nợ, maker-checker, ghi nhận chi trả | Model `WithdrawalRequest`; trang Ví trong `/tai-khoan`; Admin duyệt rút | Đã làm (Phase 1 lõi) — chi trả ghi nhận thủ công, chưa nối payout tự động qua ngân hàng |
| FR-07 | Chuyển ví nội bộ giữa người dùng, có phí cấu hình được, idempotent | `src/modules/ledger.ts`, model `WalletTransfer`; API `POST /v1/wallet/transfers` | Đã làm (Phase 1 lõi) |
| FR-08 | Mua thẻ cào/PIN/gift card: reserve mã trong transaction, giao mã 1 lần, mã hoá AES-256-GCM + fingerprint HMAC | `src/modules/cards.ts`; trang `/cua-hang-the`; API `/v1/cards/*` | Đã làm — vòng đời đúng bảng 9 của Security Spec (IMPORTED → VALIDATED → AVAILABLE → RESERVED → DELIVERED, QUARANTINED → AVAILABLE/VOIDED), Secure Reveal 9 bước, Emergency Vault Lock, Risk Engine giữ giao mã khi điểm cao |
| FR-09 | Nạp game trực tiếp (direct top-up): validate UID → xác nhận nickname → chốt gói → route provider | `src/modules/orders.ts`, `orders-service.ts`, `providers.ts`; trang `/nap-game/[slug]`; API `POST /v1/topups/validate`, `POST /v1/orders` | Đã làm (Phase 1 lõi) với Manual + Mock provider. **Provider thật: chưa làm** (xem ghi chú dưới) |
| FR-10 | Gạch thẻ (card exchange): nộp thẻ, fingerprint chống trùng, phí theo **ma trận telco × mệnh giá × nhóm khách** trong DB (`exchange_fee_rules`, seed từ số liệu khảo sát thị trường 06/11/2026 — xem mục Charging Compat API dưới đây); setting chiết khấu phẳng chỉ còn là fallback, phạt sai mệnh giá 50% cấu hình được | Model `ExchangeOrder`; trang `/doi-the`; API `/v1/card-exchange/*` | Đã làm (Phase 1 lõi) — xử lý qua hàng chờ Manual/Mock |
| FR-11 | Đại lý đa tầng: 1 parent, closure table, chống chu trình, cấp đại lý là dữ liệu cấu hình | `src/modules/agents.ts`; portal `/dai-ly/portal`; API `/v1/agents/*` | Đã làm (Phase 1 lõi) |
| FR-12 | Hoa hồng: rule theo beneficiary/base/rate, vesting, cap theo margin, đảo khi refund | `src/modules/commission.ts`; Admin mục Hoa hồng + Settlements | Đã làm (Phase 1 lõi) |
| FR-13 | Công nợ (credit): hạn mức, outstanding/reserved, available = limit − outstanding − reserved, điều chỉnh maker-checker | `src/modules/credit.ts`; Admin mục Công nợ | Đã làm (Phase 1 lõi) |
| FR-14 | Provider routing & webhook: adapter contract, capability theo product/region, routing theo priority/cost/success-rate, circuit breaker, webhook verify HMAC + chống replay | `src/modules/providers.ts`, `src/modules/webhooks.ts`; API `POST /v1/webhooks/{provider}` | Đã làm (Phase 1 lõi) cho **Manual + Mock** provider. **Provider thật: chưa làm — cần hợp đồng/sandbox nhà cung cấp**, hiện chỉ Manual + Mock |
| FR-15 | Đối soát (reconciliation): run theo kỳ, so khớp số tiền/trạng thái, lệch tạo case có owner/severity | Model `ProviderReconciliationRun/Item`, `ReconciliationCase`; Admin mục Đối soát | Đã làm (Phase 1 lõi) ở mức run + case thủ công |
| FR-16 | Partner API + Sandbox: REST `/v1`, ký HMAC-SHA256, Idempotency-Key, error envelope + request_id, cursor pagination, môi trường SANDBOX/LIVE | `src/app/v1/*`, `public/openapi.yaml`, model `ApiClient`/`ApiKey` | Đã làm (Phase 1 lõi) |
| FR-18 | Charging Compat API (bổ sung theo khảo sát thị trường): `POST/GET /chargingws/v2` (command=charging/check), `GET /chargingws/v2/getfee`, sign MD5 2 công thức + alias `seri`, callback_sign MD5, status 99/1/2/3/4 + mã lỗi 100–104, dùng chung ApiClient/partner_key, request_id → idempotency | `src/modules/charging.ts`, `src/app/chargingws/v2/*` | Đã làm — có suite test riêng (9 case) PASS, ghi trong OpenAPI |
| FR-19 | Bảo mật theo Security Specification v1.0: Argon2id, Risk Engine + fraud queue, Vault Lock, phiên/throttling, audit theo bảng 17, dual approval mở rộng (refund/role/xuất mã/provider secret), gói bằng chứng PAY-08 | `src/modules/password.ts`, `risk.ts`, `totp.ts`, `password-reset.ts`; `docs/SECURITY_CHECKLIST.md` | Đã làm — ánh xạ từng mã SEC-AC tại `docs/SECURITY_CHECKLIST.md`; SEC-INF-01/SEC-DR-01 một phần (phụ thuộc vận hành), SEC-TEST-01 (pentest độc lập) chưa kết luận |
| FR-17 | Admin / Support / Dispute / Settings / Audit: quản trị người dùng/đơn/provider, ticket hỗ trợ, dispute, mọi cấu hình nghiệp vụ lưu DB sửa ở Admin → Cài đặt, audit log append-only | `src/app/admin/*`, `src/modules/settings.ts`, `src/modules/audit.ts`; model `SupportTicket`, `Dispute`, `Setting`, `AuditLog` | Đã làm (Phase 1 lõi) |

## Charging Compat API (ngoài brief gốc, theo docs/research/card-exchange-sites.md)

Chuẩn gạch thẻ chung của thị trường VN đã tích hợp đầy đủ: endpoint `/chargingws/v2`
(charging + check), `/chargingws/v2/getfee`, cả hai công thức sign MD5 (legacy và mở rộng),
field alias `seri`, callback về partner qua outbox webhook sẵn có với `callback_sign`,
status mapping 99/1/2/3/4 và mã lỗi request 100/101/102/103/104. Thẻ sai mệnh giá được
định giá theo mệnh giá THẬT tra từ ma trận mệnh giá hợp lệ, trừ phí theo nhóm phí của
partner và penalty 50% mệnh giá nhỏ hơn (setting `exchange.wrong_value_penalty_bps`).
Ma trận phí seed từ bảng chi tiết theo mệnh giá trong file nghiên cứu (3 nhóm
MEMBER/AGENT/API) — là **dữ liệu mẫu của ngày khảo sát 06/11/2026**, sửa được ở
Admin → Cài đặt / bảng `exchange_fee_rules`, không hard-code trong code.
Test: suite `charging-compat` (9 case) trong `npm test` — sign legacy/extended/check,
status mapping, ma trận phí từ DB, trùng request_id, sai mệnh giá + penalty, thẻ lỗi không payout.

## Bảo mật theo Security Specification

Toàn bộ ánh xạ yêu cầu (ACC/PAY/Card Vault/Risk/Audit/Session/Admin/Web-API/DR) và tiêu chí
SEC-AC-01..SEC-TEST-01 nằm tại `docs/SECURITY_CHECKLIST.md` kèm trạng thái + bằng chứng test.
Test âm (IDOR, Support reveal, Vault Lock, webhook sai chữ ký, replay, rò secret, admin chưa MFA,
login throttling) nằm trong suite `security` của `npm test`.

## Ghi chú trung thực về phạm vi

- **Provider thật — Chưa làm:** hiện chỉ có **Manual** (xử lý thủ công bởi vận hành) và
  **Mock** (sandbox mô phỏng success/failed/unknown/pending). Nối provider thật cần hợp
  đồng + tài khoản sandbox của từng nhà cung cấp; kiến trúc adapter/routing/webhook đã
  sẵn sàng để cắm thêm mà không đổi contract.
- **Cổng thanh toán thật — Chưa làm:** nạp ví hiện dùng chuyển khoản thủ công
  (maker-checker) + **MockPay**. Cổng thanh toán thật (ngân hàng/ví điện tử/thẻ quốc tế)
  cần pháp lý + hợp đồng cổng, để giai đoạn sau.
- **MFA TOTP — Đã làm (sửa ghi chú cũ ngày 07/11/2026):** TOTP RFC 6238 đã chạy thật
  và BẮT BUỘC cho mọi vai trò quản trị (chưa bật → không vào được /admin), đăng nhập
  kèm mã TOTP, step-up bằng mật khẩu/TOTP cho thao tác nhạy cảm — bằng chứng:
  smoke #8–#10 và test "SEC-AC-02 Admin MFA gate" / "login TOTP + DB session".
  Phần còn lại của Phase 4 là Redis/worker nền và rate-limit phân tán.

## Lộ trình theo PRD (Phase 1–5)

- **Phase 1 — Lõi nền tảng (đợt này):** auth/RBAC, catalog, pricing, ví/ledger,
  đơn hàng + state machine + idempotency, mua thẻ, nạp game, gạch thẻ (Manual/Mock),
  đại lý + hoa hồng + công nợ, Partner API + sandbox, Admin/Support/Dispute/Settings/Audit.
- **Phase 2 — Provider thật:** ký hợp đồng + nối sandbox/từng provider nạp game và gạch thẻ,
  bật routing đa nguồn theo dữ liệu thật, đối soát tự động theo lịch.
- **Phase 3 — Thanh toán thật:** tích hợp cổng thanh toán/ví điện tử được cấp phép,
  payout rút tiền tự động, đối soát ngân hàng.
- **Phase 4 — Bảo mật & quy mô:** passkey/WebAuthn, Redis + worker nền cho webhook/queue,
  rate-limit phân tán, cảnh báo vận hành (alert UNKNOWN tồn đọng, circuit mở).
- **Phase 5 — Mở rộng quốc tế:** đa tiền tệ/FX đầy đủ, region ngoài VN, gift card quốc tế,
  bản địa hoá giao diện.
