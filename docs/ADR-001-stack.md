# ADR-001 — Chọn stack triển khai: Next.js 14 + TypeScript + Prisma + PostgreSQL

- **Trạng thái:** Đã chốt (Accepted)
- **Ngày:** 06/11/2026
- **Bối cảnh tài liệu:** SunCard Enterprise Documentation v1.0, tài liệu 01 (PRD) và 11 (Deployment)

## Bối cảnh

Bộ tài liệu gốc SunCard Enterprise Documentation v1.0 đề xuất một baseline công nghệ:
**Laravel + Vue 3 + PostgreSQL**, kiến trúc modular monolith. Tuy nhiên tài liệu ghi rõ
baseline này là **đề xuất tham khảo**, và quyết định stack cụ thể được **chốt tại thời điểm
triển khai** dựa trên hạ tầng thực tế của đơn vị vận hành.

## Quyết định

Triển khai SunCard bằng:

- **Next.js 14 (App Router) + TypeScript** — một codebase duy nhất cho cả 4 bề mặt:
  Storefront (public), Customer Portal, Agent Portal, Admin Portal, cộng Partner API (`/v1`)
  và Docs Portal.
- **Prisma 5** làm ORM + tầng truy cập dữ liệu (schema bám tài liệu 05 — Database ERD).
- **PostgreSQL** làm cơ sở dữ liệu chính (giữ nguyên lựa chọn DB của tài liệu gốc).
- **Modular monolith**: domain tách theo module trong `src/modules/`
  (money/ledger, orders, pricing, agents, cards, providers, commission, credit,
  payments, webhooks, reconciliation, support, audit, security, settings),
  kèm khả năng chạy tác vụ nền (webhook delivery, đối soát) theo mô hình worker/cron route.

## Lý do

1. **Hạ tầng hiện có của chủ dự án đang chạy stack này thật.** Các hệ thống khác của chủ dự
   án (điển hình SMMv2) đã vận hành Next.js + Prisma + PostgreSQL trong production —
   quy trình build, deploy (Vercel + Postgres/Neon, VPS + Docker), xử lý Prisma engines
   và kinh nghiệm vận hành đều có sẵn. Chọn lại Laravel/Vue đồng nghĩa dựng thêm một
   pipeline PHP/Node thứ hai chỉ cho riêng dự án này.
2. **Một codebase, một ngôn ngữ.** Storefront, Portal, Admin và Partner API dùng chung
   TypeScript, chung module domain (ledger, pricing, state machine đơn hàng) — không có
   lớp tích hợp front/back riêng, giảm bề mặt lỗi tiền tệ và idempotency.
3. **Contract không đổi.** Toàn bộ hợp đồng nghiệp vụ bám tài liệu gốc: schema dữ liệu
   (doc 05), Partner API + mã lỗi + ký HMAC (doc 06), luồng nghiệp vụ (doc 03),
   bảo mật (doc 10). Chỉ tầng framework thay đổi, không thay đổi hành vi hệ thống.
4. **Tốc độ bàn giao Phase 1.** Đội/agent triển khai có sẵn pattern đã kiểm chứng
   (session JWT, RBAC guard, HMAC verify, ledger double-entry) trên cùng stack.

## Hệ quả

- Tích cực: tái dùng hạ tầng deploy/monitor sẵn có; một quy trình CI; tuyển dụng/duy trì
  một stack duy nhất.
- Cần lưu ý: Prisma engines phải có mặt lúc build/runtime — trên môi trường chặn tải
  binary dùng `npm install --ignore-scripts` + copy/curl engines thủ công (xem `DEPLOY.md`).
  Tác vụ nền dài (webhook retry, đối soát) chạy qua cron route/worker thay vì daemon PHP.
- Không ảnh hưởng: mọi FR trong PRD, mọi endpoint Partner API và mọi bảng dữ liệu giữ
  nguyên tên/ngữ nghĩa như tài liệu gốc; đối tác tích hợp không nhận thấy khác biệt.


> Ghi chú bảo mật (Security Specification v1.0): hash mật khẩu dùng **Argon2id** (hash-wasm, ACC-01); TOTP tự triển khai RFC 6238; chi tiết tại `docs/SECURITY_CHECKLIST.md`.
