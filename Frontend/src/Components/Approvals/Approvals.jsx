import { useState, useEffect, useCallback } from 'react'
import { FaCheck, FaTimes, FaInbox } from 'react-icons/fa'
import useThemeStore, { getTheme } from '../../store/useThemeStore'
import axiosInstance from '../../helper/axiosInstance'
import nexusToast from '../../helper/nexusToast'
import useRealtime from '../../helper/useRealtime'

const fmtAED = (n) => `AED ${Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const DOC_LABEL = {
  po:             { label: 'Purchase Order',   color: '#8b5cf6' },
  bill:           { label: 'Bill',             color: '#f59e0b' },
  vendor_payment: { label: 'Vendor Payment',   color: '#ef4444' },
  payment:        { label: 'Customer Payment', color: '#10b981' },
  invoice:        { label: 'Invoice',          color: '#3b82f6' },
}

export default function Approvals() {
  const isDark = useThemeStore((s) => s.isDark)
  const T = getTheme(isDark)

  const [reqs, setReqs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('pending') // pending | all
  const [busy, setBusy]       = useState(null)       // id being approved/rejected

  const load = useCallback(() => {
    setLoading(true)
    axiosInstance.get(`/api/approvals/?status=${filter}`)
      .then(r => setReqs(r.data?.data?.requests || []))
      .catch(() => setReqs([]))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])
  useRealtime(['approvals_updated'], load)

  const approve = async (req) => {
    setBusy(req._id)
    try {
      const r = await axiosInstance.post(`/api/approvals/${req._id}/approve`)
      nexusToast.success(r.data?.message || 'Approved')
      load()
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to approve')
    } finally { setBusy(null) }
  }

  const reject = async (req) => {
    const reason = window.prompt('Reason for rejection (optional):', '')
    if (reason === null) return
    setBusy(req._id)
    try {
      await axiosInstance.post(`/api/approvals/${req._id}/reject`, { reason })
      nexusToast.success('Rejected')
      load()
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to reject')
    } finally { setBusy(null) }
  }

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 }
  const badge = (st) => {
    const c = st === 'approved' ? '#10b981' : st === 'rejected' ? '#ef4444' : '#f59e0b'
    return { fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: c, background: `${c}1a`, border: `1px solid ${c}44`, textTransform: 'capitalize' }
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '24px 28px', color: T.textPri, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 700, margin: 0 }}>Approvals</h1>
          <p style={{ color: T.textSec, fontSize: 13, marginTop: 4 }}>Review documents held for approval. Approving creates the document; rejecting discards it.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['pending', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${filter === f ? T.blue : T.border}`,
              background: filter === f ? T.blue : 'transparent',
              color: filter === f ? '#fff' : T.textSec, fontFamily: 'inherit', textTransform: 'capitalize',
            }}>{f}</button>
          ))}
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
              {['Type', 'Document', 'Amount', 'Requested By', 'Progress', 'Status', ''].map((h, i) => (
                <th key={h} style={{ padding: '11px 16px', textAlign: i === 2 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 50, textAlign: 'center', color: T.textSec }}>Loading…</td></tr>
            ) : reqs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '64px 20px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: T.textSec }}>
                  <FaInbox size={26} />
                  <span style={{ fontWeight: 600, color: T.textPri }}>No {filter === 'pending' ? 'pending ' : ''}approvals</span>
                </div>
              </td></tr>
            ) : reqs.map(item => {
              const req = item.req || item
              const canAct = item.canAct
              const d = DOC_LABEL[req.docType] || { label: req.docType, color: T.textSec }
              const nSteps = req.steps?.length || 1
              const curStep = Math.min((req.currentStep ?? 0) + 1, nSteps)
              return (
                <tr key={req._id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: d.color, background: `${d.color}1a`, border: `1px solid ${d.color}44` }}>{d.label}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {req.action && req.action !== 'create' && (
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginRight: 7, padding: '1px 6px', borderRadius: 5, color: req.action === 'delete' ? '#ef4444' : '#f59e0b', background: req.action === 'delete' ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)' }}>{req.action === 'delete' ? 'Void' : 'Edit'}</span>
                    )}
                    {req.title || '—'}{req.resultDocNumber && <span style={{ color: T.textSec, fontWeight: 400, marginLeft: 6, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{req.resultDocNumber}</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{fmtAED(req.amount)}</td>
                  <td style={{ padding: '12px 16px', color: T.textSec }}>{req.requestedByName || req.requestedBy || '—'}</td>
                  <td style={{ padding: '12px 16px', color: T.textSec, fontSize: 12 }}>
                    {req.status === 'pending' ? `Step ${curStep} of ${nSteps}` : fmtDate(req.requestedAt)}
                  </td>
                  <td style={{ padding: '12px 16px' }}><span style={badge(req.status)}>{req.status}</span></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {req.status === 'pending' && (canAct ? (
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button onClick={() => approve(req)} disabled={busy === req._id} title="Approve"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', opacity: busy === req._id ? 0.6 : 1 }}>
                          <FaCheck size={10} /> Approve
                        </button>
                        <button onClick={() => reject(req)} disabled={busy === req._id} title="Reject"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, cursor: 'pointer', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,.35)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', opacity: busy === req._id ? 0.6 : 1 }}>
                          <FaTimes size={10} /> Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: T.textSec }}>Awaiting other approver</span>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
