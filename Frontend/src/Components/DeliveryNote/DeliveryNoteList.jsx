import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus, FaSearch, FaTruck,
  FaChevronLeft, FaChevronRight, FaClipboardList,
} from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";

const STATUSES = [
  { key: "all",        label: "All",        color: "#64748b", bg: "rgba(100,116,139,0.1)" },
  { key: "draft",      label: "Draft",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { key: "confirmed",  label: "Confirmed",  color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { key: "dispatched", label: "Dispatched", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  { key: "delivered",  label: "Delivered",  color: "#10b981", bg: "rgba(16,185,129,0.12)" },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]));

const fmtAED = (n) =>
  `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.draft;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: s.color, background: s.bg, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
};

const LIMIT = 20;

export default function DeliveryNoteList() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const navigate = useNavigate();

  const [notes,        setNotes]        = useState([]);
  const [stats,        setStats]        = useState({});
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const r = await axiosInstance.get("/api/delivery-notes/stats");
      setStats(r.data?.data || {});
    } catch { /* non-fatal */ }
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const r = await axiosInstance.get("/api/delivery-notes/", { params });
      const d = r.data?.data || {};
      setNotes(d.deliveryNotes || []);
      setTotalCount(d.total || 0);
      setTotalPages(Math.max(1, Math.ceil((d.total || 0) / LIMIT)));
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };
  const handleStatusFilter = (key) => { setStatusFilter(key); setPage(1); };

  const card = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.35)" : "0 2px 12px rgba(0,0,0,0.06)",
  };

  const statCards = [
    { label: "Total",      value: stats.total      || 0, color: "#64748b", bg: "rgba(100,116,139,0.1)" },
    { label: "Draft",      value: stats.draft      || 0, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    { label: "Confirmed",  value: stats.confirmed  || 0, color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    { label: "Dispatched", value: stats.dispatched || 0, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    { label: "Delivered",  value: stats.delivered  || 0, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.textPri, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 48px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16,185,129,0.12)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                <FaTruck />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0 }}>Delivery Notes</h1>
            </div>
            <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>Track dispatched goods and delivery status</p>
          </div>
          <button
            onClick={() => navigate("/Sales/Outbound")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "linear-gradient(135deg,#10b981,#059669)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>
            <FaPlus size={12} /> Create Delivery Note
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          {statCards.map((s) => (
            <div key={s.label} style={{ ...card, padding: "16px 18px" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: "0 0 4px", fontFamily: "DM Mono, monospace" }}>{s.value}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: T.textSec, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ ...card, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
            <FaSearch size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }} />
            <input
              value={search}
              onChange={handleSearch}
              placeholder="Search DN number, customer…"
              style={{ width: "100%", paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, color: T.textPri, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Status tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUSES.map((s) => (
              <button
                key={s.key}
                onClick={() => handleStatusFilter(s.key)}
                style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s",
                  background: statusFilter === s.key ? s.bg : T.surface2,
                  color: statusFilter === s.key ? s.color : T.textSec,
                  outline: statusFilter === s.key ? `1.5px solid ${s.color}` : "none",
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ ...card, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: T.textSec, fontSize: 14 }}>Loading…</div>
          ) : notes.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <FaClipboardList size={36} style={{ color: T.textMuted, marginBottom: 12, opacity: 0.5 }} />
              <p style={{ fontSize: 14, color: T.textSec, margin: 0 }}>No delivery notes found</p>
              <p style={{ fontSize: 12, color: T.textMuted, margin: "6px 0 0" }}>Create one from the Outbound page</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", borderBottom: `1px solid ${T.border}` }}>
                  {["DN Number", "Date", "Customer", "Sales Order", "Items", "Grand Total", "Status"].map((h, i) => (
                    <th key={h} style={{ padding: "11px 16px", textAlign: i >= 4 ? "right" : "left", fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notes.map((note) => (
                  <tr
                    key={note._id}
                    onClick={() => navigate(`/Sales/Deliverynote/${note._id}`)}
                    style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.1s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 700, color: T.blue, background: "rgba(59,130,246,0.08)", padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(59,130,246,0.15)" }}>
                        {note.dnNumber}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px", color: T.textSec, fontSize: 12 }}>{note.date || "—"}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>{note.customerName || "—"}</p>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: T.textSec }}>{note.orderNumber || "—"}</span>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>{(note.items || []).length}</span>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.blue, fontFamily: "DM Mono, monospace" }}>{fmtAED(note.grandTotal)}</span>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <StatusBadge status={note.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "0 4px" }}>
            <span style={{ fontSize: 12, color: T.textSec }}>
              Showing {Math.min((page - 1) * LIMIT + 1, totalCount)}–{Math.min(page * LIMIT, totalCount)} of {totalCount}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: page === 1 ? T.textMuted : T.textSec, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}>
                <FaChevronLeft size={10} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: page === totalPages ? T.textMuted : T.textSec, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.5 : 1 }}>
                Next <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
