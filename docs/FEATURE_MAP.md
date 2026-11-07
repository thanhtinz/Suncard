# SunCard — Bản đồ tính năng (FEATURE MAP)

Ánh xạ yêu cầu chức năng FR-01..FR-17 (PRD, tài liệu 01) sang module / trang / API
trong repo, kèm trạng thái trung thực. Cập nhật gần nhất: 07/11/2026 — bổ sung Phase 2–5
ở mục riêng bên dưới (mục lục cũ của Phase 1 giữ nguyên để tra cứu).

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
| FR-05 | Nạp ví maker-checker: tạo yêu cầu nạp → người khác duyệt → post ledger | `src/modules/ledger.ts`, model `Deposit` + `FinancialApprovalRequest`; Admin mục Nạp/Rút tiền | Đã làm (Phase 1 lõi) với phương thức chuyển khoản thủ công + MockPay. **VNPay đã tích hợp theo đặc tả công khai (Phase 3)** — xem mục riêng bên dưới; cần tài khoản merchant thật để chạy tiền thật |
| FR-06 | Rút tiền: yêu cầu rút, kiểm KYC/hold/nợ, maker-checker, ghi nhận chi trả | Model `WithdrawalRequest`; trang Ví trong `/tai-khoan`; Admin duyệt rút | Đã làm (Phase 1 lõi) — chi trả ghi nhận thủ công, chưa nối payout tự động qua ngân hàng |
| FR-07 | Chuyển ví nội bộ giữa người dùng, có phí cấu hình được, idempotent | `src/modules/ledger.ts`, model `WalletTransfer`; API `POST /v1/wallet/transfers` | Đã làm (Phase 1 lõi) |
| FR-08 | Mua thẻ cào/PIN/gift card: reserve mã trong transaction, giao mã 1 lần, mã hoá AES-256-GCM + fingerprint HMAC | `src/modules/cards.ts`; trang `/cua-hang-the`; API `/v1/cards/*` | Đã làm — vòng đời đúng bảng 9 của Security Spec (IMPORTED → VALIDATED → AVAILABLE → RESERVED → DELIVERED, QUARANTINED → AVAILABLE/VOIDED), Secure Reveal 9 bước, Emergency Vault Lock, Risk Engine giữ giao mã khi điểm cao |
| FR-09 | Nạp game trực tiếp (direct top-up): validate UID → xác nhận nickname → chốt gói → route provider | `src/modules/orders.ts`, `orders-service.ts`, `providers.ts`; trang `/nap-game/[slug]`; API `POST /v1/topups/validate`, `POST /v1/orders` | Đã làm (Phase 1 lõi) với Manual + Mock provider. **Provider thật: chưa làm** (xem ghi chú dưới) |
| FR-10 | Gạch thẻ (card exchange): nộp thẻ, fingerprint chống trùng, phí theo **ma trận telco × mệnh giá × nhóm khách** trong DB (`exchange_fee_rules`, seed từ số liệu khảo sát thị trường 06/11/2026 — xem mục Charging Compat API dưới đây); setting chiết khấu phẳng chỉ còn là fallback, phạt sai mệnh giá 50% cấu hình được | Model `ExchangeOrder`; trang `/doi-the`; API `/v1/card-exchange/*` | Đã làm (Phase 1 lõi) — xử lý qua hàng chờ Manual/Mock |
| FR-11 | Đại lý đa tầng: 1 parent, closure table, chống chu trình, cấp đại lý là dữ liệu cấu hình | `src/modules/agents.ts`; portal `/dai-ly/portal`; API `/v1/agents/*` | Đã làm (Phase 1 lõi) |
| FR-12 | Hoa hồng: rule theo beneficiary/base/rate, vesting, cap theo margin, đảo khi refund | `src/modules/commission.ts`; Admin mục Hoa hồng + Settlements | Đã làm (Phase 1 lõi) |
| FR-13 | Công nợ (credit): hạn mức, outstanding/reserved, available = limit − outstanding − reserved, điều chỉnh maker-checker | `src/modules/credit.ts`; Admin mục Công nợ | Đã làm (Phase 1 lõi) |
| FR-14 | Provider routing & webhook: adapter contract, capability theo product/region, routing theo priority/cost/success-rate, circuit breaker, webhook verify HMAC + chống replay | `src/modules/providers.ts`, `src/modules/webhooks.ts`; API `POST /v1/webhooks/{provider}` | Đã làm (Phase 1 lõi) cho **Manual + Mock** provider. **Phase 2: adapter `HTTP_CHARGING` ra upstream thật theo chuẩn /chargingws/v2 đã làm + test end-to-end bằng stub** — xem mục riêng bên dưới; chạy tiền thật cần hợp đồng + partner key của upstream cụ thể |
| FR-15 | Đối soát (reconciliation): run theo kỳ, so khớp số tiền/trạng thái, lệch tạo case có owner/severity | Model `ProviderReconciliationRun/Item`, `ReconciliationCase`; Admin mục Đối soát; `src/modules/reconciliation.ts`, `src/modules/ops.ts`; cron `GET/POST /api/cron/ops` | Đã làm: run thủ công ở Admin + **tự động theo lịch qua cron** (đối soát thật với upstream HTTP bằng command=check; provider khác đối soát nội bộ), lệch tạo case |
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

## Phase 2–5 (bổ sung ngày 07/11/2026 — suite test `phase2` trong `npm test`, 12 nhóm, ALL PASS)

- **Provider HTTP_CHARGING (Phase 2) — ĐÃ LÀM + test bằng stub upstream:** SunCard đóng
  vai khách gọi upstream theo chuẩn `/chargingws/v2`: POST command=charging/check,
  GET getfee, ký MD5 cả 2 công thức (legacy + mở rộng, chọn qua `config.signMode`),
  map status 99/1/2/3/4 vào state machine đơn, sai mệnh giá chốt theo mệnh giá upstream
  chấp nhận + penalty như luồng nội bộ, timeout/phản hồi rác → UNKNOWN (không failover).
  Cấu hình ở Admin → Nhà cung cấp (baseUrl, partnerId, signMode, bật/tắt); partner_key
  đi qua duyệt kép PROVIDER_SECRET và lưu **mã hoá AES-256-GCM** (`ProviderCredential.secretEnc`).
  Routing chọn provider qua setting `exchange.provider_code`. Callback upstream vào
  `/v1/webhooks/{provider}` xác thực bằng `callback_sign` MD5 và chống trùng như cũ.
  Test end-to-end bằng stub HTTP server dựng trong test: charging → SUCCESS + ví cộng
  đúng 1 lần; status 2 sai mệnh giá; status 3 thẻ lỗi; 99 → inquiry chốt; check cho đơn
  UNKNOWN → chốt trạng thái. **Còn thiếu để chạy tiền thật:** hợp đồng + partner_id/key
  của một upstream cụ thể (mỗi nhà có khác biệt nhỏ về field/phí cần đối chiếu khi nối).
- **Đối soát tự động + worker nền (Phase 2/4) — ĐÃ LÀM:** `src/modules/ops.ts` +
  endpoint `/api/cron/ops` và `/api/cron/webhooks` (giao webhook đến hạn), bảo vệ bằng
  `CRON_SECRET` gửi qua **header** (`x-cron-secret` hoặc `Authorization: Bearer`), so
  timing-safe trên hash, **fail-closed** khi chưa đặt secret, không nhận qua query.
  Mỗi vòng cron: (a) inquiry đơn UNKNOWN quá hạn (`orders.unknown_inquiry_after_minutes`)
  và đơn PENDING của provider HTTP quá hạn (`ops.pending_inquiry_after_minutes`);
  (b) đối soát provider HTTP_CHARGING trong cửa sổ `ops.reconcile_lookback_hours`;
  (c) cảnh báo vận hành khi đơn UNKNOWN tồn đọng vượt `ops.unknown_alert_threshold`
  hoặc circuit breaker của provider ACTIVE đang mở → Notification cho mọi tài khoản
  quản trị (chống spam 24h) + khối "Cảnh báo vận hành" trên Admin dashboard.
  `vercel.json` đã khai báo 2 cron — **giới hạn gói Vercel free: cron chỉ chạy 1 lần/ngày**
  nên trên bản demo, inquiry/đối soát tự động tối đa ngày 1 lần; production nên dùng
  cron ngoài (VPS/GitHub Actions) gọi endpoint thường xuyên hơn.
- **Cổng nạp VNPay (Phase 3) — ĐÃ LÀM theo đặc tả công khai, CHƯA có tài khoản thật:**
  `src/modules/vnpay.ts`: tạo URL thanh toán (vnp_TmnCode, `vnp_Amount` = tiền × 100,
  secure hash HMAC-SHA512 trên tham số đã sắp xếp + encode), endpoint IPN verify chữ ký
  là nguồn sự thật duy nhất để cộng ví (return URL chỉ hiển thị, không cộng tiền),
  cộng **đúng 1 lần** qua ledger (claim nguyên tử theo trạng thái intent), IPN đã xác
  thực **không** qua maker-checker; Deposit có trạng thái `PENDING_GATEWAY`.
  Cấu hình ở Admin → Cài đặt (nhóm `vnpay`: enabled, tmn_code, pay_url, return_url);
  hash secret lưu mã hoá qua API riêng `/api/admin/payments/vnpay-secret`; thiếu cấu
  hình = tính năng tắt, trang Ví chỉ hiện form VNPay khi đã bật. Test: vector ký/kiểm
  tự tạo, IPN hợp lệ cộng 1 lần (gọi trùng trả RspCode 02, không cộng lại), sai chữ ký
  → 97, sai số tiền → 04. **Chạy tiền thật cần:** đăng ký merchant VNPay (TmnCode +
  hash secret thật) và khai báo IPN URL với VNPay.
- **Passkey/WebAuthn (Phase 4) — ĐÃ LÀM phần code + test mức options/challenge/lỗi:**
  `@simplewebauthn/server` + `@simplewebauthn/browser`; model `WebAuthnCredential` và
  `WebAuthnChallenge` (server-side, hạn 5 phút, dùng đúng 1 lần, claim nguyên tử).
  Đăng ký/quản lý passkey ở trang Bảo mật tài khoản; đăng nhập bằng passkey (email →
  assertion → phiên như login thường, tôn trọng LoginThrottle khoá tăng dần, cảnh báo
  thiết bị mới, tài khoản bật TOTP mà assertion không có user-verification vẫn đòi TOTP);
  passkey làm step-up thay mật khẩu/TOTP cho Secure Reveal (challenge mục đích STEPUP).
  RP ID/origin cấu hình ở settings `webauthn.*`. **Giới hạn kiểm chứng:** không có thiết
  bị xác thực thật trong môi trường test headless nên ceremony attestation/assertion
  đầu-cuối (vân tay/FaceID chìa khoá thật) CHƯA kiểm chứng được — test chỉ phủ: sinh
  options, vòng đời challenge (đúng mục đích/hết hạn/dùng 2 lần), credential lạ bị reject.
  Cần 1 thiết bị thật (điện thoại/máy có platform authenticator) để nghiệm thu cuối.
- **Rate-limit phân tán (Phase 4) — ĐÃ LÀM:** bảng `rate_limit_counters` (Postgres),
  tăng đếm bằng 1 câu `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` nguyên tử theo
  cửa sổ 1 phút; áp cho login (theo IP) và Partner API (theo client), giữ nguyên ngưỡng
  cấu hình hiện tại; lỗi DB thì fail-open có kiểm soát về limiter bộ nhớ. Test: 20 lần
  tăng song song cho đúng dãy 1..20. (Redis vẫn chưa dùng — Postgres đáp ứng quy mô hiện tại.)
- **Nền đa tiền tệ (Phase 5 — chỉ phần nền) — ĐÃ LÀM:** tỉ giá `fx.vnd_per_usd` trong
  DB sửa ở Admin → Cài đặt; `GET /v1/fx` (Partner API) trả tỉ giá; trang Cửa hàng thẻ
  (`?usd=1`) và trang Nạp game (checkbox) hiển thị thêm giá quy đổi **ước tính** sang
  USD khi khách chọn xem. **Tiền thật vẫn 100% VND** — ledger/đơn/ví không đổi, USD
  chỉ là hiển thị tham khảo, không phải luồng thanh toán đa tiền tệ.

## Ghi chú trung thực về phạm vi

- **Provider nạp game thật — Chưa làm:** phần Phase 2 đợt này phủ provider **gạch thẻ**
  ra upstream (HTTP_CHARGING). Provider nạp game trực tiếp của từng nhà phát hành vẫn
  chỉ có Manual + Mock — cần hợp đồng/tài khoản sandbox từng nhà phát hành.
- **MFA TOTP — Đã làm (sửa ghi chú cũ ngày 07/11/2026):** TOTP RFC 6238 đã chạy thật
  và BẮT BUỘC cho mọi vai trò quản trị (chưa bật → không vào được /admin), đăng nhập
  kèm mã TOTP, step-up bằng mật khẩu/TOTP cho thao tác nhạy cảm — bằng chứng:
  smoke #8–#10 và test "SEC-AC-02 Admin MFA gate" / "login TOTP + DB session".
- **Settings mới sau deploy:** các setting của Phase 2–5 (nhóm `vnpay`, `fx`, `webauthn`,
  `ops`, `provider`) có giá trị mặc định trong code và xuất hiện ở Admin → Cài đặt sau
  khi seed chạy lại hoặc sau lần lưu đầu tiên qua API (setSetting tự upsert).

## Lộ trình theo PRD (Phase 1–5)

- **Phase 1 — Lõi nền tảng (đợt này):** auth/RBAC, catalog, pricing, ví/ledger,
  đơn hàng + state machine + idempotency, mua thẻ, nạp game, gạch thẻ (Manual/Mock),
  đại lý + hoa hồng + công nợ, Partner API + sandbox, Admin/Support/Dispute/Settings/Audit.
- **Phase 2 — Provider thật:** ✅ adapter gạch thẻ HTTP_CHARGING + đối soát tự động theo
  lịch đã làm (test bằng stub). Còn lại: ký hợp đồng + nối từng provider nạp game thật,
  bật routing đa nguồn theo dữ liệu thật.
- **Phase 3 — Thanh toán thật:** ✅ VNPay đã tích hợp theo đặc tả công khai (chờ tài khoản
  merchant thật). Còn lại: cổng/ví khác, payout rút tiền tự động, đối soát ngân hàng.
- **Phase 4 — Bảo mật & quy mô:** ✅ passkey/WebAuthn (cần thiết bị thật để nghiệm thu
  ceremony), worker nền dạng cron endpoint + cảnh báo vận hành, rate-limit phân tán bằng
  Postgres. Còn lại: Redis/queue chuyên dụng khi quy mô tăng, pentest độc lập.
- **Phase 5 — Mở rộng quốc tế:** ✅ phần nền FX (tỉ giá DB + /v1/fx + hiển thị quy đổi USD
  tuỳ chọn). Còn lại: đa tiền tệ thật (ledger đa tiền tệ), region ngoài VN, gift card
  quốc tế, bản địa hoá giao diện.
