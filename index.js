const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = __dirname;
const SERVER_DIR = path.join(REPO_ROOT, 'apps', 'server');
const DIST_FILE = path.join(SERVER_DIR, 'dist', 'index.js');

function run(cmd, cwd, env = {}) {
  console.log(`[TriQ] Running: ${cmd}`);
  execSync(cmd, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });
}

async function start() {
  // Fast path: pre-built dist exists
  if (fs.existsSync(DIST_FILE)) {
    console.log('[TriQ] Using pre-built dist.');
    require(DIST_FILE);
    return;
  }

  console.log('[TriQ] No pre-built dist found. Building on server...');

  // Ensure root dependencies are installed (npm workspaces)
  if (!fs.existsSync(path.join(REPO_ROOT, 'node_modules'))) {
    console.log('[TriQ] Installing root dependencies...');
    run('npm install', REPO_ROOT);
  }

  // Generate Prisma client (must match DATABASE_URL provider)
  console.log('[TriQ] Generating Prisma client...');
  run('npx prisma generate', SERVER_DIR);

  // Compile TypeScript
  console.log('[TriQ] Building TypeScript...');
  run('npm run build', SERVER_DIR);

  // Verify dist was created
  if (!fs.existsSync(DIST_FILE)) {
    console.error('[TriQ] Build completed but dist/index.js not found.');
    process.exit(1);
  }

  console.log('[TriQ] Starting server...');
  require(DIST_FILE);
}

start().catch(err => {
  console.error('[TriQ] Fatal startup error:', err.message);
  process.exit(1);
});
