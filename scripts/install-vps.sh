#!/usr/bin/env bash
# SunCard — cài đặt 1 lệnh trên VPS Ubuntu
# Dùng:  curl -fsSL https://raw.githubusercontent.com/thanhtinz/Suncard/main/scripts/install-vps.sh | bash
# hoặc:  bash scripts/install-vps.sh
# Tuỳ chọn: SEED=1 bash scripts/install-vps.sh   (chạy thêm seed dữ liệu demo)
set -euo pipefail

REPO_URL="https://github.com/thanhtinz/Suncard.git"
APP_DIR="${APP_DIR:-/opt/suncard}"
SEED="${SEED:-0}"

log() { printf '\n==> %s\n' "$*"; }

# ---------- 1. Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  log "Chưa có Docker — cài Docker Engine + Compose plugin..."
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg git openssl
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
else
  log "Docker đã có: $(docker --version)"
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "LỖI: docker compose plugin chưa sẵn sàng. Kiểm tra cài đặt Docker rồi chạy lại." >&2
  exit 1
fi

# ---------- 2. Mã nguồn ----------
if [ -d "$APP_DIR/.git" ]; then
  log "Repo đã có tại $APP_DIR — git pull..."
  git -C "$APP_DIR" pull --ff-only
else
  log "Clone repo về $APP_DIR..."
  sudo mkdir -p "$(dirname "$APP_DIR")"
  if [ "$(id -u)" -ne 0 ]; then SUDO=sudo; else SUDO=""; fi
  $SUDO git clone "$REPO_URL" "$APP_DIR" || { git clone "$REPO_URL" "$APP_DIR"; }
fi
cd "$APP_DIR"

# ---------- 3. .env ----------
if [ ! -f .env ]; then
  log "Chưa có .env — tạo .env với secret ngẫu nhiên (openssl rand)..."
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -hex 48)"
  CARD_ENCRYPTION_KEY="$(openssl rand -base64 32)"
  CARD_FINGERPRINT_KEY="$(openssl rand -hex 32)"
  PARTNER_WEBHOOK_SECRET="$(openssl rand -hex 32)"
  PROVIDER_WEBHOOK_SECRET="$(openssl rand -hex 32)"
  cat > .env <<EOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://suncard:${POSTGRES_PASSWORD}@postgres:5432/suncard?schema=public
JWT_SECRET=${JWT_SECRET}
CARD_ENCRYPTION_KEY=${CARD_ENCRYPTION_KEY}
CARD_FINGERPRINT_KEY=${CARD_FINGERPRINT_KEY}
PARTNER_WEBHOOK_SECRET=${PARTNER_WEBHOOK_SECRET}
PROVIDER_WEBHOOK_SECRET=${PROVIDER_WEBHOOK_SECRET}
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
  chmod 600 .env
  echo "Đã tạo .env (quyền 600). KHÔNG commit file này."
else
  log ".env đã tồn tại — giữ nguyên, không ghi đè secret."
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a

# ---------- 4. Build + chạy ----------
log "docker compose up -d --build ..."
docker compose up -d --build

log "Chờ Postgres khoẻ..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U suncard -d suncard >/dev/null 2>&1; then
    echo "Postgres sẵn sàng."
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then echo "LỖI: Postgres không lên sau 60s." >&2; exit 1; fi
done

# ---------- 5. Schema + seed ----------
log "prisma db push (đồng bộ schema)..."
docker compose exec -T app npx prisma db push

if [ "$SEED" = "1" ]; then
  log "SEED=1 — chạy seed dữ liệu demo..."
  docker compose exec -T app npm run db:seed
else
  log "Bỏ qua seed (chạy lại với SEED=1 nếu muốn dữ liệu demo)."
fi

# ---------- 6. Xong ----------
cat <<'DONE'

============================================================
SunCard đã chạy.
  - App:       http://<IP-VPS>:3000
  - Logs:      docker compose logs -f app
  - Dừng:      docker compose down
  - Cập nhật:  git pull && docker compose up -d --build

Việc cần làm tiếp trên VPS thật:
  1. Trỏ domain + reverse proxy (Nginx/Caddy) + HTTPS (Let's Encrypt).
  2. Sửa NEXT_PUBLIC_APP_URL trong .env thành https://<domain> rồi
     docker compose up -d --build lại.
  3. Đổi mật khẩu các tài khoản demo nếu đã seed (xem README.md).
  4. Sao lưu volume suncard_pgdata định kỳ (pg_dump).
============================================================
DONE
