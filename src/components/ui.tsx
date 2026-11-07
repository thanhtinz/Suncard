import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { statusLabel } from "@/modules/orders";

export function Money({ v, currency = "VND" }: { v: bigint | number | string; currency?: string }) {
  const n = typeof v === "bigint" ? v : BigInt(String(v).replace(/\D/g, "") || "0") * (String(v).startsWith("-") ? -1n : 1n);
  return <span className="whitespace-nowrap font-medium">{formatMoney(n, currency)}</span>;
}
export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "SUCCESS" || status === "ACTIVE" || status === "APPROVED" || status === "DELIVERED" || status === "AVAILABLE" || status === "PAID" ? "bg-green-100 text-green-700" :
    status === "FAILED" || status === "REJECTED" || status === "DEAD" || status === "EXPIRED" ? "bg-red-100 text-red-700" :
    status === "UNKNOWN" || status === "REVIEW" ? "bg-amber-100 text-amber-700" :
    "bg-blue-100 text-blue-700";
  return <span className={`badge ${color}`}>{statusLabel(status) === status ? status : statusLabel(status)}</span>;
}
export function Empty({ text = "Chưa có dữ liệu" }: { text?: string }) {
  return <div className="card p-8 text-center text-slate-500">{text}</div>;
}
export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div><h1 className="text-2xl font-bold text-navy">{title}</h1>{sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}</div>
      {action}
    </div>
  );
}
export function DataTable({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="card overflow-x-auto"><table className="table"><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
  );
}

