import { useEffect, useState, useCallback } from 'react';
import { FaCloudUploadAlt, FaDownload, FaUndo, FaSpinner, FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { getBackups, triggerBackup, restoreBackup, downloadBackupExcel } from '../../helper/backupApi';

const fmtBytes = (n) => {
  const v = Number(n || 0);
  if (v >= 1_048_576) return `${(v / 1_048_576).toFixed(2)} MB`;
  if (v >= 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${v} B`;
};
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleString('en-AE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS = {
  success: { label: 'Success', color: '#16a34a', icon: <FaCheckCircle size={11} /> },
  failed:  { label: 'Failed',  color: '#ef4444', icon: <FaTimesCircle size={11} /> },
};

export default function Backups() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ todaySlot: 0, nextScheduledSlot: 0, nextScheduledLabel: '' });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null); // slot number, or null
  const [restoring, setRestoring] = useState(false);
  const [downloadingSlot, setDownloadingSlot] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getBackups()
      .then((r) => {
        const d = r.data?.data || {};
        setRows(Array.isArray(d.backups) ? d.backups : []);
        setMeta({ todaySlot: d.todaySlot ?? 0, nextScheduledSlot: d.nextScheduledSlot ?? 0, nextScheduledLabel: d.nextScheduledLabel || '' });
      })
      .catch(() => nexusToast.error('Failed to load backups'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      await triggerBackup();
      nexusToast.success('Backup completed');
      load();
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Backup failed');
    } finally {
      setRunning(false);
    }
  };

  const downloadNow = async (slot) => {
    setDownloadingSlot(slot);
    try {
      const r = await downloadBackupExcel(slot);
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-slot-${slot}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      nexusToast.success('Downloaded!');
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Download failed');
    } finally {
      setDownloadingSlot(null);
    }
  };

  const confirmRestore = async () => {
    if (restoreTarget == null) return;
    setRestoring(true);
    try {
      const r = await restoreBackup(restoreTarget);
      nexusToast.success(r.data?.message || 'Restore complete');
      setRestoreTarget(null);
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0 }}>Database Backups</h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: '5px 0 0' }}>
            Rolling 30-day rotation · today is slot {meta.todaySlot} · next scheduled run {meta.nextScheduledLabel || '—'}
          </p>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            background: running ? T.surface2 : 'linear-gradient(135deg,#3b82f6,#2563eb)',
            color: running ? T.textSec : '#fff', border: 'none', borderRadius: 11,
            fontSize: 13, fontWeight: 700, cursor: running ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', boxShadow: running ? 'none' : '0 4px 14px rgba(59,130,246,.35)',
          }}
        >
          {running ? <FaSpinner style={{ animation: 'bkSpin .8s linear infinite' }} /> : <FaCloudUploadAlt />}
          {running ? 'Running…' : 'Run Backup Now'}
        </button>
      </div>
      <style>{`@keyframes bkSpin { to { transform: rotate(360deg); } }`}</style>

      {/* Table */}
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {['Slot', 'Uploaded At', 'Size', 'Collections', 'Status', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: T.textSec }}><FaSpinner style={{ animation: 'bkSpin .8s linear infinite' }} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>No backups yet — click "Run Backup Now" to create the first one.</td></tr>
              ) : rows.map((b) => {
                const s = STATUS[b.status] || STATUS.failed;
                return (
                  <tr key={b.slot} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>#{b.slot}</td>
                    <td style={{ padding: '12px 16px', color: T.textPri }}>{fmtDate(b.uploadedAt)}</td>
                    <td style={{ padding: '12px 16px', color: T.textSec }}>{fmtBytes(b.sizeBytes)}</td>
                    <td style={{ padding: '12px 16px', color: T.textSec }}>{b.collections ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: s.color, fontWeight: 700, fontSize: 12 }}>
                        {s.icon}{s.label}
                      </span>
                      {b.status === 'failed' && b.error && (
                        <div style={{ fontSize: 11, color: T.textSec, marginTop: 3, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.error}>{b.error}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => downloadNow(b.slot)}
                          disabled={b.status !== 'success' || downloadingSlot === b.slot}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                            background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8,
                            fontSize: 12, fontWeight: 600, color: b.status === 'success' ? T.textPri : T.textSec,
                            cursor: b.status === 'success' ? 'pointer' : 'not-allowed', opacity: b.status === 'success' ? 1 : 0.5,
                            fontFamily: 'inherit',
                          }}
                        >
                          {downloadingSlot === b.slot
                            ? <><FaSpinner style={{ animation: 'bkSpin .8s linear infinite' }} /> Downloading…</>
                            : <><FaDownload size={11} /> Download</>}
                        </button>
                        <button
                          onClick={() => setRestoreTarget(b.slot)}
                          disabled={b.status !== 'success'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                            background: 'transparent', border: '1.5px solid rgba(239,68,68,.4)', borderRadius: 8,
                            fontSize: 12, fontWeight: 600, color: '#ef4444', cursor: b.status === 'success' ? 'pointer' : 'not-allowed',
                            opacity: b.status === 'success' ? 1 : 0.5, fontFamily: 'inherit',
                          }}
                        ><FaUndo size={11} /> Restore</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore confirmation modal */}
      {restoreTarget != null && (
        <div
          onClick={() => !restoring && setRestoreTarget(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaExclamationTriangle size={16} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>Restore backup slot #{restoreTarget}?</div>
            </div>
            <p style={{ fontSize: 13, color: T.textSec, lineHeight: 1.6, margin: '0 0 20px' }}>
              This <b>replaces every collection</b> in the live database with the contents of this backup.
              All data created or changed after this backup was taken will be <b>permanently lost</b>. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRestoreTarget(null)} disabled={restoring} style={{ padding: '9px 16px', background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={confirmRestore} disabled={restoring} style={{ padding: '9px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: restoring ? 'not-allowed' : 'pointer', opacity: restoring ? 0.7 : 1, fontFamily: 'inherit' }}>
                {restoring ? 'Restoring…' : 'Yes, restore & overwrite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
