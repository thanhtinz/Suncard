import type { DB } from "./ledger";

// Order state machine (doc 03/05):
// CREATED → VALIDATING → RESERVED → SUBMITTING → PENDING → PROCESSING
//   → SUCCESS | FAILED | UNKNOWN | REVIEW | REFUND_PENDING → REFUNDED | CANCELLED
// UNKNOWN ≠ FAILED: không failover tự động; chỉ inquiry mới phân giải được UNKNOWN.

export const ORDER_STATUSES = [
  "CREATED", "VALIDATING", "RESERVED", "SUBMITTING", "PENDING", "PROCESSING",
  "SUCCESS", "FAILED", "UNKNOWN", "REVIEW", "REFUND_PENDING", "REFUNDED", "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ["VALIDATING", "CANCELLED"],
  VALIDATING: ["RESERVED", "FAILED", "CANCELLED", "REVIEW"],
  RESERVED: ["SUBMITTING", "PENDING", "CANCELLED", "FAILED", "REVIEW"],
  SUBMITTING: ["PENDING", "PROCESSING", "SUCCESS", "FAILED", "UNKNOWN"],
  PENDING: ["PROCESSING", "SUCCESS", "FAILED", "UNKNOWN", "REVIEW"],
  PROCESSING: ["SUCCESS", "FAILED", "UNKNOWN", "REVIEW"],
  SUCCESS: ["REFUND_PENDING", "REVIEW"],
  FAILED: ["REFUND_PENDING"],
  UNKNOWN: ["PROCESSING", "SUCCESS", "FAILED", "REVIEW"], // chỉ qua inquiry/xác minh, không tự failover
  REVIEW: ["SUCCESS", "FAILED", "REFUND_PENDING", "PROCESSING"],
  REFUND_PENDING: ["REFUNDED", "FAILED"],
  REFUNDED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: string): boolean {
  const list = (TRANSITIONS as Record<string, string[]>)[from];
  return !!list && list.includes(to);
}

export function assertTransition(from: string, to: string) {
  if (!canTransition(from, to)) throw new Error(`INVALID_TRANSITION:${from}->${to}`);
}

export async function transitionOrder(db: DB, orderId: string, to: OrderStatus, actor = "system", note?: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.status === to) return order; // idempotent no-op
  assertTransition(order.status, to);
  const updated = await db.order.update({ where: { id: orderId }, data: { status: to } });
  await db.orderStatusHistory.create({
    data: { orderId, fromStatus: order.status, toStatus: to, actor, note },
  });
  return updated;
}

export const TERMINAL_STATUSES: OrderStatus[] = ["SUCCESS", "FAILED", "REFUNDED", "CANCELLED"];
export function isTerminal(status: string) { return TERMINAL_STATUSES.includes(status as OrderStatus); }

/** Nhãn hiển thị tiếng Việt; UNKNOWN hiển thị "Đang xác minh", tuyệt đối không hiển thị thất bại. */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    CREATED: "Đã tạo", VALIDATING: "Đang kiểm tra", RESERVED: "Đã giữ tiền/mã",
    SUBMITTING: "Đang gửi nhà cung cấp", PENDING: "Đang chờ", PROCESSING: "Đang xử lý",
    SUCCESS: "Thành công", FAILED: "Thất bại", UNKNOWN: "Đang xác minh",
    REVIEW: "Đang rà soát", REFUND_PENDING: "Đang hoàn tiền", REFUNDED: "Đã hoàn tiền",
    CANCELLED: "Đã huỷ", PENDING_GATEWAY: "Chờ cổng thanh toán",
  };
  return map[status] ?? status;
}
