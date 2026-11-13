// PINTOK APTEKA — 24/7 Cloud Runner (Employee Bot + Admin Bot + Group Bot + Web Dashboard)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pollUpdates } = require('./bot');
const { pollAdminUpdates } = require('./admin_bot');

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
  const server = http.createServer((req, res) => {
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
