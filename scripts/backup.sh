#!/usr/bin/env bash
# Backup PostgreSQL SunCard: dump đã nén gzip. KHUYẾN NGHỊ mã hoá trước khi lưu offsite (xem DEPLOY.md mục Backup/DR).
# Dùng: DATABASE_URL=postgresql://... ./scripts/backup.sh [thư_mục_đích]
set -euo pipefail
DEST="${1:-./backups}"
mkdir -p "$DEST"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DEST/suncard-$TS.sql.gz"
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "${DATABASE_URL:?Cần DATABASE_URL}" | gzip > "$FILE"
elif command -v docker >/dev/null 2>&1; then
  docker compose exec -T postgres pg_dump -U suncard suncard | gzip > "$FILE"
else
  echo "Không tìm thấy pg_dump hoặc docker" >&2; exit 1
fi
# Kiểm tra tính toàn vẹn file nén
gzip -t "$FILE"
sha256sum "$FILE" > "$FILE.sha256"
echo "Backup xong: $FILE"
echo "LƯU Ý: sao chép bản backup sang hạ tầng tách biệt và MÃ HOÁ (age/gpg) — backup chứa dữ liệu nhạy cảm."
echo "Giữ retention tối thiểu 7 bản ngày + 4 bản tuần; kiểm tra restore định kỳ bằng scripts/restore-test.sh."
