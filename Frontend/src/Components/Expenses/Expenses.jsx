import { useEffect, useState, useCallback } from "react";
import { FaPlus, FaReceipt, FaSpinner, FaSearch, FaBan, FaMoneyBillWave, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";
import { baseCurrency } from "../../helper/currency";
import CustomSelect from "../common/CustomSelect";

const LIMIT = 20;
const money   = (n) => `${baseCurrency()} ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_CFG = {
  recorded: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Recorded" },
  void:     { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "Void" },
};

export default function Expenses() {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null); // expense row pending void confirm

  // Pay modal — settle an unpaid expense from a cash/bank account.
  const [payTarget, setPayTarget] = useState(null); // expense row being paid
  const [payAccount, setPayAccount] = useState("");
  const [paying, setPaying] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    axiosInstance.get("/api/accounts/?limit=500&status=active")
      .then(r => setBankAccounts((r.data?.data?.accounts || []).filter(a => a.isBankAccount)))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/expenses/?page=${page}&limit=${LIMIT}`);
      setRows(res.data?.data?.expenses || []);
      setTotal(res.data?.data?.total || 0);
    } catch {
      nexusToast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const confirmVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await axiosInstance.patch(`/api/expenses/${voidTarget._id}/void`);
      nexusToast.success("Expense voided");
      setVoidTarget(null);
      load();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || "Failed to void");
    } finally {
      setVoiding(false);
    }
  };

  const submitPay = async () => {
    if (!payAccount) { nexusToast.error("Pick a cash/bank account"); return; }
    setPaying(true);
    try {
      await axiosInstance.patch(`/api/expenses/${payTarget._id}/pay`, { paidThrough: payAccount });
      nexusToast.success("Expense paid");
      setPayTarget(null);
      setPayAccount("");
      load();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || "Failed to pay");
    } finally {
      setPaying(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(r =>
        (r.expenseNumber || "").toLowerCase().includes(q) ||
        (r.payee || "").toLowerCase().includes(q) ||
        (r.expenseAccountName || "").toLowerCase().includes(q))
    : rows;

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  const th = { padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
  const td = { padding: "11px 14px", fontSize: 13, color: T.textPri, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: "20px", color: T.textPri, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? "rgba(59,130,246,0.12)" : "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: T.blue }}>
              <FaReceipt size={16} />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 19, fontWeight: 800, color: T.textPri, margin: 0 }}>Expenses</h1>
              <p style={{ fontSize: 12, color: T.textSec, margin: "2px 0 0" }}>{total} record{total === 1 ? "" : "s"}</p>
            </div>
          </div>
          <button onClick={() => navigate("/Purchase/Expenses/New")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", background: "linear-gradient(135deg,#3b82f6,#2563eb)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <FaPlus size={11} /> New Expense
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16, maxWidth: 360 }}>
          <FaSearch size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number, payee, account…"
            style={{ width: "100%", padding: "9px 12px 9px 32px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, fontFamily: "inherit", outline: "none" }} />
        </div>

        {/* Table */}
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.surface2 }}>
                  <th style={th}>Number</th>
                  <th style={th}>Date</th>
                  <th style={th}>Account</th>
                  <th style={th}>Payee</th>
                  <th style={th}>Paid Through</th>
                  <th style={{ ...th, textAlign: "right" }}>Total</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: "center" }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ ...td, textAlign: "center", padding: 40, color: T.textSec }}><FaSpinner style={{ animation: "spin .7s linear infinite" }} /> Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...td, textAlign: "center", padding: 50, color: T.textSec }}>No expenses yet. Click “New Expense” to record one.</td></tr>
                ) : filtered.map((r) => {
                  const sc = STATUS_CFG[r.status] || STATUS_CFG.recorded;
                  return (
                    <tr key={r._id}>
                      <td style={{ ...td, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: T.blue }}>{r.expenseNumber}</td>
                      <td style={td}>{fmtDate(r.date)}</td>
                      <td style={{ ...td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{r.expenseAccountName || "—"}</td>
                      <td style={td}>{r.payee || "—"}</td>
                      <td style={{ ...td, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.paid
                          ? (r.paidThroughName || "—")
                          : <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "3px 9px", borderRadius: 6 }}>Unpaid · Payable</span>}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{money(r.total)}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, padding: "3px 9px", borderRadius: 6 }}>{sc.label}</span>
                      </td>
                      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                        {r.status !== "void" && !r.paid && (
                          <button onClick={() => { setPayTarget(r); setPayAccount(""); }} title="Pay"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#10b981", padding: 4, marginRight: 6 }}>
                            <FaMoneyBillWave size={13} />
                          </button>
                        )}
                        {r.status !== "void" && (
                          <button onClick={() => setVoidTarget(r)} title="Void"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                            <FaBan size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ padding: "7px 14px", border: `1.5px solid ${T.border}`, borderRadius: 8, background: T.surface, color: T.textSec, fontSize: 12, fontWeight: 600, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
            <span style={{ fontSize: 12, color: T.textSec }}>Page {page} of {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
              style={{ padding: "7px 14px", border: `1.5px solid ${T.border}`, borderRadius: 8, background: T.surface, color: T.textSec, fontSize: 12, fontWeight: 600, cursor: page >= pages ? "not-allowed" : "pointer", opacity: page >= pages ? 0.5 : 1 }}>Next</button>
          </div>
        )}
      </div>

      {/* Pay modal */}
      {payTarget && (
        <div onClick={() => !paying && setPayTarget(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 420, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24, fontFamily: "'DM Sans',sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>Pay Expense</h2>
              <button onClick={() => !paying && setPayTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec }}><FaTimes size={15} /></button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: T.textSec }}>{payTarget.expenseNumber}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: T.blue, fontFamily: "'DM Mono',monospace" }}>{money(payTarget.total)}</span>
            </div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Pay From <span style={{ color: "#ef4444" }}>*</span></label>
            <CustomSelect value={payAccount} onChange={setPayAccount} placeholder="Select cash/bank…"
              options={[{ value: "", label: "Select cash/bank…" }, ...bankAccounts.map(a => ({ value: a._id, label: `[${a.accountCode}] ${a.accountName}` }))]} />
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setPayTarget(null)} disabled={paying}
                style={{ flex: 1, padding: "10px 0", border: `1.5px solid ${T.border}`, borderRadius: 9, background: "transparent", color: T.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={submitPay} disabled={paying}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: paying ? "not-allowed" : "pointer", opacity: paying ? 0.7 : 1 }}>
                {paying ? <><FaSpinner size={12} style={{ animation: "spin .7s linear infinite" }} /> Paying…</> : <><FaMoneyBillWave size={13} /> Confirm Pay</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void confirm modal */}
      {voidTarget && (
        <div onClick={() => !voiding && setVoidTarget(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 400, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24, fontFamily: "'DM Sans',sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", flexShrink: 0 }}>
                <FaBan size={16} />
              </div>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>Void Expense?</h2>
            </div>
            <p style={{ fontSize: 13, color: T.textSec, lineHeight: 1.6, margin: "0 0 4px" }}>
              <b style={{ color: T.textPri }}>{voidTarget.expenseNumber}</b> ({money(voidTarget.total)}) will be voided and a reversing journal entry posted. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setVoidTarget(null)} disabled={voiding}
                style={{ flex: 1, padding: "10px 0", border: `1.5px solid ${T.border}`, borderRadius: 9, background: "transparent", color: T.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmVoid} disabled={voiding}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: voiding ? "not-allowed" : "pointer", opacity: voiding ? 0.7 : 1 }}>
                {voiding ? <><FaSpinner size={12} style={{ animation: "spin .7s linear infinite" }} /> Voiding…</> : <><FaBan size={12} /> Void Expense</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
