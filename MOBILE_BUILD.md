# Mobile (Android) build — Nexus

The desktop app bundles the Go `backend.exe` as a sidecar. **Android can't run that.**
On mobile the app talks to a **remote backend over HTTPS**. Deploy the Go backend to a
host first, then point the frontend at it.

## 0. Fix the Node version (this machine)

The active Node is **v14.17.0**, too old for npm/Vite/Tauri CLI. Switch with nvm-windows
**in every shell** before running anything:

```powershell
nvm use 22.17.1
node -v   # must print v22.x
```

## 1. Point the app at the remote backend

`Frontend/.env` (see `.env.example`):

```
VITE_API_URL=https://api.yourdomain.com
```

Phones can't reach the desktop's `localhost`. Use a real reachable host. Prefer HTTPS —
plain HTTP needs Android cleartext permission (extra config, avoid).

## 2. One-time prerequisites

- **Android Studio** + SDK (Platform 34+) + **NDK** + an emulator or USB device.
- **JDK 17**.
- Environment variables: `ANDROID_HOME`, `NDK_HOME` (or `ANDROID_NDK_HOME`), `JAVA_HOME`.
- Rust Android targets:
  ```powershell
  rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
  ```

## 3. Initialise the Android project (one time)

```powershell
cd e:\ajal_personal\Erp
npx tauri android init
```

Generates `src-tauri/gen/android/`. The `tauri.android.conf.json` override (already in repo)
empties `externalBin` so the build doesn't look for an Android backend binary.

## 4. Run / build

```powershell
# Live on emulator or attached device
npx tauri android dev

# Release APK / AAB → src-tauri/gen/android/app/build/outputs/
npx tauri android build
```

`beforeBuildCommand` runs `npm run build` — make sure `nvm use 22.17.1` is active first,
or it fails on Node 14.

## Notes

- **Responsive UI**: the app shell is mobile-ready (off-canvas sidebar drawer via the
  hamburger, full-width content). Individual screens are progressively tuned; wide tables
  scroll inside their own box on phones.
- **Signing**: release AAB for Play Store needs a keystore — configure in
  `src-tauri/gen/android/app/build.gradle.kts` after init.
- **CORS**: already handled — the backend allowlist (`main.go`) includes
  `http://tauri.localhost`, `https://tauri.localhost`, `tauri://localhost`. For a
  web-hosted frontend set `APP_URL` / `ALLOWED_ORIGINS` env on the backend.
- **iOS** later: same model (`npx tauri ios init`), needs macOS + Xcode.
