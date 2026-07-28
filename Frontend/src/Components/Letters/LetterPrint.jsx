import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FaArrowLeft, FaPrint, FaDownload, FaEnvelope, FaEdit, FaTimes } from 'react-icons/fa';
import DOMPurify from 'dompurify';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import useAuthStore from '../../store/useAuthStore';
import useOrganization from '../../helper/useOrganization';
import nexusToast from '../../helper/nexusToast';
import { getLetter, sendLetterEmail } from '../../helper/letterApi';
import { A4_W, A4_H, SIDE_PX, SIDE_MM, A4_W_MM, A4_H_MM, padsPx, buildLetterPdf, reflowPageBreaks, waitForLetterFonts } from './letterShared';

const CONTENT_W = A4_W - 2 * SIDE_PX;

export default function LetterPrint() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const base = location.pathname.startsWith('/HR') ? '/HR/Letters' : '/Letters';
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const { getOrganization } = useOrganization();

  const captureRef = useRef(null);
  const screenBodyRef = useRef(null);
  const pageRef = useRef(null);
  const [letter, setLetter] = useState(null);
  const [lh, setLh] = useState({ image: '', topPad: 13, bottomPad: 8 });
  const [loading, setLoading] = useState(true);
  const [pageCount, setPageCount] = useState(1);
  const [printPages, setPrintPages] = useState([]); // one HTML string per real page, split at .pg-spacer boundaries

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const orgId = activeOrg?._id;
        const [org, l] = await Promise.all([
          orgId ? getOrganization(orgId, true).catch(() => null) : null,
          getLetter(id).then((r) => r.data?.data).catch(() => null),
          waitForLetterFonts(),
        ]);
        if (!alive) return;
        if (org) setLh({ image: org.letterheadImage || '', topPad: org.letterheadTopPad || 13, bottomPad: org.letterheadBottomPad || 8 });
        setLetter(l);
        setEmailTo(l?.customerEmail || l?.employeeEmail || '');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
    // getOrganization is unstable (new fn each render) — key on org id to avoid a refetch loop.
  }, [id, activeOrg?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanBody = letter ? DOMPurify.sanitize(letter.body || '', { USE_PROFILES: { html: true } }) : '';
  const { top: topPx, bot: botPx } = padsPx(lh);

  // Set the sanitized HTML imperatively (not dangerouslySetInnerHTML) so we can
  // then insert page-break spacers as real DOM children without React fighting
  // us on the next render — same reflowPageBreaks used by the editor, applied
  // to both the on-screen preview AND the offscreen capture node that feeds
  // the actual downloaded/emailed PDF (buildLetterPdf now slices at each
  // spacer's actual offset, so it always matches wherever reflow put them).
  // loading also gates on waitForLetterFonts() above, so DM Sans is guaranteed
  // ready before this ever measures offsetHeight — no fallback-font drift.
  useEffect(() => {
    if (loading || !letter) return;
    let pages = 1;
    if (screenBodyRef.current) {
      screenBodyRef.current.innerHTML = cleanBody;
      pages = reflowPageBreaks(screenBodyRef.current, topPx, botPx);

      // Split the now-reflowed content at each .pg-spacer boundary into one
      // HTML bucket per real page — printPages below renders these as explicit
      // per-page blocks with a forced break between them, so print doesn't
      // depend on the browser's own pagination guessing where a page ends.
      const buckets = [];
      let current = document.createElement('div');
      Array.from(screenBodyRef.current.children).forEach((child) => {
        if (child.classList.contains('pg-spacer')) {
          buckets.push(current);
          current = document.createElement('div');
        } else {
          current.appendChild(child.cloneNode(true));
        }
      });
      buckets.push(current);
      setPrintPages(buckets.map((b) => b.innerHTML));
    }
    if (captureRef.current) {
      captureRef.current.innerHTML = cleanBody;
      reflowPageBreaks(captureRef.current, topPx, botPx);
    }
    setPageCount(pages);
  }, [loading, letter, cleanBody, topPx, botPx]);

  const download = async () => {
    try {
      const pdf = await buildLetterPdf(captureRef.current, lh.image, lh, letter?.watermark);
      pdf.save(`letter-${letter?.letterNumber || id}.pdf`);
      nexusToast.success('Downloaded!');
    } catch { nexusToast.error('Download failed'); }
  };

  const printLetter = () => window.print();

  const doSendEmail = async () => {
    const to = emailTo.split(',').map((s) => s.trim()).filter(Boolean);
    if (to.length === 0) return nexusToast.error('Enter at least one email');
    setSending(true);
    try {
      const pdf = await buildLetterPdf(captureRef.current, lh.image, lh, letter?.watermark);
      const base64 = pdf.output('datauristring').split(',')[1];
      await sendLetterEmail(letter.id, to, emailMsg, base64);
      nexusToast.success('Letter emailed');
      setEmailOpen(false);
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to send email');
    } finally { setSending(false); }
  };

  const topMm = (lh.topPad / 100) * A4_H_MM;
  const botMm = (lh.bottomPad / 100) * A4_H_MM;

  const btn = { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: T.textPri }}>
      <style>{`
        .lt-table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .lt-table td, .lt-table th { border: 2px solid #000; padding: 5px 8px; font-size: 13px; vertical-align: top; }
        .ltp-body { font-size: 13.5px; line-height: 1.6; color: #0f172a; }
        .ltp-body p { margin: 0 0 8px; }
        .ltp-body ul, .ltp-body ol { margin: 0 0 8px; padding-left: 24px; }
        .ltp-body ul { list-style: disc; }
        .ltp-body ol { list-style: decimal; }
        .ltp-body li { margin: 0 0 4px; }
        .ltp-print { display: none; }
        .ltp-watermark { position: absolute; left: 0; width: ${A4_W}px; height: ${A4_H}px; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; overflow: hidden; }
        .ltp-watermark span { font-size: 110px; font-weight: 800; color: #dc2626; opacity: 0.12; transform: rotate(-45deg); white-space: nowrap; text-transform: uppercase; }
        @media print {
          body * { visibility: hidden; }
          .ltp-print, .ltp-print * { visibility: visible; }
          .ltp-print { display: block; position: absolute; left: 0; top: 0; width: 100%; }
          .ltp-print-page { position: relative; width: ${A4_W_MM}mm; min-height: ${A4_H_MM}mm; padding: ${topMm}mm ${SIDE_MM}mm ${botMm}mm; overflow: hidden; }
          .ltp-print-page + .ltp-print-page { break-before: page; }
          .ltp-print-lh { position: absolute; top: 0; left: 0; width: ${A4_W_MM}mm; height: ${A4_H_MM}mm; z-index: 0; }
          .ltp-print-content { position: relative; z-index: 1; }
          .ltp-print-watermark { position: absolute; top: 0; left: 0; width: ${A4_W_MM}mm; height: ${A4_H_MM}mm; z-index: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; overflow: hidden; }
          .ltp-print-watermark span { font-size: 90px; font-weight: 800; color: #dc2626; opacity: 0.12; transform: rotate(-45deg); white-space: nowrap; text-transform: uppercase; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      {/* Toolbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(base)} style={{ ...btn, background: T.surface2, color: T.textPri, border: `1px solid ${T.border}` }}><FaArrowLeft size={11} /> Back</button>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{letter?.letterNumber || 'Letter'}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate(`${base}/${id}/edit`)} style={{ ...btn, background: T.surface2, color: T.textPri, border: `1px solid ${T.border}` }}><FaEdit size={11} /> Edit</button>
          <button onClick={printLetter} disabled={!letter} style={{ ...btn, background: '#fff', color: '#1e3a5f' }}><FaPrint size={11} /> Print</button>
          <button onClick={download} disabled={!letter} style={{ ...btn, background: '#f59e0b', color: '#0a0e1a' }}><FaDownload size={11} /> Download</button>
          <button onClick={() => setEmailOpen(true)} disabled={!letter} style={{ ...btn, background: '#3b82f6', color: '#fff' }}><FaEnvelope size={11} /> Email</button>
        </div>
      </div>

      {/* Screen preview — tiled letterhead + continuous content */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 16px 60px' }}>
        {loading ? (
          <div style={{ padding: 60, color: T.textSec }}>Loading…</div>
        ) : !letter ? (
          <div style={{ padding: 60, color: T.textSec }}>Letter not found.</div>
        ) : (
          <div ref={pageRef} style={{ width: A4_W, minHeight: A4_H, position: 'relative', background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,.25)' }}>
            {Array.from({ length: pageCount }, (_, k) => (
              lh.image
                ? <img key={k} src={lh.image} alt="" style={{ position: 'absolute', top: k * A4_H, left: 0, width: A4_W, height: A4_H, objectFit: 'cover', pointerEvents: 'none' }} />
                : <div key={k} style={{ position: 'absolute', top: k * A4_H, left: 0, right: 0, height: topPx, borderBottom: '2px solid #1e3a5f' }} />
            ))}
            {Array.from({ length: Math.max(0, pageCount - 1) }, (_, k) => (
              <div key={`b${k}`} style={{ position: 'absolute', top: (k + 1) * A4_H - 1, left: 0, right: 0, borderTop: '1px dashed #cbd5e1', pointerEvents: 'none' }} />
            ))}
            {letter?.watermark && Array.from({ length: pageCount }, (_, k) => (
              <div key={`w${k}`} className="ltp-watermark" style={{ top: k * A4_H }}><span>{letter.watermark}</span></div>
            ))}
            <div ref={screenBodyRef} className="ltp-body" style={{ position: 'relative', zIndex: 1, padding: `${topPx}px ${SIDE_PX}px ${botPx}px` }} />
          </div>
        )}
      </div>

      {/* Offscreen capture node (usable content width, for PDF rasterization) */}
      <div style={{ position: 'fixed', left: -99999, top: 0, width: CONTENT_W, pointerEvents: 'none' }} aria-hidden>
        <div ref={captureRef} className="ltp-body" style={{ width: CONTENT_W }} />
      </div>

      {/* Print-only DOM — one explicit page block per printPages entry (split at
          the same .pg-spacer boundaries reflowPageBreaks already computed),
          each with its own letterhead/watermark and a forced break before it.
          Deterministic — doesn't rely on the browser's own pagination to guess
          where a page ends. */}
      {letter && (
        <div className="ltp-print">
          {printPages.map((html, k) => (
            <div key={k} className="ltp-print-page">
              {lh.image && <img className="ltp-print-lh" src={lh.image} alt="" />}
              {letter.watermark && <div className="ltp-print-watermark"><span>{letter.watermark}</span></div>}
              <div className="ltp-print-content ltp-body" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          ))}
        </div>
      )}

      {/* Email modal */}
      {emailOpen && (
        <div onClick={() => !sending && setEmailOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Email {letter?.letterNumber}</div>
              <span onClick={() => setEmailOpen(false)} style={{ cursor: 'pointer', color: T.textSec }}><FaTimes /></span>
            </div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>To (comma-separated)</label>
            <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="customer@example.com" style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, color: T.textPri, fontSize: 13, width: '100%', marginBottom: 12, fontFamily: 'inherit' }} />
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>Message (optional)</label>
            <textarea value={emailMsg} onChange={(e) => setEmailMsg(e.target.value)} rows={3} style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, color: T.textPri, fontSize: 13, width: '100%', marginBottom: 18, resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEmailOpen(false)} disabled={sending} style={{ ...btn, background: T.surface2, color: T.textSec, border: `1px solid ${T.border}` }}>Cancel</button>
              <button onClick={doSendEmail} disabled={sending} style={{ ...btn, background: '#3b82f6', color: '#fff', opacity: sending ? 0.7 : 1 }}>{sending ? 'Sending…' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
