import { prisma } from "@/lib/prisma";

// Rate limit phân tán (Phase 4): đếm theo cửa sổ cố định 1 phút trong Postgres.
// Một câu INSERT ... ON CONFLICT DO UPDATE ... RETURNING count là nguyên tử giữa nhiều
// instance/process — thay limiter in-memory (mỗi process một bộ đếm riêng) ở auth + Partner API.

export const RATE_WINDOW_MS = 60_000;

export function windowStartOf(nowMs: number): Date {
  return new Date(Math.floor(nowMs / RATE_WINDOW_MS) * RATE_WINDOW_MS);
}

/** Tăng bộ đếm và trả về tổng số request trong cửa sổ sau khi tăng. */
export async function incrementRateCounter(key: string, nowMs = Date.now()): Promise<number> {
  const windowStart = windowStartOf(nowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit_counters (id, key, "windowStart", count, "updatedAt")
    VALUES (gen_random_uuid()::text, ${key}, ${windowStart}, 1, NOW())
    ON CONFLICT (key, "windowStart")
    DO UPDATE SET count = rate_limit_counters.count + 1, "updatedAt" = NOW()
    RETURNING count`;
  return rows[0]?.count ?? 1;
}

/** true = cho phép. Lỗi hạ tầng DB -> fail-open có kiểm soát về limiter bộ nhớ để không khoá toàn bộ auth/API. */
export async function rateLimitDistributed(key: string, limitPerMinute: number): Promise<boolean> {
  if (limitPerMinute <= 0) return true;
  try {
    const count = await incrementRateCounter(key);
    return count <= limitPerMinute;
  } catch {
    const { rateLimit } = await import("./security");
    return rateLimit(key, limitPerMinute);
  }
}

/** Dọn bộ đếm của cửa sổ đã qua (cron ops gọi định kỳ). */
export async function purgeOldRateCounters(keepWindows = 5): Promise<number> {
  const cutoff = new Date(Date.now() - keepWindows * RATE_WINDOW_MS);
  const res = await prisma.rateLimitCounter.deleteMany({ where: { windowStart: { lt: cutoff } } });
  return res.count;
}
