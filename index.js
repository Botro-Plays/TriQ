const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = __dirname;
const SERVER_DIR = path.join(REPO_ROOT, 'apps', 'server');
const DIST_FILE = path.join(SERVER_DIR, 'dist', 'index.js');
const ENV_FILE = path.join(SERVER_DIR, '.env');
const ENV_EXAMPLE = path.join(SERVER_DIR, '.env.example');

function run(cmd, cwd, env = {}) {
  console.log(`[TriQ] Running: ${cmd} (cwd: ${cwd})`);
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

  // 1. Install root dependencies
  if (!fs.existsSync(path.join(REPO_ROOT, 'node_modules'))) {
    console.log('[TriQ] Installing root dependencies...');
    run('npm install', REPO_ROOT);
  }

  // 2. Install server dependencies (monorepo sub-package)
  if (!fs.existsSync(path.join(SERVER_DIR, 'node_modules'))) {
    console.log('[TriQ] Installing server dependencies...');
    run('npm install', SERVER_DIR);
  }

  // 3. Auto-create .env from example if missing
  if (!fs.existsSync(ENV_FILE) && fs.existsSync(ENV_EXAMPLE)) {
    console.log('[TriQ] Creating .env from .env.example...');
    fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
    console.log('[TriQ] WARNING: .env was auto-created from example. Please set real DATABASE_URL and secrets!');
  }

  // 4. Generate Prisma client
  console.log('[TriQ] Generating Prisma client...');
  run('npx prisma generate', SERVER_DIR);

  // 5. Deploy database migrations (idempotent)
  console.log('[TriQ] Deploying database migrations...');
  run('npx prisma migrate deploy', SERVER_DIR);

  // 6. Seed database (idempotent via upsert)
  console.log('[TriQ] Seeding database...');
  run('npx prisma db seed', SERVER_DIR);

  // 7. Compile TypeScript
  console.log('[TriQ] Building TypeScript...');
  run('npm run build', SERVER_DIR);

  // 8. Verify dist was created
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
