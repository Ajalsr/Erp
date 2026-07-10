import { useEffect, useState, useCallback, useRef } from 'react';
import { FaFileExcel, FaSpinner, FaCheckSquare, FaRegSquare } from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { getExportTypes, previewExportCount, exportTransactions } from '../../helper/exportApi';
import AppDatePicker from '../common/AppDatePicker';

const fmtMoney = (n) => `AED ${Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const startOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const today = () => new Date().toISOString().slice(0, 10);

export default function TransactionExport() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [types, setTypes] = useState([]); // [{value,label}]
  const [selected, setSelected] = useState(new Set());
  const [startDate, setStartDate] = useState(startOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [preview, setPreview] = useState(null); // {total, byType, amountTotal}
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getExportTypes()
      .then((r) => setTypes(r.data?.data || []))
      .catch(() => nexusToast.error('Failed to load transaction types'));
  }, []);

  const toggleType = (value) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(types.map((t) => t.value)));
  const clearAll = () => setSelected(new Set());

  const validRange = startDate && endDate && endDate >= startDate;
  const canExport = selected.size > 0 && validRange && !exporting;

  // Debounced live preview count as selection/dates change.
  const debounceRef = useRef(null);
  useEffect(() => {
    if (selected.size === 0 || !validRange) { setPreview(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewing(true);
      previewExportCount(Array.from(selected), startDate, endDate)
        .then((r) => setPreview(r.data?.data || null))
        .catch(() => setPreview(null))
        .finally(() => setPreviewing(false));
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, startDate, endDate]);

  const runExport = useCallback(async () => {
    if (!canExport) return;
    setExporting(true);
    try {
      const r = await exportTransactions(Array.from(selected), startDate, endDate);
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_export_${startDate}_to_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      nexusToast.success('Exported!');
    } catch (e) {
      if (e?.response?.status === 404) {
        nexusToast.error('No transactions found for the selected types and date range');
      } else {
        nexusToast.error(e?.response?.data?.message || 'Export failed');
      }
    } finally {
      setExporting(false);
    }
  }, [canExport, selected, startDate, endDate]);

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: 22 };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0 }}>Export Transactions</h1>
        <p style={{ fontSize: 12, color: T.textSec, margin: '5px 0 0' }}>
          Pick transaction types and a date range, download one Excel workbook — one sheet per type plus a summary.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(280px, 1fr) 340px', alignItems: 'start' }}>
        {/* Type checklist */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>Transaction Types</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={selectAll} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Select All</button>
              <button onClick={clearAll} style={{ background: 'none', border: 'none', color: T.textSec, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Clear All</button>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {types.map((t) => {
              const checked = selected.has(t.value);
              const count = preview?.byType?.[t.value];
              return (
                <div
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 10, border: `1.5px solid ${checked ? '#3b82f6' : T.border}`,
                    background: checked ? (isDark ? 'rgba(59,130,246,.1)' : '#eff6ff') : T.bg,
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  {checked ? <FaCheckSquare color="#3b82f6" size={15} /> : <FaRegSquare color={T.textSec} size={15} />}
                  <span style={{ fontSize: 13, color: T.textPri, fontWeight: checked ? 700 : 500, flex: 1 }}>{t.label}</span>
                  {count != null && <span style={{ fontSize: 11, color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{count}</span>}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>From</label>
              <AppDatePicker value={startDate} onChange={setStartDate} placeholder="Start date" style={{ width: 180 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>To</label>
              <AppDatePicker value={endDate} onChange={setEndDate} placeholder="End date" style={{ width: 180 }} />
            </div>
          </div>
          {!validRange && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>End date must be on or after start date.</div>}
        </div>

        {/* Summary / export panel */}
        <div style={{ ...card, position: 'sticky', top: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginBottom: 14 }}>Summary</div>
          {previewing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textSec, fontSize: 13, padding: '8px 0' }}>
              <FaSpinner style={{ animation: 'txSpin .8s linear infinite' }} /> Counting…
            </div>
          ) : preview ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.textPri }}>{preview.total}</div>
              <div style={{ fontSize: 12, color: T.textSec, marginBottom: 10 }}>records matched</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>{fmtMoney(preview.amountTotal)}</div>
              <div style={{ fontSize: 11, color: T.textSec }}>combined amount</div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: T.textSec }}>Select at least one type and a valid date range to see a count.</div>
          )}

          <button
            onClick={runExport}
            disabled={!canExport}
            style={{
              width: '100%', marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 16px', borderRadius: 11, border: 'none',
              background: canExport ? 'linear-gradient(135deg,#16a34a,#15803d)' : T.surface2,
              color: canExport ? '#fff' : T.textSec, fontSize: 13, fontWeight: 700,
              cursor: canExport ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              boxShadow: canExport ? '0 4px 14px rgba(22,163,74,.35)' : 'none',
            }}
          >
            {exporting ? <><FaSpinner style={{ animation: 'txSpin .8s linear infinite' }} /> Exporting…</> : <><FaFileExcel /> Export to Excel</>}
          </button>
        </div>
      </div>
      <style>{`@keyframes txSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
