import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaBold, FaItalic, FaUnderline, FaListUl, FaListOl,
  FaAlignLeft, FaAlignCenter, FaAlignRight, FaTable,
  FaArrowLeft, FaSave, FaPlus, FaMinus,
} from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import useAuthStore from '../../store/useAuthStore';
import useOrganization from '../../helper/useOrganization';
import useGetCustomers from '../../helper/useGetCustomers';
import nexusToast from '../../helper/nexusToast';
import { getLetterTypes, getLetter, createLetter, updateLetter, getNextLetterNumber } from '../../helper/letterApi';
import { A4_W, A4_H, SIDE_PX, padsPx, seedTemplate } from './letterShared';

export default function LetterEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const activeOrg = useAuthStore((s) => s.activeOrg);
  const { getOrganization } = useOrganization();
  const { handleGetCustomers, data: customers } = useGetCustomers();

  const pageRef = useRef(null);
  const bodyRef = useRef(null);
  const savedRange = useRef(null);
  const initialHtml = useRef('');   // body HTML to inject once the editor mounts
  const applied = useRef(false);

  const [types, setTypes] = useState([]);
  const [lh, setLh] = useState({ image: '', topPad: 13, bottomPad: 8 });
  const [type, setType] = useState('warranty');
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [custQuery, setCustQuery] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => { handleGetCustomers(); }, [handleGetCustomers]);
  useEffect(() => { getLetterTypes().then((r) => setTypes(r.data?.data || [])).catch(() => {}); }, []);

  // Load org letterhead + letter (edit) or seed a starter template (new).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const orgId = activeOrg?._id;
        const [org, letterRes, nextNum] = await Promise.all([
          orgId ? getOrganization(orgId, true).catch(() => null) : null,
          isEdit ? getLetter(id).then((r) => r.data?.data).catch(() => null) : null,
          isEdit ? null : getNextLetterNumber().then((r) => r.data?.data?.letterNumber).catch(() => ''),
        ]);
        if (!alive) return;
        if (org) setLh({ image: org.letterheadImage || '', topPad: org.letterheadTopPad || 13, bottomPad: org.letterheadBottomPad || 8 });
        if (letterRes) {
          setType(letterRes.type || 'warranty');
          setTitle(letterRes.title || '');
          setCustomerId(letterRes.customerId || '');
          setCustQuery(letterRes.customerName || '');
          initialHtml.current = letterRes.body || '';
        } else if (!isEdit) {
          initialHtml.current = seedTemplate(activeOrg?.name, nextNum);
        }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
    // getOrganization is recreated each render (unstable) — key on the org id only
    // so this runs once per letter/org, not on every render (was an infinite loop).
  }, [id, isEdit, activeOrg?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const recomputePages = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    setPageCount(Math.max(1, Math.ceil(el.scrollHeight / A4_H)));
  }, []);

  // Inject the loaded/seeded body once the contentEditable is actually mounted
  // (it's gated behind `loading`, so we can't set innerHTML during the fetch).
  useEffect(() => {
    if (loading || applied.current || !bodyRef.current) return;
    bodyRef.current.innerHTML = initialHtml.current;
    applied.current = true;
    recomputePages();
  }, [loading, recomputePages]);

  useEffect(() => {
    const el = pageRef.current;
    if (!el || loading) return;
    const ro = new ResizeObserver(recomputePages);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, recomputePages]);

  const filteredCustomers = custQuery.trim()
    ? (customers || []).filter((c) => (c.customerDisplayName || c.companyName || '').toLowerCase().includes(custQuery.toLowerCase())).slice(0, 8)
    : [];

  // ── Rich-text commands ──────────────────────────────────────────
  const saveSel = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && bodyRef.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0);
  };
  const restoreSel = () => {
    const sel = window.getSelection();
    if (savedRange.current && sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  };
  const exec = (cmd, val = null) => {
    bodyRef.current?.focus();
    restoreSel();
    document.execCommand(cmd, false, val);
    saveSel();
    recomputePages();
  };

  const currentCell = () => {
    const sel = window.getSelection();
    let n = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
    while (n && n.nodeName !== 'TD' && n.nodeName !== 'TH') n = n.parentNode;
    return n && (n.nodeName === 'TD' || n.nodeName === 'TH') ? n : null;
  };

  const insertTable = (rows = 3, cols = 3) => {
    bodyRef.current?.focus();
    restoreSel();
    let html = '<table class="lt-table"><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += '<td><br></td>';
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    saveSel();
    recomputePages();
  };
  const addRow = () => {
    const cell = currentCell(); if (!cell) return nexusToast.error('Click inside a table first');
    const row = cell.parentNode; const n = row.children.length;
    const tr = document.createElement('tr');
    for (let i = 0; i < n; i++) { const td = document.createElement('td'); td.innerHTML = '<br>'; tr.appendChild(td); }
    row.parentNode.insertBefore(tr, row.nextSibling); recomputePages();
  };
  const addCol = () => {
    const cell = currentCell(); if (!cell) return nexusToast.error('Click inside a table first');
    const idx = Array.from(cell.parentNode.children).indexOf(cell);
    const table = cell.closest('table');
    table.querySelectorAll('tr').forEach((tr) => {
      const td = document.createElement('td'); td.innerHTML = '<br>';
      tr.insertBefore(td, tr.children[idx + 1] || null);
    });
  };
  const delRow = () => {
    const cell = currentCell(); if (!cell) return nexusToast.error('Click inside a table first');
    const row = cell.parentNode; const table = cell.closest('table');
    if (table.querySelectorAll('tr').length <= 1) table.remove(); else row.remove(); recomputePages();
  };
  const delCol = () => {
    const cell = currentCell(); if (!cell) return nexusToast.error('Click inside a table first');
    const idx = Array.from(cell.parentNode.children).indexOf(cell);
    const table = cell.closest('table');
    table.querySelectorAll('tr').forEach((tr) => tr.children[idx]?.remove());
    if (!table.querySelector('td')) table.remove();
  };

  const save = useCallback(async () => {
    if (!title.trim()) return nexusToast.error('Title is required');
    const body = bodyRef.current?.innerHTML?.trim() || '';
    if (!body || body === '<br>') return nexusToast.error('Letter body is required');
    setSaving(true);
    try {
      const payload = { type, title: title.trim(), body, customerId };
      if (isEdit) { await updateLetter(id, payload); nexusToast.success('Letter updated'); }
      else { await createLetter(payload); nexusToast.success('Letter created'); }
      navigate('/Letters');
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to save letter');
    } finally { setSaving(false); }
  }, [type, title, customerId, isEdit, id, navigate]);

  const tbBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 7, cursor: 'pointer', color: T.textPri, fontSize: 13 };
  const inputStyle = { padding: '8px 11px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.textPri, fontSize: 13, fontFamily: 'inherit' };
  const { top: topPx, bot: botPx } = padsPx(lh);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: T.textPri }}>
      <style>{`
        .lt-table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .lt-table td, .lt-table th { border: 1px solid #94a3b8; padding: 5px 8px; font-size: 13px; vertical-align: top; min-width: 40px; }
        .lt-body:focus { outline: none; }
        .lt-body { font-size: 13.5px; line-height: 1.6; color: #0f172a; }
        .lt-body p { margin: 0 0 8px; }
      `}</style>

      {/* Toolbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/Letters')} style={{ ...tbBtn, width: 'auto', padding: '0 12px', gap: 7 }}><FaArrowLeft size={11} /> Back</button>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{isEdit ? 'Edit Letter' : 'New Letter'}</div>
          <button onClick={save} disabled={saving} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            <FaSave size={12} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Letter'}
          </button>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
            {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Letter title (e.g. Warranty Certificate)" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <div style={{ position: 'relative' }}>
            <input value={custQuery} onChange={(e) => { setCustQuery(e.target.value); setCustomerId(''); setCustOpen(true); }} onFocus={() => setCustOpen(true)} placeholder="Address to customer (optional)" style={{ ...inputStyle, width: 240 }} />
            {custOpen && filteredCustomers.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
                {filteredCustomers.map((c) => (
                  <div key={c._id} onClick={() => { setCustomerId(c._id); setCustQuery(c.customerDisplayName || c.companyName); setCustOpen(false); }} style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${T.border}` }}>
                    {c.customerDisplayName || c.companyName}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Format row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} style={tbBtn}><FaBold size={11} /></button>
          <button title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} style={tbBtn}><FaItalic size={11} /></button>
          <button title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} style={tbBtn}><FaUnderline size={11} /></button>
          <span style={{ width: 1, height: 22, background: T.border, margin: '0 4px' }} />
          <button title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')} style={tbBtn}><FaListUl size={11} /></button>
          <button title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')} style={tbBtn}><FaListOl size={11} /></button>
          <span style={{ width: 1, height: 22, background: T.border, margin: '0 4px' }} />
          <button title="Align left" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyLeft')} style={tbBtn}><FaAlignLeft size={11} /></button>
          <button title="Align center" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyCenter')} style={tbBtn}><FaAlignCenter size={11} /></button>
          <button title="Align right" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyRight')} style={tbBtn}><FaAlignRight size={11} /></button>
          <span style={{ width: 1, height: 22, background: T.border, margin: '0 4px' }} />
          <select title="Font size" onMouseDown={saveSel} onChange={(e) => { exec('fontSize', e.target.value); e.target.selectedIndex = 0; }} style={{ ...inputStyle, padding: '6px 8px', height: 32 }}>
            <option value="">Size</option>
            <option value="2">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="6">X-Large</option>
          </select>
          <label title="Text color" style={{ ...tbBtn, position: 'relative', overflow: 'hidden' }}>
            A
            <input type="color" onMouseDown={saveSel} onChange={(e) => exec('foreColor', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </label>
          <span style={{ width: 1, height: 22, background: T.border, margin: '0 4px' }} />
          <button title="Insert 3×3 table" onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(3, 3)} style={{ ...tbBtn, width: 'auto', padding: '0 10px', gap: 6 }}><FaTable size={11} /> Table</button>
          <button title="Add row" onMouseDown={(e) => e.preventDefault()} onClick={addRow} style={{ ...tbBtn, width: 'auto', padding: '0 8px', gap: 4, fontSize: 11 }}><FaPlus size={9} /> Row</button>
          <button title="Add column" onMouseDown={(e) => e.preventDefault()} onClick={addCol} style={{ ...tbBtn, width: 'auto', padding: '0 8px', gap: 4, fontSize: 11 }}><FaPlus size={9} /> Col</button>
          <button title="Delete row" onMouseDown={(e) => e.preventDefault()} onClick={delRow} style={{ ...tbBtn, width: 'auto', padding: '0 8px', gap: 4, fontSize: 11 }}><FaMinus size={9} /> Row</button>
          <button title="Delete column" onMouseDown={(e) => e.preventDefault()} onClick={delCol} style={{ ...tbBtn, width: 'auto', padding: '0 8px', gap: 4, fontSize: 11 }}><FaMinus size={9} /> Col</button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 16px 60px' }}>
        {loading ? (
          <div style={{ padding: 60, color: T.textSec }}>Loading…</div>
        ) : (
          <div ref={pageRef} style={{ width: A4_W, minHeight: A4_H, position: 'relative', background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,.25)' }}>
            {/* Letterhead tiled per page */}
            {Array.from({ length: pageCount }, (_, k) => (
              lh.image
                ? <img key={k} src={lh.image} alt="" style={{ position: 'absolute', top: k * A4_H, left: 0, width: A4_W, height: A4_H, objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }} />
                : <div key={k} style={{ position: 'absolute', top: k * A4_H, left: 0, right: 0, height: topPx, borderBottom: '2px solid #1e3a5f', display: 'flex', alignItems: 'center', paddingLeft: SIDE_PX, color: '#94a3b8', fontStyle: 'italic', fontSize: 12 }}>{k === 0 ? 'No letterhead — set one in Organization Settings' : ''}</div>
            ))}
            {/* Page-break guides */}
            {Array.from({ length: Math.max(0, pageCount - 1) }, (_, k) => (
              <div key={`b${k}`} style={{ position: 'absolute', top: (k + 1) * A4_H - 1, left: 0, right: 0, borderTop: '1px dashed #cbd5e1', pointerEvents: 'none' }} />
            ))}
            <div
              ref={bodyRef}
              className="lt-body"
              contentEditable
              suppressContentEditableWarning
              onInput={recomputePages}
              onKeyUp={saveSel}
              onMouseUp={saveSel}
              style={{ position: 'relative', zIndex: 1, padding: `${topPx}px ${SIDE_PX}px ${botPx}px`, minHeight: A4_H - topPx - botPx }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
