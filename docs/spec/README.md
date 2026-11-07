# Bộ tài liệu gốc — SunCard Enterprise Documentation v1.0

Thư mục này ghi chú về **nguồn spec chính thức** của dự án SunCard:
bộ **SunCard Enterprise Documentation v1.0** (11 tài liệu, ban hành 06/11/2026).

Mọi quyết định nghiệp vụ, schema, API contract và quy trình vận hành trong repo này
bám bộ tài liệu đó. Khi có xung đột giữa code và tài liệu, tài liệu gốc là nguồn tham
chiếu để đối chiếu (trừ quyết định stack đã chốt riêng tại `docs/ADR-001-stack.md`).

## Danh sách 11 tài liệu

| # | Tài liệu | Nội dung chính |
|---|---|---|
| 01 | PRD (Product Requirements Document) | Tầm nhìn, phạm vi Phase 1–5, yêu cầu chức năng FR-01..FR-17 |
| 02 | SRS (Software Requirements Specification) | Yêu cầu phần mềm chi tiết, use case, ràng buộc phi chức năng |
| 03 | Business Logic & Workflows | State machine đơn hàng, ledger kép, pricing precedence, hoa hồng, công nợ, maker-checker |
| 04 | UX/UI | Brand (navy `#14213D`, primary `#2563EB`, nền `#F5F7FB`), bề mặt Storefront/Portal/Admin, trạng thái màn hình |
| 05 | Database ERD | Thiết kế bảng dữ liệu toàn hệ thống |
| 06 | API Specification | Partner API `/v1`: HMAC auth, error envelope, mã lỗi, pagination, webhook |
| 07 | Provider Integration | Contract adapter nhà cung cấp, routing, circuit breaker, webhook, đối soát |
| 08 | Admin SOP | Quy trình vận hành Admin: duyệt tiền, xử lý đơn UNKNOWN, đối soát, dispute |
| 09 | Agent Guide | Hướng dẫn đại lý: cấp bậc, mạng lưới, hoa hồng, công nợ |
| 10 | Security | RBAC, MFA, mã hoá thẻ, audit, chống replay, rate limit |
| 11 | Deployment | Kiến trúc triển khai, môi trường, go-live checklist |

## Ánh xạ tài liệu → module trong repo

| Tài liệu | Module / bề mặt trong repo |
|---|---|
| 01 PRD | Toàn repo; phạm vi theo phase xem `docs/FEATURE_MAP.md` |
| 02 SRS | `src/modules/*` (domain), `src/app/*` (bề mặt web) |
| 03 Business Logic & Workflows | `src/modules/ledger.ts`, `orders.ts`, `orders-service.ts`, `pricing.ts`, `commission.ts`, `credit.ts` |
| 04 UX/UI | `src/app/layout.tsx`, `src/app/globals.css`, `src/components/*`, các trang trong `src/app/` |
| 05 Database ERD | `prisma/schema.prisma` |
| 06 API Specification | `src/app/v1/*` (Partner API), `public/openapi.yaml` |
| 07 Provider Integration | `src/modules/providers.ts`, webhook inbound `src/app/v1/webhooks/[provider]` |
| 08 Admin SOP | `src/app/admin/*` |
| 09 Agent Guide | `src/app/dai-ly/*`, `src/modules/agents.ts` |
| 10 Security | `src/modules/security.ts`, `src/modules/cards.ts` (mã hoá/fingerprint), `src/modules/audit.ts` |
| 11 Deployment | `Dockerfile`, `docker-compose.yml`, `scripts/install-vps.sh`, `DEPLOY.md` |

## Ghi chú

- File `.docx` gốc của bộ tài liệu được lưu ngoài repo (kho tài liệu của chủ dự án);
  thư mục này là bản ghi chú + ánh xạ để người đọc code truy được về nguồn spec.
- Ánh xạ chi tiết từng yêu cầu chức năng FR-01..FR-17: xem `docs/FEATURE_MAP.md`.
