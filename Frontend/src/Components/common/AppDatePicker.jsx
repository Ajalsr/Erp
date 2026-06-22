import { useState, useRef, useEffect } from "react";
import { FaChevronLeft, FaChevronRight, FaCalendarAlt } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";

// Shared custom calendar used across every module. Drop-in for a native
// <input type="date">: `value` and `onChange` use ISO "YYYY-MM-DD" strings,
// except onChange receives the string directly (not an event).
//
//   <AppDatePicker value={date} onChange={setDate} placeholder="Select date" />

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

function MiniCalendar({ value, onChange, T }) {
  const blue    = T.blue    || "#3b82f6";
  const blueDim = T.blueDim || "rgba(59,130,246,0.12)";
  const today = new Date();
  const sel   = value ? new Date(value + "T00:00:00") : null;
  const [view, setView] = useState({ y: (sel || today).getFullYear(), m: (sel || today).getMonth() });

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const pick = (d) => {
    if (!d) return;
    onChange(`${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  };
  const prev = () => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const next = () => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });
  const isSelected = (d) => sel && d && sel.getFullYear() === view.y && sel.getMonth() === view.m && sel.getDate() === d;
  const isToday = (d) => d && today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d;

  return (
    <div style={{ width: 260, padding: "12px 10px", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" onClick={prev} style={{ background: "none", border: "none", cursor: "pointer", color: T.textPri, padding: "2px 6px", borderRadius: 4, fontSize: 13 }}><FaChevronLeft /></button>
        <span style={{ fontWeight: 600, fontSize: 13, color: T.textPri }}>{MONTHS[view.m]} {view.y}</span>
        <button type="button" onClick={next} style={{ background: "none", border: "none", cursor: "pointer", color: T.textPri, padding: "2px 6px", borderRadius: 4, fontSize: 13 }}><FaChevronRight /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: T.textSec, padding: "2px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {cells.map((d, i) => (
          <div key={i} onClick={() => pick(d)} style={{
            textAlign: "center", padding: "6px 0", borderRadius: 6, fontSize: 12, cursor: d ? "pointer" : "default",
            fontWeight: isSelected(d) ? 700 : isToday(d) ? 600 : 400,
            color: isSelected(d) ? "#fff" : isToday(d) ? blue : d ? T.textPri : "transparent",
            background: isSelected(d) ? blue : isToday(d) ? blueDim : "transparent",
            transition: "background 0.15s",
          }}
            onMouseEnter={e => { if (d && !isSelected(d)) e.currentTarget.style.background = blueDim; }}
            onMouseLeave={e => { if (!isSelected(d)) e.currentTarget.style.background = isToday(d) ? blueDim : "transparent"; }}
          >{d || ""}</div>
        ))}
      </div>
    </div>
  );
}

export default function AppDatePicker({ value, onChange, placeholder = "Select date", disabled = false, style = {} }) {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const blue    = T.blue    || "#3b82f6";
  const blueDim = T.blueDim || "rgba(59,130,246,0.12)";
  const inputBg = T.inputBg || T.surface2 || T.surface;
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false); // flip panel when near viewport right edge
  const ref = useRef(null);

  // Decide alignment before opening so the 264px panel never overflows the screen.
  const toggle = () => {
    if (disabled) return;
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setAlignRight(r.left + 270 > window.innerWidth);
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })
    : placeholder;

  return (
    <div ref={ref} style={{ position: "relative", ...style }}>
      <button type="button" onClick={toggle} disabled={disabled} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px",
        borderRadius: 8, border: `1px solid ${open ? blue : T.border}`,
        background: inputBg, color: value ? T.textPri : T.textSec,
        cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: value ? 500 : 400,
        fontFamily: "inherit", opacity: disabled ? 0.6 : 1,
        boxShadow: open ? `0 0 0 3px ${blueDim}` : "none", transition: "all 0.15s",
      }}>
        <FaCalendarAlt style={{ color: blue, fontSize: 13, flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left" }}>{display}</span>
      </button>
      {open && !disabled && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", ...(alignRight ? { right: 0 } : { left: 0 }), zIndex: 1000,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
          <MiniCalendar value={value} onChange={(v) => { onChange(v); setOpen(false); }} T={T} />
        </div>
      )}
    </div>
  );
}
