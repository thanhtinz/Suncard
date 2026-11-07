#!/usr/bin/env bash
# Restore TEST (SEC-DR-01): khôi phục bản backup mới nhất vào DB tạm, kiểm tra bảng lõi + số dòng, rồi xoá DB tạm.
# Bằng chứng: in ra số bảng và count của users/orders/ledger_transactions; lưu log làm bằng chứng diễn tập.
# Dùng: PGHOST=... PGPORT=... PGUSER=... ./scripts/restore-test.sh [file_backup.sql.gz]
set -euo pipefail
FILE="${1:-$(ls -t ./backups/*.sql.gz 2>/dev/null | head -1)}"
[ -n "${FILE:-}" ] && [ -f "$FILE" ] || { echo "Không thấy file backup" >&2; exit 1; }
TESTDB="suncard_restore_test_$(date +%s)"
echo "== Restore test từ $FILE vào DB tạm $TESTDB =="
createdb "$TESTDB"
trap "dropdb --if-exists $TESTDB" EXIT
gunzip -c "$FILE" | psql -v ON_ERROR_STOP=1 "$TESTDB" >/dev/null
TABLES=$(psql -t -A "$TESTDB" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
USERS=$(psql -t -A "$TESTDB" -c "SELECT count(*) FROM users")
ORDERS=$(psql -t -A "$TESTDB" -c "SELECT count(*) FROM orders")
LEDGER=$(psql -t -A "$TESTDB" -c "SELECT count(*) FROM ledger_transactions")
echo "RESTORE TEST PASS — bảng: $TABLES, users: $USERS, orders: $ORDERS, ledger_transactions: $LEDGER"
echo "Ngày kiểm tra (UTC): $(date -u +%FT%TZ)"
