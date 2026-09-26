import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 4173;

// Read version from package.json
let appVersion = '1.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  appVersion = pkg.version || '1.0.0';
} catch (e) {}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// Check if dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  console.error('\n[Error] The "dist" directory was not found.');
  console.log('Please run "npm run build" first to create the local build files.\n');
  process.exit(1);
}

// Utility to run shell commands as Promise
const runCmd = (cmd, timeout = 4000) => {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: __dirname, timeout }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout ? stdout.trim() : '');
    });
  });
};

const server = http.createServer(async (req, res) => {
  let reqPath = (req.url || '/').split('?')[0];

  // API Endpoint: System Status
  if (reqPath === '/api/system/status' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      app: 'A-Mart Supermarket Inventory & POS',
      version: appVersion,
      mode: 'desktop-standalone',
      port: PORT,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // API Endpoint: Check for Updates
  if (reqPath === '/api/system/check-update' && req.method === 'GET') {
    try {
      await runCmd('git fetch origin main', 3500);
      const countStr = await runCmd('git rev-list HEAD..origin/main --count', 2000);
      const count = parseInt(countStr, 10) || 0;

      if (count > 0) {
        let commitMsg = '';
        try {
          commitMsg = await runCmd('git log -1 origin/main --pretty=%s', 2000);
        } catch (_) {}

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          hasUpdate: true,
          pendingCommits: count,
          latestMessage: commitMsg || 'New update available on main branch'
        }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        hasUpdate: false,
        pendingCommits: 0,
        message: 'System is up to date'
      }));
      return;
    } catch (err) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        hasUpdate: false,
        offline: true,
        message: 'Unable to reach update server (offline mode)'
      }));
      return;
    }
  }

  // API Endpoint: Apply Update
  if (reqPath === '/api/system/apply-update' && (req.method === 'POST' || req.method === 'GET')) {
    try {
      const pullOutput = await runCmd('git pull origin main', 8000);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        success: true,
        message: 'Update pulled successfully. Reloading application...',
        output: pullOutput
      }));
      return;
    } catch (err) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        success: false,
        error: err.message || 'Failed to pull update'
      }));
      return;
    }
  }

  // Static File Serving
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let filePath = path.join(DIST_DIR, reqPath);

  // Security check: ensure path does not escape DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  // SPA fallback: return index.html if file doesn't exist
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const isNoCache = ext === '.html' || reqPath === '/sw.js' || reqPath === '/manifest.webmanifest';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
    } else {
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': isNoCache ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000'
      };
      if (reqPath === '/sw.js') {
        headers['Service-Worker-Allowed'] = '/';
      }
      res.writeHead(200, headers);
      res.end(content);
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const url = `http://localhost:${PORT}`;
    if (!process.env.NO_BROWSER) {
      const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
      const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

      if (fs.existsSync(edgePath)) {
        exec(`"${edgePath}" --app="${url}"`);
      } else if (fs.existsSync(chromePath)) {
        exec(`"${chromePath}" --app="${url}"`);
      } else {
        exec(`start ${url}`);
      }
    }
    process.exit(0);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n======================================================');
  console.log('         A-MART SUPERMARKET & POS - LOCAL BUILD       ');
  console.log('======================================================');
  console.log(` Status: Running locally (v${appVersion})`);
  console.log(` Address: ${url}`);
  console.log(' Mode: Standalone Desktop Window');
  console.log(' Automatic Update API: Active (/api/system/*)');
  console.log(' Press Ctrl+C in this terminal to stop the application.');
  console.log('======================================================\n');

  // Check available native browsers to launch in frameless App Window mode
  if (!process.env.NO_BROWSER) {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    if (fs.existsSync(edgePath)) {
      exec(`"${edgePath}" --app="${url}"`);
    } else if (fs.existsSync(chromePath)) {
      exec(`"${chromePath}" --app="${url}"`);
    } else {
      exec(`start ${url}`);
    }
  }
});
