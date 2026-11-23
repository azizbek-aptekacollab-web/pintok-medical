// PINTOK APTEKA — F-Apteka Plug-and-Play Integration Gateway (Webhook Push + API Pull + Normalization)
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { getEnv } = require('../jarvis_env');
const { getTashkentNow } = require('../attendance');

const DATA_DIR = path.join(__dirname, '..', 'bot-data');
const SALES_FILE = path.join(DATA_DIR, 'jarvis-sales.json');

function toNumber(val) {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val === null || val === undefined) return 0;
  const cleaned = String(val).replace(/\s+/g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function getTodayDateStr() {
  try {
    return getTashkentNow().dateStr;
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function normalizeFAptekaPayload(raw = {}, fallbackDate) {
  const date = String(raw.date || raw.дата || raw.sana || fallbackDate || getTodayDateStr()).slice(0, 10);
  const rawBranches = Array.isArray(raw.branches || raw.филиалы || raw.filiallar)
    ? (raw.branches || raw.филиалы || raw.filiallar)
    : [];
  const rawPharmacists = Array.isArray(
    raw.pharmacists || raw.фармацевты || raw.кассиры || raw.staff || raw.сотрудники || raw.qizlar
  )
    ? (raw.pharmacists || raw.фармацевты || raw.кассиры || raw.staff || raw.сотрудники || raw.qizlar)
    : [];

  const branches = rawBranches.map((b, idx) => {
    const revenue = toNumber(b.revenue ?? b.выручка ?? b.сумма ?? b.sales ?? b.sawda ?? b.total);
    const checks = Math.round(toNumber(b.checks ?? b.чеки ?? b.checkCount ?? b.chek));
    const returns = toNumber(b.returns ?? b.возвраты ?? b.qaytarıw);
    const profit = toNumber(b.profit ?? b.прибыль ?? b.payda);
    const avgCheck = checks > 0 ? Math.round(revenue / checks) : toNumber(b.avgCheck ?? b.средний_чек);
    return {
      id: String(b.id || b.branchId || `branch_${idx + 1}`),
      name: String(b.name || b.филиал || b.filial || `${idx + 1}-Филиал`).trim(),
      revenue,
      checks,
      returns,
      profit,
      avgCheck
    };
  });

  const pharmacists = rawPharmacists.map((p) => {
    const revenue = toNumber(p.revenue ?? p.sales ?? p.сумма ?? p.выручка ?? p.sawda);
    const checks = Math.round(toNumber(p.checks ?? p.чеки ?? p.checkCount ?? p.chek));
    const avgCheck = checks > 0 ? Math.round(revenue / checks) : toNumber(p.avgCheck ?? p.средний_чек);
    return {
      name: String(p.name || p.имя || p.фио || p.fio || p.фармацевт || 'Белгисиз').trim(),
      branch: String(p.branch || p.филиал || p.filial || '').trim(),
      revenue,
      checks,
      avgCheck
    };
  });

  // Sort pharmacists by revenue descending
  pharmacists.sort((a, b) => b.revenue - a.revenue);

  let totalRevenue = toNumber(raw.totalRevenue ?? raw.итого_выручка ?? raw.выручка ?? raw.revenue);
  let totalChecks = Math.round(toNumber(raw.totalChecks ?? raw.итого_чеки ?? raw.чеки ?? raw.checks));
  let totalReturns = toNumber(raw.totalReturns ?? raw.возвраты ?? raw.returns);
  let totalProfit = toNumber(raw.totalProfit ?? raw.прибыль ?? raw.profit);

  if (!totalRevenue && branches.length) {
    totalRevenue = branches.reduce((sum, b) => sum + b.revenue, 0);
  }
  if (!totalRevenue && pharmacists.length) {
    totalRevenue = pharmacists.reduce((sum, p) => sum + p.revenue, 0);
  }
  if (!totalChecks && branches.length) {
    totalChecks = branches.reduce((sum, b) => sum + b.checks, 0);
  }
  if (!totalChecks && pharmacists.length) {
    totalChecks = pharmacists.reduce((sum, p) => sum + p.checks, 0);
  }
  if (!totalReturns && branches.length) {
    totalReturns = branches.reduce((sum, b) => sum + b.returns, 0);
  }
  if (!totalProfit && branches.length) {
    totalProfit = branches.reduce((sum, b) => sum + b.profit, 0);
  }

  return {
    date,
    source: String(raw.source || 'f-apteka'),
    syncedAt: new Date().toISOString(),
    totalRevenue,
    totalChecks,
    totalReturns,
    totalProfit,
    avgCheck: totalChecks > 0 ? Math.round(totalRevenue / totalChecks) : 0,
    branches,
    pharmacists,
    notes: String(raw.notes || raw.комментарий || '').trim()
  };
}

function readSalesStore() {
  try {
    if (fs.existsSync(SALES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SALES_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (_) {}
  return { byDate: {}, lastSyncAt: null, lastSource: null };
}

function saveSalesReport(report) {
  const store = readSalesStore();
  if (!store.byDate || typeof store.byDate !== 'object') store.byDate = {};
  store.byDate[report.date] = report;
  store.lastSyncAt = report.syncedAt;
  store.lastSource = report.source;
  let persistedToDisk = false;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SALES_FILE, JSON.stringify(store, null, 2), 'utf8');
    persistedToDisk = true;
  } catch (_) {
    persistedToDisk = false;
  }
  return { store, persistedToDisk };
}

function fetchJson(urlString, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) {
            return reject(new Error(`F-Apteka JSON емес жуўап қайтарды (HTTP ${res.statusCode})`));
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`F-Apteka сервери қәте қайтарды: HTTP ${res.statusCode}`));
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('F-Apteka сервери жуўап бермеди (timeout)')));
    req.on('error', reject);
    req.end();
  });
}

function sendJson(res, status, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(payload);
  }
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-f-apteka-token, x-f-apteka-url, x-f-apteka-api-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function getQueryParam(req, name) {
  if (req.query && req.query[name] !== undefined) return req.query[name];
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    return u.searchParams.get(name);
  } catch (_) {
    return null;
  }
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  const webhookSecret = getEnv('F_APTEKA_WEBHOOK_SECRET', 'pintok-f-apteka-sync-2026');
  const envApiUrl = getEnv('F_APTEKA_API_URL', '');
  const envApiToken = getEnv('F_APTEKA_API_TOKEN', '');

  if (req.method === 'GET') {
    const action = String(getQueryParam(req, 'action') || 'status').toLowerCase();
    const date = getQueryParam(req, 'date') || getTodayDateStr();
    const store = readSalesStore();

    if (action === 'pull') {
      const apiUrl = String((req.headers && req.headers['x-f-apteka-url']) || envApiUrl || '').trim();
      const apiToken = String((req.headers && req.headers['x-f-apteka-api-token']) || envApiToken || '').trim();

      if (!apiUrl) {
        return sendJson(res, 200, {
          ok: false,
          code: 'NOT_CONFIGURED',
          message:
            'F-Apteka API мәнзили еле киритилмеген. «Сазлаў → F-Apteka интеграциясы» бөлимине API URL ҳәм Token киритсеңиз, автомат синхронлаў дәрҳал ислейди.',
          webhookEndpoint: '/api/f-apteka-sync',
          lastSyncAt: store.lastSyncAt
        });
      }

      try {
        const sep = apiUrl.includes('?') ? '&' : '?';
        const fullUrl = `${apiUrl}${sep}date=${encodeURIComponent(date)}`;
        const headers = apiToken ? { Authorization: `Bearer ${apiToken}`, 'x-api-key': apiToken } : {};
        const remoteData = await fetchJson(fullUrl, headers);
        const report = normalizeFAptekaPayload({ ...remoteData, source: 'f-apteka-api' }, date);
        const { persistedToDisk } = saveSalesReport(report);
        return sendJson(res, 200, {
          ok: true,
          mode: 'pull',
          persistedToDisk,
          report
        });
      } catch (err) {
        return sendJson(res, 502, {
          ok: false,
          code: 'SYNC_ERROR',
          error: err.message
        });
      }
    }

    return sendJson(res, 200, {
      ok: true,
      service: 'f-apteka-sync',
      apiConfigured: Boolean(envApiUrl),
      webhookEndpoint: '/api/f-apteka-sync',
      lastSyncAt: store.lastSyncAt,
      lastSource: store.lastSource,
      savedDatesCount: Object.keys(store.byDate || {}).length
    });
  }

  if (req.method === 'POST') {
    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (_) {
      return sendJson(res, 400, { ok: false, error: 'Қәте JSON формат' });
    }

    const mode = String(body.mode || 'webhook').toLowerCase();
    // Webhook push from external F-Apteka server requires token verification
    if (mode === 'webhook') {
      const providedToken = String(
        (req.headers && req.headers['x-f-apteka-token']) ||
          body.token ||
          getQueryParam(req, 'token') ||
          ''
      ).trim();
      if (webhookSecret && providedToken !== webhookSecret) {
        return sendJson(res, 401, {
          ok: false,
          code: 'UNAUTHORIZED',
          error: 'F-Apteka webhook токени қәте (x-f-apteka-token).'
        });
      }
    }

    const report = normalizeFAptekaPayload(
      {
        ...body,
        source: mode === 'webhook' ? 'f-apteka-webhook' : body.source || `f-apteka-${mode}`
      },
      body.date || getTodayDateStr()
    );
    const { persistedToDisk } = saveSalesReport(report);

    return sendJson(res, 200, {
      ok: true,
      mode,
      persistedToDisk,
      report
    });
  }

  return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
}

handler.normalizeFAptekaPayload = normalizeFAptekaPayload;
handler.readSalesStore = readSalesStore;
handler.saveSalesReport = saveSalesReport;

module.exports = handler;
