"use client";
import { useState } from "react";

export interface SavedBank {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

export const VN_BANKS = [
  "Vietcombank", "VietinBank", "BIDV", "Agribank", "Techcombank", "MB Bank (Quân Đội)",
  "ACB (Á Châu)", "VPBank", "TPBank", "Sacombank", "HDBank", "SHB", "VIB", "MSB (Hàng Hải)",
  "OCB (Phương Đông)", "Eximbank", "SeABank", "Nam A Bank", "VietBank", "Bac A Bank",
  "PVcomBank", "NCB (Quốc Dân)", "ABBank", "Kienlongbank", "LienVietPostBank (LPBank)",
];

export function maskAccount(n: string) {
  if (n.length <= 6) return n;
  return `${n.slice(0, 3)} •••• ${n.slice(-3)}`;
}

export default function BankAccountsManager({ initial }: { initial: SavedBank[] }) {
  const [banks, setBanks] = useState<SavedBank[]>(initial);
  const [bankSel, setBankSel] = useState("");
  const [bankCustom, setBankCustom] = useState("");
  const [account, setAccount] = useState("");
  const [owner, setOwner] = useState("");
  const [asDefault, setAsDefault] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await fetch("/api/account/bank-accounts").catch(() => null);
    const d = await r?.json().catch(() => null);
    if (d?.ok) setBanks(d.banks as SavedBank[]);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(""); setErr("");
    const bankName = bankSel === "__OTHER__" ? bankCustom.trim() : bankSel;
    try {
      const r = await fetch("/api/account/bank-accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, accountNumber: account, accountName: owner, isDefault: asDefault }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d?.message ?? "Không lưu được ngân hàng");
      setMsg("Đã lưu ngân hàng. Lần rút tiền sau chỉ cần chọn trong danh sách.");
      setBankSel(""); setBankCustom(""); setAccount(""); setOwner(""); setAsDefault(false);
      await refresh();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Không lưu được ngân hàng"); }
    setBusy(false);
  }

  async function remove(id: string) {
    setBusy(true); setMsg(""); setErr("");
    try {
      const r = await fetch(`/api/account/bank-accounts/${id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d?.message ?? "Không xoá được ngân hàng");
      setMsg("Đã xoá ngân hàng đã lưu.");
      await refresh();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Không xoá được ngân hàng"); }
    setBusy(false);
  }

  async function makeDefault(id: string) {
    setBusy(true); setMsg(""); setErr("");
    try {
      const r = await fetch(`/api/account/bank-accounts/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d?.message ?? "Không đặt được mặc định");
      setMsg("Đã đặt ngân hàng mặc định cho lần rút tiền.");
      await refresh();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Không đặt được mặc định"); }
    setBusy(false);
  }

  return (
    <div className="card p-5 space-y-4">
      {banks.length === 0 ? (
        <p className="text-sm text-slate-500">Bạn chưa lưu ngân hàng nào. Thêm ngân hàng bên dưới để những lần rút tiền sau chỉ cần chọn trong danh sách, không phải nhập lại.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {banks.map((b) => (
            <div key={b.id} className="py-3 flex flex-wrap items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#FFF3DF] text-sundeep flex items-center justify-center shrink-0">
                <i className="fa-solid fa-building-columns text-[16px]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-navy text-sm flex items-center gap-2 flex-wrap">
                  {b.bankName}
                  {b.isDefault && <span className="badge bg-grad-sun text-white">Mặc định</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{maskAccount(b.accountNumber)} · {b.accountName}</div>
              </div>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {!b.isDefault && (
                  <button type="button" className="btn-ghost !py-1.5 !px-3 text-[13px]" disabled={busy} onClick={() => makeDefault(b.id)}>
                    <i className="fa-solid fa-star" aria-hidden="true" /> Đặt mặc định
                  </button>
                )}
                <button type="button" className="btn-ghost !py-1.5 !px-3 text-[13px] !text-red-600" disabled={busy} onClick={() => remove(b.id)} aria-label={`Xoá ngân hàng ${b.bankName}`}>
                  <i className="fa-solid fa-trash-can" aria-hidden="true" /> Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="space-y-3 border-t border-[#F7EDD8] pt-4" onSubmit={add}>
        <h4 className="font-bold text-navy text-sm">Thêm ngân hàng mới</h4>
        <div>
          <label className="label">Ngân hàng</label>
          <select className="input" value={bankSel} onChange={(e) => setBankSel(e.target.value)} required>
            <option value="" disabled>Chọn ngân hàng</option>
            {VN_BANKS.map((n) => <option key={n} value={n}>{n}</option>)}
            <option value="__OTHER__">Ngân hàng khác (tự nhập)</option>
          </select>
        </div>
        {bankSel === "__OTHER__" && (
          <div><label className="label">Tên ngân hàng</label><input className="input" value={bankCustom} onChange={(e) => setBankCustom(e.target.value)} required placeholder="Nhập tên ngân hàng của bạn" /></div>
        )}
        <div><label className="label">Số tài khoản</label><input className="input" inputMode="numeric" value={account} onChange={(e) => setAccount(e.target.value)} required placeholder="Chỉ nhập số" /></div>
        <div><label className="label">Chủ tài khoản</label><input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} required placeholder="Tên in trên tài khoản" /></div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={asDefault} onChange={(e) => setAsDefault(e.target.checked)} className="accent-[#E86A17]" />
          Đặt làm ngân hàng mặc định khi rút tiền
        </label>
        {msg && <div className="rounded-lg bg-green-50 text-green-700 px-3 py-2 text-sm">{msg}</div>}
        {err && <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{err}</div>}
        <button className="btn-primary w-full" disabled={busy}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Lưu ngân hàng
        </button>
      </form>
    </div>
  );
}
