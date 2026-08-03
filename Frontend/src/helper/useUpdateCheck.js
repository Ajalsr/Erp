import { useEffect, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'

const MANIFEST_URL = 'https://spifora.com/downloads/latest.json'
const DISMISSED_KEY = 'spifora_update_dismissed_version'

// "1.2.10" > "1.2.9" — plain numeric segment compare, no pre-release/build tags.
function isNewer(latest, current) {
  const a = latest.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0
    if (x !== y) return x > y
  }
  return false
}

const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Desktop-only, best-effort: a new installer is just a static file drop on the
// marketing site, so this checks a small JSON manifest rather than wiring up
// Tauri's signed-updater plugin (no code-signing infra here yet). Failures
// (offline, manifest missing) are silent — this is a "nice to know", not
// something that should ever block or alarm the user.
export default function useUpdateCheck() {
  const [update, setUpdate] = useState(null) // { version, notes, url } | null

  useEffect(() => {
    if (!isDesktop) return
    let cancelled = false
    ;(async () => {
      try {
        const current = await getVersion()
        const res = await fetch(MANIFEST_URL, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !data?.version || !isNewer(data.version, current)) return
        if (localStorage.getItem(DISMISSED_KEY) === data.version) return
        setUpdate({ version: data.version, notes: data.notes || '', url: data.url || '/download' })
      } catch {
        // offline or manifest unreachable — say nothing
      }
    })()
    return () => { cancelled = true }
  }, [])

  const dismiss = () => {
    if (update) localStorage.setItem(DISMISSED_KEY, update.version)
    setUpdate(null)
  }

  return { update, dismiss }
}
