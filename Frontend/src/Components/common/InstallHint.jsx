import { useEffect, useState } from 'react';
import useThemeStore, { getTheme } from '../../store/useThemeStore';

// First-visit "install this app" banner for browsers (not the desktop app).
//  • iOS/iPadOS Safari: shows the Share → Add to Home Screen instruction (Apple
//    gives no programmatic install, so it must be manual).
//  • Android / desktop Chrome: captures beforeinstallprompt and offers a
//    one-tap Install button.
// Hidden when already installed (standalone), inside the Tauri desktop app, or
// once dismissed.
const DISMISS_KEY = 'spifora_install_hint_dismissed';
const isDesktopApp = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const isStandalone = () =>
  (typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true));

const isIOSSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const iOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /safari/.test(ua) && !/crios|fxios|edgios|chrome/.test(ua);
  return iOS && safari;
};

export default function InstallHint() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState(null); // Android beforeinstallprompt event

  useEffect(() => {
    if (isDesktopApp || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    if (isIOSSafari()) { setIos(true); setShow(true); return; }

    // Android / Chrome — wait for the install prompt to become available.
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); setShow(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!show) return null;

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setShow(false); };
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    dismiss();
  };

  const ShareIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', margin: '0 2px' }}>
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );

  return (
    <div style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 200000, display: 'flex', justifyContent: 'center', pointerEvents: 'none', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 460, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,.28)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/spifora-icon.png" alt="" style={{ height: 36, width: 36, objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: T.textPri }}>Install Spifora</div>
          {ios ? (
            <div style={{ fontSize: 12, color: T.textSec, lineHeight: 1.45 }}>
              Tap <ShareIcon /> <b>Share</b>, then <b>Add to Home Screen</b>.
            </div>
          ) : (
            <div style={{ fontSize: 12, color: T.textSec }}>Add it to your home screen for a fullscreen app.</div>
          )}
        </div>
        {!ios && (
          <button onClick={install} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#3b82f6', color: '#fff', border: 'none', fontFamily: 'inherit' }}>Install</button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" style={{ flexShrink: 0, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: `1px solid ${T.border}`, color: T.textSec, fontSize: 14, lineHeight: 1 }}>×</button>
      </div>
    </div>
  );
}
