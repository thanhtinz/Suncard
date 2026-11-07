# SunCard — multi-stage Dockerfile (Next.js 14 + Prisma 5 + PostgreSQL)
# Build:  docker build -t suncard .
# Run:    docker run --env-file .env -p 3000:3000 suncard

# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
# --ignore-scripts: tránh postinstall của @prisma/engines tải binary qua mạng
# (engines được copy thủ công ở stage builder nếu có sẵn trong context).
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# ---------- Stage 2: builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma engines: nếu repo/context có sẵn engines (ví dụ copy từ máy dev vào
# node_modules trước khi build, hoặc mount qua build context), giữ nguyên.
# Nếu chưa có, thử tải bằng curl (curl qua proxy hoạt động tốt hơn Node download).
RUN if [ ! -f node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node ]; then \
      HASH=$(node -e "try{console.log(require('./node_modules/@prisma/engines-version/package.json').enginesVersion)}catch(e){console.log('')}"); \
      if [ -n "$HASH" ]; then \
        apk add --no-cache curl && \
        curl -fsSL "https://binaries.prisma.sh/all_commits/${HASH}/debian-openssl-3.0.x/libquery_engine.so.node.gz" | gunzip > node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node || true; \
        curl -fsSL "https://binaries.prisma.sh/all_commits/${HASH}/debian-openssl-3.0.x/schema-engine.gz" | gunzip > node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x || true; \
        chmod +x node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x || true; \
      fi; \
    fi

ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL giả chỉ để prisma generate/build không lỗi khi chưa có DB thật;
# giá trị thật được truyền lúc runtime qua docker-compose / env.
ENV DATABASE_URL="postgresql://suncard:suncard@localhost:5432/suncard?schema=public"

RUN npx prisma generate
RUN npm run build

# ---------- Stage 3: runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next standalone output (nếu next.config bật output: 'standalone').
# Nếu chưa bật standalone, fallback: copy toàn bộ .next + node_modules cần thiết.
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# node_modules (gồm @prisma/engines + .prisma/client đã generate)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ || exit 1

CMD ["npm", "run", "start"]
