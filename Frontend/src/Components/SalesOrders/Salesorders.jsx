import { useEffect, useState, useRef, useCallback } from "react";
import {
  FaPlus, FaTimes, FaSearch, FaShoppingCart,
  FaChevronLeft, FaChevronRight, FaBoxOpen,
  FaFileInvoiceDollar, FaEdit, FaBan,
  FaSortAmountDown, FaSortAmountUp, FaDownload,
  FaCheckCircle, FaClock, FaTimesCircle, FaSpinner,
  FaHourglassHalf, FaThumbsUp, FaThumbsDown, FaFilter,
  FaEllipsisV, FaAngleDown, FaChevronDown, FaBolt,
  FaRegCopy, FaRegBell, FaArrowUp, FaArrowDown
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import useGetAllSalesOrder from "../../helper/useGetAllSalesOrder";
import useWebSocket from "../../helper/useWebSocket";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import useAuthStore from "../../store/useAuthStore";
import { usePermissions } from "../../helper/permissions";
import axiosInstance from "../../helper/axiosInstance";

// ── CustomSelect (portal dropdown, unchanged logic) ──────────────
const CustomSelect = ({ value, onChange, options, placeholder = "Select", minWidth = 120 }) => {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef = useRef(null);
  const rafRef = useRef(null);

  const opts = options.map(o => typeof o === "string" ? { label: o, value: o } : o);
  const selected = opts.find(o => o.value === value);

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(opts.length * 38 + 12, 220);
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: Math.max(r.width, minWidth) });
    setReady(true);
  }, [opts.length, minWidth]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() =>
      rafRef.current = requestAnimationFrame(() => measurePos())
    );
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  useEffect(() => {
    if (!open) return;
    const upd = () => measurePos();
    window.addEventListener("scroll", upd, true);
    window.addEventListener("resize", upd);
    return () => { window.removeEventListener("scroll", upd, true); window.removeEventListener("resize", upd); };
  }, [open, measurePos]);
  useEffect(() => {
    const h = e => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target))
      { setOpen(false); setReady(false); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isDarkNow = (() => { try { return JSON.parse(localStorage.getItem("nexus-theme") || "{}").state?.isDark ?? true; } catch { return true; } })();
  const bg = isDarkNow ? "#0f1825" : "#ffffff";
  const border = isDarkNow ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const textPri = isDarkNow ? "#e2e8f0" : "#1e293b";
  const textSec = isDarkNow ? "#64748b" : "#94a3b8";
  const hoverBg = isDarkNow ? "rgba(59,130,246,0.08)" : "#f0f7ff";
  const activeBg = isDarkNow ? "rgba(59,130,246,0.14)" : "#e8f2ff";
  const activeC = isDarkNow ? "#60a5fa" : "#1d4ed8";
  const focusBorder = isDarkNow ? "rgba(59,130,246,0.5)" : "#93c5fd";

  const dropdown = (
    <div ref={dropRef} style={{
      position: "absolute", top: dropPos.top, left: dropPos.left, width: dropPos.width,
      zIndex: 1000001, background: bg, border: `1px solid ${border}`, borderRadius: "10px",
      boxShadow: isDarkNow ? "0 20px 60px rgba(0,0,0,0.6)" : "0 8px 32px rgba(0,0,0,0.12)",
      overflow: "hidden", fontFamily: "'DM Sans', sans-serif",
      visibility: ready ? "visible" : "hidden", opacity: ready ? 1 : 0, transition: "opacity 0.1s",
    }}>
      <div style={{ padding: "4px" }}>
        {opts.map((opt, i) => {
          const isAct = opt.value === value;
          return (
            <div key={i} onClick={() => { onChange(opt.value); setOpen(false); setReady(false); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "12px",
                fontWeight: isAct ? "600" : "400", color: isAct ? activeC : textPri,
                background: isAct ? activeBg : "transparent",
              }}
              onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = "transparent"; }}>
              {opt.label}
              {isAct && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={activeC} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={triggerRef} onClick={handleOpen} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: "32px", padding: "0 10px", minWidth,
      border: `1px solid ${open ? focusBorder : border}`, borderRadius: "7px",
      background: bg, cursor: "pointer", userSelect: "none",
      boxShadow: open ? `0 0 0 3px ${isDarkNow ? "rgba(59,130,246,0.12)" : "rgba(147,197,253,0.2)"}` : "none",
      transition: "border-color 0.15s, box-shadow 0.15s", gap: "8px",
    }}>
      <span style={{ fontSize: "12px", fontWeight: "500", color: selected ? textPri : textSec, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
        {selected ? selected.label : placeholder}
      </span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={open ? activeC : textSec}
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: "transform 0.18s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 2 }).format(amount || 0);

const round2 = (n) => Math.round(((parseFloat(n) || 0) + Number.EPSILON) * 100) / 100;
const fmtAEDFull = (n) => "AED " + Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCurrencyShort = (amount) => {
  const n = amount || 0;
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(1)}K`;
  return `AED ${n.toFixed(0)}`;
};

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
};

const formatStatus = (s) => {
  if (!s) return "Unknown";
  const map = { pending_approval: "Pending Approval", cancel_requested: "Cancel Requested" };
  return map[s] || s.charAt(0).toUpperCase() + s.slice(1);
};

const transformOrders = (apiData) => {
  if (!apiData?.salesOrders) return [];
  return apiData.salesOrders.map(o => ({
    id: o.id,
    saleOrderNumber: o.orderNumber,
    status: formatStatus(o.status),
    rawStatus: (o.status || "").toLowerCase(),
    customer: o.customerName || "N/A",
    customerCode: o.customerCode,
    lpoNumber: o.lpoNumber || "—",
    lpoValue: o.lpoValue || 0,
    total: o.total || 0,
    orderDate: o.orderDate,
    lpoDate: o.lpoDate,
    expectedShipmentDate: o.expectedShipmentDate,
    paymentTerms: o.paymentTerms,
    salesperson: o.salesperson,
    items: o.items || [],
    subTotal: o.subTotal || 0,
    shippingCharges: o.shippingCharges || 0,
    adjustment: o.adjustment || 0,
    vat: o.vat || 0,
    createdAt: o.createdAt,
    rejectionReason: o.rejectionReason || "",
    createdBy: o.createdBy || "",
    approverNote: o.approverNote || "",
    approverNoteBy: o.approverNoteBy || "",
    approverNoteAt: o.approverNoteAt || null,
    fulfillmentStatus: o.fulfillmentStatus || "",
    linkedPoIds: o.linkedPoIds || [],
  }));
};

const STATUS_CFG = {
  draft:            { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.22)", dot: "#f59e0b",   label: "Draft"            },
  confirmed:        { color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.22)", dot: "#10b981",   label: "Confirmed"        },
  open:             { color: "#3b82f6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.22)", dot: "#3b82f6",   label: "Open"             },
  "in progress":    { color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.22)", dot: "#8b5cf6",   label: "In Progress"      },
  completed:        { color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.22)", dot: "#10b981",   label: "Completed"        },
  closed:           { color: "#64748b", bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.22)", dot: "#64748b", label: "Closed"           },
  cancelled:        { color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.22)",  dot: "#ef4444",   label: "Cancelled"        },
  pending_approval: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.28)", dot: "#f59e0b",   label: "Pending Approval" },
  approved:         { color: "#06b6d4", bg: "rgba(6,182,212,0.10)",  border: "rgba(6,182,212,0.22)",  dot: "#06b6d4",   label: "Approved"         },
  rejected:         { color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.22)",  dot: "#ef4444",   label: "Rejected"         },
};
const getStatus = (raw) => STATUS_CFG[raw?.toLowerCase()] || STATUS_CFG.closed;

// Customer initials avatar
const Avatar = ({ name, size = 28, isDark }) => {
  const initials = (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const colors = [
    ["#1d4ed8", "#dbeafe"], ["#7c3aed", "#ede9fe"], ["#0891b2", "#cffafe"],
    ["#059669", "#d1fae5"], ["#d97706", "#fef3c7"], ["#dc2626", "#fee2e2"],
  ];
  const idx = (name || "?").charCodeAt(0) % colors.length;
  const [fg, bgC] = isDark
    ? [colors[idx][1], colors[idx][0] + "33"]
    : [colors[idx][0], colors[idx][1]];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bgC, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: "700", flexShrink: 0,
      letterSpacing: "-0.02em", fontFamily: "'DM Sans', sans-serif",
    }}>{initials}</div>
  );
};

const Salesorders = () => {
  const { handleGetSalesorder, data, loading, error } = useGetAllSalesOrder();
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const myUserId = useAuthStore((s) => s.user?.userId || s.activeOrg?.userId || "");
  const isAdminOrOwner = ["owner", "admin"].includes((activeOrg?.role || "").toLowerCase());
  const { canEditRecord } = usePermissions();

  // An approver may sign off a pending order — but never their own (no self-approval).
  const canApproveOrder = (o) =>
    !!o && o.rawStatus === "pending_approval" && isAdminOrOwner && o.createdBy !== myUserId;

  // Who may edit a given order:
  //  • cancelled → no one (terminal).
  //  • pending_approval → approver only (admin/owner) — the requester waits for a decision.
  //  • every other status (draft, open, approved, confirmed, shipped, completed, invoiced,
  //    rejected) → the user's configured edit permission (Settings).
  const canEditOrder = (o) => {
    if (!o || o.rawStatus === "cancelled") return false;
    if (o.rawStatus === "pending_approval") return isAdminOrOwner;
    return canEditRecord("sales_orders", o.createdBy);
  };

  const [drawer, setDrawer] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [approvingId, setApprovingId] = useState(null);
  const approvingRef = useRef(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [perPage, setPerPage] = useState(10);
  const [soHistory, setSoHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Create-PO-from-SO (procure-to-order, multi-vendor) ──────────────────
  const [poModalSO, setPoModalSO] = useState(null);   // the SO being procured
  const [poVendors, setPoVendors] = useState([]);     // vendor options
  const [poLines, setPoLines] = useState([]);         // [{ check, soItemId, itemId, details, unit, rate, qty, vendorId }]
  const [poSaving, setPoSaving] = useState(false);
  const [poShipping, setPoShipping] = useState("0");
  const [poAdjustment, setPoAdjustment] = useState("0");
  const [linkedPOs, setLinkedPOs] = useState([]); // POs raised against the open SO

  // Vendor-origin VAT: mainland 5%, free_zone/overseas 0% (mirrors the PO form).
  const vendorTaxRate = (origin) => {
    const o = (origin || "").toLowerCase().replace(/\s+/g, "_");
    return (o === "free_zone" || o === "overseas") ? 0 : 0.05;
  };
  const poLineCalc = (l) => {
    const qty = parseFloat(l.qty) || 0;
    const rate = parseFloat(l.rate) || 0;
    const disc = parseFloat(l.discount) || 0;
    let base = qty * rate;
    if (l.discountType === "percentage") base = base - base * (disc / 100);
    else base = Math.max(0, base - disc);
    const v = poVendors.find(x => (x._id || x.id) === l.vendorId);
    const taxRate = vendorTaxRate(v?.origin);
    const tax = base * taxRate;
    const freight = parseFloat(l.freight) || 0;
    const freightTax = freight * (parseFloat(l.freightTaxRate) || 0) / 100;
    return { base, tax, taxRate, freight, freightTax, amount: base + tax + freight + freightTax };
  };
  const poTotals = (() => {
    const chosen = poLines.filter(l => l.check);
    let sub = 0, tax = 0;
    chosen.forEach(l => { const c = poLineCalc(l); sub += c.base + c.freight; tax += c.tax + c.freightTax; });
    const ship = parseFloat(poShipping) || 0;
    const adj = parseFloat(poAdjustment) || 0;
    return { sub: round2(sub), tax: round2(tax), ship: round2(ship), adj: round2(adj), grand: round2(sub + tax + ship + adj) };
  })();

  useEffect(() => {
    if (!selected?.id) { setLinkedPOs([]); return; }
    axiosInstance.get(`/api/purchase-orders/getorders?sourceSalesOrderId=${selected.id}&limit=100`)
      .then(r => setLinkedPOs(r.data?.data?.purchaseOrders || []))
      .catch(() => setLinkedPOs([]));
  }, [selected?.id, poSaving]);

  useEffect(() => {
    if (!poModalSO) return;
    axiosInstance.get("/api/vendors/?limit=200")
      .then(r => setPoVendors(r.data?.data?.vendors || []))
      .catch(() => setPoVendors([]));
    setPoShipping("0");
    setPoAdjustment("0");
    setPoLines((poModalSO.items || []).map(it => {
      const remaining = Math.max(0, (it.quantity || 0) - (it.fulfilledQty || 0));
      return {
        check: remaining > 0,
        soItemId: it._id || it.id || "",
        itemId: it.itemId || "",
        details: it.details || "",
        unit: it.unit || "",
        rate: it.rate || 0,
        discount: typeof it.discount === "number" ? it.discount : 0,
        discountType: it.discountType || "fixed",
        qty: remaining || it.quantity || 0,
        freight: 0,
        freightTaxRate: 0,
        vendorId: "",
      };
    }));
  }, [poModalSO]);

  const submitCreatePO = async () => {
    const chosen = poLines.filter(l => l.check && l.qty > 0 && l.vendorId);
    if (!chosen.length) { alert("Select at least one line, set a quantity, and pick a vendor."); return; }
    // Group selected lines by vendor → one PO per vendor (multi-vendor split).
    const byVendor = {};
    chosen.forEach(l => { (byVendor[l.vendorId] ||= []).push(l); });
    setPoSaving(true);
    try {
      const results = [];
      for (const [vendorId, lines] of Object.entries(byVendor)) {
        const v = poVendors.find(x => (x._id || x.id) === vendorId);
        const res = await axiosInstance.post(`/api/sales-orders/${poModalSO.id}/create-po`, {
          vendorId,
          vendorName: v?.displayName || v?.name || v?.companyName || "",
          shippingCharges: Number(poShipping) || 0,
          adjustment: Number(poAdjustment) || 0,
          items: lines.map(l => ({
            sourceSoItemId: l.soItemId,
            itemId: l.itemId,
            details: l.details,
            quantity: Number(l.qty),
            rate: Number(l.rate),
            unit: l.unit,
            discount: Number(l.discount) || 0,
            discountType: l.discountType,
            freight: Number(l.freight) || 0,
            freightTaxRate: Number(l.freightTaxRate) || 0,
          })),
        });
        results.push(res.data?.data?.orderNumber || "PO");
      }
      setPoModalSO(null);
      await handleGetSalesorder();
      alert(`Created ${results.length} purchase order(s): ${results.join(", ")}`);
    } catch (e) {
      alert(e.response?.data?.message || "Failed to create purchase order.");
    } finally {
      setPoSaving(false);
    }
  };

  const updateOrderStatus = async (id, status, extra = {}) => {
    if (approvingRef.current) return;
    approvingRef.current = id;
    setApprovingId(id);
    try {
      await axiosInstance.patch(`/api/sales-orders/${id}/status`, { status, ...extra });
      await handleGetSalesorder();
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, rawStatus: status, status: formatStatus(status), ...(extra.rejectionReason ? { rejectionReason: extra.rejectionReason } : {}) } : null);
    } catch (e) {
      alert(e.response?.data?.message || "Failed to update status.");
    } finally {
      approvingRef.current = null;
      setApprovingId(null);
    }
  };

  // Custom reject-reason modal state (replaces silent reject + native prompt).
  const [rejectOrder, setRejectOrder] = useState(null); // order being rejected
  const [rejectReason, setRejectReason] = useState("");
  const confirmRejectOrder = async () => {
    if (!rejectOrder || !rejectReason.trim()) return;
    await updateOrderStatus(rejectOrder.id, "rejected", { rejectionReason: rejectReason.trim() });
    setRejectOrder(null);
    setRejectReason("");
  };

  useEffect(() => { handleGetSalesorder(); }, [handleGetSalesorder]);
  useWebSocket((event) => { if (event.type === "sales_orders_updated") handleGetSalesorder(); });

  useEffect(() => {
    if (activeTab !== "history" || !selected?.id) return;
    setSoHistory(null);
    setHistoryLoading(true);
    axiosInstance.get(`/api/sales-orders/${selected.id}/history`)
      .then(r => setSoHistory(r.data?.data ?? null))
      .catch(() => setSoHistory(null))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, selected?.id]);

  const allOrders = data ? transformOrders(data) : [];

  const exportOrdersCSV = (orders) => {
    if (!orders.length) return;
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Order #","Customer","LPO #","Status","Order Date","Total (AED)","VAT (AED)"];
    const rows = orders.map(o => [
      o.saleOrderNumber, o.customer, o.lpoNumber, o.rawStatus,
      o.orderDate ? o.orderDate.slice(0, 10) : "",
      o.total.toFixed(2), o.vat.toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `sales_orders_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const bulkUpdateStatus = async (status) => {
    if (!selectedRows.size) return;
    const ids = [...selectedRows];
    try {
      await Promise.all(ids.map(id => axiosInstance.patch(`/api/sales-orders/${id}/status`, { status })));
      await handleGetSalesorder();
      setSelectedRows(new Set());
    } catch (e) {
      alert(e.response?.data?.message || `Failed to bulk ${status}`);
    }
  };

  const handleBulkCancel = async () => {
    if (!selectedRows.size) return;
    if (isAdminOrOwner) {
      const reason = window.prompt(
        `Cancel ${selectedRows.size} order(s)?\n\nOptional reason (leave blank to skip):`,
        ""
      );
      if (reason === null) return; // user hit Cancel on prompt
      const ids = [...selectedRows];
      try {
        await Promise.all(
          ids.map(id => axiosInstance.patch(`/api/sales-orders/${id}/status`, {
            status: "cancelled",
            cancelReason: reason || "",
          }))
        );
        await handleGetSalesorder();
        setSelectedRows(new Set());
      } catch (e) {
        alert(e.response?.data?.message || "Failed to cancel orders.");
      }
    } else {
      if (!window.confirm(`Submit cancellation request for ${selectedRows.size} order(s)?`)) return;
      const ids = [...selectedRows];
      try {
        await Promise.all(
          ids.map(id => axiosInstance.patch(`/api/sales-orders/${id}/status`, {
            status: "cancel_requested",
            cancelRequestedBy: activeOrg?.userId || "",
          }))
        );
        await handleGetSalesorder();
        setSelectedRows(new Set());
      } catch (e) {
        alert(e.response?.data?.message || "Failed to submit cancel requests.");
      }
    }
  };

  const filtered = allOrders
    .filter(o => statusFilter === "all" || o.rawStatus === statusFilter)
    .filter(o => {
      const q = search.toLowerCase();
      return !q || o.saleOrderNumber?.toLowerCase().includes(q) ||
        o.customer?.toLowerCase().includes(q) || o.lpoNumber?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let av, bv;
      if (sortBy === "date") { av = new Date(a.orderDate || 0); bv = new Date(b.orderDate || 0); }
      else if (sortBy === "total") { av = a.total; bv = b.total; }
      else { av = (a.saleOrderNumber || "").toLowerCase(); bv = (b.saleOrderNumber || "").toLowerCase(); }
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentItems = filtered.slice((page - 1) * perPage, page * perPage);

  const stats = {
    total: allOrders.length,
    open: allOrders.filter(o => ["open", "confirmed", "in progress"].includes(o.rawStatus)).length,
    pending: allOrders.filter(o => ["pending_approval"].includes(o.rawStatus)).length,
    drafts: allOrders.filter(o => o.rawStatus === "draft").length,
    value: allOrders.reduce((s, o) => s + o.total, 0),
  };

  const openDrawer = (item) => { setSelected(item); setDrawer(true); setActiveTab("overview"); };
  const closeDrawer = () => { setDrawer(false); setSelected(null); };

  const toggleRow = (id) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === currentItems.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(currentItems.map(i => i.id)));
  };

  // ── Colors ───────────────────────────────────────────────────
  const C = {
    bg:         isDark ? "#070c18" : "#eef1fb",
    surface:    isDark ? "#0b1220" : "#ffffff",
    surface2:   isDark ? "#0f1828" : "#f4f7fc",
    surface3:   isDark ? "#141f30" : "#edf1f8",
    border:     isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
    border2:    isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
    textPri:    isDark ? "#eef1f8" : "#0f172a",
    textSec:    isDark ? "#5a6a84" : "#64748b",
    textMuted:  isDark ? "#374255" : "#94a3b8",
    blue:       "#3b82f6",
    blueLight:  isDark ? "#60a5fa" : "#1d4ed8",
    blueDim:    isDark ? "rgba(59,130,246,0.13)" : "rgba(59,130,246,0.08)",
    green:      "#10b981",
    greenDim:   isDark ? "rgba(16,185,129,0.13)" : "rgba(16,185,129,0.08)",
    amber:      "#f59e0b",
    amberDim:   isDark ? "rgba(245,158,11,0.13)" : "rgba(245,158,11,0.08)",
    purple:     "#8b5cf6",
    purpleDim:  isDark ? "rgba(139,92,246,0.13)" : "rgba(139,92,246,0.08)",
    red:        "#ef4444",
    redDim:     isDark ? "rgba(239,68,68,0.13)" : "rgba(239,68,68,0.07)",
    cyan:       "#06b6d4",
    cyanDim:    isDark ? "rgba(6,182,212,0.13)" : "rgba(6,182,212,0.07)",
    glass:      isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.7)",
    glow:       isDark ? "0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)" : "0 2px 16px rgba(0,0,0,0.07)",
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Outfit:wght@500;600;700;800&display=swap');
    .so * { box-sizing: border-box; }
    .so { font-family: 'DM Sans', sans-serif; }
    .so-heading { font-family: 'Outfit', sans-serif; }

    * { scrollbar-width: thin; scrollbar-color: ${isDark ? "rgba(255,255,255,0.10) transparent" : "rgba(0,0,0,0.12) transparent"}; }
    *::-webkit-scrollbar { width: 4px; height: 4px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.12)"}; border-radius: 999px; }
    *::-webkit-scrollbar-thumb:hover { background: ${isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)"}; }

    .so-stat { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease; cursor: default; }
    .so-stat:hover { transform: translateY(-3px); box-shadow: ${isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 6px 20px rgba(0,0,0,0.1)"}; }

    .so-row { cursor: default; transition: background 0.1s, transform 0.12s; }
    .so-row:hover { background: ${isDark ? "rgba(99,102,241,0.05)" : "rgba(59,130,246,0.03)"} !important; }
    .so-row:hover td { position: relative; }
    .so-row.selected-row { background: ${isDark ? "rgba(59,130,246,0.09)" : "rgba(59,130,246,0.05)"} !important; }

    .so-order-link { cursor: pointer; transition: color 0.12s; }
    .so-order-link:hover { color: ${C.blueLight} !important; }

    .so-tbl-btn { transition: all 0.1s; border: none !important; }
    .so-tbl-btn:hover { opacity: 0.75; }

    .so-pill { transition: all 0.12s; cursor: pointer; white-space: nowrap; }
    .so-pill:hover { background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"} !important; color: ${C.textPri} !important; }
    .so-pill-active { font-weight: 600 !important; }

    .so-icon-btn { transition: all 0.12s; }
    .so-icon-btn:hover { background: ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"} !important; color: ${C.textPri} !important; }

    .so-primary-btn { transition: all 0.12s; }
    .so-primary-btn:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(59,130,246,0.35); }
    .so-primary-btn:active { transform: translateY(0); }

    .so-ghost-btn { transition: all 0.12s; }
    .so-ghost-btn:hover { background: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"} !important; }

    .so-page-btn { transition: all 0.1s; }
    .so-page-btn:hover:not(:disabled) { border-color: ${C.blueLight}50 !important; color: ${C.blueLight} !important; }

    .drawer-tab { transition: all 0.14s; cursor: pointer; }
    .drawer-tab:hover { background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"} !important; }

    .fin-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.015)"} !important; }
    .det-card:hover { border-color: ${isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.15)"} !important; }

    .so-checkbox { cursor: pointer; accent-color: ${C.blue}; }
    .so-approve { transition: all 0.12s; }
    .so-approve:hover { filter: brightness(1.08); }
    .so-reject { transition: all 0.12s; }
    .so-reject:hover { filter: brightness(1.08); }

    @keyframes slideIn  { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeUp   { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spin     { to { transform: rotate(360deg); } }
    @keyframes pulse    { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

    .anim-slide  { animation: slideIn 0.28s cubic-bezier(0.16,1,0.3,1) forwards; }
    .anim-fade   { animation: fadeIn 0.2s ease forwards; }
    .anim-up     { animation: fadeUp 0.28s ease both; }
    .anim-up1    { animation: fadeUp 0.28s 0.04s ease both; }
    .anim-up2    { animation: fadeUp 0.28s 0.08s ease both; }
    .anim-up3    { animation: fadeUp 0.28s 0.12s ease both; }
    .anim-spin   { animation: spin 0.7s linear infinite; }
    .anim-pulse  { animation: pulse 1.4s ease infinite; }

    .col-sort { cursor: pointer; user-select: none; transition: color 0.1s; }
    .col-sort:hover { color: ${C.textPri} !important; }

    .tag-pending { background: rgba(245,158,11,0.12); color: #d97706; border: 1px solid rgba(245,158,11,0.25); }
    .tag-positive { background: rgba(16,185,129,0.10); color: #059669; border: 1px solid rgba(16,185,129,0.22); }

    .bulk-bar { animation: fadeUp 0.2s ease both; }
  `;

  const card = (extra = {}) => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "12px",
    transition: "background 0.2s, border-color 0.2s",
    ...extra,
  });

  // ── Loading ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg }}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <div className="anim-spin" style={{ width: "32px", height: "32px", border: `2px solid ${C.border}`, borderTopColor: C.blue, borderRadius: "50%" }} />
        <span style={{ color: C.textSec, fontSize: "13px", fontFamily: "DM Sans, sans-serif" }}>Loading sales orders…</span>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: "20px", color: C.red, background: C.redDim, borderRadius: "12px", margin: "24px", border: `1px solid rgba(239,68,68,0.2)`, fontFamily: "DM Sans, sans-serif" }}>
      Error: {error}
    </div>
  );

  // ── Status pill tabs with counts ─────────────────────────────
  const STATUS_TABS = [
    { value: "all",              label: "All",             count: allOrders.length },
    { value: "open",             label: "Open",            count: allOrders.filter(o => o.rawStatus === "open").length },
    { value: "pending_approval", label: "Pending",         count: allOrders.filter(o => o.rawStatus === "pending_approval").length },
    { value: "approved",         label: "Approved",        count: allOrders.filter(o => o.rawStatus === "approved").length },
    { value: "confirmed",        label: "Confirmed",       count: allOrders.filter(o => o.rawStatus === "confirmed").length },
    { value: "draft",            label: "Draft",           count: allOrders.filter(o => o.rawStatus === "draft").length },
    { value: "completed",        label: "Completed",       count: allOrders.filter(o => o.rawStatus === "completed").length },
    { value: "rejected",         label: "Rejected",        count: allOrders.filter(o => o.rawStatus === "rejected").length },
    { value: "cancelled",        label: "Cancelled",       count: allOrders.filter(o => o.rawStatus === "cancelled").length },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="so" style={{ background: C.bg, minHeight: "100vh", color: C.textPri }}>

        {/* ── PAGE HEADER ─────────────────────────────────────── */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 28px", boxShadow: isDark ? "0 1px 0 rgba(255,255,255,0.04)" : "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div className="anim-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "60px" }}>
            {/* Breadcrumb + title */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: C.textMuted }}>Sales</span>
              <span style={{ color: C.textMuted, fontSize: "12px" }}>/</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: C.blueDim, color: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>
                  <FaShoppingCart />
                </div>
                <h1 className="so-heading" style={{ fontSize: "15px", fontWeight: "700", color: C.textPri, margin: 0, letterSpacing: "-0.01em" }}>Sales Orders</h1>
                <span style={{ fontSize: "11px", fontWeight: "600", background: C.blueDim, color: C.blueLight, padding: "2px 7px", borderRadius: "5px" }}>{allOrders.length}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button className="so-ghost-btn so-icon-btn"
                onClick={() => exportOrdersCSV(filtered)}
                style={{ height: "32px", padding: "0 12px", borderRadius: "7px", fontSize: "12px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit", background: "transparent", color: C.textSec, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "5px" }}>
                <FaDownload size={11} /> Export CSV
              </button>
              <button className="so-primary-btn" onClick={() => navigate("/Sales/Salesorders/Newsalesorders")}
                style={{ height: "32px", padding: "0 14px", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", background: C.blue, color: "white", border: "none", display: "flex", alignItems: "center", gap: "5px" }}>
                <FaPlus size={10} /> New Order
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ────────────────────────────────────── */}
        <div style={{ padding: "20px 28px" }}>

          {/* ── STAT CARDS ──────────────────────────────────── */}
          <div className="anim-up1" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "12px", marginBottom: "18px" }}>
            {[
              { label: "Total Orders",   value: stats.total,                       icon: <FaShoppingCart />, color: C.blue,   dim: C.blueDim,   sub: `${stats.open} active`      },
              { label: "Active",         value: stats.open,                        icon: <FaBolt />,         color: C.green,  dim: C.greenDim,  sub: "open + confirmed"          },
              { label: "Pending Review", value: stats.pending,                     icon: <FaHourglassHalf />,color: C.amber,  dim: C.amberDim,  sub: "awaiting approval", alert: stats.pending > 0 },
              { label: "Drafts",         value: stats.drafts,                      icon: <FaEdit />,         color: C.purple, dim: C.purpleDim, sub: "not submitted"             },
              { label: "Pipeline Value", value: formatCurrencyShort(stats.value),  icon: <FaFileInvoiceDollar />, color: C.cyan, dim: C.cyanDim, sub: "all orders", small: true  },
            ].map((c, i) => (
              <div key={i} className="so-stat" style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: "14px",
                padding: "16px 18px",
                position: "relative", overflow: "hidden",
                boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.3)" : "0 1px 8px rgba(0,0,0,0.05)",
              }}>
                {/* Gradient top bar */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${c.color}, ${c.color}40, transparent)` }} />
                {/* Subtle glow corner */}
                <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: c.color, opacity: isDark ? 0.04 : 0.06, pointerEvents: "none" }} />

                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "10px", color: C.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px", whiteSpace: "nowrap" }}>{c.label}</p>
                    <p className="so-heading" style={{ fontSize: c.small ? "15px" : "24px", fontWeight: "800", color: C.textPri, margin: "0 0 5px", lineHeight: 1, letterSpacing: "-0.03em" }}>{c.value}</p>
                    <p style={{ fontSize: "10px", color: C.textSec, margin: 0 }}>{c.sub}</p>
                  </div>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: c.dim, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", border: `1px solid ${c.color}22` }}>{c.icon}</div>
                    {c.alert && (
                      <div className="anim-pulse" style={{ position: "absolute", top: -2, right: -2, width: "8px", height: "8px", borderRadius: "50%", background: C.amber, border: `2px solid ${C.surface}` }} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── TOOLBAR ─────────────────────────────────────── */}
          <div className="anim-up2" style={{ ...card(), marginBottom: "2px", overflow: "hidden" }}>
            {/* Status tabs */}
            <div style={{ display: "flex", gap: "0", overflowX: "auto", borderBottom: `1px solid ${C.border}`, padding: "0 12px" }}>
              {STATUS_TABS.map(tab => {
                const isActive = statusFilter === tab.value;
                const sc = tab.value !== "all" ? getStatus(tab.value) : null;
                return (
                  <button key={tab.value} onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                    style={{
                      padding: "10px 12px", fontSize: "12px", fontWeight: isActive ? "600" : "400",
                      color: isActive ? (sc ? sc.color : C.blueLight) : C.textSec,
                      background: "transparent", border: "none", borderBottom: `2px solid ${isActive ? (sc ? sc.color : C.blue) : "transparent"}`,
                      cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "5px",
                      whiteSpace: "nowrap", transition: "all 0.14s", marginBottom: "-1px",
                    }}
                    className="so-pill drawer-tab"
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span style={{
                        fontSize: "10px", fontWeight: "700",
                        background: isActive ? (sc ? sc.bg : C.blueDim) : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
                        color: isActive ? (sc ? sc.color : C.blueLight) : C.textSec,
                        padding: "1px 6px", borderRadius: "4px",
                        border: isActive ? `1px solid ${sc ? sc.border : "rgba(59,130,246,0.2)"}` : "1px solid transparent",
                      }}>{tab.count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search + sort row */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "10px 14px" }}>
              <div style={{ position: "relative", flex: 1, minWidth: "200px", maxWidth: "360px" }}>
                <FaSearch style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: "11px", pointerEvents: "none" }} />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search orders, customers, LPO…"
                  style={{ width: "100%", height: "32px", padding: "0 30px 0 30px", border: `1px solid ${C.border}`, borderRadius: "7px", fontSize: "12px", background: C.surface2, color: C.textPri, outline: "none", fontFamily: "inherit", transition: "border-color 0.15s" }}
                  onFocus={e => e.target.style.borderColor = "rgba(59,130,246,0.4)"}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textSec, padding: "2px", display: "flex" }}>
                    <FaTimes size={10} />
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "6px", marginLeft: "auto", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: C.textMuted, whiteSpace: "nowrap" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
                <div style={{ width: "1px", height: "16px", background: C.border }} />
                <span style={{ fontSize: "12px", color: C.textSec, whiteSpace: "nowrap" }}>Sort by</span>
                <CustomSelect
                  value={sortBy}
                  onChange={v => { setSortBy(v); setPage(1); }}
                  options={[
                    { label: "Date",    value: "date"  },
                    { label: "Value",   value: "total" },
                    { label: "Order #", value: "order" },
                  ]}
                  minWidth={110}
                />
                <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                  className="so-icon-btn"
                  style={{ width: "32px", height: "32px", border: `1px solid ${C.border}`, borderRadius: "7px", background: "transparent", color: C.textSec, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}>
                  {sortDir === "asc" ? <FaSortAmountDown size={12} /> : <FaSortAmountUp size={12} />}
                </button>
              </div>
            </div>
          </div>

          {/* ── BULK ACTION BAR ──────────────────────────────── */}
          {selectedRows.size > 0 && (
            <div className="bulk-bar" style={{ background: C.blueDim, border: `1px solid rgba(59,130,246,0.2)`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "8px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: C.blueLight }}>{selectedRows.size} selected</span>
              <button onClick={() => setSelectedRows(new Set())} style={{ fontSize: "11px", color: C.textSec, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
              <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                {isAdminOrOwner && (
                  <button className="so-tbl-btn" onClick={() => bulkUpdateStatus("approved")} style={{ padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", color: C.green, background: "rgba(16,185,129,0.1)", cursor: "pointer", fontFamily: "inherit" }}>
                    Bulk Approve
                  </button>
                )}
                <button className="so-tbl-btn" onClick={handleBulkCancel} style={{ padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", color: C.red, background: "rgba(239,68,68,0.1)", cursor: "pointer", fontFamily: "inherit" }}>
                  {isAdminOrOwner ? "Bulk Cancel" : "Request Cancel"}
                </button>
                <button className="so-tbl-btn" onClick={() => exportOrdersCSV(currentItems.filter(i => selectedRows.has(i.id)))} style={{ padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", color: C.textSec, background: C.surface3, cursor: "pointer", fontFamily: "inherit" }}>
                  Export Selected
                </button>
              </div>
            </div>
          )}

          {/* ── TABLE ─────────────────────────────────────────── */}
          <div className="anim-up3" style={{ ...card(), overflow: "hidden", marginBottom: "10px" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "860px" }}>
                <thead>
                  <tr style={{ background: isDark ? "rgba(255,255,255,0.025)" : C.surface2, borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "10px 14px", width: "40px" }}>
                      <input type="checkbox" className="so-checkbox"
                        checked={currentItems.length > 0 && selectedRows.size === currentItems.length}
                        onChange={toggleAll}
                      />
                    </th>
                    {[
                      { label: "Order #",   align: "left",  sortKey: "order" },
                      { label: "Customer",  align: "left"                    },
                      { label: "Status",    align: "left"                    },
                      { label: "LPO",       align: "left"                    },
                      { label: "LPO Value", align: "right", sortKey: "total" },
                      { label: "Total",     align: "right", sortKey: "total" },
                      { label: "Date",      align: "left",  sortKey: "date"  },
                      { label: "",          align: "right"                   },
                    ].map((h, i) => (
                      <th key={i}
                        onClick={h.sortKey ? () => { if (sortBy === h.sortKey) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(h.sortKey); setSortDir("desc"); } } : undefined}
                        className={h.sortKey ? "col-sort" : ""}
                        style={{ padding: "10px 14px", textAlign: h.align, fontSize: "10px", fontWeight: "600", color: sortBy === h.sortKey ? C.blueLight : C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {h.label}
                          {h.sortKey && sortBy === h.sortKey && (
                            sortDir === "asc" ? <FaArrowUp size={8} /> : <FaArrowDown size={8} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length > 0 ? currentItems.map((item, idx) => {
                    const sc = getStatus(item.rawStatus);
                    const isSelected = selectedRows.has(item.id);
                    return (
                      <tr key={item.id || idx}
                        className={`so-row${isSelected ? " selected-row" : ""}`}
                        style={{ borderBottom: `1px solid ${C.border2}` }}>
                        <td style={{ padding: "12px 14px" }}>
                          <input type="checkbox" className="so-checkbox" checked={isSelected} onChange={() => toggleRow(item.id)} />
                        </td>

                        {/* Order # */}
                        <td style={{ padding: "12px 14px" }}>
                          <span className="so-order-link so-heading"
                            onClick={() => openDrawer(item)}
                            style={{ fontSize: "13px", fontWeight: "700", color: C.textPri, display: "block", letterSpacing: "-0.01em" }}>
                            {item.saleOrderNumber}
                          </span>
                          {item.salesperson && (
                            <span style={{ fontSize: "10px", color: C.textMuted }}>{item.salesperson}</span>
                          )}
                        </td>

                        {/* Customer */}
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Avatar name={item.customer} size={26} isDark={isDark} />
                            <div>
                              <p style={{ fontSize: "12px", fontWeight: "600", color: C.textPri, margin: 0 }}>{item.customer}</p>
                              {item.customerCode && (
                                <p style={{ fontSize: "10px", color: C.textSec, margin: 0, fontFamily: "'DM Mono', monospace" }}>{item.customerCode}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: "4px",
                              fontSize: "10px", fontWeight: "600", padding: "3px 8px",
                              borderRadius: "5px", background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                              whiteSpace: "nowrap", width: "fit-content",
                            }}>
                              <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: sc.color, flexShrink: 0 }} />
                              {item.status}
                            </span>
                            {item.rawStatus === "shipped" && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: "3px",
                                fontSize: "9px", fontWeight: "700", padding: "2px 6px",
                                borderRadius: "4px", width: "fit-content",
                                background: "rgba(245,158,11,0.12)", color: "#f59e0b",
                                border: "1px solid rgba(245,158,11,0.3)", whiteSpace: "nowrap",
                              }}>
                                ⚡ To Invoice
                              </span>
                            )}
                          </div>
                        </td>

                        {/* LPO */}
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: "12px", color: C.textSec, fontFamily: "'DM Mono', monospace" }}>{item.lpoNumber}</span>
                        </td>

                        {/* LPO Value */}
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <span style={{ fontSize: "12px", fontWeight: "500", color: C.textSec, fontFamily: "'DM Mono', monospace" }}>{formatCurrency(item.lpoValue)}</span>
                        </td>

                        {/* Total */}
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <span className="so-heading" style={{ fontSize: "13px", fontWeight: "700", color: C.textPri, fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>{formatCurrency(item.total)}</span>
                        </td>

                        {/* Date */}
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: "11px", color: C.textSec, whiteSpace: "nowrap" }}>{formatDate(item.orderDate)}</span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "12px 10px" }}>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", alignItems: "center" }}>
                            <button className="so-tbl-btn"
                              onClick={() => openDrawer(item)}
                              style={{ height: "26px", padding: "0 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "500", color: C.textSec, background: C.surface2, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                              View
                            </button>

                            {canEditOrder(item) && (
                              <button className="so-tbl-btn"
                                onClick={() => navigate(`/Sales/Salesorders/Newsalesorders/${item._id || item.id}`)}
                                style={{ height: "26px", padding: "0 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "500", color: item.rawStatus==="rejected"?"#ef4444":C.blueLight, background: item.rawStatus==="rejected"?"rgba(239,68,68,0.1)":C.blueDim, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "3px" }}>
                                <FaEdit size={9} /> {item.rawStatus==="rejected"?"Edit & Resubmit":"Edit"}
                              </button>
                            )}

                            {canApproveOrder(item) && (
                              <>
                                <button className="so-approve"
                                  disabled={approvingId === item.id}
                                  onClick={() => updateOrderStatus(item.id, "approved")}
                                  style={{ height: "26px", padding: "0 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", color: "#10b981", background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.2)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "3px" }}>
                                  <FaThumbsUp size={9} />
                                </button>
                                <button className="so-reject"
                                  disabled={approvingId === item.id}
                                  onClick={() => { setRejectReason(""); setRejectOrder(item); }}
                                  style={{ height: "26px", padding: "0 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", color: "#ef4444", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "3px" }}>
                                  <FaThumbsDown size={9} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="9" style={{ padding: "72px 20px", textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: C.surface2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: C.textMuted }}>
                            <FaBoxOpen />
                          </div>
                          <p className="so-heading" style={{ fontWeight: "700", color: C.textPri, fontSize: "14px", margin: 0 }}>No orders found</p>
                          <p style={{ color: C.textSec, fontSize: "12px", margin: 0 }}>
                            {statusFilter !== "all" ? `No orders with status "${formatStatus(statusFilter)}"` : "Create your first sales order to get started"}
                          </p>
                          <button onClick={() => navigate("/Sales/Salesorders/Newsalesorders")}
                            className="so-primary-btn"
                            style={{ marginTop: "4px", padding: "8px 18px", background: C.blue, color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "5px" }}>
                            <FaPlus size={10} /> New Sales Order
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── PAGINATION ────────────────────────────────────── */}
          {filtered.length > 0 && (
            <div style={{ ...card(), padding: "9px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              {/* Left: count + per-page */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "11px", color: C.textSec, whiteSpace: "nowrap" }}>
                  {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length} orders
                </span>
                <div style={{ width: 1, height: 14, background: C.border }} />
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: "11px", color: C.textMuted, whiteSpace: "nowrap" }}>Rows per page</span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[10, 20, 50, 100].map(n => (
                      <button key={n} onClick={() => { setPerPage(n); setPage(1); }}
                        className="so-page-btn"
                        style={{ height: "24px", minWidth: "32px", borderRadius: "5px", fontSize: "11px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1px solid ${perPage === n ? "rgba(59,130,246,0.35)" : C.border}`, background: perPage === n ? C.blueDim : "transparent", color: perPage === n ? C.blueLight : C.textSec }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: page nav */}
              <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="so-page-btn"
                  style={{ height: "28px", padding: "0 10px", border: `1px solid ${C.border}`, borderRadius: "6px", background: "transparent", fontSize: "11px", color: page === 1 ? C.textMuted : C.textSec, cursor: page === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                  <FaChevronLeft size={9} /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
                  .map((p, i) => p === "..." ? (
                    <span key={`e${i}`} style={{ padding: "0 4px", color: C.textSec, fontSize: "11px" }}>…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)} className="so-page-btn"
                      style={{ height: "28px", minWidth: "28px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1px solid ${page === p ? "rgba(59,130,246,0.3)" : C.border}`, background: page === p ? C.blueDim : "transparent", color: page === p ? C.blueLight : C.textSec }}>
                      {p}
                    </button>
                  ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="so-page-btn"
                  style={{ height: "28px", padding: "0 10px", border: `1px solid ${C.border}`, borderRadius: "6px", background: "transparent", fontSize: "11px", color: page === totalPages ? C.textMuted : C.textSec, cursor: page === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                  Next <FaChevronRight size={9} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── DETAIL DRAWER ─────────────────────────────────────── */}
      {drawer && selected && (() => {
        const sc = getStatus(selected.rawStatus);
        const hue = sc.color;
        const fmtM = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const itemCount = selected.items?.length || 0;

        return (
          <>
            <div className="anim-fade" onClick={closeDrawer}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(4,8,18,0.75)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />

            <div className="anim-slide" style={{
              position: "fixed", right: 0, top: 0, bottom: 0, width: "480px", maxWidth: "100vw",
              background: isDark ? "#0a1020" : "#f8fafc",
              borderLeft: `1px solid ${C.border}`,
              zIndex: 51, display: "flex", flexDirection: "column",
              boxShadow: isDark ? "-32px 0 80px rgba(0,0,0,0.65)" : "-8px 0 40px rgba(0,0,0,0.12)",
            }}>

              {/* ── DRAWER HEADER ── */}
              <div style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
                {/* Status color bar */}
                <div style={{ height: "3px", background: `linear-gradient(90deg, ${hue}, ${hue}60, transparent)` }} />

                <div style={{ padding: "16px 20px 0" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0, paddingRight: "36px" }}>
                      <div style={{
                        width: "42px", height: "42px", borderRadius: "11px", flexShrink: 0,
                        background: sc.bg, color: hue,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px",
                        border: `1px solid ${sc.border}`,
                      }}>
                        <FaShoppingCart />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 className="so-heading" style={{ fontSize: "17px", fontWeight: "800", color: C.textPri, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                          {selected.saleOrderNumber}
                        </h3>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "11px", color: C.textSec }}>{selected.customer}</span>
                          {selected.customerCode && (
                            <code style={{ fontSize: "10px", background: C.blueDim, color: C.blueLight, padding: "1px 6px", borderRadius: "4px", fontFamily: "'DM Mono', monospace" }}>{selected.customerCode}</code>
                          )}
                          <span style={{
                            fontSize: "10px", fontWeight: "600", padding: "2px 7px", borderRadius: "4px",
                            background: sc.bg, color: hue, border: `1px solid ${sc.border}`,
                            display: "inline-flex", alignItems: "center", gap: "3px",
                          }}>
                            <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: hue }} />
                            {selected.status}
                          </span>
                          {selected.fulfillmentStatus && (
                            <span style={{
                              fontSize: "10px", fontWeight: "600", padding: "2px 7px", borderRadius: "4px",
                              background: selected.fulfillmentStatus === "fulfilled" ? "rgba(16,185,129,0.12)" : selected.fulfillmentStatus === "partial" ? "rgba(59,130,246,0.12)" : "rgba(100,116,139,0.12)",
                              color: selected.fulfillmentStatus === "fulfilled" ? "#10b981" : selected.fulfillmentStatus === "partial" ? "#3b82f6" : "#94a3b8",
                              border: `1px solid ${selected.fulfillmentStatus === "fulfilled" ? "rgba(16,185,129,0.3)" : selected.fulfillmentStatus === "partial" ? "rgba(59,130,246,0.3)" : "rgba(100,116,139,0.3)"}`,
                              display: "inline-flex", alignItems: "center", gap: "3px",
                            }}>
                              <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "currentColor" }} />
                              {selected.fulfillmentStatus === "fulfilled" ? "Fulfilled" : selected.fulfillmentStatus === "partial" ? "Partial Delivery" : "Unfulfilled"}
                            </span>
                          )}
                          {selected.rawStatus === "shipped" && (
                            <span style={{
                              fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "4px",
                              background: "rgba(245,158,11,0.12)", color: "#f59e0b",
                              border: "1px solid rgba(245,158,11,0.3)",
                              display: "inline-flex", alignItems: "center", gap: "3px",
                            }}>
                              ⚡ To Invoice
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={closeDrawer} style={{
                      position: "absolute", top: "16px", right: "20px",
                      width: "28px", height: "28px", borderRadius: "8px",
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                      border: `1px solid ${C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: C.textSec,
                    }}>
                      <FaTimes size={10} />
                    </button>
                  </div>

                  {/* 4 stat chips */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginBottom: "14px" }}>
                    {[
                      { label: "LPO Value", value: selected.lpoValue ? `AED ${Number(selected.lpoValue).toLocaleString("en-AE", { maximumFractionDigits: 0 })}` : "—", color: C.blueLight, bg: C.blueDim, border: "rgba(59,130,246,0.15)" },
                      { label: "Total",     value: selected.total ? `AED ${Number(selected.total).toLocaleString("en-AE", { maximumFractionDigits: 0 })}` : "—",    color: hue, bg: sc.bg, border: sc.border },
                      { label: "Items",     value: String(itemCount),              color: C.purple, bg: C.purpleDim, border: "rgba(139,92,246,0.15)" },
                      { label: "Date",      value: formatDate(selected.orderDate), color: C.amber,  bg: C.amberDim,  border: "rgba(245,158,11,0.15)"  },
                    ].map((chip, i) => (
                      <div key={i} style={{ background: chip.bg, border: `1px solid ${chip.border}`, borderRadius: "8px", padding: "8px 10px" }}>
                        <p style={{ fontSize: "9px", fontWeight: "700", color: chip.color, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 3px" }}>{chip.label}</p>
                        <p style={{ fontSize: "12px", fontWeight: "700", color: chip.color, margin: 0, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chip.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tab bar */}
                  <div style={{ display: "flex", gap: "0" }}>
                    {[
                      { id: "overview", label: "Overview" },
                      { id: "items",    label: `Items${itemCount > 0 ? ` (${itemCount})` : ""}` },
                      { id: "history",  label: "History" },
                    ].map(tab => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className="drawer-tab"
                        style={{
                          padding: "8px 14px", fontSize: "12px", fontWeight: activeTab === tab.id ? "600" : "400",
                          color: activeTab === tab.id ? C.blueLight : C.textSec,
                          background: "transparent", border: "none",
                          borderBottom: `2px solid ${activeTab === tab.id ? C.blue : "transparent"}`,
                          cursor: "pointer", fontFamily: "inherit", marginBottom: "-1px",
                          transition: "all 0.14s",
                        }}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── DRAWER BODY ── */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: "10px" }}>

                {/* OVERVIEW */}
                {activeTab === "overview" && (
                  <>
                    {/* Approve panel */}
                    {canApproveOrder(selected) && (
                      <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)", borderRadius: "10px", padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "12px" }}>
                          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "rgba(245,158,11,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>⏳</div>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: "700", color: "#d97706" }}>Awaiting Your Approval</div>
                            <div style={{ fontSize: "11px", color: C.textSec, marginTop: "2px" }}>Review then approve or reject.</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button disabled={approvingId === selected.id}
                            onClick={() => updateOrderStatus(selected.id, "approved")}
                            className="so-approve"
                            style={{ flex: 1, padding: "9px 0", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontSize: "12px", fontWeight: "700", cursor: approvingId ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: approvingId ? 0.7 : 1 }}>
                            <FaThumbsUp size={11} /> {approvingId === selected.id ? "Processing…" : "Approve Order"}
                          </button>
                          <button disabled={approvingId === selected.id}
                            onClick={() => { setRejectReason(""); setRejectOrder(selected); }}
                            className="so-reject"
                            style={{ flex: 1, padding: "9px 0", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)", color: "#ef4444", fontSize: "12px", fontWeight: "700", cursor: approvingId ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <FaThumbsDown size={11} /> Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Approver note — message left by an approver who edited this order. */}
                    {selected.approverNote && (
                      <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)", borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <span style={{ fontSize: "16px", lineHeight: 1.2 }}>📝</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "#d97706" }}>Note from approver</div>
                          <div style={{ fontSize: "12px", color: C.textPri, marginTop: "3px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{selected.approverNote}</div>
                          {selected.approverNoteAt && (
                            <div style={{ fontSize: "11px", color: C.textSec, marginTop: "4px" }}>{formatDate(selected.approverNoteAt)}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Rejected banner */}
                    {selected.rawStatus === "rejected" && (
                      <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "16px" }}>🚫</span>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "#ef4444" }}>Order Rejected</div>
                          {selected.rejectionReason && (
                            <div style={{ fontSize: "12px", color: C.textPri, marginTop: "3px" }}>“{selected.rejectionReason}”</div>
                          )}
                          <div style={{ fontSize: "11px", color: C.textSec, marginTop: "2px" }}>Creator can edit and resubmit.</div>
                        </div>
                      </div>
                    )}

                    {/* Edit — permission-based for draft/rejected/approved; approver-only
                        while the order is pending approval (see canEditOrder). */}
                    {canEditOrder(selected) && (
                      <button onClick={() => navigate(`/Sales/Salesorders/Newsalesorders/${selected._id || selected.id}`)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: selected.rawStatus === "rejected" ? "rgba(239,68,68,0.08)" : C.blueDim, color: selected.rawStatus === "rejected" ? "#ef4444" : C.blueLight, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        <FaEdit size={11} /> {selected.rawStatus === "rejected" ? "Edit & Resubmit" : "Edit Order"}
                      </button>
                    )}

                    {/* Financial card */}
                    <div style={{ background: isDark ? C.surface : "#fff", border: `1px solid ${C.border}`, borderRadius: "10px", overflow: "hidden" }}>
                      <div style={{ height: "2px", background: `linear-gradient(90deg, ${hue}, ${hue}50, transparent)` }} />
                      <div style={{ padding: "11px 14px 6px" }}>
                        <p style={{ fontSize: "9px", fontWeight: "700", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Financial Summary</p>
                      </div>
                      {[
                        { label: "LPO Value",  value: fmtM(selected.lpoValue)       },
                        { label: "Subtotal",   value: fmtM(selected.subTotal)        },
                        { label: "Shipping",   value: fmtM(selected.shippingCharges) },
                        { label: "Adjustment", value: fmtM(selected.adjustment)      },
                        { label: "VAT (5%)",   value: fmtM(selected.vat)             },
                      ].map(({ label, value }, i) => (
                        <div key={i} className="fin-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", borderBottom: `1px solid ${C.border2}`, transition: "background 0.1s" }}>
                          <span style={{ fontSize: "11px", color: C.textSec }}>{label}</span>
                          <span style={{ fontSize: "12px", fontWeight: "500", color: C.textPri, fontFamily: "'DM Mono', monospace" }}>{value}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: isDark ? `${hue}0d` : `${hue}08` }}>
                        <span className="so-heading" style={{ fontSize: "13px", fontWeight: "700", color: C.textPri }}>Total</span>
                        <span className="so-heading" style={{ fontSize: "17px", fontWeight: "800", color: hue, fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>{fmtM(selected.total)}</span>
                      </div>
                    </div>

                    {/* Info grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
                      {[
                        { emoji: "🔖", label: "LPO Number",   value: selected.lpoNumber || "—",               mono: true  },
                        { emoji: "📅", label: "Order Date",   value: formatDate(selected.orderDate)                        },
                        { emoji: "📋", label: "LPO Date",     value: formatDate(selected.lpoDate)                          },
                        { emoji: "🚢", label: "Expected Ship", value: formatDate(selected.expectedShipmentDate)             },
                        { emoji: "💳", label: "Payment Terms", value: selected.paymentTerms || "—"                         },
                        { emoji: "👤", label: "Salesperson",  value: selected.salesperson || "—"                           },
                      ].map(({ emoji, label, value, mono }) => (
                        <div key={label} className="det-card" style={{
                          background: isDark ? C.surface : "#fff",
                          border: `1px solid ${C.border}`, borderRadius: "9px", padding: "11px 12px",
                          transition: "border-color 0.15s",
                        }}>
                          <p style={{ fontSize: "9px", color: C.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span>{emoji}</span> {label}
                          </p>
                          <p style={{ fontSize: "12px", fontWeight: "700", color: C.textPri, margin: 0, fontFamily: mono ? "'DM Mono', monospace" : "inherit" }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ITEMS */}
                {activeTab === "items" && (
                  selected.items?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                      {selected.items.map((item, i) => (
                        <div key={i} style={{
                          background: isDark ? C.surface : "#fff",
                          border: `1px solid ${C.border}`, borderRadius: "9px", padding: "11px 13px",
                          display: "flex", gap: "10px", alignItems: "center",
                        }}>
                          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: C.blueDim, color: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "12px", fontWeight: "600", color: C.textPri, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.details || `Item ${i + 1}`}</p>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "10px", color: C.textSec }}>Qty <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: "600", color: C.textPri }}>{item.quantity}</span></span>
                              <span style={{ color: C.border, fontSize: "10px" }}>·</span>
                              <span style={{ fontSize: "10px", color: C.textSec }}>Rate <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: "600", color: C.textPri }}>{fmtM(item.rate)}</span></span>
                              {item.discount && <span style={{ fontSize: "10px", color: C.amber, fontWeight: "600" }}>−{item.discount}</span>}
                            </div>
                            {/* Fulfillment progress */}
                            {(item.fulfilledQty > 0 || selected.fulfillmentStatus) && (() => {
                              const fulfilled = item.fulfilledQty || 0;
                              const total     = item.quantity || 1;
                              const pct       = Math.min((fulfilled / total) * 100, 100);
                              const backorder = Math.max(total - fulfilled, 0);
                              return (
                                <div style={{ marginTop: 6 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                    <span style={{ fontSize: "9px", color: C.textSec }}>Delivered {fulfilled}/{total}</span>
                                    {backorder > 0 && <span style={{ fontSize: "9px", color: "#f59e0b", fontWeight: "600" }}>Backorder: {backorder}</span>}
                                  </div>
                                  <div style={{ height: 3, borderRadius: 2, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
                                    <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: pct >= 100 ? "#10b981" : "#3b82f6", transition: "width 0.4s" }} />
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          <span className="so-heading" style={{ fontSize: "13px", fontWeight: "700", color: hue, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{fmtM(item.amount)}</span>
                        </div>
                      ))}
                      <div style={{ background: isDark ? `${hue}0d` : `${hue}07`, border: `1px solid ${sc.border}`, borderRadius: "9px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: C.textSec }}>{itemCount} item{itemCount !== 1 ? "s" : ""} · Subtotal</span>
                        <span className="so-heading" style={{ fontSize: "14px", fontWeight: "800", color: hue, fontFamily: "'DM Mono', monospace" }}>{fmtM(selected.subTotal)}</span>
                      </div>

                      {/* Procure-to-order: raise PO(s) to source these lines.
                          Hidden until the order clears approval — no procurement on a
                          draft or pending_approval order. */}
                      {!["cancelled", "rejected", "draft", "pending_approval"].includes(selected.rawStatus) && (
                        <button onClick={() => setPoModalSO(selected)}
                          style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", borderRadius: 9, border: "none", background: "#3b82f6", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          <FaFileInvoiceDollar size={12} /> Create Purchase Order
                        </button>
                      )}
                      {linkedPOs.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.textSec, margin: "0 0 6px" }}>
                            Linked purchase orders ({linkedPOs.length})
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {linkedPOs.map(po => {
                              const ps = getStatus(po.status);
                              return (
                                <div key={po._id} onClick={() => navigate("/Purchase/PurchaseOrders")}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: isDark ? C.surface : "#fff", cursor: "pointer" }}>
                                  <div style={{ minWidth: 0 }}>
                                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: C.blueLight }}>{po.orderNumber}</span>
                                    <span style={{ fontSize: 11, color: C.textSec }}> · {po.vendorName || "—"}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, color: ps.color, background: ps.bg, border: `1px solid ${ps.border}` }}>{ps.label}</span>
                                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, fontWeight: 700, color: C.textPri }}>{fmtM(po.total)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px", gap: "10px" }}>
                      <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: C.surface2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: C.textMuted }}><FaBoxOpen /></div>
                      <p className="so-heading" style={{ fontWeight: "700", color: C.textPri, fontSize: "13px", margin: 0 }}>No line items</p>
                      <p style={{ color: C.textSec, fontSize: "11px", margin: 0 }}>No items found for this order.</p>
                    </div>
                  )
                )}

                {/* HISTORY */}
                {activeTab === "history" && (() => {
                  const statusMeta = {
                    created:          { label: "Order Created",         color: "#6366f1", icon: "✦" },
                    status_changed:   { label: "Status Updated",        color: "#3b82f6", icon: "⟳" },
                    open:             { label: "Open",                  color: "#3b82f6", icon: "◉" },
                    pending_approval: { label: "Submitted for Approval", color: "#f59e0b", icon: "⏳" },
                    approved:         { label: "Approved",              color: "#10b981", icon: "✓" },
                    confirmed:        { label: "Confirmed",             color: "#10b981", icon: "✓" },
                    rejected:         { label: "Rejected",              color: "#ef4444", icon: "✕" },
                    cancelled:        { label: "Cancelled",             color: "#ef4444", icon: "✕" },
                    cancel_requested: { label: "Cancel Requested",      color: "#f59e0b", icon: "!" },
                    shipped:          { label: "Shipped",               color: "#8b5cf6", icon: "→" },
                    completed:        { label: "Completed",             color: "#10b981", icon: "★" },
                    invoiced:         { label: "Invoiced",              color: "#06b6d4", icon: "◈" },
                    draft:            { label: "Draft",                 color: C.textSec, icon: "◌" },
                    pending:          { label: "Pending",               color: "#f59e0b", icon: "⏳" },
                  };

                  const fmtTs = ts => {
                    if (!ts) return "";
                    const d = new Date(ts);
                    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                      + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                  };

                  if (historyLoading) return (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "160px", gap: 8, color: C.textSec, fontSize: "12px" }}>
                      <FaSpinner style={{ animation: "spin .7s linear infinite" }} /> Loading history…
                    </div>
                  );

                  const entries = soHistory?.statusHistory ?? [];
                  if (!entries.length) return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px", gap: "10px" }}>
                      <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: C.surface2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: C.textMuted }}><FaClock /></div>
                      <p className="so-heading" style={{ fontWeight: "700", color: C.textPri, fontSize: "13px", margin: 0 }}>No activity yet</p>
                      <p style={{ color: C.textSec, fontSize: "11px", margin: 0 }}>History is recorded from this point forward.</p>
                    </div>
                  );

                  return (
                    <div style={{ padding: "4px 0 8px" }}>
                      {entries.map((e, i) => {
                        const isLast = i === entries.length - 1;
                        const meta = e.action === "created"
                          ? statusMeta.created
                          : (statusMeta[e.status] ?? statusMeta.status_changed);
                        return (
                          <div key={i} style={{ display: "flex", gap: 12, position: "relative" }}>
                            {/* vertical line */}
                            {!isLast && (
                              <div style={{
                                position: "absolute", left: 15, top: 28, width: 2,
                                height: "calc(100% - 8px)",
                                background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
                              }} />
                            )}
                            {/* dot */}
                            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", marginTop: 4,
                              background: isDark ? `${meta.color}22` : `${meta.color}18`,
                              border: `2px solid ${meta.color}55`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "13px", color: meta.color, fontWeight: "700", zIndex: 1 }}>
                              {meta.icon}
                            </div>
                            {/* content */}
                            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: meta.color }}>{meta.label}</span>
                                {e.action !== "created" && e.status && (
                                  <span style={{ fontSize: "10px", fontWeight: "600", padding: "1px 7px", borderRadius: "10px",
                                    background: isDark ? `${meta.color}20` : `${meta.color}15`,
                                    color: meta.color, border: `1px solid ${meta.color}35` }}>
                                    {e.status.replace(/_/g, " ")}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "10px", color: C.textSec, marginTop: 2 }}>
                                {fmtTs(e.changedAt)}
                                {e.changedBy && <span style={{ marginLeft: 6, color: C.textMuted }}>by {e.changedBy}</span>}
                              </div>
                              {e.note && (
                                <div style={{ marginTop: 4, fontSize: "11px", color: C.textSec,
                                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                                  border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px" }}>
                                  {e.note}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </>
        );
      })()}

      {rejectOrder && createPortal(
        <div onClick={() => approvingId === null && setRejectOrder(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 440, background: isDark ? C.surface : "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, fontFamily: "inherit" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPri }}>Reject sales order</h3>
            <p style={{ margin: "6px 0 14px", fontSize: 12.5, color: C.textSec }}>
              Rejecting <strong style={{ color: C.textPri }}>{rejectOrder.saleOrderNumber}</strong> sends it back to the creator. A reason is required.
            </p>
            <textarea autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…" rows={3}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", color: C.textPri, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setRejectOrder(null)} disabled={approvingId !== null}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={confirmRejectOrder} disabled={!rejectReason.trim() || approvingId !== null}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: (!rejectReason.trim() || approvingId !== null) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (!rejectReason.trim() || approvingId !== null) ? 0.5 : 1 }}>
                <FaThumbsDown size={11} /> {approvingId === rejectOrder.id ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {poModalSO && createPortal(
        <div onClick={() => !poSaving && setPoModalSO(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 880, maxHeight: "90vh", overflowY: "auto", background: isDark ? C.surface : "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, fontFamily: "inherit" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPri }}>Create Purchase Order</h3>
            <p style={{ margin: "6px 0 16px", fontSize: 12.5, color: C.textSec }}>
              Procure for <strong style={{ color: C.textPri }}>{poModalSO.saleOrderNumber}</strong> · {poModalSO.customer}.
              Pick a vendor per line — lines sharing a vendor become one PO (multi-vendor = multiple POs).
            </p>

            {(() => {
              // shared styles for the line editor inputs
              const inp = { boxSizing: "border-box", textAlign: "right", padding: "7px 9px", borderRadius: 8, border: `1px solid ${C.border}`, background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", color: C.textPri, fontSize: 12.5, fontFamily: "'DM Mono', monospace", width: "100%" };
              const lab = { fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: C.textSec, margin: "0 0 3px" };
              const set = (idx, patch) => setPoLines(p => p.map((x, i) => i === idx ? { ...x, ...patch } : x));
              return poLines.map((l, idx) => {
                const c = poLineCalc(l);
                return (
                  <div key={l.soItemId || idx} style={{ padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: isDark ? "rgba(255,255,255,0.02)" : "#fff", marginBottom: 9, opacity: l.check ? 1 : 0.55 }}>
                    {/* top row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: l.check ? 10 : 0 }}>
                      <input type="checkbox" checked={l.check}
                        onChange={e => set(idx, { check: e.target.checked })} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.details || "Item"}</p>
                        <span style={{ fontSize: 10.5, color: C.textSec }}>{l.unit || "unit"}{c.taxRate > 0 ? ` · VAT ${Math.round(c.taxRate * 100)}%` : l.vendorId ? " · zero-rated" : ""}</span>
                      </div>
                      <div style={{ width: 230, flexShrink: 0 }}>
                        <CustomSelect
                          value={l.vendorId}
                          onChange={(v) => set(idx, { vendorId: v })}
                          placeholder="Buy from (vendor)…"
                          minWidth={230}
                          options={poVendors.map(v => ({ value: v._id || v.id, label: v.displayName || v.name || v.companyName || "Vendor" }))}
                        />
                      </div>
                      <span style={{ width: 96, textAlign: "right", flexShrink: 0, fontSize: 13, fontWeight: 700, color: "#3b82f6", fontFamily: "'DM Mono', monospace" }}>{fmtAEDFull(c.amount)}</span>
                    </div>

                    {/* editable fields */}
                    {l.check && (
                      <div style={{ display: "grid", gridTemplateColumns: "70px 100px 110px 100px 90px", gap: 9 }}>
                        <div><p style={lab}>Qty</p>
                          <input type="number" min="0" step="any" value={l.qty} onChange={e => set(idx, { qty: e.target.value })} style={inp} /></div>
                        <div><p style={lab}>Rate</p>
                          <input type="number" min="0" step="any" value={l.rate} onChange={e => set(idx, { rate: e.target.value })} style={inp} /></div>
                        <div><p style={lab}>Discount</p>
                          <div style={{ display: "flex", gap: 4 }}>
                            <input type="number" min="0" step="any" value={l.discount} onChange={e => set(idx, { discount: e.target.value })} style={{ ...inp, width: "60%" }} />
                            <button type="button" onClick={() => set(idx, { discountType: l.discountType === "percentage" ? "fixed" : "percentage" })}
                              style={{ width: "40%", borderRadius: 8, border: `1px solid ${C.border}`, background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", color: C.textPri, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                              {l.discountType === "percentage" ? "%" : "AED"}
                            </button>
                          </div></div>
                        <div><p style={lab}>Freight</p>
                          <input type="number" min="0" step="any" value={l.freight} onChange={e => set(idx, { freight: e.target.value })} style={inp} /></div>
                        <div><p style={lab}>Frt Tax %</p>
                          <input type="number" min="0" step="any" value={l.freightTaxRate} onChange={e => set(idx, { freightTaxRate: e.target.value })} style={inp} /></div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {/* Header charges + live totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <div style={{ width: 320, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", background: isDark ? "rgba(255,255,255,0.02)" : "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, color: C.textSec }}>Subtotal</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.textPri, fontFamily: "'DM Mono', monospace" }}>{fmtAEDFull(poTotals.sub)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, color: C.textSec }}>VAT</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>{fmtAEDFull(poTotals.tax)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: C.textSec }}>Shipping</span>
                  <input type="number" min="0" step="any" value={poShipping} onChange={e => setPoShipping(e.target.value)}
                    style={{ width: 110, boxSizing: "border-box", textAlign: "right", padding: "5px 8px", borderRadius: 7, border: `1px solid ${C.border}`, background: isDark ? "rgba(255,255,255,0.04)" : "#fff", color: C.textPri, fontSize: 12, fontFamily: "'DM Mono', monospace" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: C.textSec }}>Adjustment</span>
                  <input type="number" step="any" value={poAdjustment} onChange={e => setPoAdjustment(e.target.value)}
                    style={{ width: 110, boxSizing: "border-box", textAlign: "right", padding: "5px 8px", borderRadius: 7, border: `1px solid ${C.border}`, background: isDark ? "rgba(255,255,255,0.04)" : "#fff", color: C.textPri, fontSize: 12, fontFamily: "'DM Mono', monospace" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.textPri }}>Grand Total</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#3b82f6", fontFamily: "'DM Mono', monospace" }}>{fmtAEDFull(poTotals.grand)}</span>
                </div>
                <p style={{ fontSize: 10, color: C.textSec, margin: "8px 0 0" }}>Shipping &amp; adjustment apply to each PO created.</p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button onClick={() => setPoModalSO(null)} disabled={poSaving}
                style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={submitCreatePO} disabled={poSaving}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 700, cursor: poSaving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: poSaving ? 0.6 : 1 }}>
                <FaFileInvoiceDollar size={11} /> {poSaving ? "Creating…" : "Create PO(s)"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Salesorders;