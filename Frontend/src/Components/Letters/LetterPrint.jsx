import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaPrint, FaDownload, FaEnvelope, FaEdit, FaTimes } from 'react-icons/fa';
import DOMPurify from 'dompurify';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import useAuthStore from '../../store/useAuthStore';
import useOrganization from '../../helper/useOrganization';
import nexusToast from '../../helper/nexusToast';
import { getLetter, sendLetterEmail } from '../../helper/letterApi';
import { A4_W, A4_H, SIDE_PX, SIDE_MM, A4_W_MM, A4_H_MM, padsPx, buildLetterPdf } from './letterShared';

const CONTENT_W = A4_W - 2 * SIDE_PX;

export default function LetterPrint() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const { getOrganization } = useOrganization();

  const captureRef = useRef(null);
  const pageRef = useRef(null);
  const [letter, setLetter] = useState(null);
  const [lh, setLh] = useState({ image: '', topPad: 13, bottomPad: 8 });
  const [loading, setLoading] = useState(true);
  const [pageCount, setPageCount] = useState(1);

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
        ]);
        if (!alive) return;
        if (org) setLh({ image: org.letterheadImage || '', topPad: org.letterheadTopPad || 13, bottomPad: org.letterheadBottomPad || 8 });
        setLetter(l);
        setEmailTo(l?.customerEmail || '');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
    // getOrganization is unstable (new fn each render) — key on org id to avoid a refetch loop.
  }, [id, activeOrg?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanBody = letter ? DOMPurify.sanitize(letter.body || '', { USE_PROFILES: { html: true } }) : '';
  const { top: topPx, bot: botPx } = padsPx(lh);

  // Page count from the offscreen capture node (usable content width).
  const recompute = useCallback(() => {
    const el = captureRef.current;
    if (!el) return;
    const usableH = A4_H - topPx - botPx;
    setPageCount(Math.max(1, Math.ceil((el.scrollHeight + 1) / usableH)));
  }, [topPx, botPx]);

  useEffect(() => {
    if (loading || !letter) return;
    recompute();
    const el = captureRef.current;
    if (!el) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, letter, cleanBody, recompute]);

  const download = async () => {
    try {
      const pdf = await buildLetterPdf(captureRef.current, lh.image, lh);
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
      const pdf = await buildLetterPdf(captureRef.current, lh.image, lh);
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
        .lt-table td, .lt-table th { border: 1px solid #94a3b8; padding: 5px 8px; font-size: 13px; vertical-align: top; }
        .ltp-body { font-size: 13.5px; line-height: 1.6; color: #0f172a; }
        .ltp-body p { margin: 0 0 8px; }
        .ltp-print { display: none; }
        @media print {
          body * { visibility: hidden; }
          .ltp-print, .ltp-print * { visibility: visible; }
          .ltp-print { display: block; position: absolute; left: 0; top: 0; width: 100%; }
          .ltp-print-lh { position: fixed; top: 0; left: 0; width: ${A4_W_MM}mm; height: ${A4_H_MM}mm; z-index: 0; }
          .ltp-print-content { position: relative; z-index: 1; padding: ${topMm}mm ${SIDE_MM}mm ${botMm}mm; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      {/* Toolbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/Letters')} style={{ ...btn, background: T.surface2, color: T.textPri, border: `1px solid ${T.border}` }}><FaArrowLeft size={11} /> Back</button>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{letter?.letterNumber || 'Letter'}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate(`/Letters/${id}/edit`)} style={{ ...btn, background: T.surface2, color: T.textPri, border: `1px solid ${T.border}` }}><FaEdit size={11} /> Edit</button>
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
            <div className="ltp-body" style={{ position: 'relative', zIndex: 1, padding: `${topPx}px ${SIDE_PX}px ${botPx}px` }} dangerouslySetInnerHTML={{ __html: cleanBody }} />
          </div>
        )}
      </div>

      {/* Offscreen capture node (usable content width, for PDF rasterization) */}
      <div style={{ position: 'fixed', left: -99999, top: 0, width: CONTENT_W, pointerEvents: 'none' }} aria-hidden>
        <div ref={captureRef} className="ltp-body" style={{ width: CONTENT_W }} dangerouslySetInnerHTML={{ __html: cleanBody }} />
      </div>

      {/* Print-only DOM — fixed letterhead repeats each page, content flows */}
      {letter && (
        <div className="ltp-print">
          {lh.image && <img className="ltp-print-lh" src={lh.image} alt="" />}
          <div className="ltp-print-content ltp-body" dangerouslySetInnerHTML={{ __html: cleanBody }} />
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
