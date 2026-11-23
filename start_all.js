// PINTOK APTEKA — 24/7 Cloud Runner (Employee Bot + Admin Bot + Group Bot + Web Dashboard + Jarvis AI)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./jarvis_env');
loadEnv();

const { pollUpdates } = require('./bot');
const { pollAdminUpdates } = require('./admin_bot');
const jarvisChatHandler = require('./api/jarvis-chat');
const jarvisDataHandler = require('./api/jarvis-data');
const fAptekaSyncHandler = require('./api/f-apteka-sync');

function readRequestBody(req, maxBytes = 6 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const PORT = Number(process.env.PORT) || 8080;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function startWebServer() {
  const server = http.createServer(async (req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    if (urlPath === '/health') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        ok: true,
        service: 'pintok-apteka',
        uptimeSeconds: Math.round(process.uptime())
      }));
      return;
    }

    const apiRoutes = {
      '/api/jarvis-chat': jarvisChatHandler,
      '/api/jarvis-data': jarvisDataHandler,
      '/api/f-apteka-sync': fAptekaSyncHandler
    };
    if (apiRoutes[urlPath]) {
      try {
        if (req.method === 'POST' || req.method === 'PUT') {
          req.body = await readRequestBody(req);
        }
        await apiRoutes[urlPath](req, res);
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ ok: false, error: err.message || 'Server error' }));
        }
      }
      return;
    }

    const relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const safePath = path.normalize(path.join(ROOT_DIR, relPath));

    if (!safePath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(safePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(safePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PINTOK APTEKA Web + Health Server listening on port ${PORT}`);
  });
}

function main() {
  startWebServer();

  console.log('Starting PINTOK APTEKA Employee Bot (@apekaaabot)...');
  pollUpdates().catch((err) => {
    console.error('Fatal Employee Bot error:', err);
  });

  console.log('Starting PINTOK APTEKA Admin Bot (@apteka_kontrol_bot)...');
  pollAdminUpdates().catch((err) => {
    console.error('Fatal Admin Bot error:', err);
  });
}

if (require.main === module) {
  main();
}

module.exports = { startWebServer, main };
