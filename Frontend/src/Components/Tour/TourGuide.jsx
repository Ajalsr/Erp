import { createPortal } from 'react-dom'
import { useEffect, useState, useRef } from 'react'
import useTourStore from '../../store/useTourStore'
import useThemeStore from '../../store/useThemeStore'

/* ── Tour definitions ─────────────────────────────────────────────── */
const TOURS = {
  welcome: [
    {
      target: null,
      title: 'Welcome to Spifora 👋',
      content: 'This quick tour covers every key area of the system. Use the → ← arrow keys or buttons to navigate, Esc to exit. You can replay it any time from the ? button.',
      icon: '🏠',
    },
    {
      target: '[data-tour="sidebar"]',
      title: 'Navigation Sidebar',
      content: 'Your main navigation hub. Click any section label to expand its sub-pages. Collapse or expand the sidebar using the menu icon in the top-left corner.',
      placement: 'right',
      icon: '🧭',
    },
    {
      target: '[data-tour="nav-home"]',
      title: 'Dashboard',
      content: 'The Home dashboard shows live KPIs across your entire business — sales revenue, pending invoices, low-stock items, open purchase orders, and more. Your command centre.',
      placement: 'right',
      icon: '📊',
    },
    {
      target: '[data-tour="nav-sales"]',
      title: 'Sales Pipeline',
      content: 'Your complete sales flow in one section: Customers → Enquiries → Quotes → Sales Orders → Outbound → Delivery Notes → Invoices → Payments Received. Each step links to the next.',
      placement: 'right',
      icon: '🛒',
    },
    {
      target: '[data-tour="nav-items"]',
      title: 'Items & Catalogue',
      content: 'Maintain your full product catalogue here. Each item tracks stock levels, cost, unit of measure, reorder point, and transaction history. Group items and set price lists.',
      placement: 'right',
      icon: '📦',
    },
    {
      target: '[data-tour="nav-inventory"]',
      title: 'Inventory Control',
      content: 'Track stock across multiple warehouses, view summaries, and record manual adjustments. Requested quantities from pending approvals are reflected automatically.',
      placement: 'right',
      icon: '🏗️',
    },
    {
      target: '[data-tour="nav-purchases"]',
      title: 'Procurement',
      content: 'Complete purchase cycle: Vendors → Purchase Orders → Inbound / GRN → Bills → Payments Made. Vendor credits and debit notes for returns are also handled here.',
      placement: 'right',
      icon: '🏭',
    },
    {
      target: '[data-tour="nav-reports"]',
      title: 'Reports & Finance',
      content: 'Generate Sales, Purchase, and Inventory reports with date-range filters. The Finance section covers Payments Received/Made and your full Chart of Accounts.',
      placement: 'right',
      icon: '📈',
    },
    {
      target: '[data-tour="navbar-search"]',
      title: 'Global Search',
      content: 'Instantly search across the entire system — customers, orders, invoices, vendors, and items — all from one place without leaving your current page.',
      placement: 'bottom',
      icon: '🔍',
    },
    {
      target: '[data-tour="navbar-org"]',
      title: 'Organization Switcher',
      content: 'Belong to multiple companies? Switch the active organization here. All data — orders, inventory, customers — is fully scoped and isolated per organization.',
      placement: 'bottom',
      icon: '🏢',
    },
    {
      target: '[data-tour="navbar-theme"]',
      title: 'Light / Dark Mode',
      content: 'Toggle between light and dark interface themes. Your preference is saved to localStorage and persists between sessions.',
      placement: 'bottom',
      icon: '🌙',
    },
    {
      target: '[data-tour="navbar-notif"]',
      title: 'Notifications',
      content: 'Real-time alerts appear here — Sales Order approvals, delivery updates, team invitations, and more. Admins see SO approval requests with a direct action link.',
      placement: 'bottom',
      icon: '🔔',
    },
    {
      target: '[data-tour="tour-help"]',
      title: 'Replay This Tour',
      content: 'Click the ? button any time to restart this guided walkthrough from the beginning. Great for onboarding new team members too.',
      placement: 'bottom',
      icon: '❓',
    },
    {
      target: null,
      title: "You're all set! 🎉",
      content: "That covers the full Spifora overview. Head to the Dashboard to see your live metrics, or jump straight into any module from the sidebar. Good luck!",
      icon: '🚀',
    },
  ],
}

/* ── Constants ──────────────────────────────────────────────────────── */
const PAD = 8    // spotlight padding around element
const TW  = 322  // tooltip width

/* ── Auto-detect best tooltip placement ────────────────────────────── */
function bestPlacement(rect, prefer) {
  if (prefer && prefer !== 'auto') return prefer
  if (!rect) return 'center'
  const spaceR = window.innerWidth  - rect.left - rect.width
  const spaceL = rect.left
  if (spaceR >= TW + 32) return 'right'
  if (spaceL >= TW + 32) return 'left'
  if (rect.top  >= 240)  return 'top'
  return 'bottom'
}

/* ── Compute tooltip CSS position ───────────────────────────────────── */
function tipPos(rect, placement) {
  if (!rect || placement === 'center') {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: TW }
  }
  const GAP = 14
  const vw = window.innerWidth
  const vh = window.innerHeight
  const base = { position: 'fixed', width: TW }

  if (placement === 'right') return { ...base,
    left: Math.min(rect.left + rect.width + PAD + GAP, vw - TW - 12),
    top:  Math.max(12, Math.min(rect.top + rect.height / 2 - 120, vh - 260)),
  }
  if (placement === 'left') return { ...base,
    left: Math.max(12, rect.left - PAD - GAP - TW),
    top:  Math.max(12, Math.min(rect.top + rect.height / 2 - 120, vh - 260)),
  }
  if (placement === 'bottom') return { ...base,
    top:  Math.min(rect.top + rect.height + PAD + GAP, vh - 260),
    left: Math.max(12, Math.min(rect.left + rect.width / 2 - TW / 2, vw - TW - 12)),
  }
  // top
  return { ...base,
    top:  Math.max(12, rect.top - PAD - GAP - 240),
    left: Math.max(12, Math.min(rect.left + rect.width / 2 - TW / 2, vw - TW - 12)),
  }
}

/* ── Caret arrow pointing tooltip → element ─────────────────────────── */
function Caret({ placement, bg, border }) {
  if (!placement || placement === 'center') return null
  const base = { position: 'absolute', width: 0, height: 0 }
  if (placement === 'right')  return <div style={{ ...base, left: -9, top: '50%', transform: 'translateY(-50%)', borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderRight: `9px solid ${bg}` }} />
  if (placement === 'left')   return <div style={{ ...base, right: -9, top: '50%', transform: 'translateY(-50%)', borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: `9px solid ${bg}` }} />
  if (placement === 'bottom') return <div style={{ ...base, top: -9, left: '50%', transform: 'translateX(-50%)', borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: `9px solid ${bg}` }} />
  return <div style={{ ...base, bottom: -9, left: '50%', transform: 'translateX(-50%)', borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: `9px solid ${bg}` }} />
}

/* ── Main component ─────────────────────────────────────────────────── */
export default function TourGuide() {
  const activeTour   = useTourStore((s) => s.activeTour)
  const currentStep  = useTourStore((s) => s.currentStep)
  const next         = useTourStore((s) => s.next)
  const prev         = useTourStore((s) => s.prev)
  const finish       = useTourStore((s) => s.finish)
  const skip         = useTourStore((s) => s.skip)
  const isDark       = useThemeStore((s) => s.isDark)

  const [rect,    setRect]    = useState(null)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)

  const steps = activeTour ? (TOURS[activeTour] || []) : []
  const step  = steps[currentStep]

  /* Auto-start welcome tour on first visit */
  useEffect(() => {
    const t = setTimeout(() => {
      const { done, activeTour: active, start } = useTourStore.getState()
      if (!done.has('welcome') && !active) start('welcome')
    }, 1800)
    return () => clearTimeout(t)
  }, [])

  /* Track target element position */
  useEffect(() => {
    setVisible(false)
    setRect(null)
    clearTimeout(timerRef.current)
    if (!step) return

    if (!step.target) {
      timerRef.current = setTimeout(() => setVisible(true), 80)
      return
    }

    const el = document.querySelector(step.target)
    if (!el) {
      timerRef.current = setTimeout(() => setVisible(true), 80)
      return
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })

    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
      setVisible(true)
    }
    timerRef.current = setTimeout(measure, 420)

    const onResize = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timerRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [step])

  /* Keyboard navigation */
  useEffect(() => {
    if (!activeTour) return
    const onKey = (e) => {
      if      (e.key === 'Escape')                            skip()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { if (currentStep < steps.length - 1) next(); else finish() }
      else if (e.key === 'ArrowLeft')                         prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTour, currentStep, steps.length, next, prev, finish, skip])

  if (!activeTour || !step) return null

  const isFirst     = currentStep === 0
  const isLast      = currentStep === steps.length - 1
  const hasTarget   = !!(step.target && rect)
  const placement   = hasTarget ? bestPlacement(rect, step.placement) : 'center'
  const tooltipPos  = tipPos(hasTarget ? rect : null, placement)

  const spot = hasTarget ? {
    top:    rect.top    - PAD,
    left:   rect.left   - PAD,
    width:  rect.width  + PAD * 2,
    height: rect.height + PAD * 2,
  } : null

  const bg   = isDark ? '#0f172a' : '#ffffff'
  const pri  = isDark ? '#f1f5f9' : '#0f172a'
  const sec  = isDark ? '#94a3b8' : '#64748b'
  const bord = isDark ? 'rgba(255,255,255,.09)' : '#e2e8f0'
  const dim  = isDark ? 'rgba(255,255,255,.08)' : '#f1f5f9'

  return createPortal(
    <>
      <style>{`
        @keyframes tour-fade  { from { opacity:0; transform:scale(.96) translateY(6px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes tour-pulse { 0%,100% { box-shadow:0 0 0 4px rgba(59,130,246,.22) } 50% { box-shadow:0 0 0 8px rgba(59,130,246,.08) } }
      `}</style>

      {/* Overlay quads or full-screen */}
      {spot ? (
        <>
          <div onClick={skip} style={{ position:'fixed', left:0, top:0, right:0, height: spot.top, background:'rgba(0,0,0,.72)', zIndex:99997, cursor:'pointer' }} />
          <div onClick={skip} style={{ position:'fixed', left:0, top: spot.top + spot.height, right:0, bottom:0, background:'rgba(0,0,0,.72)', zIndex:99997, cursor:'pointer' }} />
          <div onClick={skip} style={{ position:'fixed', left:0, top: spot.top, width: spot.left, height: spot.height, background:'rgba(0,0,0,.72)', zIndex:99997, cursor:'pointer' }} />
          <div onClick={skip} style={{ position:'fixed', left: spot.left + spot.width, top: spot.top, right:0, height: spot.height, background:'rgba(0,0,0,.72)', zIndex:99997, cursor:'pointer' }} />
          {/* Spotlight highlight ring */}
          <div style={{ position:'fixed', top: spot.top, left: spot.left, width: spot.width, height: spot.height, borderRadius:10, border:'2px solid rgba(59,130,246,.8)', zIndex:99998, pointerEvents:'none', animation:'tour-pulse 2s ease infinite' }} />
        </>
      ) : (
        <div onClick={skip} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.72)', zIndex:99997, cursor:'pointer' }} />
      )}

      {/* Tooltip */}
      {visible && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...tooltipPos,
            zIndex:       100000,
            background:   bg,
            border:       `1px solid ${bord}`,
            borderRadius: 18,
            padding:      '22px 24px 18px',
            boxShadow:    isDark
              ? '0 32px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(59,130,246,.1)'
              : '0 24px 64px rgba(0,0,0,.18)',
            animation:    'tour-fade .28s cubic-bezier(.16,1,.3,1) both',
            fontFamily:   'DM Sans, sans-serif',
          }}
        >
          <Caret placement={spot ? placement : null} bg={bg} border={bord} />

          {/* Progress bar */}
          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:16 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                height:     5,
                width:      i === currentStep ? 22 : 5,
                borderRadius: 99,
                background: i === currentStep
                  ? '#3b82f6'
                  : i < currentStep
                    ? 'rgba(59,130,246,.38)'
                    : (isDark ? 'rgba(255,255,255,.1)' : '#e2e8f0'),
                transition: 'all .28s cubic-bezier(.34,1.56,.64,1)',
              }} />
            ))}
            <span style={{ marginLeft:'auto', fontSize:10, color: isDark ? '#334155' : '#cbd5e1', fontWeight:600, letterSpacing:'.04em', flexShrink:0 }}>
              {currentStep + 1} / {steps.length}
            </span>
          </div>

          {/* Icon + title */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
            {step.icon && <span style={{ fontSize:22, lineHeight:1, flexShrink:0, marginTop:2 }}>{step.icon}</span>}
            <h3 style={{ color:pri, fontSize:15, fontWeight:700, margin:0, lineHeight:1.3, fontFamily:'Sora, sans-serif', letterSpacing:'-0.02em' }}>
              {step.title}
            </h3>
          </div>

          {/* Body */}
          <p style={{ color:sec, fontSize:12.5, margin:'0 0 20px', lineHeight:1.72 }}>
            {step.content}
          </p>

          {/* Divider */}
          <div style={{ height:1, background: bord, margin:'0 0 14px' }} />

          {/* Footer */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <button onClick={skip}
              style={{ color: isDark ? '#334155' : '#b0bec5', fontSize:11.5, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit', transition:'color .15s' }}>
              Skip tour
            </button>

            <div style={{ display:'flex', gap:7 }}>
              {!isFirst && (
                <button onClick={prev}
                  style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${bord}`, background: dim, color:sec, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  ← Back
                </button>
              )}
              <button onClick={() => isLast ? finish() : next()}
                style={{ padding:'6px 20px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 14px rgba(59,130,246,.38)' }}>
                {isLast ? "Let's go! 🚀" : 'Next →'}
              </button>
            </div>
          </div>

          {/* Keyboard hint */}
          <div style={{ marginTop:10, textAlign:'center' }}>
            <span style={{ color: isDark ? '#1e293b' : '#dde4ee', fontSize:10 }}>
              ← → arrow keys &nbsp;·&nbsp; Esc to exit
            </span>
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
