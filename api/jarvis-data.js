// PINTOK APTEKA — Jarvis Live Data Endpoint (Attendance + Sales + Competitors)
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { WORKPLACES, getTashkentNow } = require('../attendance');
const { readSalesStore, saveSalesReport, normalizeFAptekaPayload } = require('./f-apteka-sync');
const { getEnv } = require('../jarvis_env');

const DATA_DIR = path.join(__dirname, '..', 'bot-data');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const COMPETITORS_FILE = path.join(DATA_DIR, 'jarvis-competitors.json');

function getTodayDateStr() {
  try {
    return getTashkentNow().dateStr;
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function readJsonSafe(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (_) {}
  return fallback;
}

function writeJsonSafe(filePath, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (_) {
    return false;
  }
}

function buildAttendanceSnapshot(dateStr) {
  const raw = readJsonSafe(ATTENDANCE_FILE, { employees: {}, records: {} });
  const employeesMap = raw.employees || {};
  const dayRecords = (raw.records && raw.records[dateStr]) || {};

  const branchMap = {};
  for (const wp of WORKPLACES) {
    branchMap[wp.id] = {
      id: wp.id,
      branchNumber: wp.branchNumber,
      name: wp.name,
      shortName: wp.shortName,
      address: wp.address,
      totalStaff: 0,
      present: 0,
      late: 0,
      absent: 0,
      sick: 0,
      totalFine: 0,
      employees: []
    };
  }

  let totalStaff = 0;
  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalFine = 0;

  for (const [empId, emp] of Object.entries(employeesMap)) {
    if (!emp || emp.archived) continue;
    const bId = emp.workplaceId || emp.branchId || 'branch_1';
    if (!branchMap[bId]) {
      branchMap[bId] = {
        id: bId,
        branchNumber: 99,
        name: emp.workplaceName || bId,
        shortName: emp.workplaceName || bId,
        address: '',
        totalStaff: 0,
        present: 0,
        late: 0,
        absent: 0,
        sick: 0,
        totalFine: 0,
        employees: []
      };
    }

    const rec = dayRecords[empId] || null;
    const isSick = Boolean(emp.sickLeave && emp.sickLeave.active);
    const hasCheckIn = Boolean(rec && rec.checkIn && rec.checkIn.time);
    const hasCheckOut = Boolean(rec && rec.checkOut && rec.checkOut.time);
    const lateMinutes = Number((rec && rec.lateMinutes) || 0);
    const fine = Number((rec && rec.fine) || 0);

    let status = 'absent';
    if (isSick) status = 'sick';
    else if (hasCheckIn && lateMinutes > 0) status = 'late';
    else if (hasCheckIn) status = 'present';

    const item = {
      id: empId,
      name: emp.name || emp.fullName || 'Хызметкер',
      phone: emp.phone || '',
      branchId: bId,
      branchName: branchMap[bId].name,
      shift: (rec && rec.shiftId) || emp.shiftId || 'SHIFT_1',
      status,
      checkInTime: (rec && rec.checkIn && rec.checkIn.time) || null,
      checkOutTime: (rec && rec.checkOut && rec.checkOut.time) || null,
      lateMinutes,
      fine,
      excused: Boolean(rec && rec.excused)
    };

    const br = branchMap[bId];
    br.totalStaff += 1;
    totalStaff += 1;
    if (status === 'present') {
      br.present += 1;
      totalPresent += 1;
    } else if (status === 'late') {
      br.present += 1;
      br.late += 1;
      totalPresent += 1;
      totalLate += 1;
    } else if (status === 'sick') {
      br.sick += 1;
    } else {
      br.absent += 1;
      totalAbsent += 1;
    }
    br.totalFine += fine;
    totalFine += fine;
    br.employees.push(item);
  }

  return {
    date: dateStr,
    summary: {
      totalStaff,
      present: totalPresent,
      late: totalLate,
      absent: totalAbsent,
      totalFine
    },
    branches: Object.values(branchMap).sort((a, b) => a.branchNumber - b.branchNumber)
  };
}

function sendJson(res, status, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(payload);
  }
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
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

  if (req.method === 'GET') {
    const date = getQueryParam(req, 'date') || getTodayDateStr();
    const attendance = buildAttendanceSnapshot(date);
    const salesStore = readSalesStore();
    const competitorsStore = readJsonSafe(COMPETITORS_FILE, { items: [] });

    return sendJson(res, 200, {
      ok: true,
      date,
      attendance,
      salesToday: (salesStore.byDate && salesStore.byDate[date]) || null,
      salesHistory: Object.values(salesStore.byDate || {})
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 14),
      competitors: Array.isArray(competitorsStore.items) ? competitorsStore.items : [],
      fAptekaConfig: {
        apiConfigured: Boolean(getEnv('F_APTEKA_API_URL')),
        webhookEndpoint: '/api/f-apteka-sync',
        lastSyncAt: salesStore.lastSyncAt || null,
        lastSource: salesStore.lastSource || null
      }
    });
  }

  if (req.method === 'POST') {
    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (_) {
      return sendJson(res, 400, { ok: false, error: 'Қәте JSON формат' });
    }

    const type = String(body.type || '').toLowerCase();

    if (type === 'sales') {
      const report = normalizeFAptekaPayload(body.payload || body, body.date || getTodayDateStr());
      const { persistedToDisk } = saveSalesReport(report);
      return sendJson(res, 200, { ok: true, persistedToDisk, report });
    }

    if (type === 'competitor') {
      const store = readJsonSafe(COMPETITORS_FILE, { items: [] });
      if (!Array.isArray(store.items)) store.items = [];
      const item = {
        id: String(body.id || `comp_${Date.now()}`),
        name: String(body.name || '').trim(),
        branchArea: String(body.branchArea || '1-Филиал (Шымбай)').trim(),
        priceLevel: String(body.priceLevel || 'Орташа').trim(),
        strengths: String(body.strengths || '').trim(),
        weaknesses: String(body.weaknesses || '').trim(),
        promos: String(body.promos || '').trim(),
        updatedAt: new Date().toISOString()
      };
      if (!item.name) {
        return sendJson(res, 400, { ok: false, error: 'Бәсекилес аптека атын киритиң' });
      }
      const existingIdx = store.items.findIndex((c) => c.id === item.id);
      if (existingIdx >= 0) store.items[existingIdx] = item;
      else store.items.unshift(item);
      const persistedToDisk = writeJsonSafe(COMPETITORS_FILE, store);
      return sendJson(res, 200, { ok: true, persistedToDisk, item, competitors: store.items });
    }

    if (type === 'delete_competitor') {
      const store = readJsonSafe(COMPETITORS_FILE, { items: [] });
      store.items = (store.items || []).filter((c) => c.id !== body.id);
      const persistedToDisk = writeJsonSafe(COMPETITORS_FILE, store);
      return sendJson(res, 200, { ok: true, persistedToDisk, competitors: store.items });
    }

    return sendJson(res, 400, { ok: false, error: 'Белгисиз сораў түри' });
  }

  return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
}

handler.buildAttendanceSnapshot = buildAttendanceSnapshot;

module.exports = handler;
