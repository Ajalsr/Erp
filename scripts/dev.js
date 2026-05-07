const { spawn } = require('child_process');

function run(command, args, cwd) {
  const proc = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
  proc.on('error', (err) => console.error(`Error: ${err.message}`));
  return proc;
}

const root = process.cwd();

run('go', ['run', '.'], `${root}/backend`);
run('npm', ['run', 'dev'], `${root}/Frontend`);