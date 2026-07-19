import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FaPlus, FaTimes, FaSearch, FaFileInvoiceDollar, FaChevronLeft,
  FaChevronRight, FaClock, FaExclamationCircle, FaMoneyBillWave,
  FaCheckCircle, FaSpinner, FaReceipt, FaEdit, FaPrint, FaPaperPlane, FaCopy, FaDownload,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";
import { useBaseCurrency, baseCurrency } from "../../helper/currency";
import useRealtime from "../../helper/useRealtime";
import { RecordPaymentModal } from "../PaymentsMade/PaymentsMade";

const STATUS_CFG = {
  draft:   { color: "#94a3b8", bg: "rgba(100,116,139,0.1)", label: "Draft"   },
  open:    { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  label: "Open"    },
  partial: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Partial" },
  paid:    { color: "#10b981", bg: "rgba(16,185,129,0.1)",  label: "Paid"    },
  overdue: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   label: "Overdue" },
  void:    { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "Void"    },
};

// Mirrors PaymentsMade (vendor payment create) so the bill drawer offers the same options.
const PAYMENT_MODES = [
  "Cash", "Bank Transfer", "Cheque", "PDC",
  "Credit Card", "Debit Card", "Demand Draft",
  "Online Transfer", "Letter of Credit", "Other",
];

const MODE_FIELDS = {
  "Cash":             [{ key: "receiptNo",   label: "Receipt No.",         placeholder: "e.g. RCP-001" }],
  "Bank Transfer":    [{ key: "bankName",    label: "Bank Name",           placeholder: "e.g. Emirates NBD" },
                       { key: "txnRef",      label: "Transaction Ref No.", placeholder: "e.g. TXN-001234", required: true },
                       { key: "accountNo",   label: "Account / IBAN",      placeholder: "e.g. AE07033..." }],
  "Cheque":           [{ key: "chequeNo",    label: "Cheque No.",          placeholder: "e.g. 001234", required: true },
                       { key: "bankName",    label: "Bank Name",           placeholder: "e.g. ADIB" },
                       { key: "branch",      label: "Branch",              placeholder: "e.g. Dubai Mall Branch" }],
  "PDC":              [{ key: "chequeNo",    label: "Cheque No.",          placeholder: "e.g. 001234", required: true },
                       { key: "chequeDate",  label: "Cheque Date",         type: "date", required: true },
                       { key: "bankName",    label: "Bank Name",           placeholder: "e.g. Mashreq Bank" },
                       { key: "branch",      label: "Branch",              placeholder: "e.g. DIFC Branch" }],
  "Credit Card":      [{ key: "cardNetwork", label: "Card Network",        type: "select", options: ["Visa", "Mastercard", "Amex", "Other"] },
                       { key: "last4",       label: "Last 4 Digits",       placeholder: "e.g. 4242" },
                       { key: "approvalCode",label: "Approval Code",       placeholder: "e.g. 123456" }],
  "Debit Card":       [{ key: "cardNetwork", label: "Card Network",        type: "select", options: ["Visa", "Mastercard", "Other"] },
                       { key: "last4",       label: "Last 4 Digits",       placeholder: "e.g. 4242" },
                       { key: "txnRef",      label: "Transaction Ref",     placeholder: "e.g. TXN-001234" }],
  "Demand Draft":     [{ key: "ddNo",        label: "DD No.",              placeholder: "e.g. DD-001234", required: true },
                       { key: "bankName",    label: "Bank Name",           placeholder: "e.g. HDFC Bank" },
                       { key: "branch",      label: "Branch",              placeholder: "e.g. Main Branch" }],
  "Online Transfer":  [{ key: "platform",   label: "Platform",            type: "select", options: ["NEFT", "RTGS", "IMPS", "UPI", "Wire Transfer", "Other"] },
                       { key: "txnRef",      label: "Reference / UTR No.", placeholder: "e.g. UTR12345678", required: true }],
  "Letter of Credit": [{ key: "lcNo",        label: "LC No.",              placeholder: "e.g. LC-001234", required: true },
                       { key: "issuingBank", label: "Issuing Bank",        placeholder: "e.g. First Abu Dhabi Bank" },
                       { key: "lcDate",      label: "LC Date",             type: "date" }],
  "Other":            [{ key: "txnRef",      label: "Reference / Description", placeholder: "Enter reference or description" }],
};

const LIMIT = 10;

// money() prints in the given currency (a bill's own currency); fmtAED falls back to
// the org base currency for org-level aggregates (stats). Bill detail/print shadow
// fmtAED with the bill's currency so every figure follows the document.
const money   = (n, ccy) => `${ccy || baseCurrency()} ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtAED  = (n) => money(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/* ── Portal helper: anchor a popup under a trigger, escape overflow:auto ── */
function useAnchoredPopup(open) {
  const triggerRef = useRef(null);
  const popupRef   = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const place = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  };
  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = (e) => { if (!popupRef.current?.contains(e.target)) place(); };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);
  return { triggerRef, popupRef, pos };
}

/* ── CustomSelect — portal dropdown (no native <select>) ── */
function CustomSelect({ value, onChange, options, placeholder = "Select…", T, isDark }) {
  const [open, setOpen] = useState(false);
  const { triggerRef, popupRef, pos } = useAnchoredPopup(open);
  const opts = options.map(o => typeof o === "string" ? { value: o, label: o } : o);
  const sel = opts.find(o => o.value === value);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!triggerRef.current?.contains(e.target) && !popupRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]); // eslint-disable-line
  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen(o => !o)}
        style={{ width: "100%", padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: `1.5px solid ${open ? "#3b82f6" : T.border}`, borderRadius: 9, background: T.surface, color: sel ? T.textPri : T.textSec, cursor: "pointer", fontSize: 13, fontFamily: "inherit", boxShadow: open ? "0 0 0 3px rgba(59,130,246,.12)" : "none", transition: "all .15s" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel?.label || placeholder}</span>
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: open ? "#3b82f6" : T.textSec, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && createPortal(
        <div ref={popupRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, minWidth: 160, zIndex: 20000, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, boxShadow: isDark ? "0 8px 32px rgba(0,0,0,.5)" : "0 8px 24px rgba(0,0,0,.14)", overflow: "hidden", maxHeight: 240, overflowY: "auto" }}>
          {opts.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ width: "100%", padding: "9px 13px", fontSize: 13, background: o.value === value ? (isDark ? "rgba(59,130,246,.15)" : "#eff6ff") : "transparent", color: o.value === value ? "#3b82f6" : T.textPri, fontWeight: o.value === value ? 700 : 400, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {o.label}{o.value === value && <span style={{ fontSize: 10 }}>✓</span>}
            </button>
          ))}
        </div>, document.body)}
    </>
  );
}

/* ── CustomDate — portal calendar (no native date input, no external dep) ── */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

function CustomDate({ value, onChange, T, isDark, placeholder = "Select date…" }) {
  const [open, setOpen] = useState(false);
  const { triggerRef, popupRef, pos } = useAnchoredPopup(open);
  const sel = value ? new Date(value + "T00:00:00") : null;
  const [view, setView] = useState(sel || new Date());
  useEffect(() => { if (open) setView(sel || new Date()); }, [open]); // eslint-disable-line
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!triggerRef.current?.contains(e.target) && !popupRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]); // eslint-disable-line

  const y = view.getFullYear(), m = view.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(new Date(y, m, d));
  const today = toISO(new Date());

  const navBtn = { width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: isDark ? T.surface2 : "#f1f5f9", cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, lineHeight: 1 };

  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen(o => !o)}
        style={{ width: "100%", padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: `1.5px solid ${open ? "#3b82f6" : T.border}`, borderRadius: 9, background: T.surface, color: sel ? T.textPri : T.textSec, cursor: "pointer", fontSize: 13, fontFamily: "inherit", boxShadow: open ? "0 0 0 3px rgba(59,130,246,.12)" : "none", transition: "all .15s" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span>📅</span>{sel ? fmtDate(value) : placeholder}</span>
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: open ? "#3b82f6" : T.textSec, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && createPortal(
        <div ref={popupRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: Math.max(pos.width, 280), zIndex: 20000, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, boxShadow: isDark ? "0 16px 48px rgba(0,0,0,.5)" : "0 16px 40px rgba(0,0,0,.18)", overflow: "hidden", padding: 12 }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button type="button" onClick={() => setView(new Date(y, m - 1, 1))} style={navBtn}>‹</button>
            <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 800, fontSize: 13.5, color: T.textPri }}>{MONTHS[m]} {y}</span>
            <button type="button" onClick={() => setView(new Date(y, m + 1, 1))} style={navBtn}>›</button>
          </div>
          {/* weekdays */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
            {WEEKDAYS.map(w => <div key={w} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: T.textSec, padding: "4px 0" }}>{w}</div>)}
          </div>
          {/* days */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const iso = toISO(d);
              const isSel = value === iso;
              const isToday = today === iso;
              return (
                <button key={i} type="button" onClick={() => { onChange(iso); setOpen(false); }}
                  style={{ height: 32, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit",
                    fontWeight: isSel || isToday ? 700 : 400,
                    background: isSel ? "#3b82f6" : isToday ? "rgba(59,130,246,.12)" : "transparent",
                    color: isSel ? "#fff" : isToday ? "#3b82f6" : T.textPri,
                    transition: "background .1s" }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(59,130,246,.15)"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isToday ? "rgba(59,130,246,.12)" : "transparent"; }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {/* footer */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
            <button type="button" onClick={() => { onChange(today); setOpen(false); }} style={{ fontSize: 11.5, fontWeight: 700, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Today</button>
            {value && <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{ fontSize: 11.5, fontWeight: 600, color: T.textSec, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Clear</button>}
          </div>
        </div>, document.body)}
    </>
  );
}

export default function Bills() {
  useBaseCurrency();
  const navigate  = useNavigate();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getTheme(isDark);

  const [bills,           setBills]           = useState([]);
  const [stats,           setStats]           = useState({});
  const [loading,         setLoading]         = useState(true);
  const [filterStatus,    setFilterStatus]    = useState("all");
  const [search,          setSearch]          = useState("");
  const [page,            setPage]            = useState(1);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [selected,        setSelected]        = useState(null);
  const [activeTab,       setActiveTab]       = useState("overview");
  const [billPayments,    setBillPayments]    = useState([]);
  const [pmtLoading,      setPmtLoading]      = useState(false);
  const [payModal,        setPayModal]        = useState(false);
  const [reverseModal,    setReverseModal]    = useState(null); // payment being reversed
  const [reverseReason,   setReverseReason]   = useState("");
  const [voidLoading,     setVoidLoading]     = useState(false);
  const [debitNotes,      setDebitNotes]      = useState([]);
  const [dnLoading,       setDnLoading]       = useState(false);
  const [appliedCredits,  setAppliedCredits]  = useState([]);
  const [reversing,       setReversing]       = useState(null);
  const [unapplyingCr,    setUnapplyingCr]    = useState(null);
  const [openCredits,     setOpenCredits]     = useState([]);   // open vendor credits to apply
  const [walletCredit,    setWalletCredit]    = useState(0);    // vendor creditAvailable wallet (overpayments)
  const [applyingWallet,  setApplyingWallet]  = useState(false);
  const [creditPicker,    setCreditPicker]    = useState(false);
  const [applyingCr,      setApplyingCr]      = useState(null);
  const [emailing,        setEmailing]        = useState(false);
  const [emailModalOpen,  setEmailModalOpen]  = useState(false);
  const [emailTo,         setEmailTo]         = useState("");
  const [emailMsg,        setEmailMsg]        = useState("");

  /* ── Load list ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.allSettled([
        axiosInstance.get("/api/bills/"),
        axiosInstance.get("/api/bills/stats"),
      ]);
      if (bRes.status === "fulfilled") setBills(bRes.value.data?.data?.bills || []);
      if (sRes.status === "fulfilled") setStats(sRes.value.data?.data || {});
    } catch { nexusToast.error("Failed to load bills"); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Live cross-client updates: refresh the list and re-sync the open bill (paid/balance/status).
  const selectedRef = useRef(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const onRealtime = useCallback(() => {
    load();
    const openId = selectedRef.current?._id;
    if (openId) {
      axiosInstance.get(`/api/bills/${openId}`)
        .then((res) => { if (res.data?.data) setSelected(res.data.data); })
        .catch(() => {});
    }
  }, [load]);
  useRealtime(['bills_updated','vendor_payments_updated','debit_notes_updated','vendor_credits_updated','grns_updated','purchase_orders_updated'], onRealtime);

  /* ── Load payments + debit notes when drawer opens ── */
  useEffect(() => {
    if (!selected?._id) return;
    setPmtLoading(true);
    axiosInstance.get(`/api/vendor-payments/?billId=${selected._id}`)
      .then(r => setBillPayments(r.data?.data?.payments || []))
      .catch(() => setBillPayments([]))
      .finally(() => setPmtLoading(false));
    setDnLoading(true);
    Promise.allSettled([
      axiosInstance.get(`/api/debit-notes?sourceDocId=${selected._id}`),
      axiosInstance.get(`/api/vendor-credits/?billId=${selected._id}`),
      axiosInstance.get(`/api/vendor-credits/?vendorId=${selected.vendorId}&status=open`),
      axiosInstance.get(`/api/vendors/${selected.vendorId}`),
    ]).then(([dnRes, vcRes, openRes, vendRes]) => {
      setDebitNotes(dnRes.status === "fulfilled" ? (dnRes.value.data?.data || []) : []);
      const credits = vcRes.status === "fulfilled" ? (vcRes.value.data?.data?.credits || []) : [];
      setAppliedCredits(credits.filter(c => c.status === "applied"));
      setOpenCredits(openRes.status === "fulfilled" ? (openRes.value.data?.data?.credits || []) : []);
      setWalletCredit(vendRes.status === "fulfilled" ? (vendRes.value.data?.data?.creditAvailable || 0) : 0);
    }).finally(() => setDnLoading(false));
  }, [selected?._id]);

  /* ── Reverse vendor payment (modal-driven, with reason) ── */
  const handleReversePayment = async () => {
    const pmt = reverseModal;
    if (!pmt) return;
    setReversing(pmt._id);
    try {
      await axiosInstance.post(`/api/vendor-payments/${pmt._id}/reverse`, {
        notes: reverseReason || "Reversed by user",
      });
      nexusToast.success('Payment reversed');
      setReverseModal(null);
      setReverseReason("");
      await load();
      const refreshed = await axiosInstance.get(`/api/bills/${selected._id}`);
      if (refreshed.data?.data) setSelected(refreshed.data.data);
      const pmtRes = await axiosInstance.get(`/api/vendor-payments/?billId=${selected._id}`);
      setBillPayments(pmtRes.data?.data?.payments || []);
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to reverse payment');
    } finally { setReversing(null); }
  };

  /* ── Drawer helpers ── */
  const openDrawer = (b) => {
    setSelected(b);
    setDrawerOpen(true);
    setActiveTab("overview");
    setBillPayments([]);
    setDebitNotes([]);
    setAppliedCredits([]);
    setOpenCredits([]);
    setWalletCredit(0);
    setCreditPicker(false);
    setPayModal(false);
  };
  const closeDrawer = () => { setDrawerOpen(false); setSelected(null); setPayModal(false); };

  /* ── Void bill ── */
  const handleVoid = async () => {
    if (!window.confirm(`Void bill ${selected.billNumber}? This cannot be undone.`)) return;
    setVoidLoading(true);
    try {
      await axiosInstance.patch(`/api/bills/${selected._id}/status`, { status: "void" });
      nexusToast.success("Bill voided");
      await load();
      closeDrawer();
    } catch { nexusToast.error("Failed to void bill"); }
    finally { setVoidLoading(false); }
  };

  /* ── Apply vendor credit to this bill ── */
  const handleApplyCreditToBill = async (cr) => {
    setApplyingCr(cr._id);
    try {
      await axiosInstance.post(`/api/vendor-credits/${cr._id}/apply`, { billId: selected._id });
      nexusToast.success(`Credit ${cr.creditNumber} applied`);
      setCreditPicker(false);
      await load();
      // Refresh bill + credit lists (same _id, so drawer effect won't re-run)
      const [billRes, vcRes, openRes] = await Promise.allSettled([
        axiosInstance.get(`/api/bills/${selected._id}`),
        axiosInstance.get(`/api/vendor-credits/?billId=${selected._id}`),
        axiosInstance.get(`/api/vendor-credits/?vendorId=${selected.vendorId}&status=open`),
      ]);
      if (billRes.status === "fulfilled" && billRes.value.data?.data) setSelected(billRes.value.data.data);
      const credits = vcRes.status === "fulfilled" ? (vcRes.value.data?.data?.credits || []) : [];
      setAppliedCredits(credits.filter(c => c.status === "applied"));
      setOpenCredits(openRes.status === "fulfilled" ? (openRes.value.data?.data?.credits || []) : []);
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || "Failed to apply credit");
    } finally { setApplyingCr(null); }
  };

  /* ── Apply vendor credit-available wallet (overpayments) to this bill ── */
  const handleApplyWalletToBill = async () => {
    const due = selected?.balanceDue || 0;
    const amt = Math.min(walletCredit, due);
    if (amt <= 0) return;
    setApplyingWallet(true);
    try {
      const res = await axiosInstance.post(`/api/vendors/${selected.vendorId}/apply-credit`, {
        billId: selected._id, amount: amt,
      });
      nexusToast.success(res.data?.message || "Credit applied");
      setCreditPicker(false);
      await load();
      const [billRes, vendRes] = await Promise.allSettled([
        axiosInstance.get(`/api/bills/${selected._id}`),
        axiosInstance.get(`/api/vendors/${selected.vendorId}`),
      ]);
      if (billRes.status === "fulfilled" && billRes.value.data?.data) setSelected(billRes.value.data.data);
      setWalletCredit(vendRes.status === "fulfilled" ? (vendRes.value.data?.data?.creditAvailable || 0) : 0);
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || "Failed to apply credit");
    } finally { setApplyingWallet(false); }
  };

  /* ── Unapply vendor credit from this bill ── */
  const handleUnapplyCredit = async (cr) => {
    if (!window.confirm(`Unapply credit ${cr.creditNumber} from this bill? The balance will be restored.`)) return;
    setUnapplyingCr(cr._id);
    try {
      await axiosInstance.post(`/api/vendor-credits/${cr._id}/unapply`);
      nexusToast.success(`Credit ${cr.creditNumber} unapplied`);
      await load();
      const [billRes, vcRes, openRes] = await Promise.allSettled([
        axiosInstance.get(`/api/bills/${selected._id}`),
        axiosInstance.get(`/api/vendor-credits/?billId=${selected._id}`),
        axiosInstance.get(`/api/vendor-credits/?vendorId=${selected.vendorId}&status=open`),
      ]);
      if (billRes.status === "fulfilled" && billRes.value.data?.data) setSelected(billRes.value.data.data);
      const credits = vcRes.status === "fulfilled" ? (vcRes.value.data?.data?.credits || []) : [];
      setAppliedCredits(credits.filter(c => c.status === "applied"));
      setOpenCredits(openRes.status === "fulfilled" ? (openRes.value.data?.data?.credits || []) : []);
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || "Failed to unapply credit");
    } finally { setUnapplyingCr(null); }
  };

  /* ── Clone bill → prefill a new bill from this one ── */
  const handleCloneBill = () => {
    const b = selected;
    navigate("/Purchase/Bills/New", {
      state: {
        vendorId:   b.vendorId || "",
        vendorName: b.vendorName || "",
        items: (b.lineItems || []).map(li => ({
          description:  li.description || "",
          qty:          li.qty || 1,
          unitPrice:    li.unitPrice || 0,
          taxRate:      li.taxRate ?? 0,
          discount:     li.discount || 0,
          discountType: li.discountType || "fixed",
        })),
      },
    });
  };

  /* ── Print bill ── */
  // Preview & print the server-generated PDF (carries the status watermark for
  // unapproved/void bills). Replaces the old client-side HTML popup.
  const handlePrintBill = () => navigate(`/Purchase/Bills/${selected._id}/print`);

  // Download the same server PDF as a file.
  const handleDownloadBill = async () => {
    try {
      const res = await axiosInstance.get(`/api/bills/${selected._id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `bill-${selected.billNumber || selected._id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { console.error("Download bill PDF failed", e); nexusToast.error("Download failed"); }
  };

  /* ── Email bill to vendor ── */
  const openEmailModal = () => {
    setEmailTo("");
    setEmailMsg("");
    setEmailModalOpen(true);
  };
  const doSendBillEmail = async () => {
    const to = emailTo.split(",").map(s => s.trim()).filter(Boolean);
    setEmailing(true);
    try {
      const res = await axiosInstance.post(`/api/bills/${selected._id}/send`, { recipients: to, message: emailMsg });
      nexusToast.success(res.data?.message || `Bill ${selected.billNumber} sent`);
      setEmailModalOpen(false);
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || "Failed to send");
    } finally { setEmailing(false); }
  };

  /* ── Filtering ── */
  const filtered = bills.filter(b => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (b.billNumber || "").toLowerCase().includes(q) || (b.vendorName || "").toLowerCase().includes(q);
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paged      = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  /* ── Stat cards ── */
  const statCards = [
    { label: "Total Bills",   value: stats.totalCount || 0,           icon: <FaFileInvoiceDollar />, color: T.blue,   dim: T.blueDim },
    { label: "Open / Partial",value: (stats.byStatus?.open?.count || 0) + (stats.byStatus?.partial?.count || 0), icon: <FaClock />, color: T.amber, dim: T.amberDim },
    { label: "Overdue",       value: stats.byStatus?.overdue?.count || 0, icon: <FaExclamationCircle />, color: "#ef4444", dim: "rgba(239,68,68,0.1)" },
    { label: "Total Payable", value: fmtAED(stats.totalPayable || 0), icon: <FaFileInvoiceDollar />, color: T.green,  dim: T.greenDim, small: true },
  ];

  /* ── Styles ── */
  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };
  const inp  = { width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" };
  const lbl  = { display: "block", fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .bl-root * { box-sizing: border-box; }
    .bl-root { font-family: 'DM Sans', sans-serif; }
    .bl-row { transition: background 0.1s; cursor: pointer; }
    .bl-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .bl-pill { cursor: pointer; transition: all 0.15s; }
    .bl-pill:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
    .bl-pill-active { background: ${isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-color: ${isDark ? "rgba(59,130,246,0.35)" : "#bfdbfe"} !important; font-weight: 600 !important; }
    .bl-btn { transition: all 0.15s; }
    .bl-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
    .bl-tab { cursor: pointer; transition: color 0.15s; }
    .bl-tab:hover { color: ${isDark ? "#60a5fa" : "#2563eb"} !important; }
    @keyframes bl-slide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes bl-fade  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes bl-spin  { to { transform: rotate(360deg); } }
    .bl-drawer  { animation: bl-slide 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
    .bl-overlay { animation: bl-fade 0.2s ease forwards; }
    .bl-spin    { animation: bl-spin 0.7s linear infinite; }
  `;

  return (
    <>
      <style>{css}</style>
      <div className="bl-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>Bills</h1>
            <p style={{ color: T.textSec, fontSize: 13, marginTop: 4 }}>Track and manage vendor bills</p>
          </div>
          <button className="bl-btn" onClick={() => navigate("/Purchase/Bills/New")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.blue, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11} /> New Bill
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
          {statCards.map((c, i) => (
            <div key={i} style={{ ...card, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent 10%,${c.color}55,transparent 90%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>{c.label}</p>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: c.dim, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{c.icon}</div>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: c.small ? 16 : 26, fontWeight: 800, color: T.textPri, margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: 11, pointerEvents: "none" }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search bill number or vendor…"
              style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}><FaTimes size={11} /></button>}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["all", "draft", "open", "partial", "paid", "overdue", "void"].map(s => (
              <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                className={`bl-pill${filterStatus === s ? " bl-pill-active" : ""}`}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, background: "transparent", color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "inherit", cursor: "pointer" }}>
                {s === "all" ? "All" : STATUS_CFG[s]?.label || s}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: T.textSec, marginLeft: "auto" }}>{filtered.length} bill{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div style={{ ...card, overflow: "hidden", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {["Bill #", "Vendor", "Bill Date", "Due Date", "Grand Total", "Paid", "Balance Due", "Status", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i >= 4 && i <= 6 ? "right" : "left", fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ padding: "60px 20px", textAlign: "center", color: T.textSec }}>
                  <FaSpinner className="bl-spin" style={{ fontSize: 18, display: "block", margin: "0 auto 10px" }} />Loading…
                </td></tr>
              ) : paged.length > 0 ? paged.map((b, i) => {
                const sc = STATUS_CFG[b.status] || STATUS_CFG.open;
                return (
                  <tr key={b._id || i} className="bl-row" onClick={() => openDrawer(b)} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.blueLight }}>{b.billNumber}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPri }}>{b.vendorName || "—"}</td>
                    <td style={{ padding: "12px 16px", color: T.textSec, fontSize: 12 }}>{fmtDate(b.billDate)}</td>
                    <td style={{ padding: "12px 16px", color: T.textSec, fontSize: 12 }}>{fmtDate(b.dueDate)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.textPri }}>{money(b.totals?.grandTotal, b.currency)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#10b981" }}>{money(b.amountPaid, b.currency)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: (b.balanceDue || 0) > 0 ? "#ef4444" : "#10b981" }}>{money(b.balanceDue, b.currency)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      <button onClick={e => { e.stopPropagation(); openDrawer(b); }}
                        style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 11, color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="9" style={{ padding: "72px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.textSec }}><FaFileInvoiceDollar /></div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 15, margin: 0 }}>No bills yet</p>
                    <p style={{ color: T.textSec, fontSize: 13, margin: 0 }}>Create your first vendor bill</p>
                    <button className="bl-btn" onClick={() => navigate("/Purchase/Bills/New")}
                      style={{ marginTop: 4, padding: "8px 20px", background: T.blue, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      New Bill
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

      {/* ── Detail Drawer ── */}
      {drawerOpen && selected && (() => {
        const b      = selected;
        const fmtAED = (n) => money(n, b.currency); // detail shows the bill's own currency
        const sc     = STATUS_CFG[b.status] || STATUS_CFG.open;
        const grand  = b.totals?.grandTotal || 0;
        const paidPct= grand > 0 ? Math.min(100, ((b.amountPaid || 0) / grand) * 100) : 0;
        const canPay = b.status !== "paid" && b.status !== "void";
        // ERP rule (Zoho/QuickBooks): a bill with any payment OR applied credit/debit
        // note cannot be voided directly — those settlements must be reversed first,
        // else the linked payments/credits are orphaned and the ledger goes out of balance.
        const settled = (b.amountPaid || 0) > 0;
        const canVoid = b.status !== "void" && b.status !== "paid" && !settled;

        return (
          <>
            <div className="bl-overlay" onClick={closeDrawer}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />
            <div className="bl-drawer" style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 490, maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

              {/* Drawer header */}
              <div style={{ padding: "18px 20px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.blueLight }}>{b.billNumber}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                      {b.threeWayMatchStatus === "mismatch" && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(245,158,11,0.12)", color: "#d97706", border: "1px solid rgba(245,158,11,0.3)" }}>⚠ 3-Way Mismatch</span>
                      )}
                      {b.threeWayMatchStatus === "matched" && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(16,185,129,0.12)", color: "#059669", border: "1px solid rgba(16,185,129,0.25)" }}>✓ 3-Way Matched</span>
                      )}
                    </div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontSize: 15, fontWeight: 800, color: T.textPri, margin: 0 }}>{b.vendorName || "—"}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {canPay && (
                      <button className="bl-btn" onClick={() => navigate(`/Purchase/Bills/Edit/${b._id}`)}
                        title="Edit" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                        <FaEdit size={11} /> Edit
                      </button>
                    )}
                    <button className="bl-btn" onClick={handleCloneBill}
                      title="Clone — create a new bill from this one" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                      <FaCopy size={11} /> Clone
                    </button>
                    <button className="bl-btn" onClick={handlePrintBill}
                      title="Preview & Print" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                      <FaPrint size={11} /> Print
                    </button>
                    <button className="bl-btn" onClick={handleDownloadBill}
                      title="Download PDF" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                      <FaDownload size={11} /> PDF
                    </button>
                    <button className="bl-btn" onClick={openEmailModal} disabled={emailing}
                      title="Email" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", cursor: emailing ? "wait" : "pointer", color: T.textSec, display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                      <FaPaperPlane size={11} />
                    </button>
                    <button onClick={closeDrawer} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 7, cursor: "pointer", color: T.textSec, display: "flex" }}>
                      <FaTimes size={11} />
                    </button>
                  </div>
                </div>

                {/* Payment progress */}
                {grand > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textSec, marginBottom: 5 }}>
                      <span>Paid {fmtAED(b.amountPaid)} of {fmtAED(grand)}</span>
                      <span style={{ fontWeight: 700, color: paidPct >= 100 ? "#10b981" : T.amber }}>{paidPct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: T.surface2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${paidPct}%`, borderRadius: 99, background: paidPct >= 100 ? "#10b981" : "#3b82f6", transition: "width 0.4s" }} />
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div style={{ display: "flex" }}>
                  {[
                    ["overview",  "Overview"],
                    ["payments",  `Payments (${billPayments.filter(p => !p.isReversed).length})`],
                    ["debitnotes",`Credits & Debit Notes (${debitNotes.length + appliedCredits.length})`],
                  ].map(([tab, label]) => (
                    <button key={tab} className="bl-tab" onClick={() => setActiveTab(tab)}
                      style={{ padding: "9px 14px", border: "none", background: "transparent", fontSize: 12, fontWeight: activeTab === tab ? 700 : 500, color: activeTab === tab ? (isDark ? "#60a5fa" : "#2563eb") : T.textSec, borderBottom: activeTab === tab ? `2px solid ${isDark ? "#60a5fa" : "#2563eb"}` : "2px solid transparent", cursor: "pointer", fontFamily: "inherit", marginBottom: -1, whiteSpace: "nowrap" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>

                {/* ── OVERVIEW ── */}
                {activeTab === "overview" && (<>
                  {/* Meta */}
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {[
                      { label: "Bill Date",     value: fmtDate(b.billDate) },
                      { label: "Due Date",      value: fmtDate(b.dueDate)  },
                      ...(b.paymentTerms ? [{ label: "Payment Terms", value: b.paymentTerms }] : []),
                      ...(b.poNumber    ? [{ label: "PO #",           value: b.poNumber, mono: true }] : []),
                      ...(b.grnNumber   ? [{ label: "GRN #",          value: b.grnNumber, mono: true }] : []),
                    ].map(({ label, value, mono }, i, arr) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri, fontFamily: mono ? "'DM Mono', monospace" : "inherit" }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Line items */}
                  {b.lineItems?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Line Items</p>
                      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                        {b.lineItems.map((item, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: i < b.lineItems.length - 1 ? `1px solid ${T.border}` : "none" }}>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.description}</p>
                              <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0", fontFamily: "'DM Mono', monospace" }}>
                                {item.qty} × {fmtAED(item.unitPrice)}
                                {item.discountAmt > 0 && <span style={{ color: "#10b981" }}> − {fmtAED(item.discountAmt)}</span>}
                              </p>
                            </div>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.textPri }}>{fmtAED(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {[
                      ...((b.totals?.discountTotal || 0) > 0 ? [
                        { label: "Gross Total", value: fmtAED((b.totals?.subtotal || 0) + (b.totals?.discountTotal || 0)) },
                        { label: "Discount",    value: `−${fmtAED(b.totals?.discountTotal)}`, green: true },
                      ] : []),
                      { label: "Subtotal (excl. VAT)", value: fmtAED(b.totals?.subtotal) },
                      { label: "VAT",                  value: fmtAED(b.totals?.taxTotal) },
                      ...((b.totals?.shipping || 0) !== 0 ? [{ label: "🚚 Shipping Charges", value: fmtAED(b.totals?.shipping) }] : []),
                      ...((b.totals?.adjustment || 0) !== 0 ? [{ label: "± Adjustment", value: `${(b.totals?.adjustment || 0) < 0 ? "−" : "+"}${fmtAED(Math.abs(b.totals?.adjustment || 0))}` }] : []),
                      { label: "Grand Total",          value: fmtAED(b.totals?.grandTotal), bold: true },
                      { label: "Amount Paid",          value: fmtAED(b.amountPaid), green: true },
                      { label: "Balance Due",          value: fmtAED(b.balanceDue), red: (b.balanceDue || 0) > 0 },
                    ].map(({ label, value, bold, red, green }, i, arr) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", background: bold ? (isDark ? "rgba(59,130,246,0.06)" : "#eff6ff") : "transparent" }}>
                        <span style={{ fontSize: 12, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: bold ? 800 : 600, color: red ? "#ef4444" : green ? "#10b981" : bold ? T.blue : T.textPri }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {b.notes && (
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 14px" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>Notes</p>
                      <p style={{ fontSize: 13, color: T.textPri, margin: 0 }}>{b.notes}</p>
                    </div>
                  )}
                </>)}

                {/* ── PAYMENTS ── */}
                {activeTab === "payments" && (<>
                  {pmtLoading ? (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: T.textSec }}>
                      <FaSpinner className="bl-spin" style={{ fontSize: 18, display: "block", margin: "0 auto 10px" }} />Loading…
                    </div>
                  ) : billPayments.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: T.textSec, margin: "0 auto 12px" }}><FaMoneyBillWave /></div>
                      <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 14, margin: 0 }}>No payments yet</p>
                      <p style={{ color: T.textSec, fontSize: 12, margin: "6px 0 0" }}>Record a payment to reduce the balance</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {billPayments.map((p, i) => (
                        <div key={p._id || i} style={{ background: T.surface2, border: `1px solid ${p.isReversed ? "rgba(239,68,68,0.2)" : T.border}`, borderRadius: 12, padding: "13px 14px", opacity: p.isReversed ? 0.75 : 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: p.isReversed ? T.textSec : T.blueLight, margin: 0, textDecoration: p.isReversed ? "line-through" : "none" }}>{p.paymentNumber}</p>
                                {p.isReversed && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>REVERSED</span>}
                              </div>
                              <p style={{ fontSize: 12, color: T.textSec, margin: "3px 0 0" }}>{p.paymentMode} · {fmtDate(p.date)}</p>
                            </div>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 800, color: p.isReversed ? T.textSec : "#10b981", textDecoration: p.isReversed ? "line-through" : "none" }}>{fmtAED(p.amount)}</span>
                          </div>
                          {p.reference && <p style={{ fontSize: 11, color: T.textSec, margin: "4px 0 0" }}>Ref: {p.reference}</p>}
                          {p.notes     && <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0", fontStyle: "italic" }}>{p.notes}</p>}
                          {!p.isReversed && (
                            <button onClick={() => { setReverseModal(p); setReverseReason(""); }} disabled={reversing === p._id}
                              style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", background: "transparent", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: reversing === p._id ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                              <FaReceipt size={9} /> {reversing === p._id ? "Reversing…" : "↩ Reverse Payment"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>)}

                {/* ── CREDITS & DEBIT NOTES ── */}
                {activeTab === "debitnotes" && (<>
                  {dnLoading ? (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: T.textSec }}>
                      <FaSpinner className="bl-spin" style={{ fontSize: 18, display: "block", margin: "0 auto 10px" }} />Loading…
                    </div>
                  ) : (debitNotes.length === 0 && appliedCredits.length === 0) ? (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: T.textSec, margin: "0 auto 12px" }}><FaFileInvoiceDollar /></div>
                      <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 14, margin: 0 }}>No credits or debit notes</p>
                      <p style={{ color: T.textSec, fontSize: 12, margin: "6px 0 0" }}>Vendor credits and debit notes applied to this bill appear here</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* Applied vendor credits */}
                      {appliedCredits.map((cr, i) => (
                        <div key={cr._id || `cr-${i}`} style={{ background: T.surface2, border: `1px solid ${isDark ? "rgba(16,185,129,0.2)" : "#bbf7d0"}`, borderRadius: 12, padding: "13px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div>
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "#10b981", margin: 0 }}>{cr.creditNumber}</p>
                              <p style={{ fontSize: 11, color: T.textSec, margin: "3px 0 0" }}>{cr.reason || "—"} · {cr.date}</p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 800, color: "#10b981", margin: 0 }}>− {fmtAED(cr.totals?.grandTotal)}</p>
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>VENDOR CREDIT</span>
                            </div>
                          </div>
                          {(cr.totals?.taxTotal > 0) && (
                            <div style={{ fontSize: 11, color: T.textSec, paddingTop: 6, borderTop: `1px solid ${T.border}` }}>
                              VAT reversed: <strong style={{ color: T.textPri }}>{fmtAED(cr.totals.taxTotal)}</strong>
                            </div>
                          )}
                          <button onClick={() => handleUnapplyCredit(cr)} disabled={unapplyingCr === cr._id}
                            style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", background: "transparent", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: unapplyingCr === cr._id ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                            <FaReceipt size={9} /> {unapplyingCr === cr._id ? "Unapplying…" : "↩ Unapply Credit"}
                          </button>
                        </div>
                      ))}
                      {/* Debit notes */}
                      {debitNotes.map((dn, i) => {
                        const dnTotals = dn.totals || {};
                        const statusColor = dn.status === "closed" ? "#10b981" : dn.status === "approved" ? "#8b5cf6" : dn.status === "void" ? "#6b7280" : "#f59e0b";
                        return (
                          <div key={dn._id || i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                              <div>
                                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "#8b5cf6", margin: 0 }}>{dn.debitNoteNumber}</p>
                                <p style={{ fontSize: 11, color: T.textSec, margin: "3px 0 0" }}>{dn.reason || "—"} · {dn.date}</p>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 800, color: "#8b5cf6", margin: 0 }}>− {fmtAED(dnTotals.grandTotal)}</p>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30`, textTransform: "capitalize" }}>{dn.status}</span>
                              </div>
                            </div>
                            {(dn.appliedAmount > 0 || dn.remainingAmount > 0) && (
                              <div style={{ fontSize: 11, color: T.textSec, display: "flex", gap: 12, paddingTop: 6, borderTop: `1px solid ${T.border}` }}>
                                <span>Applied: <strong style={{ color: T.textPri }}>{fmtAED(dn.appliedAmount || 0)}</strong></span>
                                <span>Remaining: <strong style={{ color: (dn.remainingAmount || 0) > 0 ? "#8b5cf6" : T.textSec }}>{fmtAED(dn.remainingAmount || 0)}</strong></span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>)}

              </div>

              {/* Credit picker panel — pick an open vendor credit to apply */}
              {creditPicker && (
                <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, background: isDark ? "rgba(16,185,129,0.04)" : "#f0fdf4" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: T.textPri, margin: 0 }}>Apply a vendor credit</p>
                    <button onClick={() => setCreditPicker(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 2 }}><FaTimes size={11} /></button>
                  </div>

                  {/* Credit-available wallet (from overpayments) — apply to this bill */}
                  {walletCredit > 0 && (
                    <button onClick={handleApplyWalletToBill} disabled={applyingWallet}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "9px 12px", marginBottom: 6, background: isDark ? "rgba(16,185,129,0.1)" : "#ecfdf5", border: `1px solid ${isDark ? "rgba(16,185,129,0.3)" : "#a7f3d0"}`, borderRadius: 9, cursor: applyingWallet ? "wait" : "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      <span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".05em" }}>Credit Available</span>
                        <span style={{ fontSize: 11, color: T.textSec, marginLeft: 8 }}>
                          Apply {fmtAED(Math.min(walletCredit, selected.balanceDue || 0))} to this bill
                        </span>
                      </span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 800, color: "#10b981" }}>
                        {applyingWallet ? "…" : fmtAED(walletCredit)}
                      </span>
                    </button>
                  )}

                  {openCredits.length === 0 && walletCredit <= 0 ? (
                    <p style={{ fontSize: 12, color: T.textSec, margin: "4px 0 0" }}>No open credits for this vendor.</p>
                  ) : openCredits.length === 0 ? null : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                      {openCredits.map(cr => (
                        <button key={cr._id} onClick={() => handleApplyCreditToBill(cr)} disabled={applyingCr === cr._id}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, cursor: applyingCr === cr._id ? "wait" : "pointer", fontFamily: "inherit", textAlign: "left" }}>
                          <span>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: "#10b981" }}>{cr.creditNumber}</span>
                            <span style={{ fontSize: 11, color: T.textSec, marginLeft: 8 }}>{cr.reason || "—"}</span>
                          </span>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 800, color: "#10b981" }}>{applyingCr === cr._id ? "…" : fmtAED(cr.totals?.grandTotal)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer — single row */}
              <div style={{ padding: "10px 20px 14px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
                {canPay && b.balanceDue > 0 && (
                  <button className="bl-btn" onClick={() => setCreditPicker(v => !v)}
                    style={{ padding: "9px 12px", background: isDark ? "rgba(16,185,129,0.1)" : "#f0fdf4", color: "#10b981", border: `1px solid ${isDark ? "rgba(16,185,129,0.25)" : "#bbf7d0"}`, borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    <FaFileInvoiceDollar size={11} /> Apply Credit
                  </button>
                )}
                {canPay && !payModal && (
                  <button className="bl-btn" onClick={() => setPayModal(true)}
                    style={{ flex: 1, padding: 10, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <FaMoneyBillWave size={12} /> Record Payment
                  </button>
                )}
                {canVoid && (
                  <button className="bl-btn" onClick={handleVoid} disabled={voidLoading}
                    style={{ padding: "10px 14px", background: "transparent", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: voidLoading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    {voidLoading ? "Voiding…" : "Void"}
                  </button>
                )}
                {!canPay && !canVoid && b.status !== "void" && settled && (
                  <span style={{ flex: 1, fontSize: 11.5, color: T.textSec, display: "flex", alignItems: "center", gap: 6, lineHeight: 1.4 }}>
                    Reverse payments &amp; applied credits to void this bill.
                  </span>
                )}
                {!canPay && !canVoid && (
                  <button className="bl-btn" onClick={closeDrawer}
                    style={{ padding: "10px 16px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Close
                  </button>
                )}
              </div>
            </div>

            {/* ── Record Payment modal — reuses the Payments Made flow (multi-bill
                allocation, excess → vendor credit, apply-credit), prefilled to this bill ── */}
            {payModal && canPay && (
              <RecordPaymentModal
                T={T}
                isDark={isDark}
                prefill={{
                  vendorId:   selected.vendorId,
                  vendorName: selected.vendorName,
                  billId:     selected._id,
                  billNumber: selected.billNumber,
                  amount:     String(selected.balanceDue || ""),
                }}
                onClose={() => setPayModal(false)}
                onSaved={async () => {
                  setPayModal(false);
                  nexusToast.success("Payment recorded");
                  await load();
                  const refreshed = await axiosInstance.get(`/api/bills/${selected._id}`);
                  if (refreshed.data?.data) setSelected(refreshed.data.data);
                  const pmtRes = await axiosInstance.get(`/api/vendor-payments/?billId=${selected._id}`);
                  setBillPayments(pmtRes.data?.data?.payments || []);
                }}
              />
            )}

            {/* ── Reverse Payment modal ── */}
            {reverseModal && (
              <div style={{ position: "fixed", inset: 0, zIndex: 9200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
                onClick={e => e.target === e.currentTarget && setReverseModal(null)}>
                <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: "24px", width: 420, maxWidth: "92vw", boxShadow: "0 40px 80px rgba(0,0,0,.4)" }}>
                  <div style={{ fontFamily: "Sora, sans-serif", fontSize: 15, fontWeight: 700, color: T.textPri, marginBottom: 4 }}>↩ Reverse Payment</div>
                  <div style={{ fontSize: 12, color: T.textSec, marginBottom: 18 }}>
                    {reverseModal.paymentNumber} · Amount: {fmtAED(reverseModal.amount)} · {reverseModal.paymentMode}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={lbl}>Reason <span style={{ color: T.textSec, fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                      <input type="text" value={reverseReason} onChange={e => setReverseReason(e.target.value)}
                        placeholder="e.g. Wrong bill, duplicate entry, cheque bounced…" style={inp} />
                    </div>
                    <div style={{ padding: "10px 13px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 12, color: "#f59e0b" }}>
                      ⚠️ This restores the bill balance and vendor payable. The original payment record stays for audit trail.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <button onClick={() => setReverseModal(null)}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.surface2, color: T.textSec, border: `1.5px solid ${T.border}`, fontFamily: "inherit" }}>
                      Cancel
                    </button>
                    <button onClick={handleReversePayment} disabled={reversing === reverseModal._id}
                      style={{ flex: 2, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: reversing === reverseModal._id ? "not-allowed" : "pointer", opacity: reversing === reverseModal._id ? 0.6 : 1, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", fontFamily: "inherit" }}>
                      {reversing === reverseModal._id ? "Processing…" : "↩ Confirm Reversal"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Email bill modal */}
      {emailModalOpen && (
        <div onClick={() => !emailing && setEmailModalOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: "92vw", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Email {selected?.billNumber}</div>
              <span onClick={() => setEmailModalOpen(false)} style={{ cursor: "pointer", color: T.textSec }}><FaTimes /></span>
            </div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", marginBottom: 6 }}>To (comma-separated, blank = vendor's email on file)</label>
            <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="vendor@example.com" style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, color: T.textPri, fontSize: 13, width: "100%", marginBottom: 12, fontFamily: "inherit" }} />
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", marginBottom: 6 }}>Message (optional)</label>
            <textarea value={emailMsg} onChange={(e) => setEmailMsg(e.target.value)} rows={3} style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, color: T.textPri, fontSize: 13, width: "100%", marginBottom: 18, resize: "vertical", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setEmailModalOpen(false)} disabled={emailing} style={{ padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "inherit" }}>Cancel</button>
              <button onClick={doSendBillEmail} disabled={emailing} style={{ padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: "#3b82f6", color: "#fff", border: "none", opacity: emailing ? 0.7 : 1, fontFamily: "inherit" }}>{emailing ? "Sending…" : "Send"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
