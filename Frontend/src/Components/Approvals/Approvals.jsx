import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FaCheck, FaTimes, FaInbox } from 'react-icons/fa'
import useThemeStore, { getTheme } from '../../store/useThemeStore'
import axiosInstance from '../../helper/axiosInstance'
import nexusToast from '../../helper/nexusToast'
import useRealtime from '../../helper/useRealtime'

const fmtAED = (n) => `AED ${Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// camelCase / snake_case → "Title Case"
const humanize = (k) => k.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim()
const HIDE_KEYS = new Set(['_id', 'id', 'orgId', 'orgID', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'created_at', 'updated_at', 'publicToken', 'stockDeducted', 'customerId', 'vendorId', 'customerCode', 'vendorCode'])
// Top-level scalar fields worth showing in the detail summary.
const scalarEntries = (obj) => Object.entries(obj || {})
  .filter(([k, v]) => v != null && typeof v !== 'object' && v !== '' && !HIDE_KEYS.has(k))
const pick = (o, keys) => { for (const k of keys) { if (o?.[k] != null && o[k] !== '') return o[k] } return undefined }
const lineItemsOf = (p) => (Array.isArray(p?.lineItems) && p.lineItems) || (Array.isArray(p?.items) && p.items) || []

const DOC_LABEL = {
  po:             { label: 'Purchase Order',   color: '#8b5cf6' },
  bill:           { label: 'Bill',             color: '#f59e0b' },
  vendor_payment: { label: 'Vendor Payment',   color: '#ef4444' },
  payment:        { label: 'Customer Payment', color: '#10b981' },
  invoice:        { label: 'Invoice',          color: '#3b82f6' },
  quote:          { label: 'Quote',            color: '#14b8a6' },
  sales_order:    { label: 'Sales Order',      color: '#6366f1' },
  customer:       { label: 'Customer',         color: '#0ea5e9' },
  vendor:         { label: 'Vendor',           color: '#a855f7' },
}

export default function Approvals() {
  const isDark = useThemeStore((s) => s.isDark)
  const T = getTheme(isDark)

  const [reqs, setReqs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('pending') // pending | all
  const [busy, setBusy]       = useState(null)       // id being approved/rejected
  const [rejectTarget, setRejectTarget] = useState(null) // req pending rejection
  const [rejectReason, setRejectReason] = useState('')
  const [detail, setDetail] = useState(null) // { req, canAct } open in the detail modal

  const [searchParams] = useSearchParams()
  const focusId = searchParams.get('id')
  const rowRefs = useRef({})
  const autoWidenedFor = useRef(null) // focusId we've already widened to "All" for

  const load = useCallback(() => {
    setLoading(true)
    axiosInstance.get(`/api/approvals/?status=${filter}`)
      .then(r => setReqs(r.data?.data?.requests || []))
      .catch(() => setReqs([]))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])
  useRealtime(['approvals_updated'], load)

  // Deep-link from a notification: scroll the targeted request into view. If it isn't
  // in the pending list (already decided), widen the filter to reveal it.
  useEffect(() => {
    if (!focusId || loading) return
    const found = reqs.some(it => (it.req || it)._id === focusId)
    // Widen to "All" at most once per target — otherwise it fights a manual filter switch.
    if (!found && filter === 'pending' && autoWidenedFor.current !== focusId) {
      autoWidenedFor.current = focusId
      setFilter('all')
      return
    }
    const el = rowRefs.current[focusId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusId, reqs, loading, filter])

  const approve = async (req) => {
    setBusy(req._id)
    try {
      // Sales orders use a bespoke status-based approval, not the generic engine.
      const r = req.docType === 'sales_order'
        ? await axiosInstance.patch(`/api/sales-orders/${req._id}/status`, { status: 'approved' })
        : await axiosInstance.post(`/api/approvals/${req._id}/approve`)
      nexusToast.success(r.data?.message || 'Approved')
      setDetail(null)
      load()
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to approve')
    } finally { setBusy(null) }
  }

  const confirmReject = async () => {
    const req = rejectTarget
    if (!req) return
    setBusy(req._id)
    try {
      if (req.docType === 'sales_order') {
        await axiosInstance.patch(`/api/sales-orders/${req._id}/status`, { status: 'rejected', rejectionReason: rejectReason.trim() })
      } else {
        await axiosInstance.post(`/api/approvals/${req._id}/reject`, { reason: rejectReason.trim() })
      }
      nexusToast.success('Rejected')
      setRejectTarget(null)
      setRejectReason('')
      setDetail(null)
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
              const focused = req._id === focusId
              return (
                <tr key={req._id} ref={el => { rowRefs.current[req._id] = el }}
                  onClick={() => setDetail({ req, canAct })}
                  style={{ cursor: 'pointer', borderBottom: `1px solid ${T.border}`, background: focused ? (isDark ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.07)') : 'transparent', boxShadow: focused ? `inset 3px 0 0 ${T.blue}` : 'none', transition: 'background .3s' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: d.color, background: `${d.color}1a`, border: `1px solid ${d.color}44` }}>{d.label}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {req.action && req.action !== 'create' && (
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginRight: 7, padding: '1px 6px', borderRadius: 5, color: req.action === 'delete' ? '#ef4444' : '#f59e0b', background: req.action === 'delete' ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)' }}>{req.action === 'delete' ? 'Void' : req.action === 'finalize' ? 'Finalize' : 'Edit'}</span>
                    )}
                    {req.title || '—'}{req.resultDocNumber && <span style={{ color: T.textSec, fontWeight: 400, marginLeft: 6, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{req.resultDocNumber}</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{fmtAED(req.amount)}</td>
                  <td style={{ padding: '12px 16px', color: T.textSec }}>{req.requestedByName || req.requestedBy || '—'}</td>
                  <td style={{ padding: '12px 16px', color: T.textSec, fontSize: 12 }}>
                    {req.status === 'pending' ? `Step ${curStep} of ${nSteps}` : fmtDate(req.requestedAt)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={badge(req.status)}>{req.status}</span>
                    {req.status === 'rejected' && req.reason && (
                      <div style={{ fontSize: 11, color: T.textSec, marginTop: 4, maxWidth: 220, whiteSpace: 'normal' }}>“{req.reason}”</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    {req.status === 'pending' && (canAct ? (
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button onClick={() => approve(req)} disabled={busy === req._id} title="Approve"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', opacity: busy === req._id ? 0.6 : 1 }}>
                          <FaCheck size={10} /> Approve
                        </button>
                        <button onClick={() => { setRejectReason(''); setRejectTarget(req) }} disabled={busy === req._id} title="Reject"
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

      {detail && (() => {
        const req = detail.req
        const d = DOC_LABEL[req.docType] || { label: req.docType, color: T.textSec }
        const p = req.payload || {}
        const items = lineItemsOf(p)
        const totals = (p.totals && typeof p.totals === 'object') ? p.totals : null
        const meta = [
          ['Amount', fmtAED(req.amount)],
          ['Requested by', req.requestedByName || req.requestedBy || '—'],
          ['Requested', fmtDate(req.requestedAt)],
          ['Action', req.action === 'delete' ? 'Void' : req.action === 'update' ? 'Edit' : 'Create'],
        ]
        const lab = { fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.05em' }
        return (
          <div onClick={() => busy === null && setDetail(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ ...card, width: '100%', maxWidth: 640, maxHeight: '88vh', overflowY: 'auto', padding: 0 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 22px', borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, background: T.surface, zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: d.color, background: `${d.color}1a`, border: `1px solid ${d.color}44` }}>{d.label}</span>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>{req.title || '—'}</h3>
                  <span style={badge(req.status)}>{req.status}</span>
                </div>
                <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSec, fontSize: 18, lineHeight: 1 }}>×</button>
              </div>

              <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Meta */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12 }}>
                  {meta.map(([k, v]) => (
                    <div key={k}><div style={lab}>{k}</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{v}</div></div>
                  ))}
                </div>

                {req.status === 'rejected' && req.reason && (
                  <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)' }}>
                    <div style={{ ...lab, color: '#ef4444' }}>Rejection reason</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>{req.reason}</div>
                  </div>
                )}

                {/* Summary fields */}
                {scalarEntries(p).length > 0 && (
                  <div>
                    <div style={{ ...lab, marginBottom: 8 }}>Details</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                      {scalarEntries(p).slice(0, 14).map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 11, color: T.textSec }}>{humanize(k)}</div>
                          <div style={{ fontSize: 13, marginTop: 2, wordBreak: 'break-word' }}>{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Line items */}
                {items.length > 0 && (
                  <div>
                    <div style={{ ...lab, marginBottom: 8 }}>Items ({items.length})</div>
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead><tr style={{ background: T.surface2 }}>
                          {['Item', 'Qty', 'Rate', 'Amount'].map((h, i) => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {items.map((it, i) => (
                            <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                              <td style={{ padding: '8px 12px' }}>{pick(it, ['details', 'name', 'description', 'itemName', 'item']) ?? '—'}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{pick(it, ['quantity', 'qty']) ?? '—'}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{(() => { const r = pick(it, ['rate', 'price', 'unitPrice']); return r != null ? fmtAED(r) : '—' })()}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{(() => { const a = pick(it, ['amount', 'total', 'lineTotal']); return a != null ? fmtAED(a) : '—' })()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Totals */}
                {totals && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                    {scalarEntries(totals).map(([k, v]) => (
                      <div key={k}><div style={{ fontSize: 11, color: T.textSec }}>{humanize(k)}</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{fmtAED(v)}</div></div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              {req.status === 'pending' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: `1px solid ${T.border}`, position: 'sticky', bottom: 0, background: T.surface }}>
                  {detail.canAct ? (
                    <>
                      <button onClick={() => { setRejectReason(''); setRejectTarget(req) }} disabled={busy !== null}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,.35)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                        <FaTimes size={11} /> Reject
                      </button>
                      <button onClick={() => approve(req)} disabled={busy !== null}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#10b981', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: busy !== null ? 0.6 : 1 }}>
                        <FaCheck size={11} /> {busy === req._id ? 'Approving…' : 'Approve'}
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: T.textSec }}>Awaiting other approver</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {rejectTarget && (
        <div onClick={() => busy === null && setRejectTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ ...card, width: '100%', maxWidth: 440, padding: 22 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>Reject request</h3>
            <p style={{ margin: '6px 0 14px', fontSize: 12.5, color: T.textSec }}>
              Rejecting discards this {DOC_LABEL[(rejectTarget.req || rejectTarget).docType]?.label?.toLowerCase() || 'request'}. Add a reason (optional) — the requester is notified.
            </p>
            <textarea autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…" rows={3}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: isDark ? T.surface2 : T.bg, color: T.textPri, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setRejectTarget(null)} disabled={busy !== null}
                style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={confirmReject} disabled={busy !== null}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: busy !== null ? 0.6 : 1 }}>
                <FaTimes size={11} /> {busy !== null ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
