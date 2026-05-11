/**
 * generate-icons.js
 * Converts app-icon.svg → 1024×1024 PNG, then runs `tauri icon` to
 * produce all required icon variants (ico, icns, PNGs, Square*.png …).
 *
 * Run once: node scripts/generate-icons.js
 */

const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs   = require('fs')

const root    = path.join(__dirname, '..')
const svgPath = path.join(__dirname, 'app-icon.svg')
const pngPath = path.join(__dirname, 'app-icon.png')

// ── 1. Make sure sharp is available ──────────────────────────────
function ensureSharp() {
  try {
    require.resolve('sharp')
  } catch {
    console.log('Installing sharp (one-time, used only for icon generation)…')
    execSync('npm install --no-save sharp', { cwd: root, stdio: 'inherit' })
  }
}

// ── 2. SVG → 1024×1024 PNG ───────────────────────────────────────
async function svgToPng() {
  const sharp = require('sharp')
  const svg   = fs.readFileSync(svgPath)

  await sharp(svg)
    .resize(1024, 1024)
    .png()
    .toFile(pngPath)

  console.log(`✓ Generated ${pngPath}`)
}

// ── 3. tauri icon <png> → all icon variants ───────────────────────
function tauriIcon() {
  console.log('Running tauri icon (this generates ico / icns / PNGs)…')
  const result = spawnSync(
    'npx',
    ['@tauri-apps/cli', 'icon', pngPath],
    { cwd: root, stdio: 'inherit', shell: true }
  )
  if (result.status !== 0) {
    console.error('tauri icon failed')
    process.exit(1)
  }
  console.log('✓ All icon variants written to src-tauri/icons/')
}

// ── Main ──────────────────────────────────────────────────────────
;(async () => {
  if (!fs.existsSync(svgPath)) {
    console.error(`SVG not found: ${svgPath}`)
    process.exit(1)
  }

  ensureSharp()
  await svgToPng()
  tauriIcon()

  console.log('\nDone! Rebuild the app with: npm run tauri build')
})()
