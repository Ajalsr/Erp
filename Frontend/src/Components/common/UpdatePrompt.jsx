import { useEffect, useState } from 'react';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

// Fire this from anywhere (e.g. a Settings "Check for updates" button) to run an
// on-demand check. Unlike the silent launch check, a manual check also tells the
// user when they're already up to date.
export const checkForUpdates = () => window.dispatchEvent(new Event('spifora:check-update'));

// Desktop-only. On launch, asks the Tauri updater whether a newer signed build
// exists (plugins.updater.endpoints → latest.json). If so, shows a prompt to
// download + install in place and relaunch — no manual re-download from the site.
// On the web build (__TAURI_INTERNALS__ absent) this renders nothing.
const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export default function UpdatePrompt() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [update, setUpdate] = useState(null);   // Tauri Update object
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isDesktop) return;
    let alive = true;
    (async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const res = await check();
        if (alive && res) setUpdate(res);
      } catch {
        // offline / endpoint unreachable / no manifest — silently skip
      }
    })();
    return () => { alive = false; };
  }, []);

  // On-demand check (Settings button) — same as launch, but reports "up to date".
  useEffect(() => {
    if (!isDesktop) return;
    const handler = async () => {
      const t = nexusToast.loading ? nexusToast.loading('Checking for updates…') : null;
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const res = await check();
        if (t && nexusToast.dismiss) nexusToast.dismiss(t);
        if (res) setUpdate(res);
        else nexusToast.success("You're on the latest version");
      } catch {
        if (t && nexusToast.dismiss) nexusToast.dismiss(t);
        nexusToast.error('Could not check for updates');
      }
    };
    window.addEventListener('spifora:check-update', handler);
    return () => window.removeEventListener('spifora:check-update', handler);
  }, []);

  if (!update) return null;

  const doUpdate = async () => {
    setBusy(true); setErr('');
    try {
      let total = 0, got = 0;
      await update.downloadAndInstall((e) => {
        if (e.event === 'Started') total = e.data.contentLength || 0;
        else if (e.event === 'Progress') { got += e.data.chunkLength || 0; if (total) setPct(Math.round((got / total) * 100)); }
        else if (e.event === 'Finished') setPct(100);
      });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e) {
      setErr(String(e?.message || e) || 'Update failed');
      setBusy(false);
    }
  };

  const btn = { padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200000, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: 420, maxWidth: '92vw', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <img src="/spifora-icon.png" alt="" style={{ height: 34, width: 34, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>Update available</div>
            <div style={{ fontSize: 12, color: T.textSec }}>Version {update.version} is ready to install</div>
          </div>
        </div>

        {update.body && (
          <div style={{ fontSize: 12.5, color: T.textSec, lineHeight: 1.5, maxHeight: 140, overflowY: 'auto', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 14, whiteSpace: 'pre-wrap' }}>
            {update.body}
          </div>
        )}

        {busy && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 8, borderRadius: 4, background: T.bg, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6', transition: 'width .2s' }} />
            </div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 6 }}>{pct < 100 ? `Downloading… ${pct}%` : 'Installing — the app will restart…'}</div>
          </div>
        )}

        {err && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setUpdate(null)} disabled={busy} style={{ ...btn, background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, opacity: busy ? 0.6 : 1 }}>Later</button>
          <button onClick={doUpdate} disabled={busy} style={{ ...btn, background: '#3b82f6', color: '#fff', opacity: busy ? 0.7 : 1 }}>{busy ? 'Updating…' : 'Update now'}</button>
        </div>
      </div>
    </div>
  );
}
