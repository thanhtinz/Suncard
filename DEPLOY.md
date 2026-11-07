# SunCard — Hướng dẫn triển khai (DEPLOY)

Ba đường triển khai: **VPS bằng script 1 lệnh** (khuyến nghị cho production tự quản),
**VPS thủ công bằng Docker Compose**, **Vercel + Neon** (demo / staging nhanh),
và **Local dev**. Biến môi trường bắt buộc ở mọi đường:

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (`postgresql://user:pass@host:5432/db?schema=public`) |
| `JWT_SECRET` | Khoá ký session JWT — random dài, không dùng lại giữa môi trường |
| `CARD_ENCRYPTION_KEY` | Khoá mã hoá AES-256-GCM cho PIN/serial thẻ (base64 32 byte) — mất khoá này là mất toàn bộ kho thẻ |
| `CARD_FINGERPRINT_KEY` | Khoá HMAC tạo fingerprint chống trùng thẻ |
| `PARTNER_WEBHOOK_SECRET` | Secret ký/verify webhook chiều Partner |
| `PROVIDER_WEBHOOK_SECRET` | Secret verify webhook inbound từ provider |
| `NEXT_PUBLIC_APP_URL` | URL công khai của app (dùng cho link/webhook callback) |

Không bao giờ commit `.env` thật. Mẫu: `.env.example`.

---

## 1. VPS — script 1 lệnh (Ubuntu 22.04/24.04)

```bash
curl -fsSL https://raw.githubusercontent.com/thanhtinz/Suncard/main/scripts/install-vps.sh | bash
# kèm dữ liệu demo:
SEED=1 bash scripts/install-vps.sh
```

Script (`scripts/install-vps.sh`, `set -e`) tự làm:

1. Cài Docker Engine + Compose plugin nếu chưa có.
2. Clone (hoặc `git pull`) repo `thanhtinz/Suncard` về `/opt/suncard` (đổi bằng `APP_DIR`).
3. Tạo `.env` với secret random bằng `openssl rand` nếu chưa có (không ghi đè `.env` đã tồn tại).
4. `docker compose up -d --build`.
5. Chờ Postgres khoẻ, chạy `prisma db push` trong container app; chạy seed khi `SEED=1`.
6. In hướng dẫn vận hành cuối (domain/HTTPS, backup).

Sau khi chạy: app ở `http://<IP-VPS>:3000`. Production thật cần thêm reverse proxy
(Nginx/Caddy) + HTTPS và sửa `NEXT_PUBLIC_APP_URL` thành domain https rồi build lại.

## 2. VPS — thủ công bằng Docker Compose

```bash
git clone https://github.com/thanhtinz/Suncard.git
cd Suncard
cp .env.example .env
# sửa .env: đặt POSTGRES_PASSWORD + toàn bộ secret bằng giá trị random thật
#   openssl rand -hex 48        # JWT_SECRET
#   openssl rand -base64 32     # CARD_ENCRYPTION_KEY

docker compose up -d --build
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed   # tuỳ chọn — dữ liệu demo

docker compose ps
docker compose logs -f app
```

`docker-compose.yml` gồm 3 service:

- `app` — build từ `Dockerfile`, port `3000`, env như bảng trên, `DATABASE_URL` trỏ service `postgres`.
- `postgres` — `postgres:16-alpine`, database `suncard`, volume `suncard_pgdata` (dữ liệu bền).
- `redis` — `redis:7-alpine`, **dự phòng** cho worker/rate-limit tương lai; Phase 1 chưa bắt buộc, app chạy được khi Redis tắt.

Cập nhật phiên bản mới:

```bash
git pull
docker compose up -d --build
docker compose exec app npx prisma db push
```

Sao lưu: `docker compose exec postgres pg_dump -U suncard suncard > backup-$(date +%F).sql`

## 3. Vercel + Neon

Phù hợp demo/staging. Production thanh toán thật nên ưu tiên VPS tự quản (kiểm soát khoá mã hoá thẻ + log).

1. **Neon**: tạo project + database, lấy connection string dạng
   `postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require`
   (dùng pooled connection string của Neon cho runtime).
2. **Vercel**: Import repo `thanhtinz/Suncard`, framework Next.js, Root Directory để trống.
3. **Environment Variables** (Project Settings → Environment Variables): đặt đủ
   `DATABASE_URL`, `JWT_SECRET`, `CARD_ENCRYPTION_KEY`, `CARD_FINGERPRINT_KEY`,
   `PARTNER_WEBHOOK_SECRET`, `PROVIDER_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.
4. **Prisma engines — lưu ý quan trọng**: trên môi trường build bị chặn tải binary
   (hoặc dùng `npm install --ignore-scripts`), `@prisma/engines` sẽ thiếu file engine và
   `prisma generate` / truy vấn runtime lỗi. Khắc phục một trong hai cách:
   - Cách chuẩn trên Vercel: để `postinstall`/build chạy bình thường (`npm run build` đã gồm `prisma generate`), Vercel tải được engines từ `binaries.prisma.sh`.
   - Cách thủ công khi tải bị chặn: curl 2 file engine đúng hash phiên bản
     (`node_modules/@prisma/engines-version` → `enginesVersion`):
     `https://binaries.prisma.sh/all_commits/<hash>/debian-openssl-3.0.x/{schema-engine.gz,libquery_engine.so.node.gz}`,
     giải nén vào `node_modules/@prisma/engines/` thành
     `schema-engine-debian-openssl-3.0.x` (chmod +x) và `libquery_engine-debian-openssl-3.0.x.so.node`,
     rồi đặt env `PRISMA_QUERY_ENGINE_LIBRARY` + `PRISMA_SCHEMA_ENGINE_BINARY` trỏ vào 2 file đó khi generate/push.
     (Trên Vercel serverless, target đúng là `debian-openssl-3.0.x` / rhel — kiểm tra log build nếu generate báo thiếu binary target.)
5. **Áp schema + seed** (chạy 1 lần từ máy local trỏ `DATABASE_URL` vào Neon, không chạy trên Vercel):
   ```bash
   npm install --ignore-scripts
   npx prisma db push
   npm run db:seed   # tuỳ chọn
   ```
6. Deploy, mở domain Vercel kiểm tra đăng nhập bằng tài khoản demo (xem README).

Giới hạn Vercel cần biết: hàm cron/webhook worker chạy theo lịch Vercel Cron (nếu cấu hình),
không có tiến trình nền thường trú; Redis không có sẵn — Phase 1 không cần.

## 4. Local dev

Xem mục "Chạy local" trong `README.md`. Tóm tắt:

```bash
# PostgreSQL local (docker hoặc bản portable)
npm install --ignore-scripts
npx prisma db push
npm run db:seed
npm run dev        # http://localhost:3000
npm test           # test lõi tiền/ledger/HMAC
npm run typecheck
```

---

## Checklist go-live

- [ ] Toàn bộ secret là giá trị random riêng cho production, lưu trong vault/quản lý secret — không dùng secret demo.
- [ ] `CARD_ENCRYPTION_KEY` đã sao lưu an toàn riêng (mất = không giải mã được kho thẻ).
- [ ] HTTPS bật, `NEXT_PUBLIC_APP_URL` là domain https.
- [ ] Đã đổi/xoá tài khoản demo và API key demo (`sc_demo_key_0001`).
- [ ] Backup Postgres tự động + đã thử restore.
- [ ] Provider thật: chỉ bật sau khi có hợp đồng/sandbox của nhà cung cấp (hiện tại Manual + Mock).

## Backup, Disaster Recovery & Key Recovery (theo Security Specification mục 15)

**Mục tiêu (baseline đề xuất của spec — cần xác nhận qua diễn tập thực tế, chưa phải cam kết đã kiểm chứng):**

| Hạng mục | Mục tiêu |
|---|---|
| RPO | ≤ 15 phút cho dữ liệu giao dịch quan trọng |
| RTO | ≤ 4 giờ cho dịch vụ cốt lõi |
| Backup DB | Tự động, nén, có checksum, lưu tách hạ tầng chính (offsite), mã hoá khi lưu |
| Restore test | Định kỳ bằng `scripts/restore-test.sh` — có bằng chứng đầu ra (số bảng/dòng) |

### Backup
```bash
DATABASE_URL=postgresql://... ./scripts/backup.sh ./backups
```
- Script dùng `pg_dump` (hoặc container postgres của compose), nén gzip, ghi `.sha256`, kiểm tra `gzip -t`.
- **Mã hoá trước khi rời máy chủ**: ví dụ `age -r <pubkey> -o backup.sql.gz.age backup.sql.gz` hoặc `gpg -c`. Backup chứa dữ liệu nhạy cảm (không chứa plaintext mã thẻ — kho thẻ chỉ giữ ciphertext — nhưng vẫn phải mã hoá theo chính sách).
- Cron mẫu: `0 * * * *` chạy backup giờ; retention 7 bản ngày + 4 bản tuần; copy offsite (S3/object storage khác tài khoản nếu có).

### Restore test (bằng chứng SEC-DR-01)
```bash
PGHOST=... PGPORT=... PGUSER=... ./scripts/restore-test.sh ./backups/<file>.sql.gz
```
Script khôi phục vào DB tạm, in số bảng + count users/orders/ledger_transactions, rồi tự xoá DB tạm. Lưu log đầu ra làm bằng chứng diễn tập (định kỳ tối thiểu hàng quý và sau thay đổi kiến trúc lớn).

### Key recovery — QUAN TRỌNG
Dữ liệu nhạy cảm phụ thuộc các khóa trong env/secret manager:
- `CARD_ENCRYPTION_KEY`: mất khóa này = **không giải mã được kho thẻ và TOTP secret** (dữ liệu coi như mất vĩnh viễn).
- `CARD_FINGERPRINT_KEY`: mất = không tra trùng fingerprint theo cách cũ (phải dựng lại chỉ mục).
- `JWT_SECRET`: mất/đổi = mọi phiên đăng nhập bị vô hiệu (người dùng đăng nhập lại).
Quy trình: lưu các khóa trong **secret manager/vault tách biệt** với backup DB, có kiểm soát truy cập kép; diễn tập khôi phục gồm cả khôi phục khóa; xoay khóa (rotation) phải có kế hoạch re-encrypt dữ liệu thẻ theo envelope version (`v1.` prefix trong ciphertext).
