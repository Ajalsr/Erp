import { useState, useCallback, useRef, useEffect } from "react";
import { FaFileAlt, FaPrint, FaChevronDown, FaChevronLeft, FaChevronRight, FaCalendarAlt } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Mini Calendar ────────────────────────────────────────────────────────────
const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

function MiniCalendar({ value, onChange, T }) {
  const today = new Date();
  const sel   = value ? new Date(value + "T00:00:00") : null;
  const [view, setView] = useState({ y: (sel || today).getFullYear(), m: (sel || today).getMonth() });

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  const pick = (d) => {
    if (!d) return;
    const iso = `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onChange(iso);
  };

  const prev = () => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const next = () => setView(v => v.m === 11 ? { y: v.y + 1, m: 0  } : { y: v.y, m: v.m + 1 });

  const isSelected = (d) => {
    if (!sel || !d) return false;
    return sel.getFullYear() === view.y && sel.getMonth() === view.m && sel.getDate() === d;
  };
  const isToday = (d) =>
    d && today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d;

  return (
    <div style={{ width: 260, padding: "12px 10px", userSelect: "none" }}>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={prev} style={{ background: "none", border: "none", cursor: "pointer", color: T.textPri, padding: "2px 6px", borderRadius: 4, fontSize: 13 }}>
          <FaChevronLeft />
        </button>
        <span style={{ fontWeight: 600, fontSize: 13, color: T.textPri }}>
          {MONTHS[view.m]} {view.y}
        </span>
        <button onClick={next} style={{ background: "none", border: "none", cursor: "pointer", color: T.textPri, padding: "2px 6px", borderRadius: 4, fontSize: 13 }}>
          <FaChevronRight />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: T.textSec, padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {cells.map((d, i) => (
          <div key={i} onClick={() => pick(d)} style={{
            textAlign: "center", padding: "6px 0", borderRadius: 6, fontSize: 12, cursor: d ? "pointer" : "default",
            fontWeight: isSelected(d) ? 700 : isToday(d) ? 600 : 400,
            color: isSelected(d) ? "#fff" : isToday(d) ? T.blue : d ? T.textPri : "transparent",
            background: isSelected(d) ? T.blue : isToday(d) ? T.blueDim : "transparent",
            transition: "background 0.15s",
          }}
            onMouseEnter={e => { if (d && !isSelected(d)) e.currentTarget.style.background = T.blueDim; }}
            onMouseLeave={e => { if (!isSelected(d)) e.currentTarget.style.background = isToday(d) ? T.blueDim : "transparent"; }}
          >
            {d || ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Date Picker Input ────────────────────────────────────────────────────────
function DatePicker({ label, value, onChange, T }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })
    : "Pick a date";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>{label}</label>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "9px 14px",
        borderRadius: 8, border: `1px solid ${open ? T.blue : T.border}`,
        background: T.inputBg, color: value ? T.textPri : T.textSec,
        cursor: "pointer", fontSize: 13, fontWeight: value ? 500 : 400, minWidth: 160,
        boxShadow: open ? `0 0 0 3px ${T.blueDim}` : "none", transition: "all 0.15s"
      }}>
        <FaCalendarAlt style={{ color: T.blue, fontSize: 13, flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left" }}>{display}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
        }}>
          <MiniCalendar value={value} onChange={(v) => { onChange(v); setOpen(false); }} T={T} />
        </div>
      )}
    </div>
  );
}

// ─── Customer Dropdown ────────────────────────────────────────────────────────
function CustomerDropdown({ value, onChange, customers, T }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = customers.filter(c =>
    !search || (c.customerDisplayName || c.companyName || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.customerCode || "").toLowerCase().includes(search.toLowerCase())
  );

  const selected = customers.find(c => c._id === value);

  return (
    <div ref={ref} style={{ position: "relative", flex: "1 1 240px" }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>Customer</label>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px",
        borderRadius: 8, border: `1px solid ${open ? T.blue : T.border}`,
        background: T.inputBg, color: selected ? T.textPri : T.textSec,
        cursor: "pointer", fontSize: 13, fontWeight: selected ? 500 : 400,
        boxShadow: open ? `0 0 0 3px ${T.blueDim}` : "none", transition: "all 0.15s"
      }}>
        <span style={{ flex: 1, textAlign: "left" }}>
          {selected ? (selected.customerDisplayName || selected.companyName) : "Select a customer…"}
        </span>
        {selected && <span style={{ fontSize: 11, color: T.textSec, background: T.surface2, padding: "2px 6px", borderRadius: 4 }}>{selected.customerCode}</span>}
        <FaChevronDown style={{ color: T.textSec, fontSize: 11, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.25)", overflow: "hidden"
        }}>
          {/* Search inside dropdown */}
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}` }}>
            <input
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "7px 10px", borderRadius: 7,
                border: `1px solid ${T.border}`, background: T.inputBg,
                color: T.textPri, fontSize: 13, outline: "none"
              }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: 16, textAlign: "center", color: T.textSec, fontSize: 13 }}>No customers found</div>
            )}
            {filtered.map(c => (
              <div key={c._id} onClick={() => { onChange(c._id, c); setOpen(false); setSearch(""); }}
                style={{
                  padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center",
                  gap: 10, borderBottom: `1px solid ${T.border}`,
                  background: c._id === value ? T.blueDim : "transparent",
                  transition: "background 0.12s"
                }}
                onMouseEnter={e => { if (c._id !== value) e.currentTarget.style.background = T.surface2; }}
                onMouseLeave={e => { if (c._id !== value) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: T.blueDim,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: T.blue, flexShrink: 0
                }}>
                  {(c.customerDisplayName || c.companyName || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.textPri, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.customerDisplayName || c.companyName}
                  </p>
                  {c.companyName && c.companyName !== c.customerDisplayName &&
                    <p style={{ margin: 0, fontSize: 11, color: T.textSec }}>{c.companyName}</p>
                  }
                </div>
                <span style={{ fontSize: 11, color: T.textSec, background: T.surface2, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>
                  {c.customerCode}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StatementOfAccount() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const printRef = useRef(null);

  const [customers, setCustomers]         = useState([]);
  const [selectedID, setSelectedID]       = useState(null);
  const [selectedCustomer, setSelected]   = useState(null);
  const [startDate, setStartDate]         = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate]   = useState(() => new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // Load customer list on mount
  useEffect(() => {
    axiosInstance.get("/api/customers/getcustomers")
      .then(r => setCustomers(r.data?.data || []))
      .catch(() => {});
  }, []);

  const handlePickCustomer = (id, cust) => {
    setSelectedID(id);
    setSelected(cust);
    setStatement(null);
  };

  const fetchStatement = async () => {
    if (!selectedID) return;
    setLoading(true); setError(null);
    try {
      const res = await axiosInstance.get(
        `/api/customers/${selectedID}/statement?startDate=${startDate}&endDate=${endDate}`
      );
      setStatement(res.data?.data);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load statement");
    } finally { setLoading(false); }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><title>Statement of Account</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',sans-serif; font-size:12px; color:#1a202c; padding:32px; }
        h2 { font-size:20px; font-weight:700; }
        .period { color:#64748b; font-size:12px; margin-top:2px; }
        .header-grid { display:flex; justify-content:space-between; margin-bottom:24px; }
        .summary { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
        .card { border:1px solid #e2e8f0; border-radius:8px; padding:12px; }
        .card-label { font-size:10px; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px; }
        .card-val { font-size:16px; font-weight:700; }
        table { width:100%; border-collapse:collapse; }
        th { background:#f8fafc; padding:9px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#475569; border-bottom:2px solid #e2e8f0; }
        th.num { text-align:right; }
        td { padding:9px 10px; border-bottom:1px solid #f1f5f9; font-size:12px; }
        td.num { text-align:right; }
        .debit { color:#dc2626; } .credit { color:#16a34a; }
        .ob-row td { font-style:italic; color:#64748b; background:#fafafa; }
        .closing td { font-weight:700; background:#f8fafc; border-top:2px solid #e2e8f0; }
        .footer { text-align:center; color:#94a3b8; font-size:10px; margin-top:20px; }
      </style></head><body>${content}</body></html>
    `);
    w.document.close(); w.focus(); w.print(); w.close();
  };

  const s = statement;

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: T.bg }}>

      {/* Page Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: T.blueDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FaFileAlt style={{ color: T.blue, fontSize: 16 }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>Statement of Account</h1>
            <p style={{ color: T.textSec, margin: 0, fontSize: 12 }}>Customer account statement with invoices and payments</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: "18px 20px", marginBottom: 24,
        display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end"
      }}>
        <CustomerDropdown
          value={selectedID}
          onChange={handlePickCustomer}
          customers={customers}
          T={T}
        />

        <DatePicker label="From" value={startDate} onChange={setStartDate} T={T} />
        <DatePicker label="To"   value={endDate}   onChange={setEndDate}   T={T} />

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button onClick={fetchStatement} disabled={!selectedID || loading} style={{
            padding: "9px 22px", borderRadius: 8, border: "none",
            background: selectedID ? T.blue : T.border,
            color: selectedID ? "#fff" : T.textSec,
            fontWeight: 600, fontSize: 13, cursor: selectedID ? "pointer" : "not-allowed",
            transition: "opacity 0.15s",
          }}>
            {loading ? "Loading…" : "Generate"}
          </button>

          {s && (
            <button onClick={handlePrint} style={{
              padding: "9px 16px", borderRadius: 8,
              border: `1px solid ${T.border}`, background: T.surface2,
              color: T.textPri, cursor: "pointer", fontSize: 13,
              display: "flex", alignItems: "center", gap: 6, fontWeight: 500
            }}>
              <FaPrint style={{ fontSize: 12 }} /> Print
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 16,
          background: T.redDim, border: `1px solid ${T.red}40`, color: T.red, fontSize: 13
        }}>{error}</div>
      )}

      {/* Statement */}
      {s && (
        <div ref={printRef} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28 }}>

          {/* Doc header */}
          <div className="header-grid" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>Statement of Account</h2>
              <p className="period" style={{ color: T.textSec, fontSize: 12, marginTop: 4 }}>
                Period: {s.period.startDate} — {s.period.endDate}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontWeight: 700, color: T.textPri, fontSize: 15, margin: 0 }}>
                {s.customer.name || s.customer.companyName}
              </p>
              {s.customer.companyName && s.customer.name !== s.customer.companyName && (
                <p style={{ color: T.textSec, fontSize: 12, margin: "2px 0 0" }}>{s.customer.companyName}</p>
              )}
              {s.customer.email && <p style={{ color: T.textSec, fontSize: 12, margin: "2px 0 0" }}>{s.customer.email}</p>}
              <p style={{ color: T.textSec, fontSize: 12, margin: "2px 0 0" }}>
                {[s.customer.address, s.customer.city, s.customer.country].filter(Boolean).join(", ")}
              </p>
              <p style={{ color: T.textSec, fontSize: 11, marginTop: 6, background: T.surface2, display: "inline-block", padding: "2px 8px", borderRadius: 6 }}>
                Account: {s.customer.code}
              </p>
            </div>
          </div>

          {/* Summary cards */}
          <div className="summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Opening Balance", value: fmt(s.openingBalance),  color: T.textPri },
              { label: "Total Invoiced",  value: fmt(s.transactions.reduce((a,t)=>a+t.debit,0)),  color: T.red },
              { label: "Total Paid",      value: fmt(s.transactions.reduce((a,t)=>a+t.credit,0)), color: T.green },
              { label: "Closing Balance", value: fmt(Math.abs(s.closingBalance)),
                color: s.closingBalance > 0 ? T.red : T.green,
                sub: s.closingBalance > 0 ? "Dr (Owed)" : s.closingBalance < 0 ? "Cr (Overpaid)" : "Settled" },
            ].map(card => (
              <div key={card.label} className="card" style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", background: T.surface2 }}>
                <p className="card-label" style={{ fontSize: 10, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{card.label}</p>
                <p className="card-val" style={{ fontSize: 18, fontWeight: 700, color: card.color, margin: 0 }}>{card.value}</p>
                {card.sub && <p style={{ fontSize: 10, color: T.textSec, margin: "3px 0 0" }}>{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* Table */}
          {s.transactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: T.textSec, border: `1px dashed ${T.border}`, borderRadius: 10 }}>
              No transactions in this period
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[["Date","l"],["Reference","l"],["Description","l"],["Debit (AED)","r"],["Credit (AED)","r"],["Balance (AED)","r"]].map(([h, a]) => (
                      <th key={h} className={a === "r" ? "num" : ""} style={{
                        padding: "10px 12px", textAlign: a === "r" ? "right" : "left",
                        fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em",
                        color: T.textSec, borderBottom: `2px solid ${T.border}`,
                        background: T.surface2
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance */}
                  <tr className="ob-row">
                    <td colSpan={5} style={{ padding: "8px 12px", fontSize: 12, color: T.textSec, fontStyle: "italic", borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
                      Opening Balance
                    </td>
                    <td className="num" style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, fontSize: 13, color: T.textPri, borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
                      {fmt(s.openingBalance)}
                    </td>
                  </tr>

                  {s.transactions.map((tx, i) => (
                    <tr key={i}>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: T.textSec, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>
                        {new Date(tx.date).toLocaleDateString("en-AE", { day:"2-digit", month:"short", year:"numeric" })}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: T.blue, fontWeight: 500, borderBottom: `1px solid ${T.border}` }}>{tx.reference}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: T.textPri, borderBottom: `1px solid ${T.border}` }}>{tx.description}</td>
                      <td className="debit" style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: tx.debit > 0 ? T.red : T.textSec, borderBottom: `1px solid ${T.border}` }}>
                        {tx.debit > 0 ? fmt(tx.debit) : "—"}
                      </td>
                      <td className="credit" style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: tx.credit > 0 ? T.green : T.textSec, borderBottom: `1px solid ${T.border}` }}>
                        {tx.credit > 0 ? fmt(tx.credit) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${T.border}`,
                        color: tx.balance > 0 ? T.red : tx.balance < 0 ? T.green : T.textSec }}>
                        {fmt(Math.abs(tx.balance))}
                        {tx.balance !== 0 && <span style={{ fontSize: 10, marginLeft: 4, fontWeight: 400 }}>{tx.balance > 0 ? "Dr" : "Cr"}</span>}
                      </td>
                    </tr>
                  ))}

                  {/* Closing */}
                  <tr className="closing">
                    <td colSpan={5} style={{ padding: "11px 12px", fontWeight: 700, fontSize: 13, color: T.textPri, borderTop: `2px solid ${T.border}`, background: T.surface2 }}>
                      Closing Balance
                    </td>
                    <td style={{ padding: "11px 12px", textAlign: "right", fontWeight: 700, fontSize: 14, borderTop: `2px solid ${T.border}`, background: T.surface2,
                      color: s.closingBalance > 0 ? T.red : T.green }}>
                      {fmt(Math.abs(s.closingBalance))}
                      {s.closingBalance !== 0 && <span style={{ fontSize: 11, marginLeft: 5, fontWeight: 500 }}>{s.closingBalance > 0 ? "Dr" : "Cr"}</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <p className="footer" style={{ textAlign: "center", color: T.textSec, fontSize: 11, marginTop: 18 }}>
            Generated on {new Date().toLocaleDateString("en-AE", { day:"2-digit", month:"long", year:"numeric" })}
            &nbsp;•&nbsp; Dr = Amount Owed &nbsp;•&nbsp; Cr = Overpaid / Credit
          </p>
        </div>
      )}

      {!s && !loading && !error && (
        <div style={{ textAlign: "center", padding: "64px 0", color: T.textSec, border: `1px dashed ${T.border}`, borderRadius: 14 }}>
          <FaFileAlt style={{ fontSize: 44, marginBottom: 14, opacity: 0.25, color: T.blue }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: T.textSec }}>Select a customer and date range, then click Generate</p>
          <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>The statement will show all invoices and payments for the selected period</p>
        </div>
      )}
    </div>
  );
}
