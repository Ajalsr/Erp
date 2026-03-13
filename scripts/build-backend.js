/**
 * build-backend.js
 * Compiles the Go backend for Tauri sidecar bundling.
 *
 * Tauri requires binaries named with the full target triple:
 *   src-tauri/binaries/backend-aarch64-apple-darwin     → Mac Apple Silicon
 *   src-tauri/binaries/backend-x86_64-apple-darwin      → Mac Intel
 *   src-tauri/binaries/backend-x86_64-pc-windows-msvc.exe → Windows x64
 *
 * Run with: node scripts/build-backend.js
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const backendDir = path.join(__dirname, '..', 'backend')
const binariesDir = path.join(__dirname, '..', 'src-tauri', 'binaries')

fs.mkdirSync(binariesDir, { recursive: true })

const targets = [
  {
    GOOS: 'darwin',
    GOARCH: 'arm64',
    out: path.join(binariesDir, 'backend-aarch64-apple-darwin'),
  },
  {
    GOOS: 'darwin',
    GOARCH: 'amd64',
    out: path.join(binariesDir, 'backend-x86_64-apple-darwin'),
  },
  {
    GOOS: 'windows',
    GOARCH: 'amd64',
    out: path.join(binariesDir, 'backend-x86_64-pc-windows-msvc.exe'),
  },
]

for (const { GOOS, GOARCH, out } of targets) {
  console.log(`Building ${path.basename(out)} (${GOOS}/${GOARCH})...`)
  try {
    execSync(`go build -o "${out}" .`, {
      cwd: backendDir,
      env: { ...process.env, GOOS, GOARCH, CGO_ENABLED: '0' },
      stdio: 'inherit',
    })
    console.log(`  ✓ ${path.basename(out)}`)
  } catch {
    console.error(`  ✗ Failed to build ${path.basename(out)}`)
    process.exit(1)
  }
}

console.log('\nAll backend binaries built into src-tauri/binaries/')
