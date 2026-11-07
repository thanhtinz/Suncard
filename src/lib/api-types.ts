// Loại kết nối API người dùng đăng ký — dùng chung cho form (client),
// module duyệt (server) và các endpoint compat kiểm tra quyền theo module.
export const API_TYPES = [
  { key: "CHARGING", label: "Đổi thẻ cào (Charging)", short: "Đổi thẻ cào" },
  { key: "RECHARGE", label: "Nạp topup (Recharge)", short: "Nạp topup" },
  { key: "SOFTCARD", label: "Mua mã thẻ (Softcard)", short: "Mua mã thẻ" },
  { key: "FULL", label: "Tất cả dịch vụ API", short: "Tất cả dịch vụ" },
] as const;

export function apiTypeLabel(key: string): string {
  return API_TYPES.find((t) => t.key === key)?.label ?? key;
}
export function apiTypeShort(key: string): string {
  return API_TYPES.find((t) => t.key === key)?.short ?? key;
}

/** Client có được phép gọi module compat này không (theo loại API đã duyệt). */
export function apiTypeAllows(clientType: string, module: "CHARGING" | "RECHARGE" | "SOFTCARD"): boolean {
  return clientType === "FULL" || clientType === module;
}
