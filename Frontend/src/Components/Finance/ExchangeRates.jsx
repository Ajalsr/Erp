import { useState, useEffect, useCallback } from "react";
import { FiPlus, FiRefreshCw } from "react-icons/fi";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import api from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ExchangeRates() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [rates, setRates] = useState([]);
  const [base, setBase] = useState("AED");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fromCurrency: "", rate: "", asOfDate: todayStr() });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/exchange-rates/");
      setRates(r.data?.data || []);
      setBase(r.data?.baseCurrency || "AED");
    } catch {
      setRates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const from = form.fromCurrency.trim().toUpperCase();
    if (!from) { nexusToast.error("Currency code required (e.g. USD)"); return; }
    if (from === base) { nexusToast.error(`${from} is the base currency — no rate needed`); return; }
    if (!(Number(form.rate) > 0)) { nexusToast.error("Rate must be a positive number"); return; }
    setSaving(true);
    try {
      await api.post("/api/exchange-rates/", {
        fromCurrency: from,
        toCurrency: base,
        rate: Number(form.rate),
        asOfDate: form.asOfDate || todayStr(),
      });
      nexusToast.success("Rate saved");
      setForm({ fromCurrency: "", rate: "", asOfDate: todayStr() });
      load();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 };
  const label = { fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 4, display: "block" };
  const input = {
    width: "100%", height: 34, padding: "0 10px", borderRadius: 8,
    border: `1px solid ${T.border}`, background: T.inputBg, color: T.textPri,
    fontSize: 13, outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ padding: 20, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: T.textPri, margin: 0 }}>Exchange Rates</h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: "4px 0 0" }}>
            Foreign currency → base (<b style={{ color: T.textPri }}>{base}</b>). Newest rate on or before a document's date is used.
          </p>
        </div>
        <button onClick={load} title="Refresh" style={{
          display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px",
          background: "transparent", color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 8,
          cursor: "pointer", fontSize: 12, fontWeight: 600,
        }}><FiRefreshCw size={13} /> Refresh</button>
      </div>

      {/* Add rate */}
      <div style={{ ...card, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label style={label}>From Currency</label>
            <input style={{ ...input, textTransform: "uppercase" }} maxLength={3} placeholder="USD"
              value={form.fromCurrency} onChange={(e) => setForm((f) => ({ ...f, fromCurrency: e.target.value.toUpperCase().slice(0, 3) }))} />
          </div>
          <div>
            <label style={label}>1 unit = ? {base}</label>
            <input style={input} type="number" step="0.0001" placeholder="3.6725"
              value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
          </div>
          <div>
            <label style={label}>As of Date</label>
            <input style={input} type="date" value={form.asOfDate} onChange={(e) => setForm((f) => ({ ...f, asOfDate: e.target.value }))} />
          </div>
          <button onClick={add} disabled={saving} style={{
            display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px",
            background: T.blue, color: "#fff", border: "none", borderRadius: 8,
            cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1,
          }}><FiPlus size={15} /> Add</button>
        </div>
      </div>

      {/* List */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1.2fr 1.4fr 1fr",
          padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
          fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          <span>Pair</span><span>Rate</span><span>As Of</span><span>Added</span>
        </div>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: T.textSec, fontSize: 13 }}>Loading…</div>
        ) : rates.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textSec, fontSize: 13 }}>
            No exchange rates yet. Add one to invoice in foreign currencies.
          </div>
        ) : (
          rates.map((r) => (
            <div key={r._id} style={{
              display: "grid", gridTemplateColumns: "1fr 1.2fr 1.4fr 1fr",
              padding: "11px 14px", borderBottom: `1px solid ${T.border2}`, alignItems: "center", fontSize: 13,
            }}>
              <span style={{ color: T.textPri, fontWeight: 600 }}>{r.fromCurrency} → {r.toCurrency}</span>
              <span style={{ color: T.textPri, fontFamily: "'DM Mono', monospace" }}>
                1 {r.fromCurrency} = {Number(r.rate).toLocaleString("en-AE", { maximumFractionDigits: 6 })} {r.toCurrency}
              </span>
              <span style={{ color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{r.asOfDate}</span>
              <span style={{ color: T.textSec }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
