// PINTOK APTEKA — Dedicated Local Computer Server for Jarvis AI & Dashboard
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./jarvis_env');
loadEnv();

const jarvisChatHandler = require('./api/jarvis-chat');
const jarvisDataHandler = require('./api/jarvis-data');
const fAptekaSyncHandler = require('./api/f-apteka-sync');

const PORT = Number(process.env.JARVIS_PORT || process.env.PORT) || 8080;
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

function readRequestBody(req, maxBytes = 8 * 1024 * 1024) {
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

const apiRoutes = {
  '/api/jarvis-chat': jarvisChatHandler,
  '/api/jarvis-data': jarvisDataHandler,
  '/api/f-apteka-sync': fAptekaSyncHandler
};

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ ok: true, service: 'jarvis-desktop', port: PORT }));
    return;
  }

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

  const relPath = urlPath === '/' ? 'jarvis.html' : urlPath.replace(/^\/+/, '');
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
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`====================================================================`);
  console.log(`  JARVIS AI (Компьютер сервери) иске түсти!`);
  console.log(`  Мәнзил: http://localhost:${PORT}/jarvis.html`);
  console.log(`====================================================================`);
});
