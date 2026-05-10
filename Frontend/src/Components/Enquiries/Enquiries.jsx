import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus, FaTimes, FaSearch, FaChevronLeft, FaChevronRight,
  FaPhoneAlt, FaEnvelope, FaBuilding, FaCalendarAlt,
  FaUserTie, FaFilter, FaEdit, FaSave,
} from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

const STATUSES = [
  { key: "all",       label: "All" },
  { key: "new",       label: "New",       color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { key: "contacted", label: "Contacted",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { key: "quoted",    label: "Quoted",     color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  { key: "converted", label: "Converted",  color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  { key: "lost",      label: "Lost",       color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  { key: "cancelled", label: "Cancelled",  color: "#64748b", bg: "rgba(100,116,139,0.12)" },
];

const SOURCES = ["Walk-in", "Phone", "Email", "Referral", "Website", "Social Media", "Exhibition", "Other"];
const PRIORITIES = ["low", "medium", "high"];

const STATUS_MAP = Object.fromEntries(STATUSES.filter(s => s.key !== "all").map(s => [s.key, s]));

const PRIORITY_CFG = {
  low:    { color: "#64748b", bg: "rgba(100,116,139,0.1)", label: "Low" },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Medium" },
  high:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   label: "High" },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.new;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: s.color, background: s.bg, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const p = PRIORITY_CFG[priority] || PRIORITY_CFG.medium;
  return (
    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
      color: p.color, background: p.bg }}>
      {p.label}
    </span>
  );
};

const EMPTY_FORM = {
  customerName: "", email: "", phone: "", company: "",
  source: "Walk-in", subject: "", description: "",
  estimatedValue: "", priority: "medium", assignedTo: "",
  followUpDate: "", notes: "", date: new Date().toISOString().slice(0, 10),
};

const LIMIT = 15;

export default function Enquiries() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const navigate = useNavigate();

  const [enquiries,    setEnquiries]    = useState([]);
  const [stats,        setStats]        = useState({});
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);

  // Drawer
  const [selected,     setSelected]     = useState(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [drawerTab,    setDrawerTab]    = useState("overview");
  const [editing,      setEditing]      = useState(false);
  const [editForm,     setEditForm]     = useState({});
  const [saving,       setSaving]       = useState(false);

  // Create modal
  const [modalOpen,    setModalOpen]    = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [submitting,   setSubmitting]   = useState(false);

  // Status update in drawer
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("q", search.trim());
      const res = await axiosInstance.get(`/api/enquiries/?${params}`);
      const d = res.data?.data ?? {};
      setEnquiries(Array.isArray(d.enquiries) ? d.enquiries : []);
      setTotalPages(d.totalPages ?? 1);
      setTotalCount(d.total ?? 0);
    } catch { setEnquiries([]); } finally { setLoading(false); }
  }, [page, statusFilter, search]);

  const loadStats = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/api/enquiries/stats");
      setStats(res.data?.data ?? {});
    } catch { }
  }, []);

  useEffect(() => { loadEnquiries(); }, [loadEnquiries]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const openDrawer = (enq) => { setSelected(enq); setDrawerOpen(true); setDrawerTab("overview"); setEditing(false); };
  const closeDrawer = () => { setDrawerOpen(false); setSelected(null); setEditing(false); };

  const handleCreate = async () => {
    if (!form.customerName.trim()) { nexusToast.error("Customer name is required"); return; }
    if (!form.subject.trim())      { nexusToast.error("Subject is required"); return; }
    setSubmitting(true);
    try {
      await axiosInstance.post("/api/enquiries/", {
        ...form,
        estimatedValue: parseFloat(form.estimatedValue) || 0,
      });
      nexusToast.success("Enquiry created successfully");
      setModalOpen(false);
      setForm(EMPTY_FORM);
      loadEnquiries();
      loadStats();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to create enquiry");
    } finally { setSubmitting(false); }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      await axiosInstance.patch(`/api/enquiries/${selected._id}/status`, { status: newStatus });
      nexusToast.success("Status updated");
      const updated = { ...selected, status: newStatus };
      setSelected(updated);
      setEnquiries(prev => prev.map(e => e._id === selected._id ? updated : e));
      loadStats();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to update status");
    } finally { setUpdatingStatus(false); }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await axiosInstance.put(`/api/enquiries/${selected._id}`, {
        ...editForm,
        estimatedValue: parseFloat(editForm.estimatedValue) || 0,
      });
      nexusToast.success("Enquiry updated");
      const updated = { ...selected, ...editForm, estimatedValue: parseFloat(editForm.estimatedValue) || 0 };
      setSelected(updated);
      setEnquiries(prev => prev.map(e => e._id === selected._id ? updated : e));
      setEditing(false);
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to update");
    } finally { setSaving(false); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const fmtAED  = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}`;

  const border = T.border;
  const thS = { padding: "10px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
    textTransform: "uppercase", color: T.textSec, background: T.surface2,
    borderBottom: `1.5px solid ${border}`, whiteSpace: "nowrap" };
  const tdS = { padding: "12px 14px", fontSize: 13, color: T.textPri, borderBottom: `1px solid ${border}`, verticalAlign: "middle" };

  // ── Stat cards ─────────────────────────────────────────────────────
  const statCards = [
    { label: "Total Enquiries", value: stats.total ?? 0,     color: T.blue,   icon: "📋" },
    { label: "New",             value: stats.new ?? 0,        color: T.blue,   icon: "🆕" },
    { label: "Quoted",          value: stats.quoted ?? 0,     color: T.purple, icon: "📄" },
    { label: "Converted",       value: stats.converted ?? 0,  color: T.green,  icon: "✅" },
    { label: "Total Value",     value: fmtAED(stats.totalValue), color: T.amber, icon: "💰", wide: true },
  ];

  const inputStyle = { width: "100%", padding: "9px 12px", border: `1.5px solid ${border}`,
    borderRadius: 9, fontSize: 13, background: T.inputBg, color: T.textPri,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  const labelStyle = { fontSize: 11, fontWeight: 600, color: T.textSec,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };

  return (
    <>
      <style>{`
        @keyframes enqSlideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes enqOverlay { from{opacity:0} to{opacity:1} }
        @keyframes enqFadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .enq-row:hover { background:${isDark ? "rgba(255,255,255,.03)" : "#f8fafc"} !important; }
        .enq-tab { cursor:pointer; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:600;
          border:none; background:transparent; font-family:inherit; transition:all .15s; }
        .enq-tab:hover { background:${T.surface2}; }
        .enq-btn { cursor:pointer; border:none; border-radius:8px; font-family:inherit;
          font-size:12px; font-weight:600; padding:8px 14px; transition:all .15s; }
        .enq-btn:hover { opacity:.85; }
        .enq-input:focus { border-color:${T.borderFoc} !important; }
      `}</style>

      <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", padding: "24px 28px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: "-0.02em" }}>Enquiries</h1>
            <p style={{ fontSize: 13, color: T.textSec, margin: "4px 0 0" }}>Track and manage customer enquiries &amp; leads</p>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setModalOpen(true); }}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px",
              background: T.blue, color: "#fff", border: "none", borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11}/> New Enquiry
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          {statCards.map((s) => (
            <div key={s.label} style={{ flex: s.wide ? "1 1 180px" : "1 1 130px", minWidth: 120,
              background: T.surface, border: `1px solid ${border}`, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: s.wide ? 15 : 22, fontWeight: 800, color: s.color, fontFamily: "'DM Mono',monospace" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: T.textSec, marginTop: 2, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div style={{ background: T.surface, border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 220px" }}>
              <FaSearch size={11} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textSec }} />
              <input
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search enquiries…"
                style={{ ...inputStyle, paddingLeft: 32, width: "100%" }}
                className="enq-input"
              />
            </div>
            {/* Status filter */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {STATUSES.map((s) => (
                <button key={s.key} className="enq-tab"
                  onClick={() => { setStatusFilter(s.key); setPage(1); }}
                  style={{ color: statusFilter === s.key ? (s.color || T.blue) : T.textSec,
                    background: statusFilter === s.key ? (s.bg || T.blueDim) : "transparent" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: T.textSec }}>Loading enquiries…</div>
          ) : enquiries.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ color: T.textSec, fontSize: 14 }}>No enquiries found</p>
              <button onClick={() => { setForm(EMPTY_FORM); setModalOpen(true); }}
                className="enq-btn" style={{ marginTop: 12, background: T.blue, color: "#fff" }}>
                Add First Enquiry
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Enquiry #", "Customer", "Company", "Subject", "Source", "Priority", "Follow Up", "Status", "Value"].map(h => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((enq) => (
                    <tr key={enq._id} className="enq-row" onClick={() => openDrawer(enq)}
                      style={{ cursor: "pointer", transition: "background .12s" }}>
                      <td style={tdS}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: T.blue }}>{enq.enquiryNumber}</span>
                      </td>
                      <td style={tdS}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{enq.customerName || "—"}</div>
                        {enq.email && <div style={{ fontSize: 11, color: T.textSec }}>{enq.email}</div>}
                      </td>
                      <td style={{ ...tdS, fontSize: 12, color: T.textSec }}>{enq.company || "—"}</td>
                      <td style={{ ...tdS, maxWidth: 200 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{enq.subject || "—"}</div>
                      </td>
                      <td style={{ ...tdS, fontSize: 12, color: T.textSec }}>{enq.source || "—"}</td>
                      <td style={tdS}><PriorityBadge priority={enq.priority}/></td>
                      <td style={{ ...tdS, fontSize: 12, color: enq.followUpDate && new Date(enq.followUpDate) < new Date() ? T.red : T.textSec }}>
                        {fmtDate(enq.followUpDate)}
                      </td>
                      <td style={tdS}><StatusBadge status={enq.status}/></td>
                      <td style={{ ...tdS, fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, textAlign: "right" }}>
                        {enq.estimatedValue ? fmtAED(enq.estimatedValue) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: `1px solid ${border}` }}>
              <span style={{ fontSize: 12, color: T.textSec }}>Page {page} of {totalPages} · {totalCount} total</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: T.surface2,
                    border: `1.5px solid ${border}`, borderRadius: 8, fontSize: 12, fontWeight: 600,
                    color: page <= 1 ? T.textSec : T.textPri, cursor: page <= 1 ? "not-allowed" : "pointer",
                    opacity: page <= 1 ? 0.5 : 1, fontFamily: "inherit" }}>
                  <FaChevronLeft size={9}/> Prev
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: T.surface2,
                    border: `1.5px solid ${border}`, borderRadius: 8, fontSize: 12, fontWeight: 600,
                    color: page >= totalPages ? T.textSec : T.textPri, cursor: page >= totalPages ? "not-allowed" : "pointer",
                    opacity: page >= totalPages ? 0.5 : 1, fontFamily: "inherit" }}>
                  Next <FaChevronRight size={9}/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Side Drawer ────────────────────────────────────────────────── */}
      {drawerOpen && selected && (
        <>
          <div onClick={closeDrawer} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40, animation: "enqOverlay .2s ease" }}/>
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 420, maxWidth: "95vw",
            background: T.surface, borderLeft: `1px solid ${border}`, zIndex: 41,
            display: "flex", flexDirection: "column", animation: "enqSlideIn .25s ease" }}>

            {/* Drawer header */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${border}`, flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.blue, fontWeight: 700 }}>{selected.enquiryNumber}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, marginTop: 2 }}>{selected.customerName}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                  <StatusBadge status={selected.status}/>
                  <PriorityBadge priority={selected.priority}/>
                </div>
              </div>
              <button onClick={closeDrawer} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 4 }}>
                <FaTimes size={16}/>
              </button>
            </div>

            {/* Drawer tabs */}
            <div style={{ display: "flex", gap: 2, padding: "8px 16px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              {["overview", "update"].map(tab => (
                <button key={tab} onClick={() => { setDrawerTab(tab); setEditing(false); }}
                  className="enq-tab"
                  style={{ color: drawerTab === tab ? T.blue : T.textSec,
                    background: drawerTab === tab ? T.blueDim : "transparent",
                    textTransform: "capitalize" }}>
                  {tab === "update" ? "Update Status" : "Overview"}
                </button>
              ))}
              <button onClick={() => { setDrawerTab("edit"); setEditForm({ ...selected, estimatedValue: selected.estimatedValue || "" }); setEditing(true); }}
                className="enq-tab"
                style={{ color: drawerTab === "edit" ? T.blue : T.textSec,
                  background: drawerTab === "edit" ? T.blueDim : "transparent", marginLeft: "auto" }}>
                <FaEdit size={11} style={{ marginRight: 5 }}/>Edit
              </button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

              {/* ── Overview Tab ── */}
              {drawerTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "enqFadeUp .2s ease" }}>

                  {/* Contact info */}
                  <div style={{ background: T.surface2, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Contact Information</div>
                    {[
                      { icon: <FaUserTie size={11}/>, label: "Customer", val: selected.customerName },
                      { icon: <FaBuilding size={11}/>, label: "Company",  val: selected.company || "—" },
                      { icon: <FaEnvelope size={11}/>, label: "Email",    val: selected.email || "—" },
                      { icon: <FaPhoneAlt size={11}/>, label: "Phone",    val: selected.phone || "—" },
                    ].map(({ icon, label, val }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ color: T.textSec, width: 16, flexShrink: 0 }}>{icon}</span>
                        <span style={{ fontSize: 11, color: T.textSec, width: 70, flexShrink: 0 }}>{label}</span>
                        <span style={{ fontSize: 13, color: T.textPri, fontWeight: 500 }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Enquiry details */}
                  <div style={{ background: T.surface2, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Enquiry Details</div>
                    {[
                      { label: "Subject",        val: selected.subject || "—" },
                      { label: "Source",         val: selected.source || "—" },
                      { label: "Assigned To",    val: selected.assignedTo || "—" },
                      { label: "Enquiry Date",   val: fmtDate(selected.date) },
                      { label: "Follow Up",      val: fmtDate(selected.followUpDate) },
                      { label: "Est. Value",     val: selected.estimatedValue ? fmtAED(selected.estimatedValue) : "—", mono: true },
                    ].map(({ label, val, mono }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${border}` }}>
                        <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                        <span style={{ fontSize: 12, color: T.textPri, fontWeight: 600, fontFamily: mono ? "'DM Mono',monospace" : "inherit" }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  {selected.description && (
                    <div style={{ background: T.surface2, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Description</div>
                      <p style={{ fontSize: 13, color: T.textPri, lineHeight: 1.6, margin: 0 }}>{selected.description}</p>
                    </div>
                  )}

                  {/* Notes */}
                  {selected.notes && (
                    <div style={{ background: T.surface2, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Notes</div>
                      <p style={{ fontSize: 13, color: T.textPri, lineHeight: 1.6, margin: 0 }}>{selected.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Update Status Tab ── */}
              {drawerTab === "update" && (
                <div style={{ animation: "enqFadeUp .2s ease" }}>
                  <p style={{ fontSize: 13, color: T.textSec, marginBottom: 16 }}>Change the enquiry status to track its progress through your pipeline.</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {STATUSES.filter(s => s.key !== "all").map(s => (
                      <button key={s.key}
                        disabled={updatingStatus || selected.status === s.key}
                        onClick={() => handleStatusUpdate(s.key)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                          border: `1.5px solid ${selected.status === s.key ? s.color : border}`,
                          borderRadius: 10, background: selected.status === s.key ? s.bg : T.surface2,
                          cursor: selected.status === s.key ? "default" : "pointer",
                          fontFamily: "inherit", transition: "all .15s" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }}/>
                        <span style={{ fontSize: 13, fontWeight: 600, color: selected.status === s.key ? s.color : T.textPri }}>
                          {s.label}
                        </span>
                        {selected.status === s.key && <span style={{ marginLeft: "auto", fontSize: 11, color: s.color }}>Current</span>}
                      </button>
                    ))}
                  </div>

                  {/* Quick convert to Sales Order */}
                  {selected.status !== "converted" && (
                    <div style={{ marginTop: 20, padding: 14, background: T.greenDim, border: `1px solid ${T.green}22`, borderRadius: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginBottom: 6 }}>Convert to Sales Order</div>
                      <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 10px" }}>Mark as converted and navigate to create a Sales Order for this customer.</p>
                      <button
                        disabled={updatingStatus}
                        onClick={async () => {
                          await handleStatusUpdate("converted");
                          navigate("/Sales/Salesorders/Newsalesorders");
                        }}
                        style={{ padding: "8px 14px", background: T.green, color: "#fff", border: "none",
                          borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        Convert & Create Order
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Edit Tab ── */}
              {drawerTab === "edit" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "enqFadeUp .2s ease" }}>
                  {[
                    { key: "customerName", label: "Customer Name *" },
                    { key: "email",        label: "Email" },
                    { key: "phone",        label: "Phone" },
                    { key: "company",      label: "Company" },
                    { key: "subject",      label: "Subject *" },
                    { key: "assignedTo",   label: "Assigned To" },
                    { key: "followUpDate", label: "Follow Up Date", type: "date" },
                    { key: "estimatedValue", label: "Estimated Value (AED)", type: "number" },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <input type={type || "text"} value={editForm[key] || ""} className="enq-input"
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ ...inputStyle }}/>
                    </div>
                  ))}

                  <div>
                    <label style={labelStyle}>Source</label>
                    <select value={editForm.source || ""} className="enq-input"
                      onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}
                      style={{ ...inputStyle }}>
                      {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Priority</label>
                    <select value={editForm.priority || "medium"} className="enq-input"
                      onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                      style={{ ...inputStyle }}>
                      {PRIORITIES.map(p => <option key={p} value={p} style={{ textTransform: "capitalize" }}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Description</label>
                    <textarea value={editForm.description || ""} rows={3} className="enq-input"
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      style={{ ...inputStyle, resize: "vertical" }}/>
                  </div>

                  <div>
                    <label style={labelStyle}>Notes</label>
                    <textarea value={editForm.notes || ""} rows={3} className="enq-input"
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      style={{ ...inputStyle, resize: "vertical" }}/>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            {drawerTab === "edit" && (
              <div style={{ padding: "14px 20px", borderTop: `1px solid ${border}`, flexShrink: 0, display: "flex", gap: 8 }}>
                <button disabled={saving} onClick={handleSaveEdit}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: 10, background: T.blue, color: "#fff", border: "none",
                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.6 : 1, fontFamily: "inherit" }}>
                  <FaSave size={11}/> {saving ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => { setDrawerTab("overview"); setEditing(false); }}
                  style={{ padding: "10px 16px", background: T.surface2, color: T.textSec,
                    border: `1.5px solid ${border}`, borderRadius: 10, fontSize: 13,
                    fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            )}
            {drawerTab !== "edit" && (
              <div style={{ padding: "14px 20px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
                <button onClick={closeDrawer}
                  style={{ width: "100%", padding: 10, background: T.surface2, color: T.textSec,
                    border: `1.5px solid ${border}`, borderRadius: 10, fontSize: 13,
                    fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Create Modal ───────────────────────────────────────────────── */}
      {modalOpen && (
        <>
          <div onClick={() => setModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, animation: "enqOverlay .2s ease" }}/>
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 560, maxWidth: "95vw", maxHeight: "90vh", background: T.surface,
            border: `1px solid ${border}`, borderRadius: 16, zIndex: 51,
            display: "flex", flexDirection: "column", animation: "enqFadeUp .2s ease" }}>

            {/* Modal header */}
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>New Enquiry</div>
                <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>Add a new customer enquiry or lead</div>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec }}>
                <FaTimes size={16}/>
              </button>
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { key: "customerName", label: "Customer Name *", full: true },
                  { key: "email",        label: "Email" },
                  { key: "phone",        label: "Phone" },
                  { key: "company",      label: "Company" },
                  { key: "subject",      label: "Subject / Product Interest *", full: true },
                  { key: "assignedTo",   label: "Assigned To" },
                  { key: "date",         label: "Enquiry Date", type: "date" },
                  { key: "followUpDate", label: "Follow Up Date", type: "date" },
                  { key: "estimatedValue", label: "Estimated Value (AED)", type: "number" },
                ].map(({ key, label, full, type }) => (
                  <div key={key} style={{ gridColumn: full ? "1 / -1" : undefined }}>
                    <label style={labelStyle}>{label}</label>
                    <input type={type || "text"} value={form[key] || ""} className="enq-input"
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ ...inputStyle }}/>
                  </div>
                ))}

                <div>
                  <label style={labelStyle}>Source</label>
                  <select value={form.source} className="enq-input"
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    style={{ ...inputStyle }}>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Priority</label>
                  <select value={form.priority} className="enq-input"
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    style={{ ...inputStyle }}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Description</label>
                  <textarea value={form.description} rows={3} className="enq-input"
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe what the customer is interested in…"
                    style={{ ...inputStyle, resize: "vertical" }}/>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Internal Notes</label>
                  <textarea value={form.notes} rows={2} className="enq-input"
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Internal notes for your team…"
                    style={{ ...inputStyle, resize: "vertical" }}/>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: "14px 22px", borderTop: `1px solid ${border}`, flexShrink: 0, display: "flex", gap: 8 }}>
              <button disabled={submitting} onClick={handleCreate}
                style={{ flex: 1, padding: "11px 0", background: T.blue, color: "#fff", border: "none",
                  borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, fontFamily: "inherit" }}>
                {submitting ? "Creating…" : "Create Enquiry"}
              </button>
              <button onClick={() => setModalOpen(false)}
                style={{ padding: "11px 18px", background: T.surface2, color: T.textSec,
                  border: `1.5px solid ${border}`, borderRadius: 10, fontSize: 13,
                  fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
