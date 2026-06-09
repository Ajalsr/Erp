import { useState, useEffect, useMemo, useCallback } from "react";
import { FiPlus, FiPlay, FiPause, FiTrash2, FiEdit2, FiZap, FiX } from "react-icons/fi";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import useAuthStore from "../../store/useAuthStore";
import api from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"];

const todayStr = () => new Date().toISOString().slice(0, 10);

const fmtMoney = (n, ccy = "AED") =>
  `${ccy} ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_STYLE = (status, T) => {
  switch (status) {
    case "active":    return { bg: T.greenDim, c: T.green };
    case "paused":    return { bg: T.amberDim, c: T.amber };
    case "completed": return { bg: T.surface2, c: T.textSec };
    default:          return { bg: T.surface2, c: T.textSec };
  }
};

const blankLine = () => ({ desc: "", qty: 1, unitPrice: 0, taxRate: 5 });

const blankForm = () => ({
  profileName: "",
  customerId: "",
  customerName: "",
  currency: "AED",
  frequency: "monthly",
  interval: 1,
  startDate: todayStr(),
  endDate: "",
  maxCount: 0,
  numberPrefix: `INV-${new Date().getFullYear()}`,
  dueDays: 30,
  autoSend: false,
  lineItems: [blankLine()],
  notesCustomer: "",
});

export default function RecurringInvoices() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const activeOrg = useAuthStore((s) => s.activeOrg);

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/recurring-invoices/");
      setProfiles(r.data?.data || []);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    api.get("/api/customers/getcustomers").then((r) => setCustomers(r.data?.data || [])).catch(() => {});
  }, [loadProfiles]);

  // ── Totals derived from line items (VAT-inclusive grand total) ──
  const totals = useMemo(() => {
    let subtotal = 0, taxTotal = 0;
    for (const li of form.lineItems) {
      const base = Number(li.qty || 0) * Number(li.unitPrice || 0);
      subtotal += base;
      taxTotal += base * (Number(li.taxRate || 0) / 100);
    }
    return { subtotal, discountTotal: 0, taxTotal, grandTotal: subtotal + taxTotal };
  }, [form.lineItems]);

  const openCreate = () => { setForm(blankForm()); setEditingId(null); setShowForm(true); };

  const openEdit = (p) => {
    setForm({
      profileName: p.profileName || "",
      customerId: p.customerId || "",
      customerName: p.billTo?.name || "",
      currency: p.currency || "AED",
      frequency: p.frequency || "monthly",
      interval: p.interval || 1,
      startDate: p.startDate || todayStr(),
      endDate: p.endDate || "",
      maxCount: p.maxCount || 0,
      numberPrefix: p.numberPrefix || `INV-${new Date().getFullYear()}`,
      dueDays: p.dueDays || 0,
      autoSend: !!p.autoSend,
      lineItems: (p.lineItems || []).map((li) => ({
        desc: li.desc || "", qty: li.qty || 1, unitPrice: li.unitPrice || 0, taxRate: li.taxRate ?? 5,
      })) || [blankLine()],
      notesCustomer: p.notes?.customer || "",
    });
    setEditingId(p._id);
    setShowForm(true);
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setLine = (i, k, v) =>
    setForm((f) => ({ ...f, lineItems: f.lineItems.map((li, idx) => (idx === i ? { ...li, [k]: v } : li)) }));

  const addLine = () => setForm((f) => ({ ...f, lineItems: [...f.lineItems, blankLine()] }));
  const removeLine = (i) =>
    setForm((f) => ({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }));

  const onPickCustomer = (id) => {
    const c = customers.find((x) => x._id === id);
    setForm((f) => ({
      ...f,
      customerId: id,
      customerName: c ? (c.customerDisplayName || c.companyName || "") : "",
    }));
  };

  const buildPayload = () => {
    const lineItems = form.lineItems.map((li) => {
      const subtotal = Number(li.qty || 0) * Number(li.unitPrice || 0);
      const taxAmt = subtotal * (Number(li.taxRate || 0) / 100);
      return {
        desc: li.desc,
        qty: Number(li.qty || 0),
        unitPrice: Number(li.unitPrice || 0),
        discount: 0,
        taxRate: Number(li.taxRate || 0),
        subtotal,
        discAmt: 0,
        taxAmt,
        total: subtotal + taxAmt,
      };
    });
    return {
      profileName: form.profileName,
      customerId: form.customerId,
      currency: form.currency,
      frequency: form.frequency,
      interval: Number(form.interval || 1),
      startDate: form.startDate,
      endDate: form.endDate,
      maxCount: Number(form.maxCount || 0),
      numberPrefix: form.numberPrefix,
      dueDays: Number(form.dueDays || 0),
      autoSend: form.autoSend,
      paymentTerms: "",
      from: { name: activeOrg?.name || "", address: "", trn: "" },
      billTo: { name: form.customerName, address: "", trn: "" },
      lineItems,
      totals,
      notes: { customer: form.notesCustomer, internal: "" },
    };
  };

  const validate = () => {
    if (!form.profileName.trim()) return "Profile name is required.";
    if (!form.customerId) return "Select a customer.";
    if (!FREQUENCIES.includes(form.frequency)) return "Pick a frequency.";
    if (!form.startDate) return "Start date is required.";
    if (form.lineItems.length === 0 || form.lineItems.every((li) => !li.desc.trim()))
      return "Add at least one line item.";
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) { nexusToast.error(err); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await api.put(`/api/recurring-invoices/${editingId}`, payload);
        nexusToast.success("Recurring profile updated");
      } else {
        await api.post("/api/recurring-invoices/", payload);
        nexusToast.success("Recurring profile created");
      }
      setShowForm(false);
      loadProfiles();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (p) => {
    const next = p.status === "active" ? "paused" : "active";
    try {
      await api.patch(`/api/recurring-invoices/${p._id}/status`, { status: next });
      nexusToast.success(next === "active" ? "Resumed" : "Paused");
      loadProfiles();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed");
    }
  };

  const runNow = async (p) => {
    try {
      const r = await api.post(`/api/recurring-invoices/${p._id}/run`);
      nexusToast.success(`Invoice ${r.data?.data?.invoiceNumber || ""} generated`);
      loadProfiles();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to generate");
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete recurring profile "${p.profileName}"? Already-generated invoices are kept.`)) return;
    try {
      await api.delete(`/api/recurring-invoices/${p._id}`);
      nexusToast.success("Deleted");
      loadProfiles();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed");
    }
  };

  // ── Styles ──
  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 };
  const label = { fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 4, display: "block" };
  const input = {
    width: "100%", height: 34, padding: "0 10px", borderRadius: 8,
    border: `1px solid ${T.border}`, background: T.inputBg, color: T.textPri,
    fontSize: 13, outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ padding: 20, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: T.textPri, margin: 0 }}>Recurring Invoices</h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: "4px 0 0" }}>
            Templates that auto-generate invoices on a schedule.
          </p>
        </div>
        <button onClick={openCreate} style={{
          display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px",
          background: T.blue, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer",
          fontSize: 13, fontWeight: 600, fontFamily: "inherit",
        }}>
          <FiPlus size={15} /> New Recurring
        </button>
      </div>

      {/* List */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1fr 1fr 0.9fr 0.8fr 1.4fr",
          padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
          fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          <span>Profile</span><span>Customer</span><span>Frequency</span><span>Next Run</span>
          <span>Generated</span><span>Status</span><span style={{ textAlign: "right" }}>Actions</span>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: T.textSec, fontSize: 13 }}>Loading…</div>
        ) : profiles.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textSec }}>
            <FiZap size={26} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ fontSize: 13, margin: 0 }}>No recurring invoices yet.</p>
            <p style={{ fontSize: 12, margin: "4px 0 0", color: T.textMuted }}>Create one to bill customers automatically.</p>
          </div>
        ) : (
          profiles.map((p) => {
            const ss = STATUS_STYLE(p.status, T);
            return (
              <div key={p._id} style={{
                display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1fr 1fr 0.9fr 0.8fr 1.4fr",
                padding: "12px 14px", borderBottom: `1px solid ${T.border2}`, alignItems: "center", fontSize: 13,
              }}>
                <span style={{ color: T.textPri, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.profileName}
                  <span style={{ display: "block", fontSize: 11, color: T.textSec, fontWeight: 400 }}>
                    {fmtMoney(p.totals?.grandTotal, p.currency)}
                  </span>
                </span>
                <span style={{ color: T.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.billTo?.name || "—"}</span>
                <span style={{ color: T.textSec, textTransform: "capitalize" }}>
                  {p.interval > 1 ? `Every ${p.interval} ` : ""}{p.frequency}
                </span>
                <span style={{ color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{p.status === "completed" ? "—" : (p.nextRunDate || "—")}</span>
                <span style={{ color: T.textSec }}>{p.generatedCount || 0}{p.maxCount ? ` / ${p.maxCount}` : ""}</span>
                <span>
                  <span style={{ background: ss.bg, color: ss.c, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, textTransform: "capitalize" }}>{p.status}</span>
                </span>
                <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {p.status !== "completed" && (
                    <>
                      <IconBtn T={T} title="Run now" onClick={() => runNow(p)}><FiZap size={14} /></IconBtn>
                      <IconBtn T={T} title={p.status === "active" ? "Pause" : "Resume"} onClick={() => toggleStatus(p)}>
                        {p.status === "active" ? <FiPause size={14} /> : <FiPlay size={14} />}
                      </IconBtn>
                      <IconBtn T={T} title="Edit" onClick={() => openEdit(p)}><FiEdit2 size={14} /></IconBtn>
                    </>
                  )}
                  <IconBtn T={T} title="Delete" danger onClick={() => remove(p)}><FiTrash2 size={14} /></IconBtn>
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div onMouseDown={() => setShowForm(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
          display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 20px", overflowY: "auto",
        }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 720 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>
                {editingId ? "Edit Recurring Invoice" : "New Recurring Invoice"}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec }}><FiX size={18} /></button>
            </div>

            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={label}>Profile Name</label>
                <input style={input} value={form.profileName} onChange={(e) => setField("profileName", e.target.value)} placeholder="e.g. Acme — monthly retainer" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={label}>Customer</label>
                  <select style={input} value={form.customerId} onChange={(e) => onPickCustomer(e.target.value)}>
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>{c.customerDisplayName || c.companyName || c.customerEmail}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={label}>Currency</label>
                  <input style={input} value={form.currency} onChange={(e) => setField("currency", e.target.value.toUpperCase())} maxLength={3} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={label}>Frequency</label>
                  <select style={input} value={form.frequency} onChange={(e) => setField("frequency", e.target.value)}>
                    {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Every</label>
                  <input style={input} type="number" min={1} value={form.interval} onChange={(e) => setField("interval", e.target.value)} />
                </div>
                <div>
                  <label style={label}>Start Date</label>
                  <input style={input} type="date" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} />
                </div>
                <div>
                  <label style={label}>End Date (optional)</label>
                  <input style={input} type="date" value={form.endDate} onChange={(e) => setField("endDate", e.target.value)} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={label}>Max Invoices (0 = ∞)</label>
                  <input style={input} type="number" min={0} value={form.maxCount} onChange={(e) => setField("maxCount", e.target.value)} />
                </div>
                <div>
                  <label style={label}>Number Prefix</label>
                  <input style={input} value={form.numberPrefix} onChange={(e) => setField("numberPrefix", e.target.value)} />
                </div>
                <div>
                  <label style={label}>Due in (days)</label>
                  <input style={input} type="number" min={0} value={form.dueDays} onChange={(e) => setField("dueDays", e.target.value)} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.textPri, cursor: "pointer" }}>
                    <input type="checkbox" checked={form.autoSend} onChange={(e) => setField("autoSend", e.target.checked)} />
                    Email on generate
                  </label>
                </div>
              </div>

              {/* Line items */}
              <div>
                <label style={label}>Line Items</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.lineItems.map((li, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "2.5fr 0.8fr 1fr 0.8fr 0.4fr", gap: 8, alignItems: "center" }}>
                      <input style={input} placeholder="Description" value={li.desc} onChange={(e) => setLine(i, "desc", e.target.value)} />
                      <input style={input} type="number" placeholder="Qty" value={li.qty} onChange={(e) => setLine(i, "qty", e.target.value)} />
                      <input style={input} type="number" placeholder="Unit price" value={li.unitPrice} onChange={(e) => setLine(i, "unitPrice", e.target.value)} />
                      <input style={input} type="number" placeholder="VAT %" value={li.taxRate} onChange={(e) => setLine(i, "taxRate", e.target.value)} />
                      <button onClick={() => removeLine(i)} disabled={form.lineItems.length === 1}
                        style={{ background: "none", border: "none", cursor: form.lineItems.length === 1 ? "not-allowed" : "pointer", color: T.red, opacity: form.lineItems.length === 1 ? 0.3 : 1 }}>
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addLine} style={{ marginTop: 8, background: "none", border: `1px dashed ${T.border}`, color: T.blue, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  + Add line
                </button>
              </div>

              {/* Totals */}
              <div style={{ background: T.surface2, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                <Row T={T} k="Subtotal" v={fmtMoney(totals.subtotal, form.currency)} />
                <Row T={T} k="VAT" v={fmtMoney(totals.taxTotal, form.currency)} />
                <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 4, paddingTop: 6 }}>
                  <Row T={T} bold k="Grand Total" v={fmtMoney(totals.grandTotal, form.currency)} />
                </div>
              </div>

              <div>
                <label style={label}>Customer Note (optional)</label>
                <textarea style={{ ...input, height: 56, padding: 10, resize: "vertical" }} value={form.notesCustomer} onChange={(e) => setField("notesCustomer", e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 18px", borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => setShowForm(false)} style={{ height: 36, padding: "0 16px", background: "transparent", border: `1px solid ${T.border}`, color: T.textSec, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button onClick={submit} disabled={saving} style={{ height: 36, padding: "0 18px", background: T.blue, color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const IconBtn = ({ children, onClick, title, danger, T }) => (
  <button title={title} onClick={onClick} style={{
    display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
    background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, cursor: "pointer",
    color: danger ? T.red : T.textSec,
  }}>{children}</button>
);

const Row = ({ k, v, bold, T }) => (
  <div style={{ display: "flex", justifyContent: "space-between" }}>
    <span style={{ color: T.textSec, fontWeight: bold ? 700 : 400 }}>{k}</span>
    <span style={{ color: T.textPri, fontWeight: bold ? 700 : 600, fontFamily: "'DM Mono', monospace" }}>{v}</span>
  </div>
);
