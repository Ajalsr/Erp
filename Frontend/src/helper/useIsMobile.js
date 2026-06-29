import { useState, useEffect } from 'react'

// useIsMobile returns true when the viewport is at/under `breakpoint` px.
// Drives the responsive shell (off-canvas sidebar, full-width main) and any
// screen that wants to collapse its layout on phones/tablets.
export default function useIsMobile(breakpoint = 768) {
  const get = () => (typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false)
  const [isMobile, setIsMobile] = useState(get)

  useEffect(() => {
    const onResize = () => setIsMobile(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint]) // eslint-disable-line

  return isMobile
}
