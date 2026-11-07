# SunCard

Nền tảng phân phối sản phẩm số đa nhà cung cấp cho thị trường Việt Nam và mở rộng quốc tế:
**bán mã thẻ cào/PIN/gift card, nạp game trực tiếp (direct top-up), gạch thẻ (card exchange)**,
mạng lưới **đại lý đa tầng**, **ví nội bộ + sổ cái kép (double-entry ledger)**, công nợ,
hoa hồng, aggregator nhiều provider (routing / webhook / đối soát), **Partner API ký HMAC + sandbox**
và hệ thống Admin vận hành + Support/Dispute.

Spec nguồn: bộ **SunCard Enterprise Documentation v1.0** (11 tài liệu, 06/11/2026) —
xem `docs/spec/README.md`. Ánh xạ tính năng: `docs/FEATURE_MAP.md`.
Quyết định stack: `docs/ADR-001-stack.md`.

## Kiến trúc

Một codebase **modular monolith** — Next.js 14 (App Router) + TypeScript + Prisma 5 + PostgreSQL:

```
SunCard (một codebase)
├── Storefront (public)        /  /nap-game  /cua-hang-the  /doi-the  /dai-ly  /tai-lieu
├── Customer Portal            /tai-khoan   (ví, đơn hàng, thẻ đã mua, ticket)
├── Agent Portal               /dai-ly/portal (mạng lưới, hoa hồng, công nợ, báo cáo)
├── Admin Portal               /admin       (vận hành, duyệt tiền, provider, đối soát, settings)
├── Partner API                /v1/*        (REST + HMAC, xem public/openapi.yaml)
└── Domain modules             src/modules/
    ├── ledger        sổ kép: post / hold / settle / release / reverse, kiểm cân bằng
    ├── orders        state machine đơn + idempotency + snapshot giá
    ├── pricing       precedence: tài khoản → nhánh → cấp đại lý → nhóm khách → mặc định
    ├── agents        closure table đa tầng, chống chu trình
    ├── cards         mã hoá AES-256-GCM + fingerprint HMAC, reserve/giao mã 1 lần
    ├── providers     adapter contract + Manual/Mock + routing + circuit breaker
    ├── commission    rule, vesting, cap theo margin, đảo khi refund
    ├── credit        hạn mức công nợ, maker-checker khi điều chỉnh
    ├── webhooks      outbox + delivery + retry backoff + chữ ký
    ├── security      session JWT, RBAC + data-scope, HMAC verify, rate limit
    ├── settings      mọi cấu hình nghiệp vụ lưu DB, sửa ở Admin → Cài đặt
    └── audit         audit log append-only
```

Luật lõi không phá vỡ: tiền = **integer minor units (BigInt) + currency** (không float);
ledger append-only, balance là projection, sai sửa bằng reversal; đơn chạy đúng state machine
(`UNKNOWN` khác `FAILED`, không failover tự động khi `UNKNOWN`); idempotency ở mọi luồng tiền;
mã thẻ chỉ giao 1 lần và log luôn mask; mọi cấu hình nghiệp vụ nằm trong DB — không hard-code.

## Chạy local

Yêu cầu: Node.js 20+, PostgreSQL 16 (Docker hoặc cài trực tiếp).

```bash
# 1. PostgreSQL — cách nhanh bằng Docker:
docker run -d --name suncard-pg -e POSTGRES_DB=suncard -e POSTGRES_USER=suncard \
  -e POSTGRES_PASSWORD=suncard -p 5432:5432 postgres:16-alpine
# (hoặc dùng luôn: docker compose up -d postgres)

# 2. Cài dependencies (bỏ qua scripts tải engine tự động):
cp .env.example .env        # sửa DATABASE_URL + secret cho khớp máy local
npm install --ignore-scripts

# 3. Prisma engines — nếu sau install vẫn thiếu engine, copy từ dự án smmv2
#    (cùng Prisma 5.22) hoặc tải bằng curl:
cp ~/workspace/smmv2/node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node \
   node_modules/@prisma/engines/ 2>/dev/null || true
cp ~/workspace/smmv2/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x \
   node_modules/@prisma/engines/ 2>/dev/null || true
#    hoặc:
# HASH=$(node -p "require('./node_modules/@prisma/engines-version/package.json').enginesVersion")
# curl -fsSL "https://binaries.prisma.sh/all_commits/$HASH/debian-openssl-3.0.x/libquery_engine.so.node.gz" | gunzip > node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node
# curl -fsSL "https://binaries.prisma.sh/all_commits/$HASH/debian-openssl-3.0.x/schema-engine.gz" | gunzip > node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x && chmod +x node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x
#    Khi generate/push nếu cần, trỏ env:
# export PRISMA_QUERY_ENGINE_LIBRARY=$PWD/node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node
# export PRISMA_SCHEMA_ENGINE_BINARY=$PWD/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x

# 4. Schema + dữ liệu mẫu + chạy:
npx prisma db push
npm run db:seed
npm run dev                 # http://localhost:3000
```

Lệnh khác: `npm run build`, `npm start`, `npm run typecheck`, `npm test` (test lõi:
ledger cân bằng, state machine, pricing precedence, idempotency, fingerprint thẻ,
HMAC + chống replay, commission cap, credit limit, RBAC/scope).

## Tài khoản demo (chỉ dùng cho bản demo)

Sau `npm run db:seed`, đăng nhập được bằng các tài khoản sau — **mật khẩu tất cả: `Suncard@123`**:

| Email | Vai trò |
|---|---|
| `superadmin@suncard.vn` | Super Admin |
| `ops@suncard.vn` | Operations (vận hành) |
| `finance@suncard.vn` | Finance (tài chính / duyệt tiền) |
| `agent@suncard.vn` | Đại lý cấp Gold (có sẵn 2 sub-agent) |
| `khach@suncard.vn` | Khách hàng (ví đã có số dư qua ledger genesis) |

Thẻ mẫu trong kho (để test mua thẻ/giao mã): thẻ **Viettel 10.000đ** —
serial `100088001234567`, PIN `1234567890123` (khớp dữ liệu seed, PIN lưu trong DB
dưới dạng mã hoá; đây là mã mẫu công khai cho demo, không phải thẻ thật).

Production: phải đổi mật khẩu toàn bộ tài khoản demo và xoá/thay thẻ mẫu trước go-live.

## Partner API

- Đặc tả đầy đủ: `public/openapi.yaml` (OpenAPI 3.1), xem trực quan tại trang `/tai-lieu`
  hoặc `GET /openapi.yaml` trên bản đã deploy.
- Ký HMAC: mọi request kèm `Authorization: Bearer <api_key>`, `X-Client-Id`,
  `X-Timestamp`, `X-Nonce`, `X-Signature`, trong đó:

  ```
  signature = HMAC-SHA256(secret, "METHOD\npath\ntimestamp\nnonce\nsha256(body)")
  ```

  POST tạo giao dịch kèm thêm header `Idempotency-Key`. Lỗi trả envelope
  `{ "error": { "code", "message" }, "request_id" }`.

- **Client mẫu (sandbox, do seed tạo):**
  - `client_id`: `demo-partner`
  - API key: `sc_demo_key_0001`
  - Secret: `sc_demo_secret_0001`

  Khi chạy seed, console cũng in ra client mẫu này; nếu giá trị trên khác với bản seed
  đang chạy, lấy giá trị seed in ra làm chuẩn. Key/secret mẫu chỉ dành cho sandbox/demo —
  production tạo client riêng trong Admin → API clients, secret chỉ hiện 1 lần lúc tạo.

## Charging Compat API (gạch thẻ chuẩn thị trường)

Ngoài Partner API /v1, SunCard có lớp tương thích chuẩn chung các web gạch thẻ VN
(khảo sát tại `docs/research/card-exchange-sites.md`):

- `POST`/`GET /chargingws/v2` — `command=charging` gạch thẻ, `command=check` tra cứu.
  Field: `partner_id`, `request_id` (duy nhất theo partner → idempotency),
  `telco`, `amount`, `serial` (chấp nhận alias `seri`), `code`, `sign`.
- `GET /chargingws/v2/getfee?partner_id=` — bảng phí của partner theo nhóm phí.
- Sign MD5 chấp nhận cả legacy `md5(key+code+serial)` và mở rộng
  `md5(key+code+command+partner_id+request_id+serial+telco)`; check ký
  `md5(key+command+partner_id+request_id)`; callback dùng `callback_sign = md5(key+code+serial)`.
- Status: 99 xử lý, 1 đúng mệnh giá, 2 sai mệnh giá (tính theo mệnh giá THẬT + penalty
  cấu hình), 3 thẻ lỗi, 4 bảo trì; lỗi request 100/101/102/103/104.
- Phí lấy từ ma trận `exchange_fee_rules` (telco × mệnh giá × nhóm MEMBER/AGENT/API)
  seed theo số liệu khảo sát 06/11/2026 — sửa ở Admin, không hard-code.

## Bảo mật (Security Specification v1.0)

- Mật khẩu **Argon2id**; **TOTP bắt buộc cho Admin** (chưa bật MFA không vào được /admin);
  phiên DB thu hồi được, login throttling, cảnh báo thiết bị mới.
- Kho thẻ AES-256-GCM + **Secure Reveal 9 bước** + **Emergency Vault Lock** + **Risk Engine**
  (fraud queue ở Admin → Hàng chờ rủi ro).
- Đối chiếu từng yêu cầu + bằng chứng test: `docs/SECURITY_CHECKLIST.md`.
- Backup/DR (mục tiêu RPO ≤ 15 phút, RTO ≤ 4 giờ) + key recovery: `DEPLOY.md`,
  `scripts/backup.sh`, `scripts/restore-test.sh`.
- Lưu ý demo: tài khoản quản trị ở lần đăng nhập đầu sẽ được yêu cầu thiết lập MFA
  (trang Tài khoản → Bảo mật 2 lớp) trước khi vào được khu Admin — đúng thiết kế spec.

## Triển khai

Xem `DEPLOY.md` — gồm: VPS 1 lệnh (`scripts/install-vps.sh`), Docker Compose thủ công
(`Dockerfile` + `docker-compose.yml`: app + PostgreSQL 16 + Redis dự phòng), Vercel + Neon,
và checklist go-live.

## Phạm vi — nói trung thực

- **Đã làm (Phase 1 lõi):** auth/RBAC, catalog + pricing, ví/ledger, nạp ví maker-checker,
  rút tiền, chuyển ví, mua thẻ, nạp game, gạch thẻ, đại lý đa tầng, hoa hồng, công nợ,
  routing/webhook/đối soát ở mức lõi, Partner API + sandbox, Admin/Support/Dispute,
  Settings cấu hình trong DB, audit log. Chi tiết từng FR: `docs/FEATURE_MAP.md`.
- **Provider thật — chưa làm:** hiện chỉ có **Manual** (xử lý thủ công) và **Mock**
  (sandbox mô phỏng). Nối provider thật cần hợp đồng + sandbox của từng nhà cung cấp.
- **Cổng thanh toán thật — chưa làm:** nạp ví hiện là chuyển khoản thủ công (maker-checker)
  và MockPay; cổng thật cần pháp lý + hợp đồng cổng thanh toán.
- **MFA TOTP — MFA-ready:** đã có field TOTP + step-up bằng mật khẩu cho thao tác nhạy cảm;
  verify mã TOTP để giai đoạn sau.
- Lộ trình Phase 2–5 (provider thật, thanh toán thật, bảo mật/quy mô, quốc tế):
  xem cuối `docs/FEATURE_MAP.md`.
