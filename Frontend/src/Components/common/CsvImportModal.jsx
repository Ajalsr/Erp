import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaUpload, FaFileCsv, FaDownload, FaCheckCircle } from 'react-icons/fa';
import toast from 'react-hot-toast';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';

// Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes ("")
// and commas/newlines inside quotes. Returns { headers, rows } of strings.
function parseCsv(text) {
  const rows = [];
  let field = '', row = [], inQuotes = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); field = ''; row = []; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter(r => r.some(c => c.trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  return { headers: nonEmpty[0].map(h => h.trim()), rows: nonEmpty.slice(1) };
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Generic CSV import modal.
 *   fields: [{ key, label, aliases: [], required }]
 *   endpoint: POST url, payloadKey: body key wrapping the rows array
 */
export default function CsvImportModal({ open, onClose, onComplete, title = 'Import CSV', fields, endpoint, payloadKey }) {
  const isDark = useThemeStore(s => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const fileRef = useRef(null);
  const [parsed, setParsed]   = useState(null); // { mapped: [{}], skipped, total }
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult]   = useState(null);

  if (!open) return null;

  const mapHeader = (header) => {
    const h = norm(header);
    return fields.find(f => norm(f.key) === h || (f.aliases || []).some(a => norm(a) === h))?.key || null;
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCsv(ev.target.result);
      if (!headers.length) { toast.error('Empty or unreadable CSV'); return; }
      const colMap = headers.map(mapHeader); // index → field key | null
      if (!colMap.some(Boolean)) { toast.error('No recognised columns. Download the template for the expected headers.'); return; }
      const mapped = [];
      let skipped = 0;
      for (const r of rows) {
        const obj = {};
        colMap.forEach((key, i) => { if (key) obj[key] = (r[i] ?? '').trim(); });
        const hasRequired = fields.filter(f => f.required).every(f => obj[f.key]);
        const hasAny = Object.values(obj).some(v => v);
        if (!hasAny || (fields.some(f => f.required) && !hasRequired)) { skipped++; continue; }
        mapped.push(obj);
      }
      setParsed({ mapped, skipped, total: rows.length, recognised: headers.filter((_, i) => colMap[i]) });
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const header = fields.map(f => f.label).join(',');
    const blob = new Blob([header + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(payloadKey || 'import')}_template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!parsed?.mapped.length) return;
    setImporting(true);
    try {
      const res = await axiosInstance.post(endpoint, { [payloadKey]: parsed.mapped });
      const d = res.data?.data || {};
      setResult(d);
      toast.success(res.data?.message || `Imported ${d.imported ?? 0}`);
      if (d.imported > 0) onComplete?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Import failed');
    } finally { setImporting(false); }
  };

  const reset = () => { setParsed(null); setFileName(''); setResult(null); if (fileRef.current) fileRef.current.value = ''; };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20, fontFamily: "'DM Sans',sans-serif" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: T.textPri, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSec }}><FaTimes size={16} /></button>
        </div>

        {/* Step 1: pick file */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>Upload a .csv file. First row must be column headers.</p>
          <button onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.textSec, fontSize: 11, fontWeight: 600, padding: '6px 10px', cursor: 'pointer' }}>
            <FaDownload size={10} /> Template
          </button>
        </div>

        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFile} />
        <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '20px', border: `2px dashed ${T.border}`, borderRadius: 12, background: 'transparent', color: T.textSec, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {fileName ? <><FaFileCsv size={22} color="#10b981" /><span style={{ fontSize: 13, color: T.textPri, fontWeight: 600 }}>{fileName}</span></> : <><FaUpload size={20} /><span style={{ fontSize: 13 }}>Click to choose CSV file</span></>}
        </button>

        {/* Recognised columns */}
        {parsed && !result && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {parsed.recognised.map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 999, padding: '3px 10px' }}>{h}</span>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: T.surface, border: `1.5px solid ${T.border}`, fontSize: 13 }}>
              <span style={{ color: T.textPri, fontWeight: 600 }}>{parsed.mapped.length} ready to import</span>
              {parsed.skipped > 0 && <span style={{ color: '#f59e0b' }}>{parsed.skipped} skipped (missing required)</span>}
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4', border: '1px solid rgba(16,185,129,0.25)' }}>
              <FaCheckCircle color="#10b981" />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>Imported {result.imported} · Failed {result.failed}</span>
            </div>
            {result.errors?.length > 0 && (
              <div style={{ marginTop: 10, maxHeight: 140, overflowY: 'auto', fontSize: 12, color: '#ef4444' }}>
                {result.errors.slice(0, 20).map((e, i) => <div key={i}>Row {e.row}: {e.message}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          {result ? (
            <button onClick={() => { reset(); onClose(); }} style={{ padding: '9px 22px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button>
          ) : (
            <>
              <button onClick={onClose} style={{ padding: '9px 18px', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 9, color: T.textPri, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={runImport} disabled={!parsed?.mapped.length || importing} style={{ padding: '9px 22px', background: parsed?.mapped.length ? '#10b981' : T.border, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: !parsed?.mapped.length || importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.7 : 1 }}>
                {importing ? 'Importing…' : `Import ${parsed?.mapped.length || 0}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
