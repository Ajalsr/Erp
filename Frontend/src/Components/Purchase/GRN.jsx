import { useState } from "react";
import {
  FaTimes, FaSearch, FaCheck, FaBan, FaBoxOpen,
  FaChevronLeft, FaChevronRight, FaPlus, FaExclamationTriangle,
  FaFileAlt, FaWarehouse, FaClipboardCheck, FaTruck,
} from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";

// ── Helpers ───────────────────────────────────────────────────────
const fmtAED = (n) =>
  `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayStr = () => new Date().toISOString().split("T")[0];

const STATUS_CFG = {
  draft:    { color: "#64748b", dim: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.25)", label: "Draft"    },
  pending:  { color: "#f59e0b", dim: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)",  label: "Pending"  },
  approved: { color: "#10b981", dim: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)",  label: "Approved" },
  rejected: { color: "#ef4444", dim: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",   label: "Rejected" },
};
const getStatusCfg = (s) => STATUS_CFG[s] || STATUS_CFG.draft;

const COND_CFG = {
  good:    { color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)",  label: "Good"    },
  partial: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)",  label: "Partial" },
  damaged: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",   label: "Damaged" },
};

// ── Mock PO catalog ───────────────────────────────────────────────
const MOCK_POS = {
  "PO-2024-001": {
    vendor: "Al Futtaim Trading", contact: "+971 4 234 5678",
    items: [
      { id: "a1", code: "SP-200", name: 'Steel Pipe 2"',       unit: "Pcs", ordered: 100, cost: 45.00 },
      { id: "a2", code: "IB-M12", name: "Industrial Bolt M12", unit: "Box", ordered: 20,  cost: 22.00 },
    ],
  },
  "PO-2024-002": {
    vendor: "Gulf Supplies LLC", contact: "+971 2 456 7890",
    items: [
      { id: "b1", code: "PE-100", name: 'PVC Elbow 90° 1"', unit: "Pcs", ordered: 200, cost: 3.50  },
      { id: "b2", code: "AF-012", name: 'Air Filter 12"',   unit: "Pcs", ordered: 10,  cost: 65.00 },
    ],
  },
  "PO-2024-003": {
    vendor: "Emirates Wholesale", contact: "+971 6 789 0123",
    items: [
      { id: "c1", code: "CW-006", name: "Copper Wire 6mm", unit: "Mtr", ordered: 500, cost: 12.00 },
      { id: "c2", code: "VB-050", name: 'Valve Ball 1/2"', unit: "Pcs", ordered: 30,  cost: 18.00 },
    ],
  },
};

const WAREHOUSES = ["Main Warehouse", "Secondary Warehouse", "Cold Storage"];

// ── Initial data ──────────────────────────────────────────────────
const INITIAL_GRNS = [
  {
    id: "GRN-2024-001", poNumber: "PO-2024-001", vendor: "Al Futtaim Trading", contact: "+971 4 234 5678",
    receivedDate: "2024-03-10", receivedBy: "Ahmed Hassan", warehouse: "Main Warehouse",
    status: "approved", qualityNotes: "All items in good condition. Minor dents on 2 pipes.",
    items: [
      { id: "a1", code: "SP-200", name: 'Steel Pipe 2"',       unit: "Pcs", ordered: 100, received: 100, accepted: 98, rejected: 2,  condition: "partial", remarks: "2 units have minor dents", cost: 45.00 },
      { id: "a2", code: "IB-M12", name: "Industrial Bolt M12", unit: "Box", ordered: 20,  received: 20,  accepted: 20, rejected: 0,  condition: "good",    remarks: "",                         cost: 22.00 },
    ],
  },
  {
    id: "GRN-2024-002", poNumber: "PO-2024-002", vendor: "Gulf Supplies LLC", contact: "+971 2 456 7890",
    receivedDate: "2024-03-14", receivedBy: "Sara Al Mansoori", warehouse: "Secondary Warehouse",
    status: "pending", qualityNotes: "Some fittings show packaging damage.",
    items: [
      { id: "b1", code: "PE-100", name: 'PVC Elbow 90° 1"', unit: "Pcs", ordered: 200, received: 195, accepted: 190, rejected: 5,  condition: "partial", remarks: "5 elbows cracked in transit", cost: 3.50  },
      { id: "b2", code: "AF-012", name: 'Air Filter 12"',   unit: "Pcs", ordered: 10,  received: 10,  accepted: 10,  rejected: 0,  condition: "good",    remarks: "",                              cost: 65.00 },
    ],
  },
  {
    id: "GRN-2024-003", poNumber: "PO-2024-003", vendor: "Emirates Wholesale", contact: "+971 6 789 0123",
    receivedDate: "2024-03-18", receivedBy: "Khalid Ibrahim", warehouse: "Main Warehouse",
    status: "approved", qualityNotes: "Wire coils well packed. All valves tested on arrival.",
    items: [
      { id: "c1", code: "CW-006", name: "Copper Wire 6mm", unit: "Mtr", ordered: 500, received: 500, accepted: 500, rejected: 0,  condition: "good", remarks: "",                        cost: 12.00 },
      { id: "c2", code: "VB-050", name: 'Valve Ball 1/2"', unit: "Pcs", ordered: 30,  received: 28,  accepted: 28,  rejected: 0,  condition: "good", remarks: "2 units back-ordered",    cost: 18.00 },
    ],
  },
  {
    id: "GRN-2024-004", poNumber: "PO-2024-001", vendor: "Al Futtaim Trading", contact: "+971 4 234 5678",
    receivedDate: "2024-03-22", receivedBy: "Ahmed Hassan", warehouse: "Main Warehouse",
    status: "draft", qualityNotes: "",
    items: [
      { id: "a1b", code: "SP-200", name: 'Steel Pipe 2"', unit: "Pcs", ordered: 50, received: 50, accepted: 50, rejected: 0, condition: "good", remarks: "", cost: 45.00 },
    ],
  },
  {
    id: "GRN-2024-005", poNumber: "PO-2024-002", vendor: "Gulf Supplies LLC", contact: "+971 2 456 7890",
    receivedDate: "2024-03-25", receivedBy: "Sara Al Mansoori", warehouse: "Cold Storage",
    status: "rejected", qualityNotes: "Items do not match PO specifications. Returned to vendor.",
    items: [
      { id: "b1b", code: "PE-100", name: 'PVC Elbow 90° 1"', unit: "Pcs", ordered: 100, received: 100, accepted: 0, rejected: 100, condition: "damaged", remarks: "Wrong size delivered — expected 1\", got 3/4\"", cost: 3.50 },
    ],
  },
];

const blankForm = () => ({
  poNumber: "", vendor: "", contact: "",
  receivedDate: todayStr(), receivedBy: "", warehouse: WAREHOUSES[0],
  qualityNotes: "", items: [],
});

const nextId = (list) => {
  const nums = list.map(g => parseInt(g.id.split("-").pop())).filter(n => !isNaN(n));
  const max  = nums.length ? Math.max(...nums) : 0;
  return `GRN-2024-${String(max + 1).padStart(3, "0")}`;
};

// ─────────────────────────────────────────────────────────────────
export default function GRN() {
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);

  const [grns,         setGrns]         = useState(INITIAL_GRNS);
  const [selectedGrn,  setSelectedGrn]  = useState(null);
  const [showView,     setShowView]     = useState(false);
  const [showCreate,   setShowCreate]   = useState(false);
  const [form,         setForm]         = useState(blankForm());
  const [poInput,      setPoInput]      = useState("");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page,         setPage]         = useState(1);
  const perPage = 6;

  // ── PO Loader ────────────────────────────────────────────────
  const loadPO = () => {
    const key = poInput.trim().toUpperCase();
    const po  = MOCK_POS[key];
    if (!po) { alert("PO not found. Try: PO-2024-001, PO-2024-002 or PO-2024-003"); return; }
    setForm(prev => ({
      ...prev, poNumber: key, vendor: po.vendor, contact: po.contact,
      items: po.items.map(i => ({ ...i, received: i.ordered, accepted: i.ordered, rejected: 0, condition: "good", remarks: "" })),
    }));
  };

  const updateItem = (idx, field, rawVal) => {
    setForm(prev => {
      const items = prev.items.map((item, i) => {
        if (i !== idx) return item;
        const val = parseInt(rawVal) || 0;
        if (field === "received")  return { ...item, received: val, accepted: val, rejected: 0 };
        if (field === "accepted")  return { ...item, accepted: Math.min(val, item.received), rejected: Math.max(0, item.received - Math.min(val, item.received)) };
        return { ...item, [field]: rawVal };
      });
      return { ...prev, items };
    });
  };

  // ── CRUD ─────────────────────────────────────────────────────
  const handleSave = (status) => {
    if (!form.poNumber || !form.vendor || form.items.length === 0) {
      alert("Please load a PO first"); return;
    }
    const newGrn = { id: nextId(grns), ...form, status };
    setGrns(prev => [newGrn, ...prev]);
    setShowCreate(false); setForm(blankForm()); setPoInput("");
  };

  const handleApprove = (id) => {
    setGrns(prev => prev.map(g => g.id === id ? { ...g, status: "approved" } : g));
    setSelectedGrn(prev => prev?.id === id ? { ...prev, status: "approved" } : prev);
  };
  const handleReject = (id) => {
    setGrns(prev => prev.map(g => g.id === id ? { ...g, status: "rejected" } : g));
    setSelectedGrn(prev => prev?.id === id ? { ...prev, status: "rejected" } : prev);
  };
  const handleSubmit = (id) => {
    setGrns(prev => prev.map(g => g.id === id ? { ...g, status: "pending" } : g));
    setSelectedGrn(prev => prev?.id === id ? { ...prev, status: "pending" } : prev);
  };

  // ── Derived ───────────────────────────────────────────────────
  const filtered   = grns.filter(g => {
    const q = search.toLowerCase();
    const matchSearch = !q || g.id.toLowerCase().includes(q) || g.vendor.toLowerCase().includes(q) || g.poNumber.toLowerCase().includes(q);
    return matchSearch && (statusFilter === "all" || g.status === statusFilter);
  });
  const totalPages  = Math.max(1, Math.ceil(filtered.length / perPage));
  const current     = filtered.slice((page - 1) * perPage, page * perPage);

  const totalAccepted = grns.reduce((s, g) => s + g.items.reduce((si, i) => si + (i.accepted || 0), 0), 0);
  const totalRejected = grns.reduce((s, g) => s + g.items.reduce((si, i) => si + (i.rejected || 0), 0), 0);

  // ── Dynamic CSS ──────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
    .ob-root * { box-sizing: border-box; }
    .ob-root  { font-family: 'DM Sans', sans-serif; }
    .ob-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }

    .ob-row { transition: background 0.1s; }
    .ob-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .ob-row:hover .ob-link { color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .ob-stat { transition: transform 0.18s ease, box-shadow 0.18s ease; cursor: default; }
    .ob-stat:hover { transform: translateY(-2px); box-shadow: ${isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.1)"} !important; }

    .ob-btn { transition: all 0.15s ease; }
    .ob-btn:hover { opacity: 0.85; transform: translateY(-1px); }

    .ob-icon-btn { transition: all 0.12s; }
    .ob-icon-btn:hover { background: ${isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9"} !important; }

    .grn-input { outline: none; }
    .grn-input:focus { border-color: ${isDark ? "rgba(59,130,246,0.55)" : "#93c5fd"} !important; box-shadow: 0 0 0 3px ${isDark ? "rgba(59,130,246,0.1)" : "rgba(147,197,253,0.2)"} !important; }

    .grn-select { outline: none; }
    .grn-select:focus { border-color: ${isDark ? "rgba(59,130,246,0.55)" : "#93c5fd"} !important; }

    .grn-pill { transition: all 0.13s; }
    .grn-pill:hover { opacity: 0.85; }

    html, body, * { scrollbar-width: thin; scrollbar-color: ${isDark ? "rgba(255,255,255,0.12) transparent" : "rgba(0,0,0,0.14) transparent"}; }
    html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { width: 5px; height: 5px; }
    html::-webkit-scrollbar-track, body::-webkit-scrollbar-track, *::-webkit-scrollbar-track { background: transparent; }
    html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb, *::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.13)"}; border-radius: 999px; }
    html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover, *::-webkit-scrollbar-thumb:hover { background: ${isDark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.24)"}; }
    html::-webkit-scrollbar-corner, body::-webkit-scrollbar-corner, *::-webkit-scrollbar-corner { background: transparent; }

    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeUp  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .ob-slide { animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
    .ob-fade  { animation: fadeIn 0.2s ease forwards; }
    .ob-up    { animation: fadeUp 0.3s ease both; }
    .ob-up-1  { animation: fadeUp 0.3s 0.05s ease both; }
    .ob-up-2  { animation: fadeUp 0.3s 0.10s ease both; }

    .pg-btn { transition: all 0.12s; }
    .pg-btn:hover:not(:disabled) { border-color: ${isDark ? "rgba(59,130,246,0.4)" : "#93c5fd"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
  `;

  const card   = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px" };
  const input  = { border: `1px solid ${T.border}`, borderRadius: "8px", background: T.surface2, color: T.textPri, fontSize: "12px", fontFamily: "inherit", padding: "8px 10px" };
  const label  = { fontSize: "10px", fontWeight: "600", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "5px" };

  return (
    <>
      <style>{css}</style>
      <div className="ob-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="ob-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: T.blueDim, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                <FaClipboardCheck />
              </div>
              <h1 className="ob-jakarta" style={{ fontSize: "19px", fontWeight: "800", color: T.textPri, margin: 0 }}>Goods Received Notes</h1>
            </div>
            <p style={{ color: T.textSec, fontSize: "12px", margin: 0, paddingLeft: "42px" }}>
              Internal documents confirming receipt and inspection of goods against purchase orders
            </p>
          </div>
          <button className="ob-btn" onClick={() => { setShowCreate(true); setForm(blankForm()); setPoInput(""); }}
            style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 18px", background: T.blue, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11} /> New GRN
          </button>
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────── */}
        <div className="ob-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "18px" }}>
          {[
            { label: "Total GRNs",     value: grns.length,                                           icon: <FaFileAlt />,          color: T.blue,   dim: T.blueDim,   sub: "All time"             },
            { label: "Pending Review", value: grns.filter(g => g.status === "pending").length,        icon: <FaClipboardCheck />,   color: T.amber,  dim: T.amberDim,  sub: "Awaiting approval"    },
            { label: "Total Accepted", value: totalAccepted,                                          icon: <FaCheck />,            color: T.green,  dim: T.greenDim,  sub: "Units across all GRNs" },
            { label: "Total Rejected", value: totalRejected,                                          icon: <FaExclamationTriangle />, color: totalRejected > 0 ? T.red : T.green, dim: totalRejected > 0 ? T.redDim : T.greenDim, sub: "Units returned/pending" },
          ].map((c, i) => (
            <div key={i} className="ob-stat" style={{ ...card, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, transparent 10%, ${c.color}55, transparent 90%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>{c.label}</p>
                <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: c.dim, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>{c.icon}</div>
              </div>
              <p className="ob-jakarta" style={{ fontSize: "22px", fontWeight: "800", color: T.textPri, margin: "0 0 6px", lineHeight: 1 }}>{c.value}</p>
              <p style={{ fontSize: "11px", color: T.textSec, margin: 0 }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── CONTROLS ────────────────────────────────────────── */}
        <div className="ob-up-2" style={{ ...card, padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, maxWidth: "300px" }}>
            <FaSearch style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: "11px", pointerEvents: "none" }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search GRN, vendor, PO…"
              className="grn-input"
              style={{ ...input, paddingLeft: "32px", width: "100%", boxSizing: "border-box" }} />
          </div>
          <div style={{ width: "1px", height: "20px", background: T.border }} />
          {/* Status filters */}
          <div style={{ display: "flex", gap: "6px" }}>
            {[{ k: "all", l: "All" }, { k: "draft", l: "Draft" }, { k: "pending", l: "Pending" }, { k: "approved", l: "Approved" }, { k: "rejected", l: "Rejected" }].map(f => {
              const sc = f.k === "all" ? null : STATUS_CFG[f.k];
              const active = statusFilter === f.k;
              return (
                <button key={f.k} className="grn-pill" onClick={() => { setStatusFilter(f.k); setPage(1); }}
                  style={{ padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s",
                    background: active ? (sc ? sc.dim : T.blueDim) : "transparent",
                    color:      active ? (sc ? sc.color : T.blueLight) : T.textSec,
                    border:     active ? `1px solid ${sc ? sc.border : "rgba(59,130,246,0.3)"}` : `1px solid ${T.border}`,
                  }}>
                  {f.l}
                </button>
              );
            })}
          </div>
          <div style={{ marginLeft: "auto", fontSize: "12px", color: T.textSec }}>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</div>
        </div>

        {/* ── TABLE ───────────────────────────────────────────── */}
        <div style={{ ...card, overflow: "hidden", marginBottom: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {["GRN #", "PO Reference", "Vendor", "Received Date", "Items", "Accepted", "Rejected", "Status", "Actions"].map((h, i) => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: i >= 7 ? "right" : "left", fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.length > 0 ? current.map((grn) => {
                const sc           = getStatusCfg(grn.status);
                const totalOrdered = grn.items.reduce((s, i) => s + i.ordered, 0);
                const accepted     = grn.items.reduce((s, i) => s + i.accepted, 0);
                const rejected     = grn.items.reduce((s, i) => s + i.rejected, 0);
                return (
                  <tr key={grn.id} className="ob-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    {/* GRN # */}
                    <td style={{ padding: "12px 14px" }}>
                      <button className="ob-link" onClick={() => { setSelectedGrn(grn); setShowView(true); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: "700", fontSize: "13px", color: T.blue, padding: 0, transition: "color 0.15s" }}>
                        {grn.id}
                      </button>
                    </td>
                    {/* PO # */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px", background: T.blueDim, color: T.blueLight, border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, fontFamily: "monospace" }}>
                        {grn.poNumber}
                      </span>
                    </td>
                    {/* Vendor */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.textSec, fontSize: "11px", flexShrink: 0 }}>
                          <FaTruck />
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: "500", color: T.textPri }}>{grn.vendor}</span>
                      </div>
                    </td>
                    {/* Date */}
                    <td style={{ padding: "12px 14px", color: T.textSec, fontSize: "12px" }}>{grn.receivedDate}</td>
                    {/* Items */}
                    <td style={{ padding: "12px 14px" }}>
                      <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri }}>{grn.items.length}</span>
                      <span style={{ fontSize: "11px", color: T.textSec, marginLeft: "4px" }}>({totalOrdered} units)</span>
                    </td>
                    {/* Accepted */}
                    <td style={{ padding: "12px 14px" }}>
                      <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: T.green }}>{accepted}</span>
                    </td>
                    {/* Rejected */}
                    <td style={{ padding: "12px 14px" }}>
                      <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: rejected > 0 ? T.red : T.textMuted }}>
                        {rejected}
                      </span>
                    </td>
                    {/* Status */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: sc.dim, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: "nowrap" }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.color }} />
                        {sc.label}
                      </span>
                    </td>
                    {/* Actions */}
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                        <button className="ob-icon-btn" onClick={() => { setSelectedGrn(grn); setShowView(true); }}
                          style={{ padding: "5px 9px", borderRadius: "7px", border: `1px solid ${T.border}`, background: "transparent", color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}
                          title="View GRN">
                          <FaFileAlt size={10} />
                        </button>
                        {grn.status === "pending" && (
                          <>
                            <button className="ob-icon-btn" onClick={() => handleApprove(grn.id)}
                              style={{ padding: "5px 9px", borderRadius: "7px", border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.1)", color: "#10b981", cursor: "pointer", fontFamily: "inherit" }}
                              title="Approve">
                              <FaCheck size={9} />
                            </button>
                            <button className="ob-icon-btn" onClick={() => handleReject(grn.id)}
                              style={{ padding: "5px 9px", borderRadius: "7px", border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}
                              title="Reject">
                              <FaTimes size={9} />
                            </button>
                          </>
                        )}
                        {grn.status === "draft" && (
                          <button className="ob-icon-btn" onClick={() => handleSubmit(grn.id)}
                            style={{ padding: "5px 9px", borderRadius: "7px", border: `1px solid rgba(245,158,11,0.3)`, background: "rgba(245,158,11,0.1)", color: "#f59e0b", cursor: "pointer", fontSize: "11px", fontWeight: "600", fontFamily: "inherit" }}
                            title="Submit for review">
                            Submit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="9" style={{ padding: "64px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", color: T.textSec }}>
                        <FaClipboardCheck />
                      </div>
                      <p className="ob-jakarta" style={{ fontWeight: "700", color: T.textPri, fontSize: "15px", margin: 0 }}>No GRNs found</p>
                      <p style={{ color: T.textSec, fontSize: "13px", margin: 0 }}>
                        {search || statusFilter !== "all" ? "Try adjusting your search or filter" : "Create your first GRN to get started"}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ──────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div style={{ ...card, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: T.textSec }}>
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "5px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", color: page === 1 ? T.textMuted : T.textSec, cursor: page === 1 ? "not-allowed" : "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                <FaChevronLeft size={9} /> Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className="pg-btn" onClick={() => setPage(p)}
                  style={{ padding: "5px 10px", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1px solid ${page === p ? "rgba(59,130,246,0.35)" : T.border}`, background: page === p ? T.blueDim : "transparent", color: page === p ? T.blueLight : T.textSec }}>
                  {p}
                </button>
              ))}
              <button className="pg-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "5px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", color: page === totalPages ? T.textMuted : T.textSec, cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                Next <FaChevronRight size={9} />
              </button>
            </div>
            <span style={{ fontSize: "12px", color: T.textSec }}>{totalPages} page{totalPages !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          CREATE GRN DRAWER
      ═══════════════════════════════════════════════════════════ */}
      {showCreate && (
        <>
          <div className="ob-fade" onClick={() => setShowCreate(false)}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.75)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", zIndex: 100 }} />
          <div className="ob-slide"
            style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "560px", maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 101, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

            {/* Drawer header */}
            <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: T.blueDim, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                  <FaClipboardCheck />
                </div>
                <div>
                  <h3 className="ob-jakarta" style={{ fontSize: "15px", fontWeight: "800", color: T.textPri, margin: 0 }}>New Goods Received Note</h3>
                  <p style={{ fontSize: "11px", color: T.textSec, margin: "2px 0 0" }}>Fill in receipt & inspection details</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(false)}
                style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "6px", cursor: "pointer", color: T.textSec, display: "flex" }}>
                <FaTimes size={11} />
              </button>
            </div>

            {/* Scrollable form body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

              {/* ── Section 1: PO Lookup ── */}
              <div style={{ background: isDark ? "rgba(59,130,246,0.05)" : "#f8faff", border: `1px solid ${isDark ? "rgba(59,130,246,0.15)" : "#dbeafe"}`, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
                <p className="ob-jakarta" style={{ fontSize: "12px", fontWeight: "700", color: T.blue, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Step 1 — Load Purchase Order
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input value={poInput} onChange={e => setPoInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && loadPO()}
                    placeholder="Enter PO number (e.g. PO-2024-001)…"
                    className="grn-input"
                    style={{ ...input, flex: 1 }} />
                  <button className="ob-btn" onClick={loadPO}
                    style={{ padding: "8px 16px", background: T.blue, color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    Load PO
                  </button>
                </div>
                {form.vendor && (
                  <div style={{ marginTop: "10px", padding: "10px 12px", background: T.surface2, borderRadius: "8px", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
                    <FaCheck size={10} color={T.green} />
                    <span style={{ fontSize: "12px", color: T.textPri }}><strong>{form.poNumber}</strong> — {form.vendor}</span>
                    <span style={{ fontSize: "11px", color: T.textSec, marginLeft: "auto" }}>{form.items.length} line item{form.items.length !== 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>

              {/* ── Section 2: Receipt Details ── */}
              <div style={{ marginBottom: "16px" }}>
                <p className="ob-jakarta" style={{ fontSize: "12px", fontWeight: "700", color: T.textSec, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Step 2 — Receipt Details
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <span style={label}>Vendor</span>
                    <input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))}
                      placeholder="Vendor name" className="grn-input" style={{ ...input, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <span style={label}>Vendor Contact</span>
                    <input value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
                      placeholder="+971 …" className="grn-input" style={{ ...input, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <span style={label}>Received Date</span>
                    <input type="date" value={form.receivedDate} onChange={e => setForm(p => ({ ...p, receivedDate: e.target.value }))}
                      className="grn-input" style={{ ...input, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <span style={label}>Received By</span>
                    <input value={form.receivedBy} onChange={e => setForm(p => ({ ...p, receivedBy: e.target.value }))}
                      placeholder="Inspector / receiver name" className="grn-input" style={{ ...input, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <span style={label}>Warehouse</span>
                    <select value={form.warehouse} onChange={e => setForm(p => ({ ...p, warehouse: e.target.value }))}
                      className="grn-select" style={{ ...input, width: "100%", boxSizing: "border-box" }}>
                      {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Section 3: Item Inspection ── */}
              {form.items.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <p className="ob-jakarta" style={{ fontSize: "12px", fontWeight: "700", color: T.textSec, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Step 3 — Inspect Items
                  </p>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: T.surface2 }}>
                          {["Item", "Ordered", "Received", "Accepted", "Rejected", "Condition"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: "9px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((item, idx) => (
                          <tr key={item.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ padding: "8px 10px" }}>
                              <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>{item.name}</p>
                              <p style={{ fontSize: "10px", color: T.textSec, margin: "1px 0 0", fontFamily: "monospace" }}>{item.code} · {item.unit}</p>
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: T.textSec }}>{item.ordered}</span>
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <input type="number" min="0" max={item.ordered} value={item.received}
                                onChange={e => updateItem(idx, "received", e.target.value)}
                                className="grn-input ob-qty-input"
                                style={{ ...input, width: "56px", padding: "4px 6px", textAlign: "center", fontWeight: "600" }} />
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <input type="number" min="0" max={item.received} value={item.accepted}
                                onChange={e => updateItem(idx, "accepted", e.target.value)}
                                className="grn-input ob-qty-input"
                                style={{ ...input, width: "56px", padding: "4px 6px", textAlign: "center", fontWeight: "600", borderColor: item.accepted < item.received ? "rgba(245,158,11,0.5)" : T.border }} />
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: item.rejected > 0 ? T.red : T.textMuted }}>
                                {item.rejected}
                              </span>
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <select value={item.condition} onChange={e => updateItem(idx, "condition", e.target.value)}
                                className="grn-select"
                                style={{ ...input, padding: "4px 6px", fontSize: "11px" }}>
                                <option value="good">Good</option>
                                <option value="partial">Partial</option>
                                <option value="damaged">Damaged</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Remarks per item */}
                    <div style={{ padding: "10px", background: T.surface2, borderTop: `1px solid ${T.border}` }}>
                      <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Item Remarks</p>
                      {form.items.map((item, idx) => (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span style={{ fontSize: "11px", color: T.textSec, width: "70px", flexShrink: 0, fontFamily: "monospace" }}>{item.code}</span>
                          <input value={item.remarks} onChange={e => updateItem(idx, "remarks", e.target.value)}
                            placeholder="Optional remarks…"
                            className="grn-input"
                            style={{ ...input, flex: 1, padding: "5px 8px" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Section 4: Quality Notes ── */}
              <div>
                <span style={label}>Quality / Inspection Notes</span>
                <textarea value={form.qualityNotes} onChange={e => setForm(p => ({ ...p, qualityNotes: e.target.value }))}
                  placeholder="Overall quality remarks, conditions, discrepancies…"
                  rows={3}
                  className="grn-input"
                  style={{ ...input, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
              </div>
            </div>

            {/* Drawer footer */}
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "8px", flexShrink: 0 }}>
              <button className="ob-btn" onClick={() => setShowCreate(false)}
                style={{ padding: "9px 16px", border: `1px solid ${T.border}`, borderRadius: "9px", background: "transparent", color: T.textSec, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button className="ob-btn" onClick={() => handleSave("draft")}
                style={{ flex: 1, padding: "9px", border: `1px solid ${T.border}`, borderRadius: "9px", background: T.surface2, color: T.textSec, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                Save as Draft
              </button>
              <button className="ob-btn" onClick={() => handleSave("pending")}
                style={{ flex: 1, padding: "9px", background: T.blue, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <FaClipboardCheck size={11} /> Submit GRN
              </button>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          VIEW GRN DRAWER (Document View)
      ═══════════════════════════════════════════════════════════ */}
      {showView && selectedGrn && (() => {
        const grn    = selectedGrn;
        const sc     = getStatusCfg(grn.status);
        const totalAcceptedGrn = grn.items.reduce((s, i) => s + i.accepted, 0);
        const totalRejectedGrn = grn.items.reduce((s, i) => s + i.rejected, 0);
        const totalValue       = grn.items.reduce((s, i) => s + i.accepted * (i.cost || 0), 0);
        return (
          <>
            <div className="ob-fade" onClick={() => { setShowView(false); setSelectedGrn(null); }}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.75)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", zIndex: 100 }} />
            <div className="ob-slide"
              style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "600px", maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 101, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

              {/* Doc header */}
              <div style={{ padding: "20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <h2 className="ob-jakarta" style={{ fontSize: "17px", fontWeight: "800", color: T.textPri, margin: 0 }}>{grn.id}</h2>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: sc.dim, color: sc.color, border: `1px solid ${sc.border}` }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.color }} />{sc.label}
                      </span>
                    </div>
                    <p style={{ color: T.textSec, fontSize: "12px", margin: 0 }}>
                      Received on {grn.receivedDate} · {grn.warehouse}
                    </p>
                  </div>
                  <button onClick={() => { setShowView(false); setSelectedGrn(null); }}
                    style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "6px", cursor: "pointer", color: T.textSec, display: "flex", marginLeft: "12px", flexShrink: 0 }}>
                    <FaTimes size={11} />
                  </button>
                </div>
              </div>

              {/* Doc body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Info grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    { label: "Purchase Order", value: grn.poNumber, mono: true, badge: true },
                    { label: "Vendor",         value: grn.vendor },
                    { label: "Vendor Contact", value: grn.contact || "—" },
                    { label: "Received By",    value: grn.receivedBy || "—" },
                    { label: "Warehouse",      value: grn.warehouse, icon: <FaWarehouse size={10} /> },
                    { label: "Received Date",  value: grn.receivedDate },
                  ].map(({ label: l, value, mono, badge, icon }) => (
                    <div key={l} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 14px" }}>
                      <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 5px", display: "flex", alignItems: "center", gap: "5px" }}>
                        {icon}{l}
                      </p>
                      {badge ? (
                        <span style={{ fontSize: "12px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", background: T.blueDim, color: T.blueLight, border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, fontFamily: "monospace" }}>
                          {value}
                        </span>
                      ) : (
                        <p className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "600", color: T.textPri, margin: 0, fontFamily: mono ? "monospace" : undefined }}>{value}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quality summary bar */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px 16px" }}>
                  <p className="ob-jakarta" style={{ fontSize: "11px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Inspection Summary</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                    {[
                      { label: "Total Accepted", value: totalAcceptedGrn, color: T.green },
                      { label: "Total Rejected", value: totalRejectedGrn, color: totalRejectedGrn > 0 ? T.red : T.textMuted },
                      { label: "Accepted Value", value: fmtAED(totalValue), color: T.blue, small: true },
                    ].map(({ label: l, value, color, small }) => (
                      <div key={l} style={{ textAlign: "center" }}>
                        <p style={{ fontSize: "10px", color: T.textSec, margin: "0 0 4px" }}>{l}</p>
                        <p className="ob-jakarta" style={{ fontSize: small ? "13px" : "20px", fontWeight: "800", color, margin: 0, lineHeight: 1 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Acceptance bar */}
                  {totalAcceptedGrn + totalRejectedGrn > 0 && (
                    <div style={{ marginTop: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "10px", color: T.green, fontWeight: "600" }}>Accepted {Math.round(totalAcceptedGrn / (totalAcceptedGrn + totalRejectedGrn) * 100)}%</span>
                        <span style={{ fontSize: "10px", color: totalRejectedGrn > 0 ? T.red : T.textMuted, fontWeight: "600" }}>Rejected {Math.round(totalRejectedGrn / (totalAcceptedGrn + totalRejectedGrn) * 100)}%</span>
                      </div>
                      <div style={{ height: "6px", borderRadius: "999px", background: T.surface, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round(totalAcceptedGrn / (totalAcceptedGrn + totalRejectedGrn) * 100)}%`, background: `linear-gradient(90deg, ${T.green}, #34d399)`, borderRadius: "999px", transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Items inspection table */}
                <div style={{ border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{ padding: "11px 14px", background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                    <p className="ob-jakarta" style={{ fontSize: "11px", fontWeight: "700", color: T.textPri, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Line Items — {grn.items.length} item{grn.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                        {["Item", "Ordered", "Received", "Accepted", "Rejected", "Condition"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "9px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grn.items.map((item, i) => {
                        const cc = COND_CFG[item.condition] || COND_CFG.good;
                        return (
                          <tr key={item.id} style={{ borderBottom: i < grn.items.length - 1 ? `1px solid ${T.border}` : "none" }}>
                            <td style={{ padding: "10px 12px" }}>
                              <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>{item.name}</p>
                              <p style={{ fontSize: "10px", color: T.textSec, margin: "2px 0 0", fontFamily: "monospace" }}>{item.code} · {item.unit}</p>
                              {item.remarks && <p style={{ fontSize: "10px", color: T.amber, margin: "2px 0 0", fontStyle: "italic" }}>{item.remarks}</p>}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "600", color: T.textSec }}>{item.ordered}</span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "600", color: T.textPri }}>{item.received}</span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: T.green }}>{item.accepted}</span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: item.rejected > 0 ? T.red : T.textMuted }}>{item.rejected}</span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px", background: cc.bg, color: cc.color, border: `1px solid ${cc.border}` }}>
                                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: cc.color }} />
                                {cc.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Quality notes */}
                {grn.qualityNotes && (
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px" }}>
                    <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Quality / Inspection Notes</p>
                    <p style={{ fontSize: "13px", color: T.textPri, margin: 0, lineHeight: 1.6 }}>{grn.qualityNotes}</p>
                  </div>
                )}
              </div>

              {/* Doc footer */}
              <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "8px", flexShrink: 0 }}>
                {grn.status === "pending" && (
                  <>
                    <button className="ob-btn" onClick={() => handleApprove(grn.id)}
                      style={{ flex: 1, padding: "9px", background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <FaCheck size={11} /> Approve GRN
                    </button>
                    <button className="ob-btn" onClick={() => handleReject(grn.id)}
                      style={{ flex: 1, padding: "9px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <FaBan size={11} /> Reject GRN
                    </button>
                  </>
                )}
                {grn.status === "draft" && (
                  <button className="ob-btn" onClick={() => handleSubmit(grn.id)}
                    style={{ flex: 1, padding: "9px", background: T.blue, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <FaClipboardCheck size={11} /> Submit for Review
                  </button>
                )}
                {(grn.status === "approved" || grn.status === "rejected") && (
                  <div style={{ flex: 1, padding: "9px", borderRadius: "9px", background: sc.dim, border: `1px solid ${sc.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: sc.color }}>
                      {grn.status === "approved" ? "✓ GRN Approved" : "✗ GRN Rejected"}
                    </span>
                  </div>
                )}
                <button onClick={() => { setShowView(false); setSelectedGrn(null); }}
                  style={{ padding: "9px 16px", border: `1px solid ${T.border}`, borderRadius: "9px", background: "transparent", color: T.textSec, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                  Close
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </>
  );
}
