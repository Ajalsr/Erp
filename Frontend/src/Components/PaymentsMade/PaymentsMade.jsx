import { useEffect, useState, useCallback, useMemo } from "react";
import { FaPlus, FaTimes, FaSearch, FaMoneyBillWave, FaChevronLeft, FaChevronRight, FaCheckCircle } from "react-icons/fa";
import { useSearchParams } from "react-router-dom";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

const fmtAED  = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const PAYMENT_MODES = ["Cash", "Bank Transfer", "Cheque", "Card", "Other"];

/* ── Record Payment Modal ─────────────────────────────────────────── */
const RecordPaymentModal = ({ T, isDark, onClose, onSaved, prefill }) => {
  const [vendors,      setVendors]      = useState([]);
  const [bills,        setBills]        = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [vendorOpen,   setVendorOpen]   = useState(false);
  const [vendorSearch, setVendorSearch] = useState(prefill?.vendorName || "");
  const [selectedBill, setSelectedBill] = useState(null);
  const [errors,       setErrors]       = useState({});

  const [form, setForm] = useState({
    vendorId:    prefill?.vendorId    || "",
    vendorName:  prefill?.vendorName  || "",
    billId:      prefill?.billId      || "",
    billNumber:  prefill?.billNumber  || "",
    amount:      prefill?.amount      || "",
    date:        new Date().toISOString().split("T")[0],
    paymentMode: "Bank Transfer",
    reference:   "",
    notes:       "",
  });

  // Load all vendors once
  useEffect(() => {
    axiosInstance.get("/api/vendors/?limit=200")
      .then(r => setVendors(r.data?.data?.vendors || []))
      .catch(() => {});
  }, []);

  // Load outstanding bills when vendor selected
  useEffect(() => {
    if (!form.vendorId) { setBills([]); setSelectedBill(null); return; }
    setBillsLoading(true);
    axiosInstance.get(`/api/bills/?vendorId=${form.vendorId}&limit=50`)
      .then(r => {
        const all = r.data?.data?.bills || [];
        setBills(all.filter(b => b.status !== "paid" && b.status !== "void" && b.status !== "draft"));
      })
      .catch(() => {})
      .finally(() => setBillsLoading(false));
  }, [form.vendorId]);

  // Auto-select prefill bill once bills load
  useEffect(() => {
    if (bills.length > 0 && form.billId && !selectedBill) {
      const found = bills.find(b => b._id === form.billId);
      if (found) setSelectedBill(found);
    }
  }, [bills, form.billId, selectedBill]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.toLowerCase();
    return vendors.filter(v =>
      !q ||
      v.displayName?.toLowerCase().includes(q) ||
      v.companyName?.toLowerCase().includes(q) ||
      v.vendorCode?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [vendors, vendorSearch]);

  const selectVendor = (v) => {
    const name = v.displayName || v.companyName || "";
    setForm(f => ({ ...f, vendorId: v._id, vendorName: name, billId: "", billNumber: "", amount: "" }));
    setVendorSearch(name);
    setVendorOpen(false);
    setSelectedBill(null);
    setErrors(e => { const n = { ...e }; delete n.vendorId; return n; });
  };

  const selectBill = (b) => {
    const balance = Math.max(0, (b.totals?.grandTotal ?? 0) - (b.amountPaid ?? 0));
    setSelectedBill(b);
    setForm(f => ({ ...f, billId: b._id, billNumber: b.billNumber || "", amount: balance.toFixed(2) }));
  };

  // Balance calculations
  const enteredAmt  = parseFloat(form.amount) || 0;
  const billTotal   = selectedBill ? (selectedBill.totals?.grandTotal ?? 0) : 0;
  const alreadyPaid = selectedBill ? (selectedBill.amountPaid ?? 0) : 0;
  const balanceDue  = selectedBill ? Math.max(0, billTotal - alreadyPaid) : 0;
  const remaining   = selectedBill ? Math.max(0, balanceDue - enteredAmt) : 0;
  const overpay     = selectedBill && enteredAmt > balanceDue;

  const validate = () => {
    const e = {};
    if (!form.vendorId) e.vendorId = "Select a vendor";
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = "Enter a valid amount";
    if (!form.date)   e.date = "Select a date";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await axiosInstance.post("/api/vendor-payments/", {
        vendorId:    form.vendorId,
        vendorName:  form.vendorName,
        billId:      form.billId   || undefined,
        billNumber:  form.billNumber || undefined,
        amount:      parseFloat(form.amount),
        paymentMode: form.paymentMode,
        reference:   form.reference,
        date:        form.date,
        notes:       form.notes,
      });
      onSaved();
      onClose();
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || "Failed to record payment" });
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: "100%", padding: "10px 13px",
    background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 9,
    color: T.textPri, fontSize: 13, outline: "none",
    fontFamily: "'DM Sans', sans-serif", transition: "border-color .15s",
  };
  const lbl    = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.textSec, marginBottom: 6 };
  const errTxt = { fontSize: 11, color: "#ef4444", marginTop: 3 };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: isDark ? "rgba(5,9,20,0.65)" : "rgba(15,23,42,0.4)",
      backdropFilter: "blur(6px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <style>{`
        @keyframes pmtIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .pm-vend-opt:hover{background:${T.surface2} !important;}
        .pm-bill-card:hover{border-color:#3b82f6 !important;background:rgba(59,130,246,.05) !important;}
        .pm-bill-sel{border-color:#3b82f6 !important;background:rgba(59,130,246,.08) !important;}
      `}</style>

      <div onClick={e => e.stopPropagation()} style={{
        background: T.surface, borderRadius: 18, width: 560, maxHeight: "92vh",
        overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,.35)",
        border: `1.5px solid ${T.border}`, animation: "pmtIn .2s ease both",
      }}>

        {/* Header */}
        <div style={{ padding: "22px 26px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: T.textPri }}>Record Payment</div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 3 }}>Apply a payment to a vendor bill</div>
          </div>
          <button onClick={onClose} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✕</button>
        </div>

        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Vendor dropdown */}
          <div style={{ position: "relative" }}>
            <label style={lbl}>Vendor <span style={{ color: "#ef4444" }}>*</span></label>
            <div
              onClick={() => setVendorOpen(o => !o)}
              style={{
                ...inp, display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", userSelect: "none",
                borderColor: errors.vendorId ? "#ef4444" : vendorOpen ? "#3b82f6" : T.border,
                boxShadow: vendorOpen ? "0 0 0 3px rgba(59,130,246,.12)" : "none",
              }}
            >
              {form.vendorId ? (
                <span style={{ fontWeight: 600, color: T.textPri }}>{form.vendorName}</span>
              ) : (
                <span style={{ color: T.textSec }}>Select a vendor…</span>
              )}
              <span style={{ color: T.textSec, fontSize: 11, transition: "transform .15s", display: "inline-block", transform: vendorOpen ? "rotate(180deg)" : "none" }}>▼</span>
            </div>
            {errors.vendorId && <div style={errTxt}>{errors.vendorId}</div>}

            {vendorOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10,
                boxShadow: "0 16px 40px rgba(0,0,0,.25)", zIndex: 200, overflow: "hidden",
              }}>
                <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
                  <input
                    autoFocus
                    placeholder="Search vendor name or code…"
                    value={vendorSearch}
                    onChange={e => setVendorSearch(e.target.value)}
                    style={{ ...inp, padding: "8px 11px", fontSize: 12 }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {filteredVendors.length === 0 ? (
                    <div style={{ padding: "14px 16px", color: T.textSec, fontSize: 13, textAlign: "center" }}>No vendors found</div>
                  ) : filteredVendors.map(v => (
                    <div key={v._id} className="pm-vend-opt"
                      onClick={() => selectVendor(v)}
                      style={{
                        padding: "10px 14px", cursor: "pointer", fontSize: 13,
                        borderBottom: `1px solid ${T.border}`,
                        background: form.vendorId === v._id ? "rgba(59,130,246,.08)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        transition: "background .1s",
                      }}>
                      <div>
                        <span style={{ fontWeight: 600, color: T.textPri }}>{v.displayName || v.companyName}</span>
                        {v.companyName && v.displayName && (
                          <span style={{ color: T.textSec, fontSize: 11, marginLeft: 7 }}>{v.companyName}</span>
                        )}
                      </div>
                      {v.vendorCode && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.textSec, background: T.surface2, padding: "2px 7px", borderRadius: 5 }}>
                          {v.vendorCode}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bill selection */}
          <div>
            <label style={lbl}>
              Bill
              <span style={{ textTransform: "none", fontWeight: 400, letterSpacing: 0, marginLeft: 6, color: T.textSec, fontSize: 11 }}>
                (optional — select to auto-fill balance due)
              </span>
            </label>
            {!form.vendorId ? (
              <div style={{ padding: "12px 14px", background: T.surface2, border: `1px dashed ${T.border}`, borderRadius: 9, color: T.textSec, fontSize: 12, textAlign: "center" }}>
                Select a vendor first to see their bills
              </div>
            ) : billsLoading ? (
              <div style={{ padding: "12px 14px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, color: T.textSec, fontSize: 12, textAlign: "center" }}>
                Loading bills…
              </div>
            ) : bills.length === 0 ? (
              <div style={{ padding: "12px 14px", background: T.surface2, border: `1px dashed ${T.border}`, borderRadius: 9, color: T.textSec, fontSize: 12, textAlign: "center" }}>
                No outstanding bills for this vendor
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 210, overflowY: "auto" }}>
                {/* General / unlinked option */}
                <div
                  onClick={() => { setSelectedBill(null); setForm(f => ({ ...f, billId: "", billNumber: "", amount: "" })); }}
                  className={!form.billId ? "pm-bill-sel pm-bill-card" : "pm-bill-card"}
                  style={{
                    padding: "10px 13px", borderRadius: 9, cursor: "pointer",
                    border: `1.5px solid ${!form.billId ? "#3b82f6" : T.border}`,
                    background: !form.billId ? "rgba(59,130,246,.06)" : T.surface2,
                    fontSize: 12, color: T.textSec, transition: "all .12s",
                  }}>
                  — General payment (not linked to a specific bill) —
                </div>

                {bills.map(b => {
                  const tot  = b.totals?.grandTotal ?? 0;
                  const paid = b.amountPaid ?? 0;
                  const bal  = Math.max(0, tot - paid);
                  const pct  = tot > 0 ? Math.min(100, (paid / tot) * 100) : 0;
                  const sel  = form.billId === b._id;
                  return (
                    <div key={b._id}
                      onClick={() => selectBill(b)}
                      className={sel ? "pm-bill-sel pm-bill-card" : "pm-bill-card"}
                      style={{
                        padding: "11px 13px", borderRadius: 9, cursor: "pointer",
                        border: `1.5px solid ${sel ? "#3b82f6" : T.border}`,
                        background: sel ? "rgba(59,130,246,.06)" : T.surface2,
                        transition: "all .12s",
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: sel ? "#3b82f6" : T.textPri }}>
                          {b.billNumber}
                        </span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#ef4444" }}>
                          AED {bal.toFixed(2)} due
                        </span>
                      </div>
                      <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "#10b981", borderRadius: 2, transition: "width .3s" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.textSec }}>
                        <span>Total: AED {tot.toFixed(2)}</span>
                        <span style={{ color: "#10b981" }}>Paid: AED {paid.toFixed(2)}</span>
                        <span style={{ color: "#ef4444" }}>Due: AED {bal.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label style={lbl}>Amount (AED) <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              style={{
                ...inp,
                fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 600,
                borderColor: errors.amount ? "#ef4444" : overpay ? "#f59e0b" : T.border,
                boxShadow: overpay ? "0 0 0 3px rgba(245,158,11,.15)" : "none",
              }}
              type="number" min="0" step="0.01" placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
            {errors.amount && <div style={errTxt}>{errors.amount}</div>}

            {/* Live breakdown */}
            {selectedBill && enteredAmt > 0 && (
              <div style={{ marginTop: 10, padding: "13px 15px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                {[
                  { label: "Bill Total",   val: `AED ${billTotal.toFixed(2)}`,   color: T.textPri },
                  { label: "Already Paid", val: `AED ${alreadyPaid.toFixed(2)}`, color: "#10b981" },
                  { label: "Balance Due",  val: `AED ${balanceDue.toFixed(2)}`,  color: "#ef4444" },
                  { label: "This Payment", val: `AED ${enteredAmt.toFixed(2)}`,  color: "#3b82f6" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color }}>{val}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>{overpay ? "Excess Payment" : "Remaining After"}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: overpay ? "#f59e0b" : remaining === 0 ? "#10b981" : "#ef4444" }}>
                    {overpay ? `+AED ${(enteredAmt - balanceDue).toFixed(2)}` : `AED ${remaining.toFixed(2)}`}
                  </span>
                </div>
                {remaining === 0 && !overpay && (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 7, fontSize: 11, color: "#10b981", textAlign: "center", fontWeight: 600 }}>
                    ✓ This payment will fully settle the bill
                  </div>
                )}
                {overpay && (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 7, fontSize: 11, color: "#f59e0b", textAlign: "center", fontWeight: 600 }}>
                    ⚠ Amount exceeds balance due
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date + Mode */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={lbl}>Payment Date <span style={{ color: "#ef4444" }}>*</span></label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={{ ...inp }} />
              {errors.date && <div style={errTxt}>{errors.date}</div>}
            </div>
            <div>
              <label style={lbl}>Payment Mode <span style={{ color: "#ef4444" }}>*</span></label>
              <select value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}
                style={{ ...inp, appearance: "none", cursor: "pointer" }}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Reference */}
          <div>
            <label style={lbl}>Reference / Cheque No.</label>
            <input style={inp} placeholder="e.g. TXN-001234 or Cheque #456"
              value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} placeholder="Optional internal notes…"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {errors.submit && (
            <div style={{ padding: "10px 13px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>
              {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 2 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 600,
              cursor: "pointer", background: T.surface2, color: T.textSec,
              border: `1.5px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif",
            }}>Cancel</button>
            <button onClick={handleSubmit} disabled={loading} style={{
              flex: 2, padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? .6 : 1,
              background: "#3b82f6", color: "#fff", border: "none",
              fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 14px rgba(59,130,246,.3)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {loading ? "Saving…" : "✓ Record Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Main Component ─────────────────────────────────────────────── */
export default function PaymentsMade() {
  const [searchParams] = useSearchParams();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [payments,   setPayments]   = useState([]);
  const [stats,      setStats]      = useState({});
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [prefill,    setPrefill]    = useState(null);
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(1);

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pmtRes, statsRes] = await Promise.allSettled([
        axiosInstance.get("/api/vendor-payments/"),
        axiosInstance.get("/api/vendor-payments/stats"),
      ]);
      if (pmtRes.status === "fulfilled")   setPayments(pmtRes.value.data?.data?.payments || []);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data?.data || {});
    } catch {
      nexusToast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pre-fill from URL params (from Bills "Record Payment" button)
  useEffect(() => {
    const billId = searchParams.get("billId");
    if (billId) {
      axiosInstance.get(`/api/bills/${billId}`).then(res => {
        const b = res.data?.data;
        if (b) {
          setPrefill({
            vendorId:   b.vendorId,
            vendorName: b.vendorName,
            billId:     b._id,
            billNumber: b.billNumber,
            amount:     String(b.balanceDue || ""),
          });
          setModalOpen(true);
        }
      }).catch(() => {});
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter(p =>
      (p.paymentNumber || "").toLowerCase().includes(q) ||
      (p.vendorName    || "").toLowerCase().includes(q) ||
      (p.billNumber    || "").toLowerCase().includes(q)
    );
  }, [payments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paged      = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  const statCards = [
    { label: "Total Paid",    value: fmtAED(stats.totalPaid), icon: <FaMoneyBillWave />, color: T.green,  dim: T.greenDim  },
    { label: "This Month",    value: fmtAED(stats.thisMonth), icon: <FaCheckCircle />,   color: T.blue,   dim: T.blueDim   },
    { label: "Transactions",  value: stats.count || 0,        icon: <FaMoneyBillWave />, color: T.amber,  dim: T.amberDim  },
  ];

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .pm-root * { box-sizing: border-box; }
    .pm-root { font-family: 'DM Sans', sans-serif; }
    .pm-row { transition: background 0.1s; }
    .pm-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .pm-btn { transition: all 0.15s; }
    .pm-btn:hover { opacity: 0.85; transform: translateY(-1px); }
  `;

  const openModal = () => { setPrefill(null); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setPrefill(null); };

  return (
    <>
      <style>{css}</style>
      <div className="pm-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>Payments Made</h1>
            <p style={{ color: T.textSec, fontSize: 13, marginTop: 4 }}>Record and track vendor payments</p>
          </div>
          <button className="pm-btn" onClick={openModal}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11} /> Record Payment
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
          {statCards.map((c, i) => (
            <div key={i} style={{ ...card, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent 10%,${c.color}55,transparent 90%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>{c.label}</p>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: c.dim, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{c.icon}</div>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: 11, pointerEvents: "none" }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search payment #, vendor, bill…"
              style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}><FaTimes size={11} /></button>}
          </div>
          <span style={{ fontSize: 12, color: T.textSec }}>{filtered.length} payment{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div style={{ ...card, overflow: "hidden", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {["Payment #", "Date", "Vendor", "Bill #", "Mode", "Reference", "Amount"].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i === 6 ? "right" : "left", fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: "60px 20px", textAlign: "center", color: T.textSec }}>Loading…</td></tr>
              ) : paged.length > 0 ? paged.map((p, i) => (
                <tr key={p._id || i} className="pm-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "12px 16px" }}><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.blueLight }}>{p.paymentNumber}</span></td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec }}>{fmtDate(p.date)}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPri }}>{p.vendorName || "—"}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.textSec }}>{p.billNumber || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: T.surface2, border: `1px solid ${T.border}`, color: T.textSec }}>{p.paymentMode}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec }}>{p.reference || "—"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#10b981" }}>{fmtAED(p.amount)}</td>
                </tr>
              )) : (
                <tr><td colSpan="7" style={{ padding: "72px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.textSec }}><FaMoneyBillWave /></div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 15, margin: 0 }}>No payments yet</p>
                    <p style={{ color: T.textSec, fontSize: 13, margin: 0 }}>Record your first vendor payment</p>
                    <button className="pm-btn" onClick={openModal}
                      style={{ marginTop: 4, padding: "8px 20px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Record Payment
                    </button>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > LIMIT && (
          <div style={{ ...card, padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: T.textSec }}>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, filtered.length)} of {filtered.length}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 12, color: page === 1 ? T.textMuted : T.textSec, cursor: page === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                <FaChevronLeft size={10} /> Prev
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 12, color: page === totalPages ? T.textMuted : T.textSec, cursor: page === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                Next <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <RecordPaymentModal
          T={T}
          isDark={isDark}
          prefill={prefill}
          onClose={closeModal}
          onSaved={() => { load(); nexusToast.success("Payment recorded successfully"); }}
        />
      )}
    </>
  );
}
