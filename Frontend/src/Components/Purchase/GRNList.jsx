import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus, FaSearch, FaWarehouse,
  FaChevronLeft, FaChevronRight, FaClipboardList, FaTimes,
} from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";

const STATUSES = [
  { key: "all",       label: "All",       color: "#64748b", dim: "rgba(100,116,139,.12)" },
  { key: "pending",   label: "Pending",   color: "#f59e0b", dim: "rgba(245,158,11,.12)"  },
  { key: "confirmed", label: "Confirmed", color: "#10b981", dim: "rgba(16,185,129,.12)"  },
  { key: "rejected",  label: "Rejected",  color: "#ef4444", dim: "rgba(239,68,68,.12)"   },
  { key: "billed",    label: "Billed",    color: "#3b82f6", dim: "rgba(59,130,246,.12)"  },
  { key: "invoiced",  label: "Invoiced",  color: "#3b82f6", dim: "rgba(59,130,246,.12)"  },
];
const SM = {
  ...Object.fromEntries(STATUSES.map(s => [s.key, s])),
  draft: { key: "draft", label: "Draft", color: "#64748b", dim: "rgba(100,116,139,.12)" },
};

const fmtAED = (n) =>
  `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Fallback total for old GRNs missing a stored `total`: sum line totals,
// else accepted-qty × rate, plus any stored header shipping/adjustment.
const grnDisplayTotal = (g) => {
  if (g.total) return g.total;
  const items = g.items || [];
  let sum = items.reduce((s, i) => {
    if (i.lineTotal) return s + i.lineTotal;
    const acc = Math.max(0, (i.receivedQty || 0) - (i.rejectedQty || 0));
    const base = acc * (i.rate || 0);
    const tax  = (i.taxAmount != null) ? i.taxAmount : 0;
    const frt  = (i.freight || 0) + (i.freightTaxAmount || 0);
    return s + base + tax + frt;
  }, 0);
  sum += (g.shippingCharges || 0) + (g.adjustment || 0);
  return sum;
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const LIMIT = 20;

export default function GRNList() {
  const isDark   = useThemeStore((s) => s.isDark);
  const T        = getTheme(isDark);
  const navigate = useNavigate();

  const [grns,         setGrns]         = useState([]);
  const [stats,        setStats]        = useState({});
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);
  const [mounted,      setMounted]      = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchStats = useCallback(async () => {
    try { const r = await axiosInstance.get("/api/grns/stats"); setStats(r.data?.data || {}); }
    catch { /* non-fatal */ }
  }, []);

  const fetchGRNs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const r = await axiosInstance.get("/api/grns/", { params });
      const raw = r.data?.data;
      // Support both old format (array) and new format ({ grns, total })
      const list  = Array.isArray(raw) ? raw : (raw?.grns || []);
      const total = Array.isArray(raw) ? raw.length : (raw?.total || 0);
      setGrns(list);
      setTotalCount(total);
      setTotalPages(Math.max(1, Math.ceil(total / LIMIT)));
    } catch { setGrns([]); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchGRNs(); }, [fetchGRNs]);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .gnl-root *{box-sizing:border-box}
    .gnl-root{font-family:'DM Sans',sans-serif}
    html,body,*{scrollbar-width:thin;scrollbar-color:${isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"} transparent}
    *::-webkit-scrollbar{width:5px}*::-webkit-scrollbar-thumb{background:${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"};border-radius:99px}
    @keyframes fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .gnl-row{transition:background .1s;cursor:pointer}
    .gnl-row:hover td{background:${isDark ? "rgba(255,255,255,.025)" : "rgba(37,99,235,.018)"} !important}
    .gnl-btn{transition:all .15s;cursor:pointer}
    .gnl-btn:hover{filter:brightness(${isDark ? "1.1" : ".95"});transform:translateY(-1px)}
    .gnl-stat{transition:transform .2s cubic-bezier(.34,1.56,.64,1)}
    .gnl-stat:hover{transform:translateY(-2px)}
    .gnl-mounted .gnl-s0{animation:fadeUp .28s .00s ease both}
    .gnl-mounted .gnl-s1{animation:fadeUp .28s .04s ease both}
    .gnl-mounted .gnl-s2{animation:fadeUp .28s .08s ease both}
    .gnl-mounted .gnl-s3{animation:fadeUp .28s .12s ease both}
    .gnl-mounted .gnl-tbl{animation:fadeUp .3s .18s ease both}
    .sora{font-family:'Sora',sans-serif}
    .mono{font-family:'DM Mono',monospace}
  `;

  const surface  = T.surface;
  const surface2 = T.surface2;
  const border   = T.border;
  const text     = T.textPri;
  const muted    = T.textSec;

  const STAT_CARDS = [
    { label: "Total",     val: stats.total     || 0, color: "#64748b", dim: "rgba(100,116,139,.1)"  },
    { label: "Pending",   val: stats.pending   || 0, color: "#f59e0b", dim: "rgba(245,158,11,.12)"  },
    { label: "Confirmed", val: stats.confirmed || 0, color: "#10b981", dim: "rgba(16,185,129,.12)"  },
    { label: "Rejected",  val: stats.rejected  || 0, color: "#ef4444", dim: "rgba(239,68,68,.12)"   },
    { label: "Invoiced",  val: stats.invoiced  || 0, color: "#3b82f6", dim: "rgba(59,130,246,.12)"  },
  ];

  return (
    <div className={`gnl-root${mounted ? " gnl-mounted" : ""}`}
      style={{ background: T.bg, minHeight: "calc(100vh - 56px)", color: text, padding: "24px 28px 48px" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16,185,129,.12)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FaWarehouse size={15} />
            </div>
            <h1 className="sora" style={{ fontSize: 20, fontWeight: 700, color: text, margin: 0, letterSpacing: "-0.03em" }}>Goods Receipt Notes</h1>
          </div>
          <p style={{ fontSize: 12.5, color: muted, margin: 0 }}>View and manage all goods receipts from inbound orders</p>
        </div>
        <button className="gnl-btn" onClick={() => navigate("/Purchase/Inbound")}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", background: "linear-gradient(135deg,#10b981,#059669)", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, color: "#fff", boxShadow: "0 4px 14px rgba(16,185,129,.3)" }}>
          <FaPlus size={11} /> New Receipt
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
        {STAT_CARDS.map((s, i) => (
          <div key={s.label} className={`gnl-stat gnl-s${i}`}
            onClick={() => { setStatusFilter(s.label.toLowerCase()); setPage(1); }}
            style={{ background: surface, border: `1px solid ${border}`, borderRadius: 13, padding: "16px 18px", position: "relative", overflow: "hidden", cursor: "pointer", outline: statusFilter === s.label.toLowerCase() ? `2px solid ${s.color}` : "2px solid transparent", outlineOffset: 2 }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${s.color},transparent)`, opacity: isDark ? .5 : .7 }} />
            <p className="sora" style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: "0 0 3px", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val}</p>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: muted, margin: 0, textTransform: "uppercase", letterSpacing: ".06em" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <FaSearch size={11} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: muted }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search GRN number, vendor…"
            style={{ width: "100%", paddingLeft: 30, paddingRight: search ? 32 : 12, paddingTop: 8, paddingBottom: 8, background: surface2, border: `1px solid ${border}`, borderRadius: 8, fontSize: 13, color: text, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          {search && <button onClick={() => { setSearch(""); setPage(1); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: muted, padding: 0, display: "flex" }}><FaTimes size={10} /></button>}
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {STATUSES.map(s => {
            const active = statusFilter === s.key;
            return (
              <button key={s.key} onClick={() => { setStatusFilter(s.key); setPage(1); }}
                style={{ padding: "5px 13px", borderRadius: 99, fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? (isDark ? `${s.color}44` : `${s.color}55`) : border}`, background: active ? (isDark ? `${s.color}18` : s.dim) : "transparent", color: active ? s.color : muted, fontFamily: "inherit", transition: "all .15s" }}>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="gnl-tbl" style={{ background: surface, border: `1px solid ${border}`, borderRadius: 13, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: muted }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${T.blueDim}`, borderTopColor: T.blue, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13 }}>Loading…</p>
          </div>
        ) : grns.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <FaClipboardList size={34} style={{ color: muted, marginBottom: 12, opacity: .4 }} />
            <p style={{ fontSize: 14, color: muted, margin: 0, fontWeight: 600 }}>No goods receipt notes found</p>
            <p style={{ fontSize: 12, color: muted, margin: "6px 0 0" }}>Create one from the Inbound page</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: isDark ? "rgba(255,255,255,.03)" : "#f8fafc", borderBottom: `1px solid ${border}` }}>
                {["GRN Number", "Date", "Vendor", "PO Number", "Items", "Total", "Status"].map((h, i) => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: i >= 4 ? "center" : "left", fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grns.map((g, idx) => {
                const statusKey = g.status?.toLowerCase() || "pending";
                const s = SM[statusKey] || SM.pending;
                return (
                  <tr key={g._id} className="gnl-row"
                    onClick={() => navigate(`/Purchase/GRN/${g._id}`)}
                    style={{ borderBottom: `1px solid ${T.border2 || border}`, animation: `fadeUp .22s ${idx * .02}s ease both` }}>
                    <td style={{ padding: "13px 16px" }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: T.blue, background: "rgba(59,130,246,.08)", padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(59,130,246,.15)" }}>
                        {g.grnNumber}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px", color: muted, fontSize: 12 }}>{fmtDate(g.receiptDate)}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: text, margin: 0 }}>{g.vendorName || "—"}</p>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span className="mono" style={{ fontSize: 11, color: muted }}>{g.poNumber || "—"}</span>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{(g.items || []).length}</span>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "center" }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: text }}>{(() => { const t = grnDisplayTotal(g); return t > 0 ? fmtAED(t) : "—"; })()}</span>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "center" }}>
                      <span style={{ padding: "3px 11px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: s.color, background: s.dim, whiteSpace: "nowrap" }}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "0 2px" }}>
          <span style={{ fontSize: 12, color: muted }}>
            Showing {Math.min((page - 1) * LIMIT + 1, totalCount)}–{Math.min(page * LIMIT, totalCount)} of {totalCount}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="gnl-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: surface, border: `1px solid ${border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: page === 1 ? muted : text, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? .5 : 1 }}>
              <FaChevronLeft size={10} /> Prev
            </button>
            <button className="gnl-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: surface, border: `1px solid ${border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: page === totalPages ? muted : text, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? .5 : 1 }}>
              Next <FaChevronRight size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
