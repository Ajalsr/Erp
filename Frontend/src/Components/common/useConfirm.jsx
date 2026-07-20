import { useState, useCallback, useRef } from 'react';
import useThemeStore, { getTheme } from '../../store/useThemeStore';

// useConfirm — themed replacement for window.confirm(). Promise-based so an
// existing `if (!window.confirm(x)) return;` becomes `if (!(await confirm(x))) return;`
// with no other restructuring.
//
//   const { confirm, ConfirmModal } = useConfirm();
//   ...
//   if (!(await confirm({ message: 'Delete this?', danger: true }))) return;
//   ...
//   return <div>{ConfirmModal}</div>
//
// `confirm` also accepts a plain string as shorthand for `{ message }`.
export default function useConfirm() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const [state, setState] = useState(null); // { title, message, confirmLabel, cancelLabel, danger }
  const resolverRef = useRef(null);

  const confirm = useCallback((opts) => {
    setState(typeof opts === 'string' ? { message: opts } : opts);
    return new Promise((resolve) => { resolverRef.current = resolve; });
  }, []);

  const close = (result) => {
    setState(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  };

  const ConfirmModal = state ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={() => close(false)} />
      <div style={{ position: 'relative', width: 380, maxWidth: '90vw', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
        {state.title && <h3 style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700, color: T.textPri, margin: '0 0 8px' }}>{state.title}</h3>}
        <p style={{ fontSize: 13, color: T.textSec, margin: 0, lineHeight: 1.5 }}>{state.message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={() => close(false)}
            style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${T.border}`, background: 'transparent', color: T.textPri }}>
            {state.cancelLabel || 'Cancel'}
          </button>
          <button onClick={() => close(true)}
            style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: state.danger ? '#dc2f3c' : '#3b82f6', color: '#fff' }}>
            {state.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmModal };
}
