// Shared breakpoint/style conventions for the app-wide phone-responsive pass.
// Matches the de facto numbers already in use (useIsMobile's default, Home.jsx,
// index.css) rather than introducing a new set — every later responsive pass
// should import from here instead of hardcoding its own breakpoint.
export const BREAKPOINT_TABLET = 768
export const BREAKPOINT_PHONE = 420

// Clamps a fixed drawer/panel width so it never exceeds the viewport — the
// exact fix every `position:'fixed', inset:0` overlay drawer needs, since
// their panels are hardcoded to a pixel width (400-480px) with no fallback
// and overflow a 360-430px phone screen otherwise.
export const drawerWidth = (px) => `min(${px}px, 100vw)`
