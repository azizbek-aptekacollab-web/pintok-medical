const fs = require('fs');
const path = require('path');

const MAX_DISTANCE_METERS = 50;
const PENALTY_PER_MINUTE = 3000;
const PENALTY_PER_5_MIN = 15000; // legacy alias (5 * 3000)
const MONTHLY_EXCUSE_LIMIT = 3;
const MONTHLY_BONUS_SUM = 1000000;

const WORKPLACES = [
  {
    id: 'branch_1',
    branchNumber: 1,
    name: '1-Филиал',
    shortName: '1-Филиал (Шымбай, 5-этажлы Емлеўхана қасында)',
    address: 'Шымбай районы, 5-этажлы Емлеўхана қасында',
    workHoursText: '08:00 – 00:00 (1-смена: 08:00–16:00 | 2-смена: 16:30–00:00)',
    hasTwoShifts: true,
    shifts: {
      SHIFT_1: { id: 'SHIFT_1', label: '☀️ 1-смена (08:00 – 16:00)', startTime: '08:00', endTime: '16:00' },
      SHIFT_2: { id: 'SHIFT_2', label: '🌙 2-смена (16:30 – 00:00)', startTime: '16:30', endTime: '00:00' }
    },
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
    name: '2-Филиал',
    shortName: '2-Филиал (Шымбай, Базар ишинде)',
    address: 'Шымбай районы, Базардың ишинде',
    workHoursText: '08:00 – 19:00',
    hasTwoShifts: false,
    shifts: {
      SHIFT_1: { id: 'SHIFT_1', label: '☀️ Күндизги смена (08:00 – 19:00)', startTime: '08:00', endTime: '19:00' }
    },
    lat: 42.933575,
    lng: 59.773668,
    anchors: [
      { lat: 42.933575, lng: 59.773668 },
      { lat: 42.933495, lng: 59.773732 },
      { lat: 42.932415, lng: 59.772631 },
      { lat: 42.93229, lng: 59.773275 }
    ],
    mapUrl: 'https://maps.google.com/maps?q=42.933575,59.773668&ll=42.933575,59.773668&z=16'
  },
  {
    id: 'branch_3',
    branchNumber: 3,
    name: '3-Филиал',
    shortName: '3-Филиал (Хожели, Емлеўхана қарама-қарсы)',
    address: 'Хожели районы, Емлеўхана қарама-қарсы',
    workHoursText: '08:00 – 00:00 (1-смена: 08:00–16:00 | 2-смена: 16:30–00:00)',
    hasTwoShifts: true,
    shifts: {
      SHIFT_1: { id: 'SHIFT_1', label: '☀️ 1-смена (08:00 – 16:00)', startTime: '08:00', endTime: '16:00' },
      SHIFT_2: { id: 'SHIFT_2', label: '🌙 2-смена (16:30 – 00:00)', startTime: '16:30', endTime: '00:00' }
    },
    lat: 42.411627,
    lng: 59.46304,
    anchors: [
      { lat: 42.411627, lng: 59.46304 },
      { lat: 42.411633, lng: 59.462748 },
      { lat: 42.411664, lng: 59.462758 },
      { lat: 42.411553, lng: 59.462991 },
      { lat: 42.411386, lng: 59.462729 },
      { lat: 42.412036, lng: 59.463001 },
      { lat: 42.411168, lng: 59.462472 },
      { lat: 42.411545, lng: 59.463034 }
    ],
    mapUrl: 'https://maps.google.com/maps?q=42.411627,59.463040&ll=42.411627,59.463040&z=16'
  },
  {
    id: 'branch_4',
    branchNumber: 4,
    name: '4-Филиал',
    shortName: '4-Филиал (Нөкис, Городской Больница қарама-қарсы)',
    address: 'Нөкис қаласы, Городской Больница қарама-қарсы',
    workHoursText: '08:00 – 00:00 (1-смена: 08:00–16:00 | 2-смена: 16:30–00:00)',
    hasTwoShifts: true,
    shifts: {
      SHIFT_1: { id: 'SHIFT_1', label: '☀️ 1-смена (08:00 – 16:00)', startTime: '08:00', endTime: '16:00' },
      SHIFT_2: { id: 'SHIFT_2', label: '🌙 2-смена (16:30 – 00:00)', startTime: '16:30', endTime: '00:00' }
    },
    lat: 42.473931,
    lng: 59.609268,
    anchors: [
      { lat: 42.473931, lng: 59.609268 },
      { lat: 42.473869, lng: 59.609245 },
      { lat: 42.473911, lng: 59.609283 }
    ],
    mapUrl: 'https://maps.google.com/maps?q=42.473931,59.609268&ll=42.473931,59.609268&z=16'
  }
];

const EMPLOYEES = [
  // 1-Филиал (7 фармацевт + 1 кассир)
  { id: 'emp_1', workplaceId: 'branch_1', name: 'Мехри', role: 'Фармацевт', phone: '+998994568584', phoneKey: '994568584' },
  { id: 'emp_2', workplaceId: 'branch_1', name: 'Жамила', role: 'Фармацевт', phone: '+998919395804', phoneKey: '919395804' },
  { id: 'emp_3', workplaceId: 'branch_1', name: 'Сапаргуль', role: 'Фармацевт', phone: '+998992513450', phoneKey: '992513450' },
  { id: 'emp_4', workplaceId: 'branch_1', name: 'Гөззал', role: 'Фармацевт', phone: '+998958360215', phoneKey: '958360215' },
  { id: 'emp_5', workplaceId: 'branch_1', name: 'Гульжайна', role: 'Фармацевт', phone: '+998953433341', phoneKey: '953433341' },
  { id: 'emp_6', workplaceId: 'branch_1', name: 'Санавар', role: 'Фармацевт', phone: '+998996569199', phoneKey: '996569199' },
  { id: 'emp_7', workplaceId: 'branch_1', name: 'Гумсай', role: 'Фармацевт', phone: '+998905941336', phoneKey: '905941336' },
  { id: 'emp_14', workplaceId: 'branch_1', name: 'Ильхам', role: 'Кассир', phone: '+998905901814', phoneKey: '905901814' },

  // 2-Филиал (Базар — 2 фармацевт)
  { id: 'emp_8', workplaceId: 'branch_2', name: 'Феруза', role: 'Фармацевт', phone: '+998956630314', phoneKey: '956630314' },
  { id: 'emp_9', workplaceId: 'branch_2', name: 'Ахзира', role: 'Фармацевт', phone: '+998906522027', phoneKey: '906522027' },

  // 3-Филиал (Хожели — 2 фармацевт)
  { id: 'emp_10', workplaceId: 'branch_3', name: 'Айгуль', role: 'Фармацевт', phone: '+998906501393', phoneKey: '906501393' },
  { id: 'emp_11', workplaceId: 'branch_3', name: 'Мафтуна', role: 'Фармацевт', phone: '+998919380809', phoneKey: '919380809' },

  // 4-Филиал (Нөкис — 2 фармацевт)
  { id: 'emp_12', workplaceId: 'branch_4', name: 'Хурлима', role: 'Фармацевт', phone: '+998913790859', phoneKey: '913790859' },
  { id: 'emp_13', workplaceId: 'branch_4', name: 'Жулдыз', role: 'Фармацевт', phone: '+998907140036', phoneKey: '907140036' }
];

const MOTIVATIONAL_ARRIVAL_MESSAGES = [
  '🌟 Рахмет! Сиз бүгин жумысқа өз ўақтында келдиңиз — сиздей жуўапкершиликли хызметкер менен ислесиў биз ушын үлкен мақтаныш!\n😊 Бүгинги күниңиз сәтли, саўдаңыз берекели ҳәм кейпиятыңыз күн бойы жоқары болсын!',
  '☀️ Ассалаўма алейкум ҳәм көп рахмет! Жумысқа ерте ҳәм өз ўақтында келгениңиз ушын сизге алғыс билдиремиз!\n🌺 Ҳәр күни усындай сергек ҳәм қуўанышлы кейпиятта жүриң, ислериңизге табыс тилеймиз!',
  '💎 Бәрекелла! Өз ўақтында келип, тәртип ҳәм жуўапкершиликтиң нағыз үлгисин көрсеттиңиз, рахмет сизге!\n✨ Күниңиз жақсы инсанларға, қуўанышлы хабарларға ҳәм мол берекетке толы болсын!'
];

const MOTIVATIONAL_DEPARTURE_MESSAGES = [
  '👏 Бүгинги мийнетиңиз ушын үлкен рахмет! Жумыс ўақтын толық ҳәм адал жуўмақлап шықтыңыз!\n🏡 Енди жақсы дем алың, шаңарағыңыз ортасында тынышлық ҳәм көтериңки кейпият тилеймиз!',
  '🌟 Көп рахмет сизге! Бүгинги сменада халыққа хызмет етип, өз жумысыңызды абырой менен атқардыңыз!\n😊 Жақсы дем алып, ертеңги күнге де усындай жоқары кейпият ҳәм күш-ғайрат пенен келиўиңизди күтемиз!'
];

function getMotivationalMessage(type = 'IN', seed = 0) {
  const list = type === 'OUT' ? MOTIVATIONAL_DEPARTURE_MESSAGES : MOTIVATIONAL_ARRIVAL_MESSAGES;
  const idx = Math.abs(Number(seed) || 0) % list.length;
  return list[idx];
}

function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

function formatPhoneDisplay(rawPhone) {
  const norm9 = normalizePhone(rawPhone);
  if (!norm9) return '';
  if (norm9.length === 9) {
    return `+998${norm9}`;
  }
  return `+${norm9}`;
}

function validateContactMessage(msg) {
  if (!msg || !msg.contact || !msg.contact.phone_number) {
    return { valid: false, reason: 'NO_CONTACT' };
  }
  if (msg.forward_date || msg.forward_from || msg.forward_origin || msg.forward_sender_name) {
    return { valid: false, reason: 'FORWARDED_CONTACT' };
  }
  if (msg.from && msg.contact.user_id && Number(msg.contact.user_id) !== Number(msg.from.id)) {
    return { valid: false, reason: 'NOT_OWN_CONTACT' };
  }
  const phoneKey = normalizePhone(msg.contact.phone_number);
  if (phoneKey.length < 7) {
    return { valid: false, reason: 'INVALID_PHONE' };
  }
  return {
    valid: true,
    phoneKey,
    formattedPhone: formatPhoneDisplay(msg.contact.phone_number)
  };
}

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

function calculateWorkplaceDistanceMeters(workplace, lat, lng) {
  const staticWp = WORKPLACES.find(w => w.id === workplace.id);
  const points = [
    { lat: workplace.lat, lng: workplace.lng },
    ...(Array.isArray(workplace.anchors) ? workplace.anchors : []),
    ...(!workplace.customLocation && staticWp && Array.isArray(staticWp.anchors) ? staticWp.anchors : [])
  ];
  let minRaw = Infinity;
  for (const pt of points) {
    if (pt && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
      // Ignore dummy placeholder coordinates (like 68.882393)
      if (pt.lat > 60) continue;
      const d = calculateDistanceMeters(pt.lat, pt.lng, lat, lng);
      if (d < minRaw) minRaw = d;
    }
  }
  if (!isFinite(minRaw)) {
    minRaw = calculateDistanceMeters(workplace.lat, workplace.lng, lat, lng);
  }
  return Number(minRaw.toFixed(2));
}

function calculateLateness(timeStr, startStr = '08:00', penaltyPerMinute = PENALTY_PER_MINUTE) {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return { isLate: false, lateMinutes: 0, penalty: 0, earlyMinutes: 0 };
  }
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) {
    return { isLate: false, lateMinutes: 0, penalty: 0, earlyMinutes: 0 };
  }
  const [shStr, smStr] = (startStr || '08:00').split(':');
  const startMinutes = (parseInt(shStr, 10) || 8) * 60 + (parseInt(smStr, 10) || 0);
  const totalMinutes = h * 60 + m;

  if (totalMinutes > startMinutes) {
    const lateMinutes = totalMinutes - startMinutes;
    const penalty = lateMinutes * penaltyPerMinute;
    return { isLate: true, lateMinutes, penalty, earlyMinutes: 0 };
  }
  return {
    isLate: false,
    lateMinutes: 0,
    penalty: 0,
    earlyMinutes: Math.max(0, startMinutes - totalMinutes)
  };
}

function calculateEarlyDeparture(timeStr, endStr = '16:00', penaltyPerMinute = PENALTY_PER_MINUTE) {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return { isEarlyLeave: false, earlyLeaveMinutes: 0, penalty: 0 };
  }
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) {
    return { isEarlyLeave: false, earlyLeaveMinutes: 0, penalty: 0 };
  }
  const [ehStr, emStr] = (endStr || '16:00').split(':');
  const eh = parseInt(ehStr, 10);
  const em = parseInt(emStr, 10) || 0;

  let endMinutes = eh * 60 + em;
  const totalMinutes = h * 60 + m;

  // For 00:00 (midnight) shift end:
  if (eh === 0 && em === 0) {
    endMinutes = 24 * 60; // 1440
    // If employee checks out between 00:00 and 04:00 AM, they stayed until midnight or past midnight
    if (h >= 0 && h < 4) {
      return { isEarlyLeave: false, earlyLeaveMinutes: 0, penalty: 0 };
    }
  }

  if (totalMinutes < endMinutes) {
    const earlyLeaveMinutes = endMinutes - totalMinutes;
    const penalty = earlyLeaveMinutes * penaltyPerMinute;
    return { isEarlyLeave: true, earlyLeaveMinutes, penalty };
  }

  return { isEarlyLeave: false, earlyLeaveMinutes: 0, penalty: 0 };
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
  if (elapsedSessionMs > 180 * 1000) {
    return { valid: false, reason: 'SESSION_EXPIRED' };
  }
  if (msg.date) {
    const msgAgeSec = Math.abs(nowMs / 1000 - msg.date);
    if (msgAgeSec > 120) {
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

function getWorkplaceShiftConfig(workplace, shiftId = 'SHIFT_1') {
  const staticWp = WORKPLACES.find(w => w.id === (workplace && workplace.id)) || WORKPLACES[0];
  const shifts = (workplace && workplace.shifts) || staticWp.shifts;
  if (shiftId === 'SHIFT_2' && shifts && shifts.SHIFT_2) {
    return shifts.SHIFT_2;
  }
  return (shifts && shifts.SHIFT_1) || {
    id: 'SHIFT_1',
    label: '☀️ 1-смена (08:00 – 16:00)',
    startTime: '08:00',
    endTime: workplace && workplace.id === 'branch_2' ? '19:00' : '16:00'
  };
}

class AttendanceManager {
  constructor(filePath) {
    let resolvedPath = filePath;
    if (process.env.VERCEL && !String(filePath).startsWith('/tmp')) {
      const tmpPath = '/tmp/pintok-attendance.json';
      try {
        if (!fs.existsSync(tmpPath) && fs.existsSync(filePath)) {
          fs.copyFileSync(filePath, tmpPath);
        }
        resolvedPath = tmpPath;
      } catch (e) {
        console.error('Vercel tmp copy error:', e.message);
      }
    }
    this.filePath = resolvedPath;
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (_) {}
    }
    this.state = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        // Merge workplace definitions with static shift rules & clean up old test coords
        const mergedWorkplaces = WORKPLACES.map(staticWp => {
          const savedWp = Array.isArray(parsed.workplaces)
            ? parsed.workplaces.find(w => w.id === staticWp.id)
            : null;
          if (!savedWp) return { ...staticWp };
          const validLat = (typeof savedWp.lat === 'number' && savedWp.lat < 60) ? savedWp.lat : staticWp.lat;
          const validLng = (typeof savedWp.lng === 'number' && savedWp.lng < 60) ? savedWp.lng : staticWp.lng;
          const isCustom = Boolean(savedWp.customLocation);
          const rawAnchors = isCustom
            ? (Array.isArray(savedWp.anchors) ? savedWp.anchors.filter(a => a && a.lat < 60) : [])
            : [
                ...(Array.isArray(staticWp.anchors) ? staticWp.anchors : []),
                ...(Array.isArray(savedWp.anchors) ? savedWp.anchors.filter(a => a && a.lat < 60) : [])
              ];
          const seen = new Set();
          const combinedAnchors = [];
          for (const a of rawAnchors) {
            if (!a || typeof a.lat !== 'number' || typeof a.lng !== 'number') continue;
            const key = `${a.lat},${a.lng}`;
            if (seen.has(key)) continue;
            seen.add(key);
            combinedAnchors.push({ lat: a.lat, lng: a.lng });
          }
          return {
            ...staticWp,
            lat: validLat,
            lng: validLng,
            customLocation: isCustom,
            anchors: combinedAnchors,
            mapUrl: `https://maps.google.com/maps?q=${validLat},${validLng}&ll=${validLat},${validLng}&z=16`
          };
        });

        const savedEmployees = Array.isArray(parsed.employees) && parsed.employees.length > 0
          ? parsed.employees.filter(e => WORKPLACES.some(w => w.id === e.workplaceId)).map(e => ({
              onSickLeave: false,
              phone: '',
              ...e
            }))
          : EMPLOYEES.map(e => ({ onSickLeave: false, ...e }));

        return {
          settings: {
            maxDistanceMeters: MAX_DISTANCE_METERS,
            penaltyPerMinute: PENALTY_PER_MINUTE,
            monthlyExcuseLimit: MONTHLY_EXCUSE_LIMIT,
            monthlyBonusSum: MONTHLY_BONUS_SUM,
            startTime: '08:00',
            shift1EndTime: '16:00',
            shift2StartTime: '16:30',
            shift2EndTime: '00:00',
            bazaarEndTime: '19:00',
            ...(parsed.settings || {}),
            // Enforce the new 50m and 3000 sum/min rules if old 4m settings were persisted
            maxDistanceMeters: (parsed.settings && parsed.settings.maxDistanceMeters >= 10)
              ? parsed.settings.maxDistanceMeters
              : MAX_DISTANCE_METERS,
            penaltyPerMinute: (parsed.settings && parsed.settings.penaltyPerMinute)
              ? parsed.settings.penaltyPerMinute
              : PENALTY_PER_MINUTE,
            monthlyExcuseLimit: (parsed.settings && parsed.settings.monthlyExcuseLimit)
              ? parsed.settings.monthlyExcuseLimit
              : MONTHLY_EXCUSE_LIMIT
          },
          workplaces: mergedWorkplaces,
          employees: savedEmployees,
          bindings: parsed.bindings || {},
          adminChats: parsed.adminChats || [],
          days: parsed.days || {},
          excuseRequests: parsed.excuseRequests || {},
          sessions: parsed.sessions || {},
          logs: parsed.logs || []
        };
      }
    } catch (e) {
      console.error('Error loading attendance state:', e.message);
    }
    return {
      settings: {
        maxDistanceMeters: MAX_DISTANCE_METERS,
        penaltyPerMinute: PENALTY_PER_MINUTE,
        monthlyExcuseLimit: MONTHLY_EXCUSE_LIMIT,
        monthlyBonusSum: MONTHLY_BONUS_SUM,
        startTime: '08:00',
        shift1EndTime: '16:00',
        shift2StartTime: '16:30',
        shift2EndTime: '00:00',
        bazaarEndTime: '19:00'
      },
      workplaces: WORKPLACES.map(w => ({ ...w })),
      employees: EMPLOYEES.map(e => ({ onSickLeave: false, ...e })),
      bindings: {},
      adminChats: [],
      days: {},
      excuseRequests: {},
      sessions: {},
      logs: []
    };
  }

  refresh() {
    this.state = this.load();
  }

  save() {
    try {
      const json = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(this.filePath, json, 'utf8');
      try {
        fs.writeFileSync(this.filePath + '.bak', json, 'utf8');
      } catch (_) {}
    } catch (e) {
      console.error('Error saving attendance state:', e.message);
    }
  }

  createSessionStore(scope) {
    return {
      get: (key) => {
        this.refresh();
        const s = (this.state.sessions && this.state.sessions[scope]) || {};
        return s[String(key)];
      },
      set: (key, val) => {
        this.refresh();
        if (!this.state.sessions) this.state.sessions = {};
        if (!this.state.sessions[scope]) this.state.sessions[scope] = {};
        this.state.sessions[scope][String(key)] = val;
        this.save();
      },
      delete: (key) => {
        this.refresh();
        if (this.state.sessions && this.state.sessions[scope]) {
          delete this.state.sessions[scope][String(key)];
          this.save();
        }
      }
    };
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

  getWorkplaces(skipRefresh = false) {
    if (!skipRefresh) this.refresh();
    return this.state.workplaces || WORKPLACES;
  }

  getWorkplaceById(workplaceId, skipRefresh = false) {
    const wps = this.getWorkplaces(skipRefresh);
    return wps.find(w => w.id === workplaceId) || WORKPLACES.find(w => w.id === workplaceId) || null;
  }

  updateWorkplaceLocation(workplaceId, lat, lng) {
    this.refresh();
    const list = this.state.workplaces || WORKPLACES.map(w => ({ ...w }));
    const wp = list.find(w => w.id === workplaceId);
    if (!wp) return { ok: false, error: 'WORKPLACE_NOT_FOUND' };
    wp.lat = Number(lat);
    wp.lng = Number(lng);
    wp.customLocation = true;
    wp.anchors = [{ lat: wp.lat, lng: wp.lng }];
    wp.mapUrl = `https://maps.google.com/maps?q=${wp.lat},${wp.lng}&ll=${wp.lat},${wp.lng}&z=16`;
    this.state.workplaces = list;
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

  getEmployeeById(employeeId) {
    this.refresh();
    return this.state.employees.find(e => e.id === employeeId) || null;
  }

  addEmployee({ workplaceId, name, phone = '', role = 'Фармацевт' }) {
    this.refresh();
    const wp = this.getWorkplaceById(workplaceId, true);
    if (!wp) return { ok: false, error: 'INVALID_WORKPLACE' };
    const cleanName = String(name || '').trim();
    if (!cleanName) return { ok: false, error: 'EMPTY_NAME' };

    const formattedPhone = phone ? formatPhoneDisplay(phone) : '';
    const phoneKey = phone ? normalizePhone(phone) : '';

    // Check if an employee with the same name in the same branch already exists; if so, update phone
    const existing = this.state.employees.find(
      e => e.workplaceId === workplaceId && e.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      if (formattedPhone) {
        existing.phone = formattedPhone;
        existing.phoneKey = phoneKey;
      }
      if (role) existing.role = String(role).trim();
      this.save();
      return { ok: true, employee: existing, workplace: wp, updated: true };
    }

    const newEmp = {
      id: 'emp_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      workplaceId,
      name: cleanName,
      role: String(role || 'Фармацевт').trim(),
      phone: formattedPhone,
      phoneKey,
      onSickLeave: false
    };
    this.state.employees.push(newEmp);
    this.save();
    return { ok: true, employee: newEmp, workplace: wp };
  }

  updateEmployeePhone(employeeId, rawPhone) {
    this.refresh();
    const emp = this.state.employees.find(e => e.id === employeeId);
    if (!emp) return { ok: false, error: 'EMPLOYEE_NOT_FOUND' };
    emp.phone = formatPhoneDisplay(rawPhone);
    emp.phoneKey = normalizePhone(rawPhone);
    if (this.state.bindings[employeeId]) {
      this.state.bindings[employeeId].phone = emp.phone;
      this.state.bindings[employeeId].phoneKey = emp.phoneKey;
    }
    this.save();
    return { ok: true, employee: emp };
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

  // Strict 1-to-1 phone + Telegram account binding (anti-multi-account & anti-buddy-punching)
  bindEmployeeWithPhone({ employeeId = null, workplaceId = null, rawPhone, telegramUserId, telegramUsername = '' }) {
    this.refresh();
    const phoneKey = normalizePhone(rawPhone);
    const formattedPhone = formatPhoneDisplay(rawPhone);
    if (!phoneKey || phoneKey.length < 7) {
      return { ok: false, error: 'INVALID_PHONE' };
    }

    // 1. Check if this telegramUserId is already bound to ANOTHER employee
    for (const [boundEmpId, bindInfo] of Object.entries(this.state.bindings)) {
      if (Number(bindInfo.telegramUserId) === Number(telegramUserId)) {
        if (employeeId && boundEmpId !== employeeId) {
          const otherEmp = this.state.employees.find(e => e.id === boundEmpId);
          return {
            ok: false,
            error: 'TELEGRAM_ALREADY_BOUND_TO_OTHER',
            otherEmployee: otherEmp
          };
        }
      }
      // 2. Check if this phone number is already bound to ANOTHER employee
      if (bindInfo.phoneKey && bindInfo.phoneKey === phoneKey) {
        if (employeeId && boundEmpId !== employeeId) {
          const otherEmp = this.state.employees.find(e => e.id === boundEmpId);
          return {
            ok: false,
            error: 'PHONE_ALREADY_BOUND_TO_OTHER',
            otherEmployee: otherEmp
          };
        }
      }
    }

    // Also check if phone belongs to another employee in employees list
    const empByPhone = this.state.employees.find(e => normalizePhone(e.phone) === phoneKey);
    if (empByPhone && employeeId && empByPhone.id !== employeeId) {
      return {
        ok: false,
        error: 'PHONE_BELONGS_TO_OTHER_EMPLOYEE',
        otherEmployee: empByPhone
      };
    }

    let targetEmp = null;
    if (employeeId) {
      targetEmp = this.state.employees.find(e => e.id === employeeId);
    } else if (empByPhone && (!workplaceId || empByPhone.workplaceId === workplaceId)) {
      targetEmp = empByPhone;
    }

    if (!targetEmp) {
      return { ok: false, error: 'EMPLOYEE_NOT_FOUND_BY_PHONE', formattedPhone, phoneKey };
    }

    if (workplaceId && targetEmp.workplaceId !== workplaceId) {
      const rightWp = this.getWorkplaceById(targetEmp.workplaceId, true);
      return {
        ok: false,
        error: 'WRONG_WORKPLACE',
        employee: targetEmp,
        expectedWorkplace: rightWp
      };
    }

    // If Manager pre-assigned a phone number to this employee, verify it matches!
    const expectedPhoneKey = normalizePhone(targetEmp.phone);
    if (expectedPhoneKey && expectedPhoneKey !== phoneKey) {
      return {
        ok: false,
        error: 'PHONE_MISMATCH',
        employee: targetEmp,
        expectedPhone: targetEmp.phone
      };
    }

    // Check if targetEmp is already bound to a different Telegram account
    const existingBinding = this.state.bindings[targetEmp.id];
    if (existingBinding && Number(existingBinding.telegramUserId) !== Number(telegramUserId)) {
      return {
        ok: false,
        error: 'ALREADY_BOUND',
        employee: targetEmp,
        boundTo: existingBinding
      };
    }

    // Save phone on employee and bind
    targetEmp.phone = formattedPhone;
    targetEmp.phoneKey = phoneKey;
    this.state.bindings[targetEmp.id] = {
      telegramUserId,
      telegramUsername,
      phone: formattedPhone,
      phoneKey,
      boundAt: new Date().toISOString()
    };
    this.save();

    return {
      ok: true,
      employee: targetEmp,
      workplace: this.getWorkplaceById(targetEmp.workplaceId, true)
    };
  }

  // Legacy helper kept for backward compatibility
  bindEmployee(employeeId, telegramUserId, telegramUsername = '', rawPhone = '') {
    this.refresh();
    const emp = this.state.employees.find(e => e.id === employeeId);
    if (!emp) {
      return { ok: false, error: 'EMPLOYEE_NOT_FOUND' };
    }
    if (rawPhone) {
      return this.bindEmployeeWithPhone({
        employeeId,
        workplaceId: emp.workplaceId,
        rawPhone,
        telegramUserId,
        telegramUsername
      });
    }
    const existingBinding = this.state.bindings[employeeId];
    if (existingBinding && Number(existingBinding.telegramUserId) !== Number(telegramUserId)) {
      return { ok: false, error: 'ALREADY_BOUND', boundTo: existingBinding };
    }
    for (const [k, v] of Object.entries(this.state.bindings)) {
      if (Number(v.telegramUserId) === Number(telegramUserId) && k !== employeeId) {
        const otherEmp = this.state.employees.find(e => e.id === k);
        return { ok: false, error: 'TELEGRAM_ALREADY_BOUND_TO_OTHER', otherEmployee: otherEmp };
      }
    }
    this.state.bindings[employeeId] = {
      telegramUserId,
      telegramUsername,
      phone: emp.phone || '',
      phoneKey: normalizePhone(emp.phone || ''),
      boundAt: new Date().toISOString()
    };
    this.save();
    return { ok: true, employee: emp, workplace: this.getWorkplaceById(emp.workplaceId, true) };
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
      if (Number(bindInfo.telegramUserId) === Number(telegramUserId)) {
        const employee = this.state.employees.find(e => e.id === empId);
        if (employee) {
          const workplace = this.getWorkplaceById(employee.workplaceId, true);
          return { employee, workplace, bindInfo };
        }
      }
    }
    return null;
  }

  // Sick leave («🏥 Больничный») management — controlled only by Manager in 2nd Bot
  setSickLeave(employeeId, isSick, dateStr = null) {
    this.refresh();
    const emp = this.state.employees.find(e => e.id === employeeId);
    if (!emp) return { ok: false, error: 'EMPLOYEE_NOT_FOUND' };
    const wp = this.getWorkplaceById(emp.workplaceId, true);
    const dStr = dateStr || getTashkentNow().dateStr;

    emp.onSickLeave = Boolean(isSick);
    if (!this.state.days[dStr]) {
      this.state.days[dStr] = {};
    }

    if (isSick) {
      this.state.days[dStr][employeeId] = {
        employeeId: emp.id,
        name: emp.name,
        role: emp.role,
        workplaceId: emp.workplaceId,
        workplaceName: wp ? wp.shortName : '',
        arrTime: '🏥 Больничный',
        leaveTime: '🏥 Больничный',
        inDistance: null,
        outDistance: null,
        isLate: false,
        lateMinutes: 0,
        latePenalty: 0,
        isEarlyLeave: false,
        earlyLeaveMinutes: 0,
        earlyLeavePenalty: 0,
        penalty: 0,
        isSickLeave: true,
        status: '🏥 Больничный'
      };
    } else if (this.state.days[dStr][employeeId] && this.state.days[dStr][employeeId].isSickLeave) {
      delete this.state.days[dStr][employeeId];
    }

    this.save();
    return { ok: true, employee: emp, workplace: wp, onSickLeave: emp.onSickLeave, dateStr: dStr };
  }

  // Monthly Excused Lateness Limit (Айына 3 күн лимит)
  getExcuseLimitStatus(employeeId, yearMonth = null, skipRefresh = false) {
    if (!skipRefresh) this.refresh();
    const ym = yearMonth || getTashkentNow().yearMonth;
    const limit = this.state.settings.monthlyExcuseLimit || MONTHLY_EXCUSE_LIMIT;
    let usedDays = 0;

    for (const [dStr, dayObj] of Object.entries(this.state.days)) {
      if (dStr.startsWith(ym) && dayObj[employeeId]) {
        if (dayObj[employeeId].excuseStatus === 'APPROVED') {
          usedDays++;
        }
      }
    }

    const remainingDays = Math.max(0, limit - usedDays);
    return {
      yearMonth: ym,
      limit,
      usedDays,
      remainingDays,
      canUseExcuse: remainingDays > 0
    };
  }

  createExcuseRequest({ employeeId, dateStr = null, reasonText }) {
    this.refresh();
    const emp = this.state.employees.find(e => e.id === employeeId);
    if (!emp) return { ok: false, error: 'EMPLOYEE_NOT_FOUND' };
    const wp = this.getWorkplaceById(emp.workplaceId, true);
    const dStr = dateStr || getTashkentNow().dateStr;
    const ym = dStr.slice(0, 7);

    const limitInfo = this.getExcuseLimitStatus(employeeId, ym, true);
    if (!limitInfo.canUseExcuse) {
      return {
        ok: false,
        error: 'EXCUSE_LIMIT_EXCEEDED',
        limitInfo
      };
    }

    if (!this.state.days[dStr] || !this.state.days[dStr][employeeId]) {
      return { ok: false, error: 'NO_DAY_RECORD' };
    }

    const rec = this.state.days[dStr][employeeId];
    const reqId = `exc_${employeeId}_${dStr}_${Date.now().toString().slice(-4)}`;
    const reqObj = {
      id: reqId,
      employeeId,
      employeeName: emp.name,
      workplaceId: emp.workplaceId,
      workplaceName: wp ? wp.shortName : '',
      dateStr: dStr,
      yearMonth: ym,
      lateMinutes: rec.lateMinutes || 0,
      penalty: rec.penalty || 0,
      reasonText: String(reasonText || '').trim(),
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    if (!this.state.excuseRequests) this.state.excuseRequests = {};
    this.state.excuseRequests[reqId] = reqObj;
    rec.excuseStatus = 'PENDING';
    rec.excuseReason = reqObj.reasonText;
    rec.excuseRequestId = reqId;
    this.save();

    return {
      ok: true,
      request: reqObj,
      limitInfo,
      employee: emp,
      workplace: wp
    };
  }

  resolveExcuseRequest(requestId, approve = true) {
    this.refresh();
    if (!this.state.excuseRequests || !this.state.excuseRequests[requestId]) {
      return { ok: false, error: 'REQUEST_NOT_FOUND' };
    }
    const reqObj = this.state.excuseRequests[requestId];
    if (reqObj.status !== 'PENDING') {
      return { ok: false, error: 'ALREADY_RESOLVED', request: reqObj };
    }

    const emp = this.state.employees.find(e => e.id === reqObj.employeeId);
    const wp = emp ? this.getWorkplaceById(emp.workplaceId, true) : null;
    const bindInfo = this.state.bindings[reqObj.employeeId] || null;
    const dayRec = (this.state.days[reqObj.dateStr] || {})[reqObj.employeeId];

    if (approve) {
      const limitInfo = this.getExcuseLimitStatus(reqObj.employeeId, reqObj.yearMonth, true);
      if (!limitInfo.canUseExcuse) {
        reqObj.status = 'REJECTED_LIMIT_EXCEEDED';
        if (dayRec) {
          dayRec.excuseStatus = 'LIMIT_EXCEEDED';
        }
        this.save();
        return {
          ok: false,
          error: 'EXCUSE_LIMIT_EXCEEDED',
          limitInfo,
          request: reqObj,
          employee: emp,
          workplace: wp,
          bindInfo
        };
      }

      reqObj.status = 'APPROVED';
      reqObj.resolvedAt = new Date().toISOString();
      if (dayRec) {
        dayRec.excuseStatus = 'APPROVED';
        dayRec.latePenalty = 0;
        dayRec.penalty = dayRec.earlyLeavePenalty || 0;
        dayRec.status = `${dayRec.status.split(' | ')[0]} | 🟢 Себепли кеширилди`;
      }
      this.save();
      const updatedLimit = this.getExcuseLimitStatus(reqObj.employeeId, reqObj.yearMonth, true);
      return {
        ok: true,
        approved: true,
        request: reqObj,
        dayRecord: dayRec,
        limitInfo: updatedLimit,
        employee: emp,
        workplace: wp,
        bindInfo
      };
    } else {
      reqObj.status = 'REJECTED';
      reqObj.resolvedAt = new Date().toISOString();
      if (dayRec) {
        dayRec.excuseStatus = 'REJECTED';
      }
      this.save();
      const updatedLimit = this.getExcuseLimitStatus(reqObj.employeeId, reqObj.yearMonth, true);
      return {
        ok: true,
        approved: false,
        request: reqObj,
        dayRecord: dayRec,
        limitInfo: updatedLimit,
        employee: emp,
        workplace: wp,
        bindInfo
      };
    }
  }

  // Preview whether checking out right now would be an early departure (before shift end time)
  checkEarlyDeparturePreview(telegramUserId, dateStr = null, timeStr = null) {
    this.refresh();
    const profile = this.getEmployeeByTelegramId(telegramUserId);
    if (!profile) return { ok: false, error: 'NOT_REGISTERED' };
    const { employee, workplace } = profile;
    const nowInfo = getTashkentNow();
    const dStr = dateStr || nowInfo.dateStr;
    const tStr = timeStr || nowInfo.timeStr;
    const dayRec = (this.state.days[dStr] || {})[employee.id];

    const shiftId = (dayRec && dayRec.shiftId) ? dayRec.shiftId : 'SHIFT_1';
    const shiftCfg = getWorkplaceShiftConfig(workplace, shiftId);
    const penaltyPerMin = this.state.settings.penaltyPerMinute || PENALTY_PER_MINUTE;
    const earlyCheck = calculateEarlyDeparture(tStr, shiftCfg.endTime, penaltyPerMin);

    return {
      ok: true,
      isEarlyLeave: earlyCheck.isEarlyLeave,
      earlyLeaveMinutes: earlyCheck.earlyLeaveMinutes,
      potentialPenalty: earlyCheck.penalty,
      shiftCfg,
      currentTime: tStr,
      employee,
      workplace
    };
  }

  recordAction({ telegramUserId, actionType, shiftId = null, lat, lng, dateStr, timeStr, fullTimeStr, isLive = false }) {
    this.refresh();
    const profile = this.getEmployeeByTelegramId(telegramUserId);
    if (!profile) {
      return { ok: false, error: 'NOT_REGISTERED' };
    }

    const { employee, workplace } = profile;
    const settings = this.state.settings;
    const maxDist = settings.maxDistanceMeters || MAX_DISTANCE_METERS;
    const penaltyPerMin = settings.penaltyPerMinute || PENALTY_PER_MINUTE;
    const nowInfo = getTashkentNow();
    const dStr = dateStr || nowInfo.dateStr;
    const tStr = timeStr || nowInfo.timeStr;
    const ftStr = fullTimeStr || nowInfo.fullTimeStr;

    // Check if employee is on Sick Leave («🏥 Больничный»)
    const existingDay = (this.state.days[dStr] || {})[employee.id];
    if (employee.onSickLeave || (existingDay && existingDay.isSickLeave)) {
      return {
        ok: false,
        error: 'ON_SICK_LEAVE',
        employee,
        workplace
      };
    }

    const distanceMeters = calculateWorkplaceDistanceMeters(workplace, lat, lng);

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
      shiftId: 'SHIFT_1',
      shiftLabel: '',
      isLate: false,
      lateMinutes: 0,
      latePenalty: 0,
      isEarlyLeave: false,
      earlyLeaveMinutes: 0,
      earlyLeavePenalty: 0,
      penalty: 0,
      excuseStatus: null,
      excuseReason: null,
      isSickLeave: false,
      status: 'Келмеди'
    };

    if (actionType === 'IN' || actionType === 'IN_EVENING' || actionType === 'IN_SHIFT_1' || actionType === 'IN_SHIFT_2') {
      const resolvedShiftId =
        shiftId ||
        (actionType === 'IN_EVENING' || actionType === 'IN_SHIFT_2' ? 'SHIFT_2' : 'SHIFT_1');
      const shiftCfg = getWorkplaceShiftConfig(workplace, resolvedShiftId);
      const lateness = calculateLateness(tStr, shiftCfg.startTime, penaltyPerMin);

      current.arrTime = tStr;
      current.inDistance = distanceMeters;
      current.inLat = lat;
      current.inLng = lng;
      current.shiftId = shiftCfg.id;
      current.shift = shiftCfg.id === 'SHIFT_2' ? 'EVENING' : 'DAY';
      current.shiftLabel = shiftCfg.label;
      current.shiftStartTime = shiftCfg.startTime;
      current.shiftEndTime = shiftCfg.endTime;
      current.isLate = lateness.isLate;
      current.lateMinutes = lateness.lateMinutes;
      current.latePenalty = lateness.penalty;
      current.earlyLeavePenalty = current.earlyLeavePenalty || 0;
      current.penalty = current.latePenalty + current.earlyLeavePenalty;
      current.status = `🟢 Жумыста (${shiftCfg.startTime}–${shiftCfg.endTime})`;
    } else if (actionType === 'OUT') {
      const shiftCfg = getWorkplaceShiftConfig(workplace, current.shiftId || 'SHIFT_1');
      const earlyDep = calculateEarlyDeparture(tStr, shiftCfg.endTime, penaltyPerMin);

      current.leaveTime = tStr;
      current.outDistance = distanceMeters;
      current.outLat = lat;
      current.outLng = lng;
      current.isEarlyLeave = earlyDep.isEarlyLeave;
      current.earlyLeaveMinutes = earlyDep.earlyLeaveMinutes;
      current.earlyLeavePenalty = earlyDep.penalty;
      const activeLatePenalty = current.excuseStatus === 'APPROVED' ? 0 : (current.latePenalty || 0);
      current.penalty = activeLatePenalty + current.earlyLeavePenalty;
      current.status = earlyDep.isEarlyLeave
        ? `⚠️ Ерте кетти (${tStr}, -${earlyDep.earlyLeaveMinutes} мин)`
        : `🔴 Кетти (${tStr})`;
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
      lateMinutes: current.lateMinutes,
      earlyLeaveMinutes: current.earlyLeaveMinutes || 0
    };
    this.state.logs.unshift(successLog);
    if (this.state.logs.length > 200) this.state.logs.length = 200;

    this.save();

    const yearMonth = dStr.slice(0, 7);
    const monthlyStats = this.getEmployeeMonthlyStats(employee.id, yearMonth);
    const excuseLimit = this.getExcuseLimitStatus(employee.id, yearMonth);
    const motivationalSms =
      (actionType !== 'OUT' && !current.isLate)
        ? getMotivationalMessage('IN', dStr.length + employee.name.length)
        : (actionType === 'OUT' && !current.isEarlyLeave)
          ? getMotivationalMessage('OUT', dStr.length + employee.name.length)
          : null;

    return {
      ok: true,
      employee,
      workplace,
      distanceMeters,
      record: current,
      monthlyStats,
      excuseLimit,
      motivationalSms,
      dateStr: dStr,
      timeStr: tStr
    };
  }

  setDayPenalty(employeeId, dateStr, newPenalty) {
    this.refresh();
    const emp = this.state.employees.find(e => e.id === employeeId);
    if (!emp) return { ok: false, error: 'EMPLOYEE_NOT_FOUND' };
    const wp = this.getWorkplaceById(emp.workplaceId);
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
      latePenalty: 0,
      isEarlyLeave: false,
      earlyLeaveMinutes: 0,
      earlyLeavePenalty: 0,
      penalty: 0,
      status: 'Келмеди'
    };
    const amount = Math.max(0, Number(newPenalty) || 0);
    existing.penalty = amount;
    existing.latePenalty = amount;
    existing.earlyLeavePenalty = 0;
    existing.isLate = amount > 0;
    if (amount === 0) {
      existing.lateMinutes = 0;
      existing.earlyLeaveMinutes = 0;
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
        dayObj[employeeId].latePenalty = 0;
        dayObj[employeeId].earlyLeavePenalty = 0;
        dayObj[employeeId].isLate = false;
        dayObj[employeeId].lateMinutes = 0;
        dayObj[employeeId].isEarlyLeave = false;
        dayObj[employeeId].earlyLeaveMinutes = 0;
      }
    }
    this.save();
    return { ok: true };
  }

  getEmployeeMonthlyStats(employeeId, yearMonth) {
    this.refresh();
    const ym = yearMonth || getTashkentNow().yearMonth;
    const emp = this.state.employees.find(e => e.id === employeeId);
    const wp = emp ? this.getWorkplaceById(emp.workplaceId) : null;
    const bonusTarget = this.state.settings.monthlyBonusSum || MONTHLY_BONUS_SUM;
    const excuseLimit = this.getExcuseLimitStatus(employeeId, ym);

    let totalDaysWorked = 0;
    let lateDaysCount = 0;
    let excusedDaysCount = 0;
    let sickDaysCount = 0;
    let earlyLeaveDaysCount = 0;
    let totalLateMinutes = 0;
    let totalEarlyLeaveMinutes = 0;
    let totalPenalty = 0;
    const history = [];

    const sortedDates = Object.keys(this.state.days)
      .filter(d => d.startsWith(ym))
      .sort();

    for (const dStr of sortedDates) {
      const rec = this.state.days[dStr][employeeId];
      if (rec) {
        if (rec.isSickLeave) {
          sickDaysCount++;
        } else if (rec.arrTime && rec.arrTime !== '—') {
          totalDaysWorked++;
        }
        if (rec.excuseStatus === 'APPROVED') {
          excusedDaysCount++;
        }
        const effectiveLate = rec.isLate && rec.excuseStatus !== 'APPROVED';
        if (effectiveLate || (rec.penalty > 0 && !rec.isEarlyLeave)) {
          lateDaysCount++;
          totalLateMinutes += rec.lateMinutes || 0;
        }
        if (rec.isEarlyLeave) {
          earlyLeaveDaysCount++;
          totalEarlyLeaveMinutes += rec.earlyLeaveMinutes || 0;
        }
        totalPenalty += rec.penalty || 0;
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
      excusedDaysCount,
      sickDaysCount,
      earlyLeaveDaysCount,
      totalLateMinutes,
      totalEarlyLeaveMinutes,
      totalPenalty,
      excuseLimit,
      bonusEligible,
      bonusAmount,
      bonusTarget,
      history
    };
  }

  formatEmployeeCalendar(employeeId, yearMonth = null) {
    this.refresh();
    const now = getTashkentNow();
    const ym = yearMonth || now.yearMonth;
    const stats = this.getEmployeeMonthlyStats(employeeId, ym);
    if (!stats.employee) return '⚠️ Хызметкер табылмады.';

    const emp = stats.employee;
    const wp = stats.workplace;
    const limitInfo = stats.excuseLimit;

    let lines = [];
    lines.push(`📅 **АЙЛЫҚ КАЛЕНДАРЬ ҲӘМ ТАБЕЛЬ (${ym})**`);
    lines.push(`👤 Фармацевт: **${emp.name}** (${emp.role})`);
    lines.push(`🏥 Филиал: **${wp ? wp.shortName : ''}**`);
    lines.push(`🩺 Больничный статусы: **${emp.onSickLeave ? '🏥 АШЫҚ (Аўырыў себепли босатылған)' : '🟢 Жумыста (Актив)'}**`);
    lines.push(`🎟️ **Себепли кешигиў лимити:** айына **${limitInfo.limit} күн** | Қалды: **${limitInfo.remainingDays} күн** (Пайдаланылды: ${limitInfo.usedDays} күн)\n`);

    lines.push(`📆 **Күнлер бойынша келип-кетиў тарийхы:**`);
    if (stats.history.length === 0) {
      lines.push(`ℹ️ *Усы айда еле белгиленген күнлер жоқ.*`);
    } else {
      for (const item of stats.history) {
        const dayNum = item.date.slice(8, 10) + '.' + item.date.slice(5, 7);
        if (item.isSickLeave) {
          lines.push(`• **${dayNum}:** 🏥 Больничный *(келип-кетиў соралмайды, штраф: 0 сум)*`);
          continue;
        }
        const inT = item.arrTime || '—';
        const outT = item.leaveTime || '—';
        let details = [];
        if (item.excuseStatus === 'APPROVED') {
          details.push(`🟢 Себепли кеширилди (${item.lateMinutes} мин, 0 сум)`);
        } else if (item.isLate && item.lateMinutes > 0) {
          const pend = item.excuseStatus === 'PENDING' ? ' ⏳(Басшы тексериўинде)' : '';
          details.push(`⏰ Кешикти: ${item.lateMinutes} мин (${(item.latePenalty || item.penalty || 0).toLocaleString('ru-RU')} сум)${pend}`);
        } else {
          details.push(`✅ Өз ўақтында`);
        }
        if (item.isEarlyLeave && item.earlyLeaveMinutes > 0) {
          details.push(`⚠️ Ерте кетти: ${item.earlyLeaveMinutes} мин (${(item.earlyLeavePenalty || 0).toLocaleString('ru-RU')} сум)`);
        }
        lines.push(`• **${dayNum}:** Келди \`${inT}\` | Кетти \`${outT}\` — ${details.join(' | ')}`);
      }
    }

    lines.push(`\n📊 **Айлық жуўмақ:**`);
    lines.push(`• Жумысқа шыққан күнлер: **${stats.totalDaysWorked} күн**`);
    lines.push(`• Өз ўақтында келген: **${stats.onTimeDaysCount} күн**`);
    lines.push(`• Кешиккен күнлер: **${stats.lateDaysCount} күн** (${stats.totalLateMinutes} минут)`);
    if (stats.earlyLeaveDaysCount > 0) {
      lines.push(`• Ерте жаўып кеткен: **${stats.earlyLeaveDaysCount} күн** (${stats.totalEarlyLeaveMinutes} минут)`);
    }
    if (stats.sickDaysCount > 0) {
      lines.push(`• Больничный күнлери: **${stats.sickDaysCount} күн**`);
    }
    lines.push(`• 🎟️ Қалған себепли лимит: **${limitInfo.remainingDays} / ${limitInfo.limit} күн**`);
    lines.push(`• 💸 **Жәми штраф (1 мин = 3 000 сум):** **${stats.totalPenalty.toLocaleString('ru-RU')} сум**`);

    return lines.join('\n');
  }

  getDailySummary(dateStr) {
    this.refresh();
    const dStr = dateStr || getTashkentNow().dateStr;
    const ym = dStr.slice(0, 7);
    const dayRecords = this.state.days[dStr] || {};
    const workplaces = this.getWorkplaces();

    return workplaces.map(wp => {
      const staff = this.state.employees.filter(e => e.workplaceId === wp.id).map(emp => {
        const rec = dayRecords[emp.id];
        const mStats = this.getEmployeeMonthlyStats(emp.id, ym);
        const isSick = emp.onSickLeave || (rec && rec.isSickLeave);
        return {
          ...emp,
          bound: Boolean(this.state.bindings[emp.id]),
          boundPhone: (this.state.bindings[emp.id] && this.state.bindings[emp.id].phone) || emp.phone || '',
          arrTime: isSick ? '🏥 Больничный' : (rec ? rec.arrTime : '—'),
          leaveTime: isSick ? '🏥 Больничный' : (rec ? rec.leaveTime : '—'),
          inDistance: rec ? rec.inDistance : null,
          outDistance: rec ? rec.outDistance : null,
          isLate: rec ? rec.isLate : false,
          lateMinutes: rec ? rec.lateMinutes : 0,
          isEarlyLeave: rec ? rec.isEarlyLeave : false,
          earlyLeaveMinutes: rec ? rec.earlyLeaveMinutes : 0,
          penalty: isSick ? 0 : (rec ? rec.penalty : 0),
          excuseStatus: rec ? rec.excuseStatus : null,
          isSickLeave: isSick,
          status: isSick ? '🏥 Больничный' : (rec ? rec.status : '⏳ Келмеди'),
          monthlyWorkedDays: mStats.totalDaysWorked,
          monthlyOnTimeDays: mStats.onTimeDaysCount,
          monthlyPenalty: mStats.totalPenalty,
          monthlyLateDays: mStats.lateDaysCount,
          monthlyLateMinutes: mStats.totalLateMinutes,
          monthlyEarlyDays: mStats.earlyLeaveDaysCount,
          monthlyEarlyMinutes: mStats.totalEarlyLeaveMinutes,
          remainingExcuses: mStats.excuseLimit.remainingDays,
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
  PENALTY_PER_MINUTE,
  PENALTY_PER_5_MIN,
  MONTHLY_EXCUSE_LIMIT,
  MONTHLY_BONUS_SUM,
  normalizePhone,
  formatPhoneDisplay,
  validateContactMessage,
  calculateDistanceMeters,
  calculateWorkplaceDistanceMeters,
  calculateLateness,
  calculateEarlyDeparture,
  validateLocationMessage,
  getMotivationalMessage,
  getWorkplaceShiftConfig,
  getTashkentNow,
  AttendanceManager
};
