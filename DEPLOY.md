# Deploy the Nexus backend

The backend is a stateless Go HTTP/WebSocket server on port `8080`. State lives in
**MongoDB** (external) and file uploads in **Cloudinary** (external) — so you just run the
binary anywhere and point it at those. Mobile needs it reachable over **HTTPS**.

`backend.exe` is a **Windows** binary — a Linux server needs a Linux build (cross-compile
or the Dockerfile).

## Env vars the server needs

| Var | Required | What |
|-----|----------|------|
| `MONGO_URI` | ✅ | MongoDB connection string (use Atlas) |
| `JWT_SECRET` | ✅ | 32+ char random string |
| `PORT` | – | defaults `8080` |
| `APP_URL` | ✅ | deployed frontend origin (CORS) |
| `ALLOWED_ORIGINS` | – | extra comma-separated origins |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | ✅ | uploads |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | – | email |
| `ADMIN_SECRET` | – | admin endpoints |

MongoDB: create a free **MongoDB Atlas** cluster → copy its `MONGO_URI` → allow the
server's IP (or `0.0.0.0/0` while testing).

---

## Option A — PaaS (easiest, gives HTTPS free)

Render / Railway / Fly.io build from the repo, no server admin, auto HTTPS.

**Render example**
1. Push repo to GitHub.
2. Render → **New → Web Service** → pick the repo.
3. Root directory: `Erp/backend`. Environment: **Docker** (uses the Dockerfile).
4. Add the env vars above.
5. Deploy → you get `https://nexus-api.onrender.com`.

Set the frontend: `Frontend/.env` → `VITE_API_URL=https://nexus-api.onrender.com`,
and backend `APP_URL` = your frontend origin.

---

## Option B — Your own Linux VPS (full control)

On a Ubuntu box (DigitalOcean / Hetzner / Lightsail):

**1. Build a Linux binary** (on your dev machine):
```powershell
nvm use 22.17.1   # only if you also build the frontend here
cd e:\ajal_personal\Erp\backend
$env:GOOS="linux"; $env:GOARCH="amd64"; $env:CGO_ENABLED="0"
go build -trimpath -ldflags "-s -w" -o backend .
```

**2. Copy binary + env to the server:**
```bash
scp backend user@SERVER_IP:/opt/nexus/backend
scp .env    user@SERVER_IP:/opt/nexus/.env     # or set env in systemd instead
```

**3. systemd service** — `/etc/systemd/system/nexus.service`:
```ini
[Unit]
Description=Nexus backend
After=network.target

[Service]
WorkingDirectory=/opt/nexus
ExecStart=/opt/nexus/backend
EnvironmentFile=/opt/nexus/.env
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nexus
sudo systemctl status nexus     # runs on 127.0.0.1:8080
```

**4. HTTPS reverse proxy with Caddy** (auto Let's Encrypt) — `/etc/caddy/Caddyfile`:
```
api.yourdomain.com {
    reverse_proxy localhost:8080
}
```
```bash
sudo systemctl reload caddy
```
Point an `A` record `api.yourdomain.com → SERVER_IP` first. Caddy issues the cert
automatically → `https://api.yourdomain.com` live.

WebSocket (`/ws`) works through Caddy's `reverse_proxy` with no extra config.

---

## After deploy

1. `Frontend/.env` → `VITE_API_URL=https://api.yourdomain.com`
2. Backend `APP_URL` = the frontend origin (so CORS allows it). Tauri mobile origins
   (`tauri.localhost`) are already allowlisted in `main.go`.
3. Rebuild frontend / mobile so the new API URL is baked in.
