const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');

// Parse a .env file into an object (skips comments and blank lines)
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  return fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return acc;
      acc[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
      return acc;
    }, {});
}

function run(command, args, cwd, label, extraEnv = {}) {
  const proc = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  proc.on('error', (err) => console.error(`[${label}] Error: ${err.message}`));
  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${label}] exited with code ${code} — check backend/.env for MONGO_URI and JWT_SECRET`);
    }
  });
  return proc;
}

const root = process.cwd();

// Load backend env vars and inject them so Go package-level init() sees them
const backendEnv = loadEnvFile(path.join(root, 'backend', '.env'));

run('go', ['run', '.'], `${root}/backend`, 'API', backendEnv);
run('npm', ['run', 'dev', '--', '--port', '5175'], `${root}/Frontend`, 'UI');
