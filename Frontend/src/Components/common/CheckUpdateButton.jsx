import { useEffect, useState } from 'react';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import { checkForUpdates } from './UpdatePrompt';

// Desktop-only "App Updates" card for Settings — shows the running version and a
// manual "Check for updates" button. On the web build it renders nothing.
const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export default function CheckUpdateButton() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (!isDesktop) return;
    import('@tauri-apps/api/app').then((m) => m.getVersion()).then(setVersion).catch(() => {});
  }, []);

  if (!isDesktop) return null;

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/spifora-icon.png" alt="" style={{ height: 34, width: 34, objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.textPri }}>App Updates</div>
          <div style={{ fontSize: 12, color: T.textSec }}>Spifora Desktop{version ? ` · v${version}` : ''}</div>
        </div>
      </div>
      <button onClick={checkForUpdates} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#3b82f6', color: '#fff', border: 'none', fontFamily: 'inherit' }}>
        Check for updates
      </button>
    </div>
  );
}
