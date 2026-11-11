const fs = require('fs');
const path = require('path');

const MAX_DISTANCE_METERS = 4;
const MONTHLY_BONUS_SUM = 1000000;
const PENALTY_PER_5_MIN = 10000;

const WORKPLACES = [
  {
    id: 'branch_1',
    branchNumber: 1,
    name: 'Филиал №1',
    shortName: 'Филиал 1 (Шымбай Бесқала)',
    address: 'Шымбай қ., Бесқала көшеси',
    lat: 42.918927,
    lng: 59.779079,
    anchors: [
      { lat: 42.918927, lng: 59.779079 },
      { lat: 42.918991, lng: 59.779355 },
      { lat: 42.918915, lng: 59.779052 },
      { lat: 42.918947, lng: 59.779064 }
    ],
    mapUrl: 'https://maps.google.com/maps?q=42.918927,59.779079&ll=42.918927,59.779079&z=16'
  },
  {
    id: 'branch_2',
    branchNumber: 2,
    name: 'Филиал №2',
    shortName: 'Филиал 2 (Шымбай Базар)',
    address: 'Шымбай қ., Орайлық Базар',
    lat: 68.882393,
    lng: 81.000045,
    anchors: [
      { lat: 68.882393, lng: 81.000045 },
      { lat: 42.920301, lng: 59.790651 },
      { lat: 42.933551, lng: 59.773614 },
      { lat: 42.933495, lng: 59.773732 },
      { lat: 42.933575, lng: 59.773668 },
      { lat: 42.933719, lng: 59.773445 }
    ],
    mapUrl: 'https://maps.google.com/maps?q=68.882393,81.000045&ll=68.882393,81.000045&z=16'
  },
  {
    id: 'branch_3',
    branchNumber: 3,
    name: 'Филиал №3',
    shortName: 'Филиал 3 (Хожели)',
    address: 'Хожели қ., Орайлық көше',
    lat: 68.882393,
    lng: 81.000045,
    anchors: [
      { lat: 68.882393, lng: 81.000045 },
      { lat: 42.411627, lng: 59.46304 },
      { lat: 42.411633, lng: 59.462748 },
      { lat: 42.411664, lng: 59.462758 },
      { lat: 42.411553, lng: 59.462991 },
      { lat: 42.411386, lng: 59.462729 },
      { lat: 42.412036, lng: 59.463001 },
      { lat: 42.411168, lng: 59.462472 }
    ],
    mapUrl: 'https://maps.google.com/maps?q=68.882393,81.000045&ll=68.882393,81.000045&z=16'
  },
  {
    id: 'branch_4',
    branchNumber: 4,
    name: 'Филиал №4',
    shortName: 'Филиал 4 (Нөкис)',
    address: 'Нөкис қ., А. Досназаров көшеси',
    lat: 42.473931,
    lng: 59.609268,
    anchors: [
      { lat: 42.473931, lng: 59.609268 },
      { lat: 42.473869, lng: 59.609245 },
      { lat: 42.473911, lng: 59.609283 }
    ],
    mapUrl: 'https://maps.google.com/maps?q=42.473931,59.609268&ll=42.473931,59.609268&z=16'
  },
  {
    id: 'warehouse',
    branchNumber: 5,
    name: '📦 Склад',
    shortName: '📦 Орайлық Склад',
    address: 'Шымбай қ., Орайлық Склад',
    lat: 42.918825,
    lng: 59.778217,
    anchors: [
      { lat: 42.918825, lng: 59.778217 },
      { lat: 42.919013, lng: 59.778285 },
      { lat: 42.919025, lng: 59.778312 }
    ],
    mapUrl: 'https://maps.google.com/maps?q=42.918825,59.778217&ll=42.918825,59.778217&z=16'
  }
];

const EMPLOYEES = [
  // Филиал №1 (7 фармацевт + 1 кассир)
  { id: 'emp_1', workplaceId: 'branch_1', name: 'Мехрибан', role: 'Бас провизор', staj: '9 жыл стаж' },
  { id: 'emp_2', workplaceId: 'branch_1', name: 'Санавар', role: 'Фармацевт', staj: '2 жыл стаж' },
  { id: 'emp_3', workplaceId: 'branch_1', name: 'Жамиля', role: 'Фармацевт', staj: '6 жыл стаж' },
  { id: 'emp_4', workplaceId: 'branch_1', name: 'Гөзал', role: 'Фармацевт', staj: '2 жыл стаж' },
  { id: 'emp_5', workplaceId: 'branch_1', name: 'Гумсай', role: 'Фармацевт', staj: '2 ай стаж' },
  { id: 'emp_6', workplaceId: 'branch_1', name: 'Гульжайна', role: 'Фармацевт', staj: '3 ай стаж' },
  { id: 'emp_15', workplaceId: 'branch_1', name: 'Ильхам', role: 'Кассир', staj: 'Кассир' },
  { id: 'emp_16', workplaceId: 'branch_1', name: 'Сапаргуль', role: 'Фармацевт', staj: 'Фармацевт' },

  // Филиал №2 (2 фармацевт)
  { id: 'emp_7', workplaceId: 'branch_2', name: 'Фируза', role: 'Бас фармацевт', staj: '3 жыл стаж' },
  { id: 'emp_8', workplaceId: 'branch_2', name: 'Ахзира', role: 'Фармацевт', staj: '2 жыл стаж' },

  // Филиал №3 (2 фармацевт)
  { id: 'emp_9', workplaceId: 'branch_3', name: 'Айгуль', role: 'Бас провизор', staj: '5 жыл стаж' },
  { id: 'emp_10', workplaceId: 'branch_3', name: 'Мафтуна', role: 'Фармацевт', staj: '3 ай стаж' },

  // Филиал №4 (2 фармацевт)
  { id: 'emp_11', workplaceId: 'branch_4', name: 'Хурлиман', role: 'Бас фармацевт', staj: '1 жыл стаж' },
  { id: 'emp_12', workplaceId: 'branch_4', name: 'Жулдыз', role: 'Фармацевт', staj: '1 жыл стаж' },

  // Склад (2 хызметкер)
  { id: 'emp_13', workplaceId: 'warehouse', name: 'Юсуп', role: 'Закупщик', staj: 'Склад' },
  { id: 'emp_14', workplaceId: 'warehouse', name: 'Мухаммед', role: 'Бухгалтер', staj: 'Склад' }
];

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

// Имарат ишиндеги телефон GPS аўытқыўын (indoor GPS drift) ҳәм филиалдың барлық белгиленген ноқатларын есапқа алыўшы функция
function calculateWorkplaceDistanceMeters(workplace, lat, lng, maxDist = MAX_DISTANCE_METERS) {
  const staticWp = WORKPLACES.find(w => w.id === workplace.id);
  const points = [
    { lat: workplace.lat, lng: workplace.lng },
    ...(Array.isArray(workplace.anchors) ? workplace.anchors : []),
    ...(staticWp && Array.isArray(staticWp.anchors) ? staticWp.anchors : [])
  ];
  let minRaw = Infinity;
  for (const pt of points) {
    if (pt && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
      const d = calculateDistanceMeters(pt.lat, pt.lng, lat, lng);
      if (d < minRaw) minRaw = d;
    }
  }
  if (!isFinite(minRaw)) {
    minRaw = calculateDistanceMeters(workplace.lat, workplace.lng, lat, lng);
  }
  // Имарат ишиндеги GPS тербелиси (60 метрге шекем имарат иши есапланады)
  const INDOOR_BUILDING_RADIUS = 60;
  if (minRaw <= maxDist) {
    return minRaw;
  }
  if (minRaw <= INDOOR_BUILDING_RADIUS) {
    return Number(((minRaw / INDOOR_BUILDING_RADIUS) * (maxDist * 0.85)).toFixed(2));
  }
  return Number((minRaw - (INDOOR_BUILDING_RADIUS - maxDist)).toFixed(2));
}

function calculateLateness(timeStr, startStr = '08:00', penaltyPer5Min = PENALTY_PER_5_MIN) {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return { isLate: false, lateMinutes: 0, penalty: 0 };
  }
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) {
    return { isLate: false, lateMinutes: 0, penalty: 0 };
  }
  const [shStr, smStr] = (startStr || '08:00').split(':');
  const startMinutes = (parseInt(shStr, 10) || 8) * 60 + (parseInt(smStr, 10) || 0);
  const totalMinutes = h * 60 + m;

  if (totalMinutes > startMinutes) {
    const lateMinutes = totalMinutes - startMinutes;
    const intervals = Math.ceil(lateMinutes / 5);
    const penalty = intervals * penaltyPer5Min;
    return { isLate: true, lateMinutes, penalty };
  }
  return { isLate: false, lateMinutes: 0, penalty: 0 };
}

function validateLocationMessage(msg, session, nowMs = Date.now()) {
  if (!msg || !msg.location) {
    return { valid: false, reason: 'NO_LOCATION' };
  }
  if (msg.forward_date || msg.forward_from || msg.forward_origin || msg.forward_sender_name) {
    return { valid: false, reason: 'FORWARDED_LOCATION' };
  }
  if (msg.venue) {
    return { valid: false, reason: 'MANUAL_VENUE_PIN' };
  }
  if (msg.edit_date && !msg.location.live_period) {
    return { valid: false, reason: 'EDITED_MESSAGE' };
  }
  if (!session || !session.requestedAt) {
    return { valid: false, reason: 'NO_ACTIVE_REQUEST' };
  }
  const elapsedSessionMs = nowMs - session.requestedAt;
  if (elapsedSessionMs > 120 * 1000) {
    return { valid: false, reason: 'SESSION_EXPIRED' };
  }
  if (msg.date) {
    const msgAgeSec = Math.abs(nowMs / 1000 - msg.date);
    if (msgAgeSec > 90) {
      return { valid: false, reason: 'STALE_MESSAGE' };
    }
  }
  return {
    valid: true,
    isLive: Boolean(msg.location.live_period),
    accuracy: msg.location.horizontal_accuracy || null
  };
}

function getTashkentNow() {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tashkent',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const dateStr = dateFormatter.format(now); // YYYY-MM-DD
  const yearMonth = dateStr.slice(0, 7); // YYYY-MM
  const fullTimeStr = timeFormatter.format(now); // HH:MM:SS
  const timeStr = fullTimeStr.slice(0, 5); // HH:MM
  const [hStr, mStr] = timeStr.split(':');
  const hours = parseInt(hStr, 10) || 0;
  const minutes = parseInt(mStr, 10) || 0;
  return { dateStr, yearMonth, timeStr, fullTimeStr, hours, minutes };
}

class AttendanceManager {
  constructor(filePath) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.state = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        return {
          settings: {
            maxDistanceMeters: MAX_DISTANCE_METERS,
            penaltyPer5Min: PENALTY_PER_5_MIN,
            monthlyBonusSum: MONTHLY_BONUS_SUM,
            startTime: '08:00',
            eveningStartTime: '17:00',
            eveningEndTime: '00:00',
            ...(parsed.settings || {})
          },
          workplaces: Array.isArray(parsed.workplaces) && parsed.workplaces.length > 0
            ? parsed.workplaces
            : WORKPLACES.map(w => ({ ...w })),
          employees: Array.isArray(parsed.employees) && parsed.employees.length > 0
            ? parsed.employees
            : EMPLOYEES.map(e => ({ ...e })),
          bindings: parsed.bindings || {},
          adminChats: parsed.adminChats || [],
          days: parsed.days || {},
          logs: parsed.logs || []
        };
      }
    } catch (e) {
      console.error('Error loading attendance state:', e.message);
    }
    return {
      settings: {
        maxDistanceMeters: MAX_DISTANCE_METERS,
        penaltyPer5Min: PENALTY_PER_5_MIN,
        monthlyBonusSum: MONTHLY_BONUS_SUM,
        startTime: '08:00',
        eveningStartTime: '17:00',
        eveningEndTime: '00:00'
      },
      workplaces: WORKPLACES.map(w => ({ ...w })),
      employees: EMPLOYEES.map(e => ({ ...e })),
      bindings: {},
      adminChats: [],
      days: {},
      logs: []
    };
  }

  refresh() {
    this.state = this.load();
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving attendance state:', e.message);
    }
  }

  getSettings() {
    this.refresh();
    return this.state.settings;
  }

  updateSettings(partial) {
    this.refresh();
    this.state.settings = {
      ...this.state.settings,
      ...partial
    };
    this.save();
    return this.state.settings;
  }

  getWorkplaces() {
    this.refresh();
    return this.state.workplaces || WORKPLACES;
  }

  updateWorkplaceLocation(workplaceId, lat, lng) {
    this.refresh();
    const list = this.state.workplaces || WORKPLACES.map(w => ({ ...w }));
    const wp = list.find(w => w.id === workplaceId);
    if (!wp) return { ok: false, error: 'WORKPLACE_NOT_FOUND' };
    wp.lat = Number(lat);
    wp.lng = Number(lng);
    if (!Array.isArray(wp.anchors)) wp.anchors = [];
    wp.anchors.push({ lat: wp.lat, lng: wp.lng });
    wp.mapUrl = `https://maps.google.com/maps?q=${wp.lat},${wp.lng}&ll=${wp.lat},${wp.lng}&z=16`;
    this.state.workplaces = list;
    const staticWp = WORKPLACES.find(w => w.id === workplaceId);
    if (staticWp) {
      staticWp.lat = wp.lat;
      staticWp.lng = wp.lng;
      if (!Array.isArray(staticWp.anchors)) staticWp.anchors = [];
      staticWp.anchors.push({ lat: wp.lat, lng: wp.lng });
      staticWp.mapUrl = wp.mapUrl;
    }
    this.save();
    return { ok: true, workplace: wp };
  }

  getEmployees(workplaceId = null) {
    this.refresh();
    if (workplaceId) {
      return this.state.employees.filter(e => e.workplaceId === workplaceId);
    }
    return this.state.employees;
  }

  addEmployee({ workplaceId, name, role = 'Фармацевт', staj = 'Жаңа' }) {
    this.refresh();
    const wp = WORKPLACES.find(w => w.id === workplaceId);
    if (!wp) return { ok: false, error: 'INVALID_WORKPLACE' };
    const cleanName = String(name || '').trim();
    if (!cleanName) return { ok: false, error: 'EMPTY_NAME' };

    const newEmp = {
      id: 'emp_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      workplaceId,
      name: cleanName,
      role: String(role || 'Фармацевт').trim(),
      staj
    };
    this.state.employees.push(newEmp);
    this.save();
    return { ok: true, employee: newEmp, workplace: wp };
  }

  removeEmployee(employeeId) {
    this.refresh();
    const idx = this.state.employees.findIndex(e => e.id === employeeId);
    if (idx === -1) return { ok: false, error: 'NOT_FOUND' };
    const [removed] = this.state.employees.splice(idx, 1);
    delete this.state.bindings[employeeId];
    this.save();
    return { ok: true, removed };
  }

  addAdminChat(chatId) {
    this.refresh();
    if (!this.state.adminChats.includes(chatId)) {
      this.state.adminChats.push(chatId);
      this.save();
    }
  }

  getAdminChats() {
    this.refresh();
    return this.state.adminChats;
  }

  bindEmployee(employeeId, telegramUserId, telegramUsername = '') {
    this.refresh();
    const emp = this.state.employees.find(e => e.id === employeeId);
    if (!emp) {
      return { ok: false, error: 'EMPLOYEE_NOT_FOUND' };
    }
    const existingBinding = this.state.bindings[employeeId];
    if (existingBinding && existingBinding.telegramUserId !== telegramUserId) {
      return { ok: false, error: 'ALREADY_BOUND', boundTo: existingBinding };
    }
    for (const [k, v] of Object.entries(this.state.bindings)) {
      if (v.telegramUserId === telegramUserId && k !== employeeId) {
        delete this.state.bindings[k];
      }
    }
    this.state.bindings[employeeId] = {
      telegramUserId,
      telegramUsername,
      boundAt: new Date().toISOString()
    };
    this.save();
    return { ok: true, employee: emp, workplace: WORKPLACES.find(w => w.id === emp.workplaceId) };
  }

  unbindEmployee(employeeId) {
    this.refresh();
    delete this.state.bindings[employeeId];
    this.save();
    return { ok: true };
  }

  resetBindings() {
    this.refresh();
    this.state.bindings = {};
    this.save();
  }

  getEmployeeByTelegramId(telegramUserId) {
    this.refresh();
    for (const [empId, bindInfo] of Object.entries(this.state.bindings)) {
      if (bindInfo.telegramUserId === telegramUserId) {
        const employee = this.state.employees.find(e => e.id === empId);
        if (employee) {
          const wps = this.state.workplaces || WORKPLACES;
          const workplace = wps.find(w => w.id === employee.workplaceId) || WORKPLACES.find(w => w.id === employee.workplaceId);
          return { employee, workplace, bindInfo };
        }
      }
    }
    return null;
  }

  recordAction({ telegramUserId, actionType, lat, lng, dateStr, timeStr, fullTimeStr, isLive = false }) {
    this.refresh();
    const profile = this.getEmployeeByTelegramId(telegramUserId);
    if (!profile) {
      return { ok: false, error: 'NOT_REGISTERED' };
    }

    const { employee, workplace } = profile;
    const settings = this.state.settings;
    const maxDist = settings.maxDistanceMeters || MAX_DISTANCE_METERS;
    const nowInfo = getTashkentNow();
    const dStr = dateStr || nowInfo.dateStr;
    const tStr = timeStr || nowInfo.timeStr;
    const ftStr = fullTimeStr || nowInfo.fullTimeStr;

    const distanceMeters = calculateWorkplaceDistanceMeters(workplace, lat, lng, maxDist);

    if (distanceMeters > maxDist) {
      const attemptLog = {
        timestamp: `${dStr} ${ftStr}`,
        employeeId: employee.id,
        name: employee.name,
        role: employee.role,
        workplaceId: workplace.id,
        workplaceName: workplace.shortName,
        actionType,
        status: 'REJECTED_TOO_FAR',
        distanceMeters,
        lat,
        lng
      };
      this.state.logs.unshift(attemptLog);
      if (this.state.logs.length > 200) this.state.logs.length = 200;
      this.save();

      return {
        ok: false,
        error: 'TOO_FAR',
        distanceMeters,
        maxAllowed: maxDist,
        employee,
        workplace
      };
    }

    if (!this.state.days[dStr]) {
      this.state.days[dStr] = {};
    }
    const dayRecords = this.state.days[dStr];
    const current = dayRecords[employee.id] || {
      employeeId: employee.id,
      name: employee.name,
      role: employee.role,
      workplaceId: workplace.id,
      workplaceName: workplace.shortName,
      arrTime: '—',
      leaveTime: '—',
      inDistance: null,
      outDistance: null,
      isLate: false,
      lateMinutes: 0,
      penalty: 0,
      status: 'Келмеди'
    };

    if (actionType === 'IN') {
      const lateness = calculateLateness(tStr, settings.startTime || '08:00', settings.penaltyPer5Min);
      current.arrTime = tStr;
      current.inDistance = distanceMeters;
      current.inLat = lat;
      current.inLng = lng;
      current.shift = 'DAY';
      current.shiftLabel = '🟢 Күндизги смена (08:00 - 18:00)';
      current.isLate = lateness.isLate;
      current.lateMinutes = lateness.lateMinutes;
      current.penalty = lateness.penalty;
      current.status = '🟢 Жумыста (08:00)';
    } else if (actionType === 'IN_EVENING') {
      const eveningStart = settings.eveningStartTime || '17:00';
      const lateness = calculateLateness(tStr, eveningStart, settings.penaltyPer5Min);
      current.arrTime = tStr;
      current.inDistance = distanceMeters;
      current.inLat = lat;
      current.inLng = lng;
      current.shift = 'EVENING';
      current.shiftLabel = '⚫ Кешки смена (17:00 - 00:00)';
      current.isLate = lateness.isLate;
      current.lateMinutes = lateness.lateMinutes;
      current.penalty = lateness.penalty;
      current.status = '⚫ Кешки сменада (17:00 - 00:00)';
    } else if (actionType === 'OUT') {
      current.leaveTime = tStr;
      current.outDistance = distanceMeters;
      current.outLat = lat;
      current.outLng = lng;
      current.status = current.shift === 'EVENING' ? '🔴 Кетти (⚫ Кешки смена)' : '🔴 Кетти';
    }

    dayRecords[employee.id] = current;

    const successLog = {
      timestamp: `${dStr} ${ftStr}`,
      employeeId: employee.id,
      name: employee.name,
      role: employee.role,
      workplaceId: workplace.id,
      workplaceName: workplace.shortName,
      actionType,
      status: 'ACCEPTED',
      timeStr: tStr,
      distanceMeters,
      isLive,
      penalty: current.penalty,
      lateMinutes: current.lateMinutes
    };
    this.state.logs.unshift(successLog);
    if (this.state.logs.length > 200) this.state.logs.length = 200;

    this.save();

    const yearMonth = dStr.slice(0, 7);
    const monthlyStats = this.getEmployeeMonthlyStats(employee.id, yearMonth);

    return {
      ok: true,
      employee,
      workplace,
      distanceMeters,
      record: current,
      monthlyStats,
      dateStr: dStr,
      timeStr: tStr
    };
  }

  setDayPenalty(employeeId, dateStr, newPenalty) {
    this.refresh();
    const emp = this.state.employees.find(e => e.id === employeeId);
    if (!emp) return { ok: false, error: 'EMPLOYEE_NOT_FOUND' };
    const wp = WORKPLACES.find(w => w.id === emp.workplaceId);
    const dStr = dateStr || getTashkentNow().dateStr;
    if (!this.state.days[dStr]) {
      this.state.days[dStr] = {};
    }
    const existing = this.state.days[dStr][employeeId] || {
      employeeId: emp.id,
      name: emp.name,
      role: emp.role,
      workplaceId: emp.workplaceId,
      workplaceName: wp ? wp.shortName : '',
      arrTime: '—',
      leaveTime: '—',
      inDistance: null,
      outDistance: null,
      isLate: false,
      lateMinutes: 0,
      penalty: 0,
      status: 'Келмеди'
    };
    const amount = Math.max(0, Number(newPenalty) || 0);
    existing.penalty = amount;
    existing.isLate = amount > 0;
    if (amount === 0) {
      existing.lateMinutes = 0;
    }
    this.state.days[dStr][employeeId] = existing;
    this.save();
    return { ok: true, record: existing };
  }

  clearMonthlyPenalties(employeeId, yearMonth) {
    this.refresh();
    const ym = yearMonth || getTashkentNow().yearMonth;
    for (const [dStr, dayObj] of Object.entries(this.state.days)) {
      if (dStr.startsWith(ym) && dayObj[employeeId]) {
        dayObj[employeeId].penalty = 0;
        dayObj[employeeId].isLate = false;
        dayObj[employeeId].lateMinutes = 0;
      }
    }
    this.save();
    return { ok: true };
  }

  getEmployeeMonthlyStats(employeeId, yearMonth) {
    this.refresh();
    const ym = yearMonth || getTashkentNow().yearMonth;
    const emp = this.state.employees.find(e => e.id === employeeId);
    const wp = emp ? WORKPLACES.find(w => w.id === emp.workplaceId) : null;
    const bonusTarget = this.state.settings.monthlyBonusSum || MONTHLY_BONUS_SUM;

    let totalDaysWorked = 0;
    let lateDaysCount = 0;
    let totalLateMinutes = 0;
    let totalPenalty = 0;
    const history = [];

    const sortedDates = Object.keys(this.state.days)
      .filter(d => d.startsWith(ym))
      .sort();

    for (const dStr of sortedDates) {
      const rec = this.state.days[dStr][employeeId];
      if (rec) {
        if (rec.arrTime && rec.arrTime !== '—') {
          totalDaysWorked++;
        }
        if (rec.penalty > 0 || rec.isLate) {
          lateDaysCount++;
          totalLateMinutes += rec.lateMinutes || 0;
          totalPenalty += rec.penalty || 0;
        }
        history.push({ date: dStr, ...rec });
      }
    }

    const bonusEligible = lateDaysCount === 0 && totalPenalty === 0;
    const bonusAmount = bonusEligible ? bonusTarget : 0;

    return {
      employeeId,
      employee: emp,
      workplace: wp,
      yearMonth: ym,
      totalDaysWorked,
      onTimeDaysCount: Math.max(0, totalDaysWorked - lateDaysCount),
      lateDaysCount,
      totalLateMinutes,
      totalPenalty,
      bonusEligible,
      bonusAmount,
      bonusTarget,
      history
    };
  }

  getDailySummary(dateStr) {
    this.refresh();
    const dStr = dateStr || getTashkentNow().dateStr;
    const ym = dStr.slice(0, 7);
    const dayRecords = this.state.days[dStr] || {};
    return WORKPLACES.map(wp => {
      const staff = this.state.employees.filter(e => e.workplaceId === wp.id).map(emp => {
        const rec = dayRecords[emp.id];
        const mStats = this.getEmployeeMonthlyStats(emp.id, ym);
        return {
          ...emp,
          bound: Boolean(this.state.bindings[emp.id]),
          arrTime: rec ? rec.arrTime : '—',
          leaveTime: rec ? rec.leaveTime : '—',
          inDistance: rec ? rec.inDistance : null,
          outDistance: rec ? rec.outDistance : null,
          isLate: rec ? rec.isLate : false,
          lateMinutes: rec ? rec.lateMinutes : 0,
          penalty: rec ? rec.penalty : 0,
          status: rec ? rec.status : '⏳ Келмеди',
          monthlyPenalty: mStats.totalPenalty,
          monthlyLateDays: mStats.lateDaysCount,
          bonusEligible: mStats.bonusEligible,
          bonusAmount: mStats.bonusAmount
        };
      });
      return {
        workplace: wp,
        staff
      };
    });
  }
}

module.exports = {
  WORKPLACES,
  EMPLOYEES,
  MAX_DISTANCE_METERS,
  MONTHLY_BONUS_SUM,
  PENALTY_PER_5_MIN,
  calculateDistanceMeters,
  calculateLateness,
  validateLocationMessage,
  getTashkentNow,
  AttendanceManager
};
