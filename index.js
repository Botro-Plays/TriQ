const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = __dirname;
const SERVER_DIR = path.join(REPO_ROOT, 'apps', 'server');
const WEB_DIR = path.join(REPO_ROOT, 'apps', 'web');
const WEB_DIST_DIR = path.join(WEB_DIR, 'dist');
const DIST_FILE = path.join(SERVER_DIR, 'dist', 'index.js');
const ENV_FILE = path.join(SERVER_DIR, '.env');
const ENV_EXAMPLE = path.join(SERVER_DIR, '.env.example');
const BUILD_LOCK = path.join(SERVER_DIR, '.building');

function run(cmd, cwd, env = {}) {
  console.log(`[TriQ] Running: ${cmd} (cwd: ${cwd})`);
  execSync(cmd, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });
}

function backgroundDbSetup() {
  const hasPrismaClient = fs.existsSync(path.join(SERVER_DIR, 'node_modules', '.prisma')) ||
                          fs.existsSync(path.join(REPO_ROOT, 'node_modules', '.prisma'));
  if (!hasPrismaClient) {
    console.log('[TriQ] Prisma client not found. Skipping background DB setup.');
    return;
  }

  console.log('[TriQ] [Background] Deploying database migrations...');
  try {
    run('npx prisma migrate deploy', SERVER_DIR);
    console.log('[TriQ] [Background] Migrations applied.');
  } catch {
    console.log('[TriQ] [Background] Migrate deploy failed or no migrations found.');
  }

  // Always push schema to ensure tables exist (idempotent)
  console.log('[TriQ] [Background] Pushing schema to database...');
  try {
    run('npx prisma db push --accept-data-loss', SERVER_DIR);
    console.log('[TriQ] [Background] Schema pushed successfully.');
  } catch {
    console.log('[TriQ] [Background] DB push failed or already up to date.');
  }

  console.log('[TriQ] [Background] Seeding database...');
  try {
    run('npx tsx prisma/seed.ts', SERVER_DIR);
    console.log('[TriQ] [Background] Seed complete.');
  } catch {
    console.log('[TriQ] [Background] Seed skipped or failed.');
  }
}

function isSourceNewerThanDist() {
  if (!fs.existsSync(DIST_FILE)) return true;
  const distMtime = fs.statSync(DIST_FILE).mtimeMs;
  const srcDir = path.join(SERVER_DIR, 'src');
  if (!fs.existsSync(srcDir)) return false;

  function checkDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (checkDir(fullPath)) return true;
      } else if (entry.isFile() && fs.statSync(fullPath).mtimeMs > distMtime) {
        return true;
      }
    }
    return false;
  }
  return checkDir(srcDir);
}

function isWebSourceNewerThanDist() {
  if (!fs.existsSync(WEB_DIST_DIR)) {
    console.log('[TriQ] Web dist does not exist, rebuild needed.');
    return true;
  }
  const distMtime = fs.statSync(WEB_DIST_DIR).mtimeMs;
  const distMtimeStr = new Date(distMtime).toISOString();
  const srcDir = path.join(WEB_DIR, 'src');
  if (!fs.existsSync(srcDir)) {
    console.log('[TriQ] Web src dir missing, skipping web rebuild check.');
    return false;
  }

  let newestFile = { path: '', mtime: 0 };

  function checkDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (checkDir(fullPath)) return true;
      } else if (entry.isFile()) {
        const mtime = fs.statSync(fullPath).mtimeMs;
        if (mtime > newestFile.mtime) {
          newestFile = { path: fullPath, mtime };
        }
        if (mtime > distMtime) {
          return true;
        }
      }
    }
    return false;
  }
  const result = checkDir(srcDir);
  console.log(`[TriQ] Web dist mtime: ${distMtimeStr}, newest src: ${newestFile.path} (${new Date(newestFile.mtime).toISOString()}), rebuild needed: ${result}`);
  return result;
}

function runSilent(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

async function start() {
  // ====== GIT CLEANUP & AUTO-UPDATE (first thing) ======
  if (fs.existsSync(path.join(REPO_ROOT, '.git'))) {
    console.log('[TriQ] Git repo detected. Cleaning local changes...');

    // Stash any local changes (including index.js edits by HidenCloud staff)
    try {
      run('git stash --include-untracked', REPO_ROOT);
      console.log('[TriQ] Local changes stashed.');
    } catch {
      console.log('[TriQ] Nothing to stash or stash failed, continuing...');
    }

    // Pull latest
    try {
      run('git pull', REPO_ROOT);
      console.log('[TriQ] Git pull complete.');
    } catch {
      console.log('[TriQ] Git pull failed, continuing with current code...');
    }

    // Check if dist exists after pull (newer pre-built dist)
    if (fs.existsSync(DIST_FILE)) {
      console.log('[TriQ] Pre-built dist found after update.');
    }
  }

  // ====== CHECK IF REBUILD IS NEEDED ======
  if (fs.existsSync(DIST_FILE) && isSourceNewerThanDist()) {
    console.log('[TriQ] Server source changed since last build. Rebuilding...');
    try {
      fs.rmSync(path.join(SERVER_DIR, 'dist'), { recursive: true, force: true });
      console.log('[TriQ] Old dist removed.');
    } catch {
      console.log('[TriQ] Could not remove old dist, continuing...');
    }
  }

  // ====== FAST PATH: pre-built dist exists ======
  if (fs.existsSync(DIST_FILE)) {
    // Generate Prisma client first (server code imports it)
    console.log('[TriQ] Generating Prisma client...');
    try { run('npx prisma generate', SERVER_DIR); } catch {
      console.log('[TriQ] Prisma generate failed, attempting to continue...');
    }

    console.log('[TriQ] Using pre-built dist.');
    require(DIST_FILE);
    console.log('[TriQ] ✅ Server and APIs are up and running!');

    // Run DB setup in background so HidenCloud doesn't timeout during startup
    setTimeout(() => backgroundDbSetup(), 2000);

    // Build web app in background if not built or source changed
    if (!fs.existsSync(WEB_DIST_DIR) || isWebSourceNewerThanDist()) {
      if (fs.existsSync(WEB_DIST_DIR) && isWebSourceNewerThanDist()) {
        console.log('[TriQ] Web source changed since last build. Rebuilding...');
      }
      setTimeout(() => {
        console.log('[TriQ] [Background] Building web app...');
        try {
          run('npm run build -w apps/web', REPO_ROOT);
          console.log('[TriQ] [Background] Web app built.');
        } catch {
          console.log('[TriQ] [Background] Web build failed.');
        }
      }, 3000);
    }

    return;
  }

  // ====== BUILD FLOW ======
  // Prevent duplicate builds if HidenCloud restarts during build
  if (fs.existsSync(BUILD_LOCK)) {
    console.log('[TriQ] Build already in progress (lock file exists). Waiting...');
    let waited = 0;
    while (fs.existsSync(BUILD_LOCK) && waited < 300) {
      await new Promise(r => setTimeout(r, 2000));
      waited += 2;
    }
    if (fs.existsSync(DIST_FILE)) {
      console.log('[TriQ] Build completed by another process. Starting...');
      require(DIST_FILE);
      return;
    }
    console.error('[TriQ] Build lock timeout. Removing stale lock.');
    try { fs.unlinkSync(BUILD_LOCK); } catch {}
  }

  console.log('[TriQ] No pre-built dist found. Building on server...');
  fs.writeFileSync(BUILD_LOCK, String(Date.now()));

  try {
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
    try {
      run('npx prisma migrate deploy', SERVER_DIR);
    } catch {
      console.log('[TriQ] Migrate deploy failed. Attempting prisma db push...');
      try {
        run('npx prisma db push --accept-data-loss', SERVER_DIR);
        console.log('[TriQ] Schema pushed successfully.');
      } catch {
        console.log('[TriQ] DB push also failed. Continuing without migrations...');
      }
    }

    // 6. Seed database (idempotent via upsert)
    console.log('[TriQ] Seeding database...');
    try {
      run('npx tsx prisma/seed.ts', SERVER_DIR);
    } catch {
      console.log('[TriQ] Seed skipped or failed.');
    }

    // 7. Build web PWA
    console.log('[TriQ] Building web app...');
    try { run('npm run build -w apps/web', REPO_ROOT); } catch {
      console.log('[TriQ] Web build failed or not configured, continuing...');
    }

    // 8. Compile server TypeScript
    console.log('[TriQ] Building server TypeScript...');
    run('npm run build', SERVER_DIR);

    // 8. Verify dist was created
    if (!fs.existsSync(DIST_FILE)) {
      console.error('[TriQ] Build completed but dist/index.js not found.');
      process.exit(1);
    }

    console.log('[TriQ] Build complete. Starting server...');
    require(DIST_FILE);
    console.log('[TriQ] ✅ Server and APIs are up and running!');
  } catch (err) {
    console.error('[TriQ] Build failed:', err.message);
    // Keep process alive briefly so HidenCloud logs the error
    await new Promise(r => setTimeout(r, 10000));
    process.exit(1);
  } finally {
    try { fs.unlinkSync(BUILD_LOCK); } catch {}
  }
}

start().catch(err => {
  console.error('[TriQ] Fatal startup error:', err.message);
  process.exit(1);
});
