const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = __dirname;
const SERVER_DIR = path.join(REPO_ROOT, 'apps', 'server');
const WEB_DIR = path.join(REPO_ROOT, 'apps', 'web');
const DIST_FILE = path.join(SERVER_DIR, 'dist', 'index.js');
const ENV_FILE = path.join(SERVER_DIR, '.env');

function log(...args) {
  console.log('[TriQ Boot]', ...args);
}

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

async function start() {
  log('=== TriQ Server Startup ===');
  log('Node version:', process.version);
  log('Working directory:', REPO_ROOT);

  // Pull latest
  if (fs.existsSync(path.join(REPO_ROOT, '.git'))) {
    try {
      log('Stashing local changes...');
      run('git stash', REPO_ROOT);
    } catch {}
    try {
      log('Pulling latest code...');
      run('git pull', REPO_ROOT);
      const head = execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim();
      log('Current commit:', head);
    } catch (err) {
      log('Git pull failed:', err.message);
    }
  }

  // Check env
  if (fs.existsSync(ENV_FILE)) {
    log('.env file found at', ENV_FILE);
  } else {
    log('WARNING: .env file NOT found at', ENV_FILE);
  }

  // Install dependencies (including dev for build tools)
  log('Installing dependencies (including dev)...');
  try {
    run('npm install --include=dev', REPO_ROOT);
  } catch (err) {
    log('npm install failed:', err.message);
    log('Trying without dev dependencies...');
    try { run('npm install', REPO_ROOT); } catch (e) { log('npm install failed again:', e.message); }
  }

  // Generate Prisma client
  log('Generating Prisma client...');
  try {
    run('npx prisma generate', SERVER_DIR);
    log('Prisma client generated.');
  } catch (err) {
    log('Prisma generate failed:', err.message);
  }

  // Build web (Vite)
  log('Building web application (Vite)...');
  try {
    run('npm run build -w apps/web', REPO_ROOT);
    log('Web build complete.');
  } catch (err) {
    log('Web build failed:', err.message);
  }

  // Build server (TypeScript)
  log('Building server (TypeScript)...');
  try {
    run('npm run build -w apps/server', REPO_ROOT);
    log('Server build complete.');
  } catch (err) {
    log('Server build failed:', err.message);
  }

  // Verify dist exists
  if (!fs.existsSync(DIST_FILE)) {
    log('ERROR: dist/index.js not found after build. Cannot start server.');
    process.exit(1);
  }
  const distSize = fs.statSync(DIST_FILE).size;
  log('Server dist ready:', DIST_FILE, '(' + distSize + ' bytes)');

  // Verify web dist exists
  const webDist = path.join(WEB_DIR, 'dist');
  if (fs.existsSync(webDist)) {
    const webFiles = fs.readdirSync(webDist);
    log('Web dist ready:', webFiles.length, 'files in', webDist);
  } else {
    log('WARNING: Web dist not found at', webDist);
  }

  // Start server
  log('=== Starting server ===');
  require(DIST_FILE);
}

start().catch(err => {
  console.error('[TriQ Boot] FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
