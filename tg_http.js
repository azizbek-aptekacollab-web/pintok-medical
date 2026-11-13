const https = require('https');

/**
 * Telegram Bot API request helper using native Node.js https over IPv4.
 * Avoids Node undici fetch ECONNRESET / IPv6 issues on Windows networks.
 */
function postJson(urlStr, data = {}, timeoutMs = 35000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body = JSON.stringify(data);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      family: 4,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(new Error(`Invalid JSON from Telegram (${res.statusCode}): ${raw.slice(0, 200)}`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Telegram request timeout after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

async function tgApiRequest(token, method, data = {}, label = 'Bot') {
  const maxRetries = method === 'getUpdates' ? 1 : 3;
  const timeoutMs = method === 'getUpdates' ? 35000 : 15000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await postJson(`https://api.telegram.org/bot${token}/${method}`, data, timeoutMs);
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`${label} API error on ${method}:`, err.message);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

module.exports = {
  postJson,
  tgApiRequest
};
