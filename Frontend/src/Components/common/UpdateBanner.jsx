import useUpdateCheck from '../../helper/useUpdateCheck'

export default function UpdateBanner() {
  const { update, dismiss } = useUpdateCheck()
  if (!update) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 16px',
      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
      color: '#fff', fontSize: 12.5, fontFamily: "'DM Sans', sans-serif",
      flexShrink: 0,
    }}>
      <span style={{ fontWeight: 700 }}>Update available</span>
      <span style={{ opacity: 0.85 }}>
        Spifora v{update.version} is out{update.notes ? ` — ${update.notes}` : ''}
      </span>
      <a
        href={`https://spifora.com${update.url}`}
        target="_blank"
        rel="noreferrer"
        style={{
          marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', color: '#fff',
          padding: '4px 12px', borderRadius: 999, fontWeight: 700, textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        Download
      </a>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)',
          fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: '0 2px', flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
