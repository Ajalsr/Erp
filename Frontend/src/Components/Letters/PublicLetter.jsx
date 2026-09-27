import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FaPrint, FaDownload } from 'react-icons/fa';
import DOMPurify from 'dompurify';
import api from '../../helper/axiosInstance';
import nexusToast from '../../helper/nexusToast';
import { A4_W, A4_H, SIDE_PX, SIDE_MM, A4_W_MM, A4_H_MM, padsPx, buildLetterPdf, reflowPageBreaks, waitForLetterFonts } from './letterShared';

const CONTENT_W = A4_W - 2 * SIDE_PX;

// Public, unauthenticated "view online" page for the emailed letter link — same
// rendering as the in-app LetterPrint.jsx (letterhead, watermark, pagination,
// client-built PDF), sourced from the single combined public/token endpoint
// instead of two authenticated fetches. No Edit/Email — a visitor with only the
// link can view, print, and download, nothing else.
export default function PublicLetter() {
  const { token } = useParams();

  const captureRef = useRef(null);
  const screenBodyRef = useRef(null);
  const pageRef = useRef(null);
  const [letter, setLetter] = useState(null);
  const [lh, setLh] = useState({ image: '', topPad: 13, bottomPad: 8 });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [printPages, setPrintPages] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [res] = await Promise.all([
          api.get(`/api/letters/public/${token}`).catch(() => null),
          waitForLetterFonts(),
        ]);
        if (!alive) return;
        const data = res?.data?.data;
        if (!data) { setNotFound(true); return; }
        const org = data.org || {};
        setLh({ image: org.letterheadImage || '', topPad: org.letterheadTopPad || 13, bottomPad: org.letterheadBottomPad || 8 });
        setLetter(data.letter);
      } catch { setNotFound(true); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [token]);

  const cleanBody = letter ? DOMPurify.sanitize(letter.body || '', { USE_PROFILES: { html: true } }) : '';
  const { top: topPx, bot: botPx } = padsPx(lh);

  useEffect(() => {
    if (loading || !letter) return;
    let pages = 1;
    if (screenBodyRef.current) {
      screenBodyRef.current.innerHTML = cleanBody;
      pages = reflowPageBreaks(screenBodyRef.current, topPx, botPx);

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
      pdf.save(`letter-${letter?.letterNumber || token}.pdf`);
      nexusToast.success('Downloaded!');
    } catch { nexusToast.error('Download failed'); }
  };

  const printLetter = () => window.print();

  const topMm = (lh.topPad / 100) * A4_H_MM;
  const botMm = (lh.bottomPad / 100) * A4_H_MM;

  const btn = { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit' };

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <p style={{ fontSize: 15 }}>Letter not found or this link has expired.</p>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: '#0f172a' }}>
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
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: '#1e3a5f', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Spifora — Letter Portal</span>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{letter?.letterNumber || ''}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={printLetter} disabled={!letter} style={{ ...btn, background: '#fff', color: '#1e3a5f' }}><FaPrint size={11} /> Print</button>
          <button onClick={download} disabled={!letter} style={{ ...btn, background: '#f59e0b', color: '#0a0e1a' }}><FaDownload size={11} /> Download</button>
        </div>
      </div>

      {/* Screen preview */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 16px 60px' }}>
        {loading ? (
          <div style={{ padding: 60, color: '#64748b' }}>Loading…</div>
        ) : !letter ? (
          <div style={{ padding: 60, color: '#64748b' }}>Letter not found.</div>
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

      {/* Print-only DOM — mirrors LetterPrint.jsx exactly */}
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
    </div>
  );
}
