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

// Letters are measured with DM Sans (.lt-body/.ltp-body font-family), loaded
// async via a Google Fonts @import — document.fonts.ready alone can resolve
// before that @import has even registered the font (it only awaits fonts
// already requested), so explicitly request the exact weights used first.
// Callers must await this BEFORE injecting content and calling reflow, so
// text is never measured with fallback-font metrics in the first place —
// no "fix it after the swap" race window at all.
export const waitForLetterFonts = () => {
  if (!document.fonts) return Promise.resolve();
  return Promise.all([
    document.fonts.load('400 13.5px "DM Sans"'),
    document.fonts.load('700 13.5px "DM Sans"'),
  ]).catch(() => {}).then(() => document.fonts.ready).catch(() => {});
};

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

// Renders a faint diagonal watermark (e.g. "DRAFT", "WARRANTY") as a full-page
// PNG, once, reused on every page inside buildLetterPdf. Drawn via canvas 2D
// (translate+rotate+centered fillText) rather than jsPDF's own text(angle,
// align:'center') — that combo doesn't reliably center rotated text (it
// anchors the pre-rotation start of the baseline, not the text's true
// center), so the watermark rendered noticeably off toward one corner instead
// of the page's true center. Canvas rotation/centering is exact and also
// matches the on-screen .lt-watermark/.ltp-watermark CSS overlay's look.
const buildWatermarkImage = (text) => {
  const t = (text || '').trim();
  if (!t) return null;
  const scale = 2;
  const cv = document.createElement('canvas');
  cv.width = A4_W * scale;
  cv.height = A4_H * scale;
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);
  ctx.translate(A4_W / 2, A4_H / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#dc2626';
  ctx.font = '800 110px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.toUpperCase(), 0, 0);
  return cv.toDataURL('image/png');
};

/**
 * Render a letter to a multi-page A4 PDF. Captures the content element, slices
 * the tall canvas into per-page bands, and stamps the letterhead on every page.
 * contentEl width should equal the usable content width (A4_W - 2*SIDE_PX), and
 * reflowPageBreaks must already have run on it (its .pg-spacer elements are
 * what decide where a page break actually falls — a blind fixed-height chop
 * of the canvas doesn't know a page's real content can be shorter than
 * usableH, so it used to slice straight through content/spacer boundaries and
 * drift further off with every page). watermark (optional) is drawn
 * diagonally, faded, on every page.
 */
export const buildLetterPdf = async (contentEl, letterheadSrc, pads, watermark) => {
  const topMm = ((pads?.topPad ?? 13) / 100) * A4_H_MM;
  const usableWmm = A4_W_MM - 2 * SIDE_MM;

  // Capture spacer offsets from the live DOM before/independent of the
  // html2canvas snapshot (it doesn't mutate contentEl either way).
  const scale = 2;
  const spacers = Array.from(contentEl.querySelectorAll('.pg-spacer'))
    .map((el) => ({ top: el.offsetTop * scale, bot: (el.offsetTop + el.offsetHeight) * scale }));

  const [canvas, lhData] = await Promise.all([
    html2canvas(contentEl, { scale, useCORS: true, backgroundColor: null }),
    loadImageDataUrl(letterheadSrc),
  ]);

  const pxPerMm = canvas.width / usableWmm; // content canvas px per mm
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const watermarkImg = buildWatermarkImage(watermark);

  let srcY = 0;
  for (let p = 0; p <= spacers.length; p++) {
    const srcEnd = p < spacers.length ? spacers[p].top : canvas.height;
    const srcH = Math.max(0, srcEnd - srcY);

    if (p > 0) pdf.addPage();
    if (lhData) pdf.addImage(lhData, 'PNG', 0, 0, A4_W_MM, A4_H_MM);
    if (watermarkImg) pdf.addImage(watermarkImg, 'PNG', 0, 0, A4_W_MM, A4_H_MM);

    if (srcH > 0) {
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = srcH;
      slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      const sliceHmm = srcH / pxPerMm;
      // PNG (not JPEG) so the transparent content background lets the letterhead show through.
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', SIDE_MM, topMm, usableWmm, sliceHmm);
    }
    srcY = p < spacers.length ? spacers[p].bot : canvas.height;
  }
  return pdf;
};

/**
 * Reserves blank space wherever a block-level child would otherwise spill into
 * the next letterhead's header/footer band. Walks bodyEl's direct children,
 * tracking cumulative height on the "current page"; when a child would cross
 * the usable-height limit, an invisible spacer (height = footer + next header)
 * is inserted before it so normal block flow pushes it down past the band —
 * same trick a word processor uses for page breaks.
 *
 * A <ul>/<ol> that alone is taller than the remaining/whole page is recursed
 * into so the break can land BETWEEN <li> items instead of treating the whole
 * list as one un-splittable block (which used to run the list straight through
 * the footer/header band once it grew past a page — a spacer div dropped
 * directly inside a <ul> between two <li>s still lays out fine; browsers only
 * enforce the li-only content model when parsing HTML text, not for nodes
 * inserted via DOM APIs). Any other element taller than one page still isn't
 * split (acceptable: paragraphs/tables rarely exceed a full page, and
 * splitting a table row mid-way would be worse).
 *
 * Idempotent: always strips any spacers it previously inserted (top-level or
 * nested inside a list) before re-measuring, so it's safe to call again after
 * every edit.
 *
 * Returns the resulting page count (spacer count + 1) — exact, since it's
 * just counting the breaks this same pass just inserted, no separate
 * height-division guess needed.
 */
export function reflowPageBreaks(bodyEl, topPx, botPx) {
  if (!bodyEl) return 1;
  bodyEl.querySelectorAll('.pg-spacer').forEach((el) => el.remove());

  const usableH = A4_H - topPx - botPx; // content height available per page
  const gapH = topPx + botPx;           // band to reserve at each page boundary
  let breaks = 0;

  // extraPx pads the spacer with whatever's left of the CURRENT page (content
  // rarely fills usableH exactly before the next child stops fitting), so
  // every page-cycle sums to exactly usableH + gapH = A4_H. Without this, each
  // page's real height drifts below A4_H, and the drift compounds page after
  // page against the letterhead images (tiled at a fixed k*A4_H) until content
  // visibly runs into the header/footer band a few pages in.
  const makeSpacer = (extraPx) => {
    const spacer = document.createElement('div');
    spacer.className = 'pg-spacer';
    spacer.contentEditable = 'false';
    spacer.style.height = (gapH + extraPx) + 'px';
    spacer.style.pointerEvents = 'none';
    return spacer;
  };

  // offsetHeight is border-box only — it excludes margin-top/bottom, but a
  // child's REAL footprint in normal block flow includes its own margins
  // (.lt-body p / li rely on margin-bottom for spacing). Undercounting by
  // 4-8px per child silently compounds over many paragraphs/list items until
  // the actual overflow point drifts well past where this thinks it is —
  // exactly what let content run into the footer band despite every check
  // technically passing.
  const outerHeight = (el) => {
    const cs = getComputedStyle(el);
    return el.offsetHeight + parseFloat(cs.marginTop || 0) + parseFloat(cs.marginBottom || 0);
  };

  // Walks container's direct children, inserting spacers as needed; returns
  // the cursor position (px used on the current page) after the pass, so a
  // recursive call into a list can hand the running total back to its caller
  // and let content after the list keep accumulating from the right spot.
  const walk = (container, cursorIn) => {
    let cursor = cursorIn;
    let child = container.firstElementChild;
    let guard = 0;
    while (child && guard++ < 5000) {
      const h = outerHeight(child);
      const overflowsPage = cursor > 0 && cursor + h > usableH;
      const tooTallAlone = cursor === 0 && h > usableH;
      const isList = child.tagName === 'UL' || child.tagName === 'OL';
      if ((overflowsPage || tooTallAlone) && isList && child.children.length > 1) {
        cursor = walk(child, cursor); // break inside the list instead of before/after it
        child = child.nextElementSibling;
        continue;
      }
      if (overflowsPage) {
        const leftover = Math.max(0, usableH - cursor);
        container.insertBefore(makeSpacer(leftover), child);
        breaks++;
        cursor = 0; // re-tally from this child, now at the top of the next page
        continue;   // re-evaluate the same child (loop advances via the next iteration)
      }
      cursor += h;
      child = child.nextElementSibling;
    }
    return cursor;
  };

  walk(bodyEl, 0);
  return breaks + 1;
}

// Starter template seeded into a NEW letter — Ref/Date header + org signature.
// Everything is editable; tables/text added on top.
export const seedTemplate = (orgName, letterNumber) => {
  const today = new Date().toLocaleDateString('en-AE', { day: '2-digit', month: 'long', year: 'numeric' });
  const org = (orgName || 'Your Company').toUpperCase();
  return (
    `<div style="text-align:left;font-size:13px"><b>Ref:</b> ${letterNumber || '____'}<br><b>Date:</b> ${today}</div>` +
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
