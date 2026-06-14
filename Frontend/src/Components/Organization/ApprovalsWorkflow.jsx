import { useState, useEffect, useMemo, useCallback } from 'react'
import { FaCheck, FaTimes, FaPlus, FaChevronUp, FaChevronDown, FaTrash, FaArrowDown, FaClock } from 'react-icons/fa'
import useThemeStore, { getTheme } from '../../store/useThemeStore'
import axiosInstance from '../../helper/axiosInstance'
import nexusToast from '../../helper/nexusToast'

/* Modules that actually enforce approval today (their create is gated). */
const APPROVAL_MODULES = [
  { key: 'purchase_orders', label: 'Purchase Orders', group: 'Purchases' },
  { key: 'bills',           label: 'Bills',            group: 'Purchases' },
  { key: 'vendor_payments', label: 'Payments Made',    group: 'Finance' },
  { key: 'payments',        label: 'Payments Received', group: 'Finance' },
  { key: 'quotes',          label: 'Quotes',           group: 'Sales' },
  { key: 'sales_orders',    label: 'Sales Orders',     group: 'Sales' },
  { key: 'invoices',        label: 'Invoices',         group: 'Sales' },
  { key: 'customers',       label: 'Customers',        group: 'Contacts' },
  { key: 'vendors',         label: 'Vendors',          group: 'Contacts' },
]
const modLabel = (k) => (APPROVAL_MODULES.find(m => m.key === k) || {}).label || k
const modGroup = (k) => (APPROVAL_MODULES.find(m => m.key === k) || {}).group || ''

/* Actions each module's gate is wired for in the backend. Only these can be toggled. */
const MODULE_ACTIONS = {
  purchase_orders: ['create'],
  bills:           ['create', 'update', 'delete'],
  vendor_payments: ['create'],
  payments:        ['create'],
  quotes:          ['create', 'update'],
  sales_orders:    ['create', 'update'],
  invoices:        ['create', 'update'],
  customers:       ['create', 'update'],
  vendors:         ['create', 'update'],
}
const actionsFor = (k) => MODULE_ACTIONS[k] || ['create']
const ACTION_LABEL = { create: 'Create', update: 'Edit', delete: 'Delete' }
const ACTION_VERB  = { create: 'created', update: 'edited', delete: 'deleted' }

/* Field catalog — mirrors backend approvalFieldCatalog. */
const APPROVAL_FIELDS = {
  purchase_orders: [{ key: 'amount', label: 'Amount', type: 'money' }, { key: 'vendor', label: 'Vendor', type: 'text' }],
  bills:           [{ key: 'amount', label: 'Amount', type: 'money' }, { key: 'vendor', label: 'Vendor', type: 'text' }],
  vendor_payments: [{ key: 'amount', label: 'Amount', type: 'money' }, { key: 'vendor', label: 'Vendor', type: 'text' }],
  payments:        [{ key: 'amount', label: 'Amount', type: 'money' }, { key: 'customer', label: 'Customer', type: 'text' }],
  quotes:          [{ key: 'amount', label: 'Amount', type: 'money' }, { key: 'customer', label: 'Customer', type: 'text' }],
  sales_orders:    [{ key: 'amount', label: 'Amount', type: 'money' }, { key: 'customer', label: 'Customer', type: 'text' }],
  invoices:        [{ key: 'amount', label: 'Amount', type: 'money' }, { key: 'customer', label: 'Customer', type: 'text' }],
  customers:       [{ key: 'name', label: 'Name', type: 'text' }],
  vendors:         [{ key: 'name', label: 'Name', type: 'text' }],
}
const OPS = {
  money: [{ v: 'gte', l: '≥' }, { v: 'lte', l: '≤' }, { v: 'gt', l: '>' }, { v: 'lt', l: '<' }, { v: 'eq', l: '=' }, { v: 'ne', l: '≠' }],
  number: [{ v: 'gte', l: '≥' }, { v: 'lte', l: '≤' }, { v: 'gt', l: '>' }, { v: 'lt', l: '<' }, { v: 'eq', l: '=' }, { v: 'ne', l: '≠' }],
  text: [{ v: 'contains', l: 'contains' }, { v: 'eq', l: 'is' }, { v: 'ne', l: 'is not' }],
}
const fieldsFor = (k) => APPROVAL_FIELDS[k] || [{ key: 'amount', label: 'Amount', type: 'money' }]
const fieldDef = (k, f) => fieldsFor(k).find(x => x.key === f) || fieldsFor(k)[0]
const roleLabel = (r) => r.charAt(0).toUpperCase() + r.slice(1)
const uid = (p) => p + Math.random().toString(36).slice(2, 8)

const emptyPolicy = () => ({
  enabled: false,
  trigger: { mode: 'always', match: 'all', conditions: [] },
  steps: [],
})

export default function ApprovalsWorkflow({ orgId, customRoles = [], canManage }) {
  const isDark = useThemeStore(s => s.isDark)
  const T = getTheme(isDark)

  const [policies, setPolicies] = useState({})
  const [selected, setSelected] = useState('bills')
  const [saving, setSaving]     = useState(false)

  const available = useMemo(() => ['owner', 'admin', ...customRoles.filter(r => r !== 'owner' && r !== 'admin')], [customRoles])
  const groups = useMemo(() => [...new Set(APPROVAL_MODULES.map(m => m.group))], [])

  useEffect(() => {
    axiosInstance.get(`/api/organizations/${orgId}`)
      .then(r => setPolicies(r.data?.data?.approvalPolicies || {}))
      .catch(() => {})
  }, [orgId])

  const policy = policies[selected] || emptyPolicy()
  const setPolicy = useCallback((p) => setPolicies(all => ({ ...all, [selected]: p })), [selected])

  const save = async () => {
    setSaving(true)
    try {
      await axiosInstance.patch(`/api/organizations/${orgId}/approval-policies`, { approvalPolicies: policies })
      nexusToast.success('Approval workflows saved')
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  const sel = { padding: '7px 10px', borderRadius: 8, fontSize: 13, background: isDark ? T.inputBg : T.surface2, border: `1px solid ${T.border}`, color: T.textPri, fontFamily: 'inherit', outline: 'none' }
  const activeCount = APPROVAL_MODULES.filter(m => policies[m.key]?.enabled).length

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 }}>
      {/* header */}
      <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.textPri }}>Approval Workflows</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: T.textSec, maxWidth: 520 }}>
            Per module: turn approval on, choose when it's required, and chain approvers. Owner &amp; Admin can always approve.
          </p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 8, background: T.blueDim, color: T.blue, border: `1px solid ${T.blue}44`, whiteSpace: 'nowrap' }}>
          {activeCount} of {APPROVAL_MODULES.length} active
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '230px minmax(0,1fr)' }}>
        {/* rail */}
        <div style={{ borderRight: `1px solid ${T.border}`, padding: '12px 10px', background: T.bg }}>
          {groups.map(g => (
            <div key={g} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, textTransform: 'uppercase', letterSpacing: '.07em', padding: '0 4px 6px' }}>{g}</div>
              {APPROVAL_MODULES.filter(m => m.group === g).map(m => {
                const on = m.key === selected
                const en = policies[m.key]?.enabled
                const steps = policies[m.key]?.steps?.length || 0
                return (
                  <button key={m.key} onClick={() => setSelected(m.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, width: '100%', textAlign: 'left',
                    border: `1px solid ${on ? T.border : 'transparent'}`, background: on ? T.surface : 'transparent', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 2,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, flexShrink: 0, background: en ? '#10b981' : T.border }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: on ? 700 : 500, color: on ? T.textPri : T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: en ? T.blue : T.textSec, background: en ? T.blueDim : 'transparent', border: `1px solid ${en ? T.blue + '44' : T.border}`, borderRadius: 6, padding: '1px 6px' }}>{en ? `${steps || 1} ${(steps || 1) === 1 ? 'step' : 'steps'}` : 'Off'}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* editor */}
        <div style={{ minWidth: 0 }}>
          <PolicyEditor T={T} modKey={selected} policy={policy} available={available} canManage={canManage} onChange={setPolicy} sel={sel} />
        </div>
      </div>

      {canManage && (
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', background: T.blue, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save Workflows'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Policy editor (right pane) ── */
function PolicyEditor({ T, modKey, policy, available, canManage, onChange, sel }) {
  const disabled = !canManage
  const trig = policy.trigger || { mode: 'always', match: 'all', conditions: [] }

  const setEnabled = (v) => onChange({ ...policy, enabled: v })

  // Which actions this policy gates. Unset ⇒ all wired actions (matches backend default).
  const supportedActions = actionsFor(modKey)
  const selActions = (policy.actions && policy.actions.length) ? policy.actions : supportedActions
  const toggleAction = (a) => {
    const has = selActions.includes(a)
    if (has && selActions.length === 1) return // keep at least one
    const next = supportedActions.filter(x => has ? (x !== a && selActions.includes(x)) : (x === a || selActions.includes(x)))
    onChange({ ...policy, actions: next })
  }

  const setTrigMode = (mode) => {
    if (mode === 'conditions' && (!trig.conditions || trig.conditions.length === 0)) {
      const f = fieldsFor(modKey)[0]
      onChange({ ...policy, trigger: { mode, match: 'all', conditions: [{ id: uid('c'), field: f.key, op: OPS[f.type][0].v, value: '' }] } })
    } else onChange({ ...policy, trigger: { ...trig, mode } })
  }
  const updCond = (id, c) => onChange({ ...policy, trigger: { ...trig, conditions: trig.conditions.map(x => x.id === id ? c : x) } })
  const rmCond = (id) => {
    const next = trig.conditions.filter(x => x.id !== id)
    onChange({ ...policy, trigger: next.length ? { ...trig, conditions: next } : { ...trig, mode: 'always', conditions: [] } })
  }
  const addCond = () => {
    const f = fieldsFor(modKey)[0]
    onChange({ ...policy, trigger: { ...trig, conditions: [...(trig.conditions || []), { id: uid('c'), field: f.key, op: OPS[f.type][0].v, value: '' }] } })
  }
  const steps = policy.steps || []
  const updStep = (id, s) => onChange({ ...policy, steps: steps.map(x => x.id === id ? s : x) })
  const rmStep = (id) => onChange({ ...policy, steps: steps.filter(x => x.id !== id) })
  const moveStep = (i, d) => { const j = i + d; if (j < 0 || j >= steps.length) return; const n = steps.slice();[n[i], n[j]] = [n[j], n[i]]; onChange({ ...policy, steps: n }) }
  const addStep = () => onChange({ ...policy, steps: [...steps, { id: uid('s'), mode: 'single', roles: [available[0]], n: 1, delegate: null }] })

  const Seg = ({ value, onCh, options }) => (
    <div style={{ display: 'inline-flex', padding: 3, gap: 2, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9 }}>
      {options.map(o => {
        const on = value === o.v
        return <button key={o.v} disabled={disabled} onClick={() => !disabled && onCh(o.v)} style={{ padding: '5px 11px', borderRadius: 7, border: 'none', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 700 : 500, background: on ? T.surface : 'transparent', color: on ? T.textPri : T.textSec, whiteSpace: 'nowrap' }}>{o.l}</button>
      })}
    </div>
  )

  return (
    <div>
      {/* head */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.blue, textTransform: 'uppercase', letterSpacing: '.08em' }}>{modGroup(modKey)}</span>
          <h3 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 750, color: T.textPri }}>{modLabel(modKey)}</h3>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: T.textSec, maxWidth: 440 }}>
            {policy.enabled ? `Held for approval ${trig.mode === 'always' ? 'on every record' : 'when conditions match'} before posting.` : 'Approval off — records post immediately.'}
          </p>
        </div>
        <button onClick={() => !disabled && setEnabled(!policy.enabled)} disabled={disabled} style={{ width: 44, height: 24, borderRadius: 999, border: 'none', position: 'relative', flexShrink: 0, cursor: disabled ? 'default' : 'pointer', background: policy.enabled ? T.blue : T.border }}>
          <span style={{ position: 'absolute', top: 2, left: policy.enabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
        </button>
      </div>

      {!policy.enabled ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: T.textSec }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textPri }}>No approval needed</div>
          <p style={{ margin: '6px auto 14px', fontSize: 12, maxWidth: 300 }}>Turn on to require sign-off on {modLabel(modKey).toLowerCase()} before they post.</p>
          {canManage && <button onClick={() => setEnabled(true)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface2, color: T.textPri, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Turn on approval</button>}
        </div>
      ) : (
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* WHICH ACTIONS */}
          {supportedActions.length > 1 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, marginBottom: 10 }}>Which actions need approval?</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {supportedActions.map(a => {
                  const on = selActions.includes(a)
                  return (
                    <button key={a} disabled={disabled} onClick={() => !disabled && toggleAction(a)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? T.blue : 'transparent', color: on ? '#fff' : T.textSec, border: `1px solid ${on ? T.blue : T.border}` }}>
                      {on ? <FaCheck size={10} /> : <span style={{ width: 10, height: 10, borderRadius: 3, border: `1.5px solid ${T.textSec}`, display: 'inline-block' }} />}
                      {ACTION_LABEL[a]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* WHEN */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, marginBottom: 10 }}>When is approval required?</div>
            <Seg value={trig.mode} onCh={setTrigMode} options={[{ v: 'always', l: 'Every record' }, { v: 'conditions', l: 'Only when conditions match' }]} />
            {trig.mode === 'conditions' && (
              <div style={{ marginTop: 12, border: `1px solid ${T.border}`, borderRadius: 12, background: T.bg, padding: 14 }}>
                {trig.conditions.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: T.textSec }}>Match</span>
                    <Seg value={trig.match} onCh={(m) => onChange({ ...policy, trigger: { ...trig, match: m } })} options={[{ v: 'all', l: 'ALL' }, { v: 'any', l: 'ANY' }]} />
                    <span style={{ fontSize: 12, color: T.textSec }}>of these:</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {trig.conditions.map(c => {
                    const f = fieldDef(modKey, c.field)
                    const ops = OPS[f.type] || OPS.text
                    return (
                      <div key={c.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select value={c.field} disabled={disabled} onChange={e => { const nf = fieldDef(modKey, e.target.value); updCond(c.id, { ...c, field: e.target.value, op: OPS[nf.type][0].v, value: '' }) }} style={{ ...sel, flex: '1 1 120px' }}>
                          {fieldsFor(modKey).map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                        </select>
                        <select value={c.op} disabled={disabled} onChange={e => updCond(c.id, { ...c, op: e.target.value })} style={{ ...sel, flex: '1 1 110px' }}>
                          {ops.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                        <input type={f.type === 'text' ? 'text' : 'number'} value={c.value} disabled={disabled} placeholder={f.type === 'text' ? 'value' : '0'} onChange={e => updCond(c.id, { ...c, value: e.target.value })} style={{ ...sel, flex: '1 1 110px' }} />
                        {!disabled && <button onClick={() => rmCond(c.id)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSec, cursor: 'pointer' }}><FaTimes size={11} /></button>}
                      </div>
                    )
                  })}
                </div>
                {canManage && <button onClick={addCond} style={{ marginTop: 11, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: T.blue, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><FaPlus size={9} /> Add condition</button>}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: T.border }} />

          {/* CHAIN */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textPri }}>Approval chain</span>
              <span style={{ fontSize: 11, color: T.textSec }}>{steps.length || 1} {(steps.length || 1) === 1 ? 'step' : 'steps'}</span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 11.5, color: T.textSec }}>Steps run top to bottom. Each clears before the next begins.</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: `1px dashed ${T.border}`, background: T.bg, fontSize: 12, color: T.textSec }}>
              A {modLabel(modKey).replace(/s$/, '').toLowerCase()} is {selActions.map(a => ACTION_VERB[a]).join(' or ')}
            </div>

            {(steps.length ? steps : []).map((s, i) => (
              <div key={s.id}>
                <Connector T={T} />
                <StepCard T={T} index={i} total={steps.length} step={s} available={available} disabled={disabled} sel={sel}
                  onChange={(ns) => updStep(s.id, ns)} onRemove={() => rmStep(s.id)} onMove={(d) => moveStep(i, d)} />
              </div>
            ))}
            {steps.length === 0 && (
              <>
                <Connector T={T} />
                <div style={{ padding: '11px 13px', borderRadius: 11, border: `1px solid ${T.border}`, background: T.surface2, fontSize: 12.5, color: T.textSec }}>
                  No steps — only <b style={{ color: T.textPri }}>Owner / Admin</b> can approve. Add a step to delegate to other roles.
                </div>
              </>
            )}

            {canManage && (
              <>
                <Connector T={T} />
                <button onClick={addStep} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, width: '100%', borderRadius: 11, border: `1.5px dashed ${T.border}`, background: 'transparent', cursor: 'pointer', color: T.textSec, fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                  <FaPlus size={12} /> Add approval step
                </button>
              </>
            )}

            <Connector T={T} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)' }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', background: '#10b981', color: '#fff', flexShrink: 0 }}><FaCheck size={11} /></span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>Approved &amp; posted</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Connector({ T }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3px 0' }}>
      <span style={{ width: 2, height: 9, background: T.border }} />
      <FaArrowDown size={12} style={{ color: T.textSec }} />
      <span style={{ width: 2, height: 9, background: T.border }} />
    </div>
  )
}

function StepCard({ T, index, total, step, available, disabled, onChange, onRemove, onMove, sel }) {
  const setMode = (mode) => {
    if (mode === step.mode) return
    if (mode === 'single') onChange({ ...step, mode, roles: step.roles.slice(0, 1).length ? step.roles.slice(0, 1) : [available[0]], n: 1 })
    else onChange({ ...step, mode, roles: step.roles.length ? step.roles : [available[0]], n: Math.min(step.n || 1, Math.max(step.roles.length, 1)) })
  }
  const setRoles = (roles) => onChange({ ...step, roles, n: step.mode === 'quorum' ? Math.max(1, Math.min(step.n || 1, Math.max(roles.length, 1))) : 1 })
  const toggleRole = (r) => {
    if (step.mode === 'single') return setRoles([r])
    setRoles(step.roles.includes(r) ? step.roles.filter(x => x !== r) : [...step.roles, r])
  }
  const maxN = Math.max(step.roles.length, 1)

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderBottom: `1px solid ${T.border}` }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, display: 'grid', placeItems: 'center', background: T.blueDim, color: T.blue, fontSize: 12, fontWeight: 700, border: `1px solid ${T.blue}44`, flexShrink: 0 }}>{index + 1}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>Step {index + 1}</div>
          <div style={{ fontSize: 11, color: T.textSec }}>{step.mode === 'quorum' ? 'Group approval' : 'Single approver'}</div>
        </div>
        <div style={{ display: 'inline-flex', padding: 3, gap: 2, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9 }}>
          {[{ v: 'single', l: 'One role' }, { v: 'quorum', l: 'Any of group' }].map(o => {
            const on = step.mode === o.v
            return <button key={o.v} disabled={disabled} onClick={() => setMode(o.v)} style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: on ? 700 : 500, background: on ? T.surface : 'transparent', color: on ? T.textPri : T.textSec }}>{o.l}</button>
          })}
        </div>
        {!disabled && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => onMove(-1)} disabled={index === 0} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSec, cursor: index === 0 ? 'default' : 'pointer' }}><FaChevronUp size={10} /></button>
            <button onClick={() => onMove(1)} disabled={index === total - 1} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSec, cursor: index === total - 1 ? 'default' : 'pointer' }}><FaChevronDown size={10} /></button>
            <button onClick={onRemove} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: '#ef4444', cursor: 'pointer' }}><FaTrash size={10} /></button>
          </div>
        )}
      </div>
      <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{step.mode === 'quorum' ? 'Approvers — any of these roles' : 'Approver role'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {available.map(r => {
              const on = step.roles.includes(r)
              return (
                <button key={r} disabled={disabled} onClick={() => toggleRole(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? T.blue : T.border}`, background: on ? T.blueDim : T.surface, color: on ? T.blue : T.textSec }}>
                  <span style={{ width: 13, height: 13, borderRadius: step.mode === 'quorum' ? 4 : 99, display: 'grid', placeItems: 'center', border: `1.5px solid ${on ? T.blue : T.border}`, background: on ? T.blue : 'transparent', color: '#fff' }}>{on && <FaCheck size={7} />}</span>
                  {roleLabel(r)}
                </button>
              )
            })}
          </div>
        </div>

        {step.mode === 'quorum' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 9, background: T.bg, border: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12.5, color: T.textSec }}>Require</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${T.border}`, borderRadius: 8, background: T.surface }}>
              <button disabled={disabled || step.n <= 1} onClick={() => onChange({ ...step, n: Math.max(1, step.n - 1) })} style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', color: T.textSec, fontSize: 15 }}>−</button>
              <span style={{ minWidth: 22, textAlign: 'center', fontSize: 13, fontWeight: 700, color: T.textPri }}>{step.n}</span>
              <button disabled={disabled || step.n >= maxN} onClick={() => onChange({ ...step, n: Math.min(maxN, step.n + 1) })} style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', color: T.textSec, fontSize: 15 }}>+</button>
            </div>
            <span style={{ fontSize: 12.5, color: T.textSec }}>of {maxN} {maxN === 1 ? 'role' : 'roles'} to approve</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSec }}><FaClock size={12} /> If unavailable, delegate to</span>
          <select value={step.delegate || ''} disabled={disabled} onChange={e => onChange({ ...step, delegate: e.target.value || null })} style={{ ...sel, flex: '0 1 180px' }}>
            <option value="">No backup</option>
            {available.filter(r => !step.roles.includes(r)).map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
