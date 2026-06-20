const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = __dirname;
const SERVER_DIR = path.join(REPO_ROOT, 'apps', 'server');
const DIST_FILE = path.join(SERVER_DIR, 'dist', 'index.js');

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

async function start() {
  // Pull latest (HidenCloud auto-pull may have already done this)
  if (fs.existsSync(path.join(REPO_ROOT, '.git'))) {
    try {
      run('git stash --include-untracked', REPO_ROOT);
    } catch {}
    try {
      run('git pull', REPO_ROOT);
    } catch {}
  }

  // Generate Prisma client (needed even with pre-built dist)
  try {
    run('npx prisma generate', SERVER_DIR);
  } catch {
    console.log('[TriQ] Prisma generate failed, continuing...');
  }

  if (!fs.existsSync(DIST_FILE)) {
    console.error('[TriQ] No pre-built dist found. Run CI workflow first to build.');
    process.exit(1);
  }

  require(DIST_FILE);
}

start().catch(err => {
  console.error('[TriQ] Fatal startup error:', err.message);
  process.exit(1);
});
