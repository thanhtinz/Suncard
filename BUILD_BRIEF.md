# SunCard — BUILD BRIEF (nguồn sự thật cho đợt dựng này)

Tài liệu gốc: bộ SunCard Enterprise Documentation v1.0 (11 docx, 06/11/2026) — tóm tắt đã được
đọc và đối chiếu đầy đủ. Repo đích: thanhtinz/Suncard (đang rỗng), push thẳng main.

## Sản phẩm là gì
Nền tảng phân phối sản phẩm số đa nhà cung cấp cho VN + mở rộng quốc tế:
gạch thẻ (card exchange), bán mã thẻ/PIN/gift card, nạp game trực tiếp (direct top-up),
mạng lưới đại lý nhiều tầng không giới hạn, ví nội bộ + ledger kép, công nợ (credit),
hoa hồng (commission), aggregator nhiều provider (routing/webhook/đối soát),
Partner API có HMAC + sandbox, Admin vận hành + Support ticket/dispute.

## Quyết định kiến trúc (ADR-001)
- Tài liệu đề xuất baseline "Laravel + Vue 3 + PostgreSQL, modular monolith" và ghi rõ
  baseline là ĐỀ XUẤT, chốt cụ thể tại thời điểm triển khai.
- Đợt này triển khai đúng kiến trúc modular monolith + async workers bằng stack mà hạ tầng
  hiện có của chủ dự án đang chạy thật: **Next.js 14 (App Router) + TypeScript + Prisma 5 +
  PostgreSQL** — một codebase gồm Storefront + Customer Portal + Agent Portal + Admin Portal
  + Partner API + Docs Portal, domain tách module trong `src/modules/`.
- Ghi ADR này vào `docs/ADR-001-stack.md` kèm lý do; toàn bộ contract nghiệp vụ/API/schema
  bám tài liệu gốc, chỉ khác framework.

## Luật cứng từ tài liệu (không được phá)
1. Tiền = integer minor units (BIGINT) + currency, KHÔNG float. Thời gian UTC.
2. Ledger double-entry append-only: mọi transaction tổng debit = tổng credit; không sửa
   balance trực tiếp — balance là projection; sai sót sửa bằng reversal. Hold tách settled.
3. Order state machine: CREATED → VALIDATING → RESERVED → SUBMITTING → PENDING → PROCESSING
   → SUCCESS | FAILED | UNKNOWN | REVIEW | REFUND_PENDING → REFUNDED | CANCELLED.
   Chỉ transition hợp lệ. UNKNOWN ≠ FAILED, KHÔNG failover tự động khi UNKNOWN.
4. Idempotency khắp nơi: duplicate request không tạo duplicate order/bút toán; callback lặp an toàn.
5. Giá snapshot tại thời điểm xác nhận đơn. Pricing precedence:
   override tài khoản → nhánh/đại lý → cấp → nhóm khách → mặc định.
6. Agent: 1 parent trực tiếp, cấm chu trình, closure table cập nhật transactional + audit;
   cấp đại lý là DỮ LIỆU cấu hình, không hard-code số tầng/tên cấp.
7. Card: PIN/serial mã hoá AES-256-GCM (envelope: key từ env, DB chỉ giữ ciphertext),
   duplicate check bằng HMAC fingerprint, reserve trong transaction có lock, giao mã MỘT lần,
   mã đã lộ không về lại AVAILABLE. Log chỉ chứa dữ liệu đã mask/hash.
8. Provider: adapter contract (authenticate/getBalance/getCatalog/getProducts/getPrice/
   validatePlayer/createOrder/getOrderStatus/cancelOrder/processWebhook/reconcile);
   capability khai báo theo product/region, method không hỗ trợ trả UNSUPPORTED rõ ràng;
   không đánh dấu SUCCESS chỉ vì HTTP 200; timeout sau submit → UNKNOWN, inquiry trước retry.
   Credential: DB chỉ giữ secret REFERENCE, không plaintext.
9. Routing: lọc theo SKU/region/currency/capability/stock/balance/status → xếp hạng
   priority/cost/success-rate/latency/risk; log lý do chọn nguồn; circuit breaker
   CLOSED/OPEN/HALF_OPEN.
10. Commission: rule theo beneficiary/base/rate|fixed/điều kiện/vesting/reversal;
    tổng commission bị CAP theo margin/policy; refund → đảo commission.
11. Credit: available = limit − outstanding − reserved; adjustment phải maker-checker.
12. Refund: tham chiếu đơn gốc, ≤ số đã thu, idempotent; đơn top-up SUCCESS không tự hoàn.
13. Reconciliation: lệch tạo case có owner/severity/evidence/resolution/audit;
    không sửa ledger bằng thao tác admin trực tiếp.
14. Security: hash mật khẩu mạnh (bcryptjs — tương đương vai trò Argon2id trong bản này,
    ghi chú trong docs), RBAC + data-scope (agent chỉ thấy nhánh của mình), MFA-ready
    (TOTP field + step-up cho thao tác nhạy cảm: reveal PIN, duyệt tiền), audit append-only
    cho mọi hành động quản trị quan trọng, rate limit, security headers, maker-checker cho
    tiền (nạp tay/rút/điều chỉnh/credit), webhook verify HMAC + chống replay (timestamp+nonce).
15. Partner API (doc 06): REST/JSON, versioning /v1, error envelope thống nhất + request_id,
    auth = API key + HMAC signature (Authorization, X-Client-Id, X-Timestamp, X-Nonce,
    X-Signature, Idempotency-Key), key chỉ hiện 1 lần lúc tạo (lưu hash), tiền trả
    amount_minor + currency, pagination cursor. Error codes đúng doc:
    AUTH_INVALID, SIGNATURE_INVALID, REPLAY_DETECTED, RATE_LIMITED, PERMISSION_DENIED,
    PRODUCT_NOT_FOUND, REGION_UNSUPPORTED, PLAYER_INVALID, INSUFFICIENT_BALANCE,
    CREDIT_LIMIT_EXCEEDED, DUPLICATE_REQUEST, PROVIDER_UNAVAILABLE, ORDER_PENDING,
    ORDER_UNKNOWN, ORDER_FAILED, VALIDATION_EXPIRED.
    Webhook events: order.created/processing/success/failed/refunded,
    wallet.deposit.success, card.delivery.completed — payload có event_id/event_type/
    created_at/resource_id/data + signature; consumer dedupe theo event_id; retry backoff.
16. MỌI cấu hình nghiệp vụ phải nằm trong DB và sửa được ở Admin → Cài đặt, KHÔNG hard-code
    (phí, chiết khấu gạch thẻ theo nhà mạng/mệnh giá, hạn mức, ngưỡng maker-checker,
    commission cap, thời gian giữ mã, SLA...) — luật riêng của chủ dự án.
17. UI: KHÔNG emoji — icon SVG/CSS. Brand doc 04: navy #14213D, primary #2563EB,
    bg #F5F7FB, surface #FFFFFF, success #16A34A, warning #F59E0B, danger #DC2626.
    Giao diện tiếng Việt. Mọi màn hình có loading/empty/error state cơ bản; đơn UNKNOWN
    hiển thị "Đang xác minh", không hiển thị thất bại; giá/phí/tổng cuối hiện trước xác nhận.

## Schema (doc 05 — dựng đủ các bảng này bằng Prisma/PostgreSQL)
Identity: users, user_profiles, roles, permissions, user_roles, role_permissions, sessions,
user_devices, verification_records.
Agent: agent_levels, agents, agent_closure, agent_relation_history, agent_invitations.
Catalog: categories, products, product_variants, product_fields, game_catalog, game_regions,
game_servers, pricing_plans, price_rules, price_snapshots, fx_rates.
Orders: orders, order_items, order_status_history, order_fulfillments, topup_orders,
exchange_orders, card_purchase_orders.
Provider: providers, provider_credentials (reference), provider_capabilities,
provider_products, provider_price_snapshots, provider_transactions, provider_webhook_events,
provider_health_metrics, provider_reconciliation_runs, provider_reconciliation_items,
reconciliation_cases.
Wallet: wallets, ledger_accounts, ledger_transactions, ledger_entries, wallet_holds,
wallet_transfers, deposits, withdrawal_requests, credit_accounts, credit_transactions,
financial_approval_requests, payment_intents.
Cards: card_batches, card_inventory, card_reservations, card_deliveries, card_access_audit.
Commission: commission_plans, commission_rules, commission_entries, commission_settlements.
Platform: api_clients, api_keys, api_usage_logs, webhook_endpoints, webhook_deliveries,
support_tickets, ticket_messages, disputes, notifications, documents, document_versions,
audit_logs, feature_flags, settings.

## Module domain (src/modules/ hoặc src/lib/)
money, ledger (post/hold/release/settle/reverse + kiểm cân bằng), orders (state machine +
idempotency + snapshot), pricing (precedence), agents (closure + chống chu trình),
cards (crypto + fingerprint + reserve/deliver), providers (contract + ManualProvider +
MockProvider sandbox có kịch bản success/failed/unknown/pending + routing + circuit breaker),
commission, credit, payments (deposit intent + callback ký), webhooks (outbox + delivery +
retry), reconciliation, support/disputes, audit, security (session JWT, RBAC guard,
HMAC verify, rate limit), settings (đọc config từ DB có cache ngắn).

Luồng tiền chính phải chạy thật end-to-end ở bản này:
- Mua nạp game / mua thẻ: validate → tính giá (precedence + snapshot) → kiểm ví/credit →
  tạo order bằng idempotency-key → hold tiền → reserve mã (nếu bán thẻ) / route provider
  (nếu top-up) → settle hoặc release/refund → commission → webhook + notification.
- Gạch thẻ: nhận thẻ → validate format → fingerprint chống trùng → provider Manual/Mock
  hoặc hàng chờ thủ công → xác nhận mới post ledger cộng tiền theo chiết khấu trong settings.
- Nạp ví: deposit intent (chuyển khoản thủ công/MockPay) → maker tạo → checker duyệt →
  ledger posting → webhook wallet.deposit.success.
- Rút tiền: request → kiểm KYC/hold/nợ → maker-checker → payout ghi nhận → reconcile.

## Bề mặt web (App Router)
Public: `/` home, `/nap-game` + `/nap-game/[slug]` (chọn region/server, nhập UID,
validate → hiện nickname xác nhận, chọn gói, bảng giá breakdown, checkout),
`/cua-hang-the` + chi tiết/mua thẻ, `/doi-the` gạch thẻ + tra cứu, `/dai-ly` giới thiệu
chương trình đại lý, `/tai-lieu` docs portal (public/agent/partner theo quyền + OpenAPI),
`/tro-giup`, `/dang-nhap`, `/dang-ky`, trang terms/privacy tĩnh.
Customer `/tai-khoan`: dashboard (available/held, đơn gần đây), đơn hàng + chi tiết
(timeline trạng thái), ví (nạp/chuyển/rút/statement từ ledger), thẻ đã mua (reveal PIN —
step-up + audit), gạch thẻ của tôi, ticket hỗ trợ, API keys (nếu được cấp), thông báo.
Agent `/dai-ly/portal`: dashboard (doanh số, commission pending/available, credit limit,
dư nợ, nhánh), cây mạng lưới + tạo sub-agent, bảng giá được cấp, đơn trong scope,
commission, báo cáo nhánh.
Admin `/admin`: overview KPI (doanh số, margin, UNKNOWN, đối soát), users, agents + levels,
products/games/packages, card inventory (import batch + quarantine lỗi), exchange queue,
top-up orders, providers + SKU mapping + routing + health, pricing plans/rules, wallets +
ledger viewer, deposits/withdrawals (maker-checker), credit, commissions + settlements,
disputes, reconciliation cases, reports, docs management, roles/permissions, audit log,
settings (mọi cấu hình nghiệp vụ), API clients.
Admin UI dùng layout/sidebar + bảng dữ liệu dùng chung để gọn; trang nào cũng phải chạy thật
trên dữ liệu seed, không để trang chết/mock rỗng.

Partner API đặt tại route thật `/v1/...` (app router thư mục `src/app/v1/...`) đúng doc 06:
categories, products, products/{id}, games, games/{id}/packages, regions, prices,
topups/validate, orders (POST/GET/GET{id}/cancel), wallet/balance|transactions|statement|
deposit-intents|transfers, cards/products|purchases|orders/{id}, card-exchange
submissions + {id}, agents/me|network|sub-agents|pricing|commissions|reports.
Kèm `docs/openapi.yaml` (OpenAPI 3.1) khớp các endpoint đã làm + trang tài liệu hiển thị nó.

Provider webhook inbound: `/v1/webhooks/{provider}` verify HMAC, dedupe event, enqueue xử lý.
Outbound webhook: bảng webhook_deliveries + worker hàm deliver (chạy inline/cron route
`/api/cron/webhooks` cũng được) có retry backoff + chữ ký.

## Seed (prisma/seed.ts) — dữ liệu mẫu chạy thử được ngay
- Roles + permissions đầy đủ theo doc 08/10 (Super Admin, System Admin, Operations,
  Finance, Support, Product Manager, Provider Manager, Risk/Compliance, Auditor,
  Customer, Agent).
- Agent levels cấu hình bằng dữ liệu: Member, Silver, Gold, Diamond, Master, Distributor.
- Settings mặc định: chiết khấu gạch thẻ theo nhà mạng, phí, ngưỡng maker-checker,
  commission cap %, hold TTL, rate limit... (ghi rõ là giá trị mẫu, sửa ở Admin).
- Categories + products: thẻ Viettel/Mobifone/Vinaphone/Garena/Zing mệnh giá
  10k–500k; games: Liên Quân Mobile, Free Fire, Genshin Impact, PUBG Mobile + packages,
  regions/servers, product_fields (UID/server).
- Pricing plans + rules mẫu theo cấp; commission plan mẫu; FX rate USD/VND mẫu.
- Providers: MANUAL (xử lý thủ công) + MOCK (sandbox, kịch bản theo đuôi UID/mệnh giá
  để test success/failed/unknown) + mapping SKU + capability.
- Card batches mẫu: vài chục mã mã hoá sẵn (PIN mẫu ghi trong README mục demo).
- Tài khoản demo (ghi vào README, mật khẩu mẫu chỉ cho bản demo):
  superadmin@suncard.vn (Super Admin), ops@suncard.vn, finance@suncard.vn,
  agent@suncard.vn (đại lý Gold có 2 sub-agent), khach@suncard.vn (khách có ví đã nạp
  qua ledger genesis đúng quy trình double-entry, không gán balance tay).
- API client mẫu cho partner + tài liệu cách ký HMAC.

## Kiểm chứng bắt buộc trước khi báo xong
- Local PostgreSQL trong sandbox: dùng bộ PG portable ở ~/workspace/tools/pg/dist —
  chạy như user nobody từ /tmp (initdb ở /tmp/pg-data-suncard, port 5440, socket /tmp),
  DATABASE_URL trỏ vào đó. Prisma engines: `npm install --ignore-scripts` rồi curl 2 file
  engine như AGENTS.md mục Prisma (hoặc copy engines từ ~/workspace/smmv2/node_modules/
  @prisma/engines nếu cùng version 5.22 — ưu tiên copy cho nhanh) + env
  PRISMA_QUERY_ENGINE_LIBRARY / PRISMA_SCHEMA_ENGINE_BINARY khi generate/push.
- `npx tsc --noEmit` sạch; `npm run build` PASS.
- Test tự động (`npm test`, dùng tsx chạy test/*.test.ts, không cần framework nặng):
  ledger cân bằng + không trừ 2 lần; state machine chặn transition sai; pricing precedence;
  idempotency trùng key → 1 order; fingerprint trùng thẻ → reject; reserve→deliver 1 lần,
  reveal lần 2 bị audit/chặn theo policy; HMAC đúng/sai chữ ký + replay nonce → reject;
  commission cap; credit vượt limit → reject; UNKNOWN không failover + inquiry xử lý sau;
  RBAC/scope: agent không xem được nhánh ngoài, customer không xem được đơn người khác.
- Chạy server thật + smoke bằng curl các luồng chính: đăng nhập, xem catalog, validate UID
  (Mock), tạo đơn top-up trừ ví đúng + ledger cân, mua thẻ giao mã 1 lần, gạch thẻ mock
  thành công cộng tiền, partner API ký HMAC tạo đơn, webhook inbound trùng event không
  tạo bút toán lặp. Lưu log smoke vào `docs/SMOKE_TEST.md`.

## Hạ tầng & bàn giao
- `.env.example`, `Dockerfile`, `docker-compose.yml` (app + postgres + redis),
  `scripts/install-vps.sh` (cài 1 lệnh trên VPS Ubuntu: docker + deploy + seed tuỳ chọn),
  `DEPLOY.md`, `README.md` (kiến trúc, cách chạy local/VPS/Vercel+Neon, tài khoản demo,
  phạm vi đã làm theo Phase 1–5 của PRD, phần còn để giai đoạn sau: provider thật cần
  hợp đồng/sandbox của từng nhà cung cấp, cổng thanh toán thật cần pháp lý — ghi trung thực).
- Copy bộ tài liệu gốc vào `docs/spec/` dạng .md (trích từ docx) hoặc ít nhất README trỏ về
  bộ tài liệu v1.0 + file `docs/FEATURE_MAP.md` ánh xạ từng FR-01..17 và từng doc 01–11
  → module/trang/API tương ứng, mục nào xong/một phần/chưa làm ghi rõ, không nhận quá.
- KHÔNG commit secret/.env thật; secrets qua env. `.gitignore` chuẩn.
- Code xong commit + push thẳng lên main của thanhtinz/Suncard qua git thường lệ
  (repo đã clone sẵn tại ~/workspace/suncard, đang ở nhánh main chưa có commit nào).
  Kiểm chứng sau push bằng `git ls-remote` / GitHub API: commit mới nhất trên main khớp local.

## Phong cách làm việc
- Làm theo từng mảng, mảng nào xong test mảng đó (theo luật làm việc của chủ dự án).
- Không emoji trong UI. Không hard-code cấu hình nghiệp vụ. Không bịa provider/cổng
  thanh toán thật — chỉ Manual + Mock sandbox, ghi rõ.
- Nếu một phần quá lớn phải cắt, cắt ở bề mặt (ít trang phụ hơn) chứ không cắt ở lõi tiền:
  ledger/order/idempotency/security phải đủ và có test.
