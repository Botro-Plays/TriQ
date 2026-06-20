const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = __dirname;
const SERVER_DIR = path.join(REPO_ROOT, 'apps', 'server');
const DIST_FILE = path.join(SERVER_DIR, 'dist', 'index.js');
const ENV_FILE = path.join(SERVER_DIR, '.env');

function log(...args) {
  console.log('[TriQ Boot]', ...args);
}

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

async function start() {
  log('Starting TriQ server...');
  log('Node version:', process.version);
  log('Working directory:', REPO_ROOT);

  // Pull latest (HidenCloud auto-pull may have already done this)
  if (fs.existsSync(path.join(REPO_ROOT, '.git'))) {
    try {
      log('Stashing local changes...');
      run('git stash --include-untracked', REPO_ROOT);
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

  // Check env file
  if (fs.existsSync(ENV_FILE)) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    const hasDbUrl = envContent.includes('DATABASE_URL');
    const hasPort = envContent.includes('PORT');
    log('.env file found. DATABASE_URL present:', hasDbUrl, 'PORT present:', hasPort);
  } else {
    log('WARNING: .env file not found at', ENV_FILE);
  }

  // Check dist file
  if (!fs.existsSync(DIST_FILE)) {
    log('ERROR: No pre-built dist found at', DIST_FILE);
    process.exit(1);
  }
  const distStat = fs.statSync(DIST_FILE);
  log('Pre-built dist found:', DIST_FILE, 'size:', distStat.size, 'bytes');

  // Generate Prisma client (needed even with pre-built dist)
  try {
    log('Generating Prisma client...');
    run('npx prisma generate', SERVER_DIR);
  } catch (err) {
    log('Prisma generate failed:', err.message);
  }

  log('Loading server from dist...');
  require(DIST_FILE);
  log('Server module loaded successfully.');
}

start().catch(err => {
  console.error('[TriQ Boot] Fatal startup error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
