import { prisma } from "@/lib/prisma";

// Mọi cấu hình nghiệp vụ nằm trong DB (bảng settings), sửa ở Admin → Cài đặt.
// Module này đọc có cache ngắn 30s; setSetting xoá cache của key.

export const DEFAULT_SETTINGS: Record<string, { value: unknown; group: string; description: string }> = {
  "exchange.discount.viettel": { value: 1500, group: "exchange", description: "Phí gạch thẻ Viettel (bps) — giá trị mẫu" },
  "exchange.discount.mobifone": { value: 1600, group: "exchange", description: "Phí gạch thẻ Mobifone (bps) — giá trị mẫu" },
  "exchange.discount.vinaphone": { value: 1600, group: "exchange", description: "Phí gạch thẻ Vinaphone (bps) — giá trị mẫu" },
  "exchange.discount.garena": { value: 1200, group: "exchange", description: "Phí gạch thẻ Garena (bps) — giá trị mẫu" },
  "exchange.discount.zing": { value: 1200, group: "exchange", description: "Phí gạch thẻ Zing (bps) — giá trị mẫu" },
  "exchange.wrong_value_penalty_bps": { value: 5000, group: "exchange", description: "Phạt sai mệnh giá gạch thẻ: bps của mệnh giá nhỏ hơn (5000 = 50%, chuẩn thị trường). Biến thể 'bảo hiểm sai mệnh giá' (nhóm phí cao hơn, không áp phạt) là ý tưởng mở rộng từ cardvip — chưa bật." },
  "exchange.provider_code": { value: "MOCK", group: "exchange", description: "Provider xử lý gạch thẻ: MOCK (sandbox) hoặc MANUAL (hàng chờ thủ công)" },
  "exchange.min_face_minor": { value: 10000, group: "exchange", description: "Mệnh giá gạch thẻ tối thiểu (minor)" },
  "exchange.max_face_minor": { value: 5000000, group: "exchange", description: "Mệnh giá gạch thẻ tối đa (minor)" },
  "wallet.transfer_fee_bps": { value: 0, group: "wallet", description: "Phí chuyển ví nội bộ (bps)" },
  "wallet.min_deposit_minor": { value: 10000, group: "wallet", description: "Nạp tối thiểu (minor)" },
  "wallet.min_withdraw_minor": { value: 50000, group: "wallet", description: "Rút tối thiểu (minor)" },
  "wallet.withdraw_fee_minor": { value: 0, group: "wallet", description: "Phí rút cố định (minor)" },
  "finance.maker_checker_threshold_minor": { value: 1000000, group: "finance", description: "Ngưỡng bắt buộc maker-checker (minor). Dưới ngưỡng vẫn ghi approval để audit." },
  "commission.cap_bps_of_margin": { value: 8000, group: "commission", description: "Tổng hoa hồng tối đa = % này của margin (bps)" },
  "commission.vesting_days": { value: 0, group: "commission", description: "Số ngày giữ hoa hồng trước khi available" },
  "cards.hold_ttl_minutes": { value: 15, group: "cards", description: "Thời gian giữ mã khi reserve (phút)" },
  "cards.max_reveal_per_card": { value: 20, group: "cards", description: "Số lần reveal PIN tối đa mỗi mã đã giao (mỗi lần đều audit; vượt -> chặn)" },
  "orders.unknown_inquiry_after_minutes": { value: 5, group: "orders", description: "Sau X phút UNKNOWN mới được inquiry" },
  "api.rate_limit_per_minute": { value: 120, group: "api", description: "Giới hạn request/phút cho Partner API theo client" },
  "api.signature_skew_seconds": { value: 300, group: "api", description: "Độ lệch timestamp cho phép của chữ ký HMAC (giây)" },
  "provider.circuit_fail_threshold": { value: 5, group: "provider", description: "Số lỗi liên tiếp mở circuit breaker" },
  "provider.circuit_cooldown_seconds": { value: 120, group: "provider", description: "Thời gian circuit OPEN trước khi HALF_OPEN (giây)" },
  "cards.vault_locked": { value: false, group: "cards", description: "Emergency Vault Lock: BẬT = ngừng MỌI reveal/delivery mã thẻ (spec 7.4). Đổi trạng thái cần step-up + audit." },
  "cards.export_enabled": { value: false, group: "cards", description: "Xuất mã plaintext: mặc định TẮT hẳn. Bật vẫn phải duyệt kép + giới hạn số lượng (spec bảng 8)." },
  "cards.export_max_per_request": { value: 100, group: "cards", description: "Số mã tối đa mỗi lần xuất (khi export được duyệt kép)" },
  "session.admin_ttl_minutes": { value: 120, group: "security", description: "Thời hạn phiên Admin (phút) — ngắn hơn phiên khách (ACC-07)" },
  "session.customer_ttl_minutes": { value: 10080, group: "security", description: "Thời hạn phiên khách (phút, mặc định 7 ngày)" },
  "login.max_attempts": { value: 5, group: "security", description: "Số lần đăng nhập sai tối đa trước khi khóa tạm (ACC-03)" },
  "login.lock_base_minutes": { value: 15, group: "security", description: "Thời gian khóa đăng nhập cơ bản (phút), tăng gấp đôi mỗi lần khóa lặp lại" },
  "security.admin_ip_allowlist": { value: [], group: "security", description: "IP allowlist cho Admin (mảng IP; rỗng = tắt, đây là tùy chọn — spec mục 6)" },
  "security.allow_private_egress": { value: false, group: "security", description: "Cho phép webhook/callback tới địa chỉ nội bộ (SSRF guard). Chỉ bật ở môi trường dev/test nội bộ." },
  "payments.max_intents_per_hour": { value: 20, group: "payments", description: "Velocity: số payment intent tối đa mỗi user mỗi giờ (PAY-06)" },
  "finance.dual_refund_threshold_minor": { value: 5000000, group: "finance", description: "Hoàn tiền vượt ngưỡng này (minor) bắt buộc duyệt kép (PAY-07)" },
  "risk.threshold_medium": { value: 30, group: "risk", description: "Ngưỡng điểm rủi ro mức Medium (step-up + giới hạn)" },
  "risk.threshold_high": { value: 60, group: "risk", description: "Ngưỡng điểm rủi ro mức High (giữ giao mã + manual review)" },
  "risk.threshold_critical": { value: 80, group: "risk", description: "Ngưỡng điểm rủi ro mức Critical (chặn + thu hồi phiên/token + incident)" },
  "risk.w_new_account": { value: 15, group: "risk", description: "Trọng số: tài khoản < 1 ngày" },
  "risk.w_new_device": { value: 15, group: "risk", description: "Trọng số: thiết bị mới chưa từng thấy" },
  "risk.w_velocity_orders": { value: 20, group: "risk", description: "Trọng số: >= 5 đơn trong 1 giờ" },
  "risk.w_large_amount": { value: 15, group: "risk", description: "Trọng số: giá trị giao dịch >= 5.000.000 minor" },
  "risk.w_reveal_velocity": { value: 20, group: "risk", description: "Trọng số: >= 10 lần reveal trong 1 giờ" },
  "risk.w_failed_logins": { value: 10, group: "risk", description: "Trọng số: >= 3 lần đăng nhập sai gần đây" },
  "risk.w_refund_history": { value: 15, group: "risk", description: "Trọng số: có refund/dispute trong 30 ngày" },
  "risk.w_shared_ip": { value: 5, group: "risk", description: "Trọng số NHỎ: IP dùng chung >= 3 tài khoản — không bao giờ chặn cứng chỉ vì VPN/IP chung (spec 9)" },
  "support.sla_hours": { value: 24, group: "support", description: "SLA phản hồi ticket (giờ)" },
};

const cache = new Map<string, { value: unknown; at: number }>();
const TTL_MS = 30_000;

export async function getSetting<T = unknown>(key: string, fallback?: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const row = await prisma.setting.findUnique({ where: { key } });
  const value = row ? (row.value as T) : (DEFAULT_SETTINGS[key]?.value as T) ?? (fallback as T);
  cache.set(key, { value, at: Date.now() });
  return value as T;
}

export async function getNumberSetting(key: string, fallback = 0): Promise<number> {
  const v = await getSetting<unknown>(key, fallback);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function setSetting(key: string, value: unknown, updatedBy?: string) {
  const def = DEFAULT_SETTINGS[key];
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as never, group: def?.group ?? "general", description: def?.description, updatedBy },
    update: { value: value as never, updatedBy },
  });
  cache.delete(key);
}

export function clearSettingsCache() { cache.clear(); }
