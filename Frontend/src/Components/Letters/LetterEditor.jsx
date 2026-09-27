import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  FaBold, FaItalic, FaUnderline, FaListUl, FaListOl,
  FaAlignLeft, FaAlignCenter, FaAlignRight, FaTable, FaStamp,
  FaArrowLeft, FaSave, FaPlus, FaMinus,
} from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import useAuthStore from '../../store/useAuthStore';
import useOrganization from '../../helper/useOrganization';
import useGetCustomers from '../../helper/useGetCustomers';
import axiosInstance from '../../helper/axiosInstance';
import { useUnsavedGuard } from '../../helper/useUnsavedGuard';
import nexusToast from '../../helper/nexusToast';
import { getLetterTypes, getLetter, createLetter, updateLetter, getNextLetterNumber } from '../../helper/letterApi';
import { A4_W, A4_H, SIDE_PX, padsPx, seedTemplate, reflowPageBreaks, waitForLetterFonts } from './letterShared';
import useIsMobile from '../../helper/useIsMobile';

/* ── TypeSelect — custom styled dropdown for letter type ─────────── */
const TypeSelect = ({ value, onChange, options, T, isMobile }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const sel = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', width: isMobile ? '100%' : 220 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        border: `1px solid ${open ? '#3b82f6' : T.border}`, borderRadius: 9,
        background: T.surface, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
        boxShadow: open ? '0 0 0 3px rgba(59,130,246,.12)' : 'none', transition: 'all .15s',
      }}>
        <span style={{ color: sel ? T.textPri : T.textSec, fontWeight: sel ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sel ? sel.label : 'Select type…'}
        </span>
        <svg style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none', color: open ? '#3b82f6' : T.textSec }}
          width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: isMobile ? 0 : 'auto',
          width: isMobile ? 'auto' : 260, zIndex: 50,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
          boxShadow: '0 20px 48px rgba(0,0,0,.2)', overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
        }}>
          {options.map((o) => {
            const active = value === o.value;
            return (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  padding: '10px 13px', cursor: 'pointer', fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#3b82f6' : T.textPri,
                  background: active ? 'rgba(59,130,246,.1)' : 'transparent',
                  borderBottom: `1px solid ${T.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = T.surface2; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                {o.label}
                {active && (
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function LetterEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  // Mounted at both /Letters/* (Sales) and /HR/Letters/* (HR) — scope which
  // letter types the dropdown offers and where Back/Save return to.
  const isHR = location.pathname.startsWith('/HR');
  const base = isHR ? '/HR/Letters' : '/Letters';
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const isMobile = useIsMobile();
  const guard = useUnsavedGuard({ hasDraft: false });

  const activeOrg = useAuthStore((s) => s.activeOrg);
  const { getOrganization } = useOrganization();
  const { handleGetCustomers, data: customers } = useGetCustomers();
  const [employees, setEmployees] = useState([]);

  const pageRef = useRef(null);
  const bodyRef = useRef(null);
  const savedRange = useRef(null);
  const initialHtml = useRef('');   // body HTML to inject once the editor mounts
  const applied = useRef(false);
  const reflowTimer = useRef(null);

  const [types, setTypes] = useState([]);
  const [lh, setLh] = useState({ image: '', topPad: 13, bottomPad: 8 });
  const [stampImage, setStampImage] = useState('');
  const [type, setType] = useState(searchParams.get('type') || (isHR ? 'offer_letter' : 'warranty'));
  const [title, setTitle] = useState('');
  const [watermark, setWatermark] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [custQuery, setCustQuery] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(searchParams.get('employeeId') || '');
  const [empQuery, setEmpQuery] = useState(searchParams.get('employeeName') || '');
  const [empOpen, setEmpOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageCount, setPageCount] = useState(1);

  const typeCategory = types.find((t) => t.value === type)?.category || '';
  // "custom" (category "") is a Sales-side catch-all, not offered under HR.
  const scopedTypes = types.filter((t) => (isHR ? t.category === 'employee' : t.category !== 'employee'));

  useEffect(() => { handleGetCustomers(); }, [handleGetCustomers]);
  useEffect(() => { getLetterTypes().then((r) => setTypes(r.data?.data || [])).catch(() => {}); }, []);
  // New letters only — once types load, snap the default onto this scope's
  // first option if the initial guess isn't actually in it. Edit mode trusts
  // whatever type the loaded letter already has (always in-scope in practice,
  // since /HR/Letters/:id/edit only ever links to employee-category letters).
  useEffect(() => {
    if (isEdit || types.length === 0) return;
    if (!scopedTypes.some((t) => t.value === type)) setType(scopedTypes[0]?.value || type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, isEdit]);
  useEffect(() => {
    axiosInstance.get('/api/employees/', { params: { status: 'active' } })
      .then((r) => setEmployees(r.data?.data?.employees || []))
      .catch(() => {});
  }, []);

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
          waitForLetterFonts(),
        ]);
        if (!alive) return;
        if (org) {
          setLh({ image: org.letterheadImage || '', topPad: org.letterheadTopPad || 13, bottomPad: org.letterheadBottomPad || 8 });
          setStampImage(org.stampImage || '');
        }
        if (letterRes) {
          setType(letterRes.type || 'warranty');
          setTitle(letterRes.title || '');
          setWatermark(letterRes.watermark || '');
          setCustomerId(letterRes.customerId || '');
          setCustQuery(letterRes.customerName || '');
          setEmployeeId(letterRes.employeeId || '');
          setEmpQuery(letterRes.employeeName || '');
          // Sanitize before ever touching the DOM — this is loaded via a raw
          // .innerHTML assignment below (not React's dangerouslySetInnerHTML,
          // but the same XSS surface), and letterRes.body may have been created
          // by any org member (or a direct API call) with no server-side
          // sanitization to rely on.
          initialHtml.current = DOMPurify.sanitize(letterRes.body || '', { USE_PROFILES: { html: true } });
        } else if (!isEdit) {
          initialHtml.current = seedTemplate(activeOrg?.name, nextNum);
        }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
    // getOrganization is recreated each render (unstable) — key on the org id only
    // so this runs once per letter/org, not on every render (was an infinite loop).
  }, [id, isEdit, activeOrg?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-paginate: insert blank spacers wherever content would spill into the
  // next page's letterhead band, and set pageCount from the exact break count
  // reflowPageBreaks just computed. This is the ONLY thing allowed to set
  // pageCount — a naive scrollHeight/A4_H division used to run alongside it
  // (via a ResizeObserver that fired on every DOM mutation, including reflow's
  // own spacer inserts) and would overwrite this exact count with a wrong one,
  // since a page's real height is usableH-of-content + one gapH spacer, not a
  // clean A4_H multiple — letterhead images would then tile at y=k*A4_H
  // positions that didn't match where the spacers actually were, so content
  // (a long bullet list especially) visibly ran through the header/footer
  // bands despite the correct spacers being in the DOM. Debounced on typing
  // (not run on every keystroke) so it doesn't jitter the layout or risk the
  // caret jumping mid-word; selection is saved/restored around the DOM
  // mutation regardless — Range stays valid since we only ever insertBefore
  // an unrelated sibling.
  const reflow = useCallback(() => {
    const { top, bot } = padsPx(lh);
    saveSel();
    const pages = reflowPageBreaks(bodyRef.current, top, bot);
    restoreSel();
    setPageCount(pages);
  }, [lh]);

  const scheduleReflow = useCallback(() => {
    if (reflowTimer.current) clearTimeout(reflowTimer.current);
    reflowTimer.current = setTimeout(reflow, 500);
  }, [reflow]);

  useEffect(() => () => { if (reflowTimer.current) clearTimeout(reflowTimer.current); }, []);

  // Inject the loaded/seeded body once the contentEditable is actually mounted
  // (it's gated behind `loading`, which now also waits on waitForLetterFonts()
  // above — DM Sans is guaranteed ready before this ever measures offsetHeight,
  // so no fallback-font-metrics drift is possible at first paint).
  useEffect(() => {
    if (loading || applied.current || !bodyRef.current) return;
    bodyRef.current.innerHTML = initialHtml.current;
    applied.current = true;
    reflow();
  }, [loading, reflow]);

  // Empty query still shows a pick-list (first 8) — not just once the user
  // starts typing — so the field behaves like a real dropdown, not a
  // search-only box.
  const filteredCustomers = (customers || [])
    .filter((c) => (c.customerDisplayName || c.companyName || '').toLowerCase().includes(custQuery.trim().toLowerCase()))
    .slice(0, 8);
  const filteredEmployees = (employees || [])
    .filter((e) => (e.displayName || `${e.firstName} ${e.lastName}` || '').toLowerCase().includes(empQuery.trim().toLowerCase()))
    .slice(0, 8);

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
    reflow();
  };

  const currentCell = () => {
    const sel = window.getSelection();
    let n = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
    while (n && n.nodeName !== 'TD' && n.nodeName !== 'TH') n = n.parentNode;
    return n && (n.nodeName === 'TD' || n.nodeName === 'TH') ? n : null;
  };

  const insertStamp = () => {
    if (!stampImage) return nexusToast.error('No stamp on file — upload one in Organization Settings first');
    bodyRef.current?.focus();
    restoreSel();
    // contentEditable="false" so the stamp moves/deletes as one unit and never
    // becomes a text-edit target itself; draggable off so a stray drag doesn't
    // rip it out of position.
    const html = `<img src="${stampImage}" alt="Company stamp" draggable="false" contenteditable="false" style="width:110px;height:auto;vertical-align:middle;" />`;
    document.execCommand('insertHTML', false, html);
    saveSel();
    reflow();
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
    reflow();
  };
  const addRow = () => {
    const cell = currentCell(); if (!cell) return nexusToast.error('Click inside a table first');
    const row = cell.parentNode; const n = row.children.length;
    const tr = document.createElement('tr');
    for (let i = 0; i < n; i++) { const td = document.createElement('td'); td.innerHTML = '<br>'; tr.appendChild(td); }
    row.parentNode.insertBefore(tr, row.nextSibling); reflow();
  };
  const addCol = () => {
    const cell = currentCell(); if (!cell) return nexusToast.error('Click inside a table first');
    const idx = Array.from(cell.parentNode.children).indexOf(cell);
    const table = cell.closest('table');
    table.querySelectorAll('tr').forEach((tr) => {
      const td = document.createElement('td'); td.innerHTML = '<br>';
      tr.insertBefore(td, tr.children[idx + 1] || null);
    });
    reflow();
  };
  const delRow = () => {
    const cell = currentCell(); if (!cell) return nexusToast.error('Click inside a table first');
    const row = cell.parentNode; const table = cell.closest('table');
    if (table.querySelectorAll('tr').length <= 1) table.remove(); else row.remove(); reflow();
  };
  const delCol = () => {
    const cell = currentCell(); if (!cell) return nexusToast.error('Click inside a table first');
    const idx = Array.from(cell.parentNode.children).indexOf(cell);
    const table = cell.closest('table');
    table.querySelectorAll('tr').forEach((tr) => tr.children[idx]?.remove());
    if (!table.querySelector('td')) table.remove();
    reflow();
  };

  const save = useCallback(async () => {
    if (!title.trim()) return nexusToast.error('Title is required');
    // Page-break spacers are editor-only presentation (recomputed fresh on
    // every load from the current letterhead padding) — never persist them.
    const clone = bodyRef.current?.cloneNode(true);
    clone?.querySelectorAll('.pg-spacer').forEach((el) => el.remove());
    // Sanitize what actually gets persisted too — typing itself can't inject
    // markup, but a paste (e.g. from a crafted webpage) can carry raw HTML
    // with event-handler attributes straight into the contentEditable DOM.
    const body = DOMPurify.sanitize(clone?.innerHTML?.trim() || '', { USE_PROFILES: { html: true } });
    if (!body || body === '<br>') return nexusToast.error('Letter body is required');
    setSaving(true);
    try {
      const payload = {
        type, title: title.trim(), body, watermark: watermark.trim(),
        customerId: typeCategory === 'employee' ? '' : customerId,
        employeeId: typeCategory === 'employee' ? employeeId : '',
      };
      if (isEdit) { await updateLetter(id, payload); nexusToast.success('Letter updated'); }
      else { await createLetter(payload); nexusToast.success('Letter created'); }
      navigate(base);
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to save letter');
    } finally { setSaving(false); }
  }, [type, title, watermark, customerId, employeeId, typeCategory, isEdit, id, navigate, base]);

  const tbBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 7, cursor: 'pointer', color: T.textPri, fontSize: 13 };
  const inputStyle = { padding: '8px 11px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.textPri, fontSize: 13, fontFamily: 'inherit' };
  const { top: topPx, bot: botPx } = padsPx(lh);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: T.textPri }}>
      <style>{`
        .lt-table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .lt-table td, .lt-table th { border: 2px solid #000; padding: 5px 8px; font-size: 13px; vertical-align: top; min-width: 40px; }
        .lt-body:focus { outline: none; }
        .lt-body { font-size: 13.5px; line-height: 1.6; color: #0f172a; }
        .lt-body p { margin: 0 0 8px; }
        .lt-body ul, .lt-body ol { margin: 0 0 8px; padding-left: 24px; }
        .lt-body ul { list-style: disc; }
        .lt-body ol { list-style: decimal; }
        .lt-body li { margin: 0 0 4px; }
        .lt-watermark { position: absolute; left: 0; width: ${A4_W}px; height: ${A4_H}px; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; overflow: hidden; }
        .lt-watermark span { font-size: 110px; font-weight: 800; color: #dc2626; opacity: 0.12; transform: rotate(-45deg); white-space: nowrap; text-transform: uppercase; }
      `}</style>

      {/* Toolbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: isMobile ? '10px 12px' : '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'wrap' }}>
          <button onClick={() => guard.leave(() => navigate(base))} style={{ ...tbBtn, width: 'auto', padding: '0 12px', gap: 7 }}><FaArrowLeft size={11} /> {!isMobile && 'Back'}</button>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800 }}>{isEdit ? 'Edit Letter' : isHR ? 'New HR Letter' : 'New Letter'}</div>
          <button onClick={save} disabled={saving} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '9px 14px' : '9px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            <FaSave size={12} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Letter'}
          </button>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <TypeSelect
            value={type}
            onChange={setType}
            options={scopedTypes}
            T={T}
            isMobile={isMobile}
          />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Letter title (e.g. Warranty Certificate)" style={{ ...inputStyle, flex: 1, minWidth: isMobile ? '100%' : 200 }} />
          {typeCategory === 'employee' ? (
            <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
              <input value={empQuery} onChange={(e) => { setEmpQuery(e.target.value); setEmployeeId(''); setEmpOpen(true); }} onFocus={() => setEmpOpen(true)} placeholder="Address to employee" style={{ ...inputStyle, width: isMobile ? '100%' : 240, boxSizing: 'border-box' }} />
              {empOpen && filteredEmployees.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
                  {filteredEmployees.map((e) => (
                    <div key={e._id} onClick={() => { setEmployeeId(e._id); setEmpQuery(e.displayName || `${e.firstName} ${e.lastName}`); setEmpOpen(false); }} style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${T.border}` }}>
                      {e.displayName || `${e.firstName} ${e.lastName}`} <span style={{ color: T.textSec, fontSize: 11 }}>· {e.employeeCode}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
              <input value={custQuery} onChange={(e) => { setCustQuery(e.target.value); setCustomerId(''); setCustOpen(true); }} onFocus={() => setCustOpen(true)} placeholder="Address to customer (optional)" style={{ ...inputStyle, width: isMobile ? '100%' : 240, boxSizing: 'border-box' }} />
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
          )}
          <input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="Watermark (optional, e.g. DRAFT)" style={{ ...inputStyle, width: isMobile ? '100%' : 200, boxSizing: 'border-box' }} />
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
          <button title={stampImage ? 'Insert company stamp' : 'No stamp on file — upload one in Organization Settings'} onMouseDown={(e) => e.preventDefault()} onClick={insertStamp} disabled={!stampImage} style={{ ...tbBtn, width: 'auto', padding: '0 10px', gap: 6, opacity: stampImage ? 1 : 0.5, cursor: stampImage ? 'pointer' : 'not-allowed' }}><FaStamp size={11} /> Stamp</button>
          <button title="Add row" onMouseDown={(e) => e.preventDefault()} onClick={addRow} style={{ ...tbBtn, width: 'auto', padding: '0 8px', gap: 4, fontSize: 11 }}><FaPlus size={9} /> Row</button>
          <button title="Add column" onMouseDown={(e) => e.preventDefault()} onClick={addCol} style={{ ...tbBtn, width: 'auto', padding: '0 8px', gap: 4, fontSize: 11 }}><FaPlus size={9} /> Col</button>
          <button title="Delete row" onMouseDown={(e) => e.preventDefault()} onClick={delRow} style={{ ...tbBtn, width: 'auto', padding: '0 8px', gap: 4, fontSize: 11 }}><FaMinus size={9} /> Row</button>
          <button title="Delete column" onMouseDown={(e) => e.preventDefault()} onClick={delCol} style={{ ...tbBtn, width: 'auto', padding: '0 8px', gap: 4, fontSize: 11 }}><FaMinus size={9} /> Col</button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ overflowX: 'auto', padding: isMobile ? '16px 0 40px' : 0 }}>
      <div style={{ display: 'flex', justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? '0 16px' : '28px 16px 60px' }}>
        {loading ? (
          <div style={{ padding: 60, color: T.textSec }}>Loading…</div>
        ) : (
          <div ref={pageRef} style={{ width: A4_W, minHeight: A4_H, flexShrink: 0, position: 'relative', background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,.25)' }}>
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
            {watermark.trim() && Array.from({ length: pageCount }, (_, k) => (
              <div key={`w${k}`} className="lt-watermark" style={{ top: k * A4_H }}><span>{watermark}</span></div>
            ))}
            <div
              ref={bodyRef}
              className="lt-body"
              contentEditable
              suppressContentEditableWarning
              onInput={scheduleReflow}
              onKeyUp={saveSel}
              onMouseUp={saveSel}
              style={{ position: 'relative', zIndex: 1, padding: `${topPx}px ${SIDE_PX}px ${botPx}px`, minHeight: A4_H - topPx - botPx }}
            />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
