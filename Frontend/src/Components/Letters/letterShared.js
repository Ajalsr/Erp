import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// A4 at 96dpi (px) and in mm
export const A4_W = 794;
export const A4_H = 1123;
export const A4_W_MM = 210;
export const A4_H_MM = 297;
export const SIDE_PX = 64;                 // left/right content margin in editor px
export const SIDE_MM = (SIDE_PX / A4_W) * A4_W_MM;

export const padsPx = (pads) => ({
  top: ((pads?.topPad ?? 13) / 100) * A4_H,
  bot: ((pads?.bottomPad ?? 8) / 100) * A4_H,
});

// Load any image src (URL or data-URL) to a PNG data-URL for jsPDF.addImage.
export const loadImageDataUrl = (src) => new Promise((resolve) => {
  if (!src) return resolve(null);
  if (src.startsWith('data:')) return resolve(src);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext('2d').drawImage(img, 0, 0);
      resolve(cv.toDataURL('image/png'));
    } catch { resolve(null); } // tainted (CORS) — skip letterhead in PDF
  };
  img.onerror = () => resolve(null);
  img.src = src;
});

/**
 * Render a letter to a multi-page A4 PDF. Captures the content element, slices
 * the tall canvas into per-page bands that fit between the letterhead's header
 * (topPad) and footer (bottomPad), and stamps the letterhead on every page.
 * contentEl width should equal the usable content width (A4_W - 2*SIDE_PX).
 */
export const buildLetterPdf = async (contentEl, letterheadSrc, pads) => {
  const topMm = ((pads?.topPad ?? 13) / 100) * A4_H_MM;
  const botMm = ((pads?.bottomPad ?? 8) / 100) * A4_H_MM;
  const usableWmm = A4_W_MM - 2 * SIDE_MM;
  const usableHmm = A4_H_MM - topMm - botMm;

  const [canvas, lhData] = await Promise.all([
    html2canvas(contentEl, { scale: 2, useCORS: true, backgroundColor: null }),
    loadImageDataUrl(letterheadSrc),
  ]);

  const pxPerMm = canvas.width / usableWmm;        // content canvas px per mm
  const sliceHpx = Math.floor(usableHmm * pxPerMm);
  const pages = Math.max(1, Math.ceil(canvas.height / sliceHpx));

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

  for (let p = 0; p < pages; p++) {
    if (p > 0) pdf.addPage();
    if (lhData) pdf.addImage(lhData, 'PNG', 0, 0, A4_W_MM, A4_H_MM);

    const srcY = p * sliceHpx;
    const srcH = Math.min(sliceHpx, canvas.height - srcY);
    if (srcH <= 0) continue;

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = srcH;
    slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    const sliceHmm = srcH / pxPerMm;
    // PNG (not JPEG) so the transparent content background lets the letterhead show through.
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', SIDE_MM, topMm, usableWmm, sliceHmm);
  }
  return pdf;
};

// Starter template seeded into a NEW letter — Ref/Date header + org signature.
// Everything is editable; tables/text added on top.
export const seedTemplate = (orgName, letterNumber) => {
  const today = new Date().toLocaleDateString('en-AE', { day: '2-digit', month: 'long', year: 'numeric' });
  const org = (orgName || 'Your Company').toUpperCase();
  return (
    `<div style="text-align:right;font-size:13px"><b>Ref:</b> ${letterNumber || '____'}<br><b>Date:</b> ${today}</div>` +
    `<p><br></p>` +
    `<p>To,</p>` +
    `<p><br></p>` +
    `<p><br></p>` +
    `<p><br></p>` +
    `<p>For <b>${org}</b></p>` +
    `<p><br></p>` +
    `<p style="border-top:1px solid #94a3b8;width:180px;padding-top:3px">Authorized Signatory</p>`
  );
};
