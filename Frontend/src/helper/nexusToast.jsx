/**
 * nexusToast — Nexus ERP design-system toast notifications
 *
 * Uses react-hot-toast under the hood. Reads the current theme from
 * localStorage automatically so every toast is always dark/light aware.
 *
 * Usage:
 *   import nexusToast from '../helper/nexusToast'
 *   nexusToast.success('Saved!')
 *   nexusToast.error('Something went wrong')
 *   nexusToast.info('Loading data…')
 *   nexusToast.warning('Check required fields')
 */

import React from 'react'
import toast from 'react-hot-toast'

// Inject keyframes once
const STYLE_ID = 'nexus-toast-keyframes'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes nexusSlideIn {
      from { opacity:0; transform:translateX(32px) scale(.95); }
      to   { opacity:1; transform:translateX(0)    scale(1);   }
    }
    @keyframes nexusFadeOut {
      from { opacity:1; transform:translateX(0) scale(1);    }
      to   { opacity:0; transform:translateX(16px) scale(.95); }
    }
  `
  document.head.appendChild(style)
}

const getIsDark = () => {
  try {
    return JSON.parse(localStorage.getItem('nexus-theme') || '{}').state?.isDark ?? true
  } catch {
    return true
  }
}

// ── Config per type ──────────────────────────────────────────────────────────
const CFG = {
  success: {
    label: 'Success',
    color: '#10b981',
    darkBorder: 'rgba(16,185,129,0.35)',
    lightBorder: '#bbf7d0',
    darkIconBg: 'rgba(16,185,129,0.15)',
    lightIconBg: '#dcfce7',
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    ),
    duration: 3000,
  },
  error: {
    label: 'Error',
    color: '#ef4444',
    darkBorder: 'rgba(239,68,68,0.35)',
    lightBorder: '#fecaca',
    darkIconBg: 'rgba(239,68,68,0.15)',
    lightIconBg: '#fee2e2',
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={12} cy={12} r={10}/><path d="M15 9l-6 6M9 9l6 6"/>
      </svg>
    ),
    duration: 5000,
  },
  warning: {
    label: 'Warning',
    color: '#f59e0b',
    darkBorder: 'rgba(245,158,11,0.35)',
    lightBorder: '#fde68a',
    darkIconBg: 'rgba(245,158,11,0.15)',
    lightIconBg: '#fef3c7',
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1={12} y1={9} x2={12} y2={13}/><line x1={12} y1={17} x2={12.01} y2={17}/>
      </svg>
    ),
    duration: 4000,
  },
  info: {
    label: 'Info',
    color: '#3b82f6',
    darkBorder: 'rgba(59,130,246,0.35)',
    lightBorder: '#bfdbfe',
    darkIconBg: 'rgba(59,130,246,0.15)',
    lightIconBg: '#dbeafe',
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={12}/><line x1={12} y1={16} x2={12.01} y2={16}/>
      </svg>
    ),
    duration: 3500,
  },
}

// ── Toast renderer ───────────────────────────────────────────────────────────
const NexusToast = ({ t: toastObj, message, type }) => {
  const dark = getIsDark()
  const cfg = CFG[type]

  return (
    <div
      onClick={() => toast.dismiss(toastObj.id)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '13px 16px 13px 14px',
        borderRadius: 14,
        background: dark ? '#0d1526' : '#ffffff',
        border: `1.5px solid ${dark ? cfg.darkBorder : cfg.lightBorder}`,
        boxShadow: dark
          ? `0 24px 56px rgba(0,0,0,0.55), 0 0 0 1px ${cfg.darkBorder}`
          : `0 12px 32px rgba(0,0,0,0.09), 0 2px 8px rgba(0,0,0,0.05)`,
        fontFamily: "'DM Sans', 'Inter', sans-serif",
        cursor: 'pointer',
        minWidth: 280,
        maxWidth: 380,
        userSelect: 'none',
        animation: toastObj.visible
          ? 'nexusSlideIn .28s cubic-bezier(.34,1.56,.64,1) both'
          : 'nexusFadeOut .22s ease forwards',
      }}
    >
      {/* Icon bubble */}
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginTop: 1,
        background: dark ? cfg.darkIconBg : cfg.lightIconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '.08em',
          textTransform: 'uppercase', color: cfg.color, marginBottom: 3,
          fontFamily: "'Sora', 'DM Sans', sans-serif",
        }}>
          {cfg.label}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 500,
          color: dark ? '#e2e8f0' : '#1e293b',
          lineHeight: 1.45,
          wordBreak: 'break-word',
        }}>
          {message}
        </div>
      </div>

      {/* Dismiss × */}
      <div style={{
        color: dark ? '#475569' : '#94a3b8',
        fontSize: 18, lineHeight: 1, flexShrink: 0,
        marginTop: -1, fontWeight: 300,
        transition: 'color .15s',
      }}>×</div>
    </div>
  )
}

// ── Public API ───────────────────────────────────────────────────────────────
const nexusToast = {
  success: (message) =>
    toast.custom((t) => <NexusToast t={t} message={message} type="success" />, {
      duration: CFG.success.duration, position: 'top-right',
    }),

  error: (message) =>
    toast.custom((t) => <NexusToast t={t} message={message} type="error" />, {
      duration: CFG.error.duration, position: 'top-right',
    }),

  warning: (message) =>
    toast.custom((t) => <NexusToast t={t} message={message} type="warning" />, {
      duration: CFG.warning.duration, position: 'top-right',
    }),

  info: (message) =>
    toast.custom((t) => <NexusToast t={t} message={message} type="info" />, {
      duration: CFG.info.duration, position: 'top-right',
    }),

  dismiss: (id) => toast.dismiss(id),
}

export default nexusToast