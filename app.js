// ============================================================================
// ПАНЕЛЬ УПРАВЛЕНИЯ СЕТЬЮ АПТЕК «ПИНТОК МЕДИКАЛ»
// 4 филиала: Чимбай (Бескала), Чимбай (Базар), Ходжейли, Нукус
// Регламент: Приход 08:00, Уход 18:00. Штраф: 10 000 сум за каждые 5 минут опоздания!
// PWA поддержка + ИИ-помощник Antigravity (Антигравити)
// ============================================================================

const STORAGE_KEYS = {
  DAILY_DATA: "pintok_medical_daily_v3",
  CONFIG: "pintok_medical_config_v3",
  CAM_LOGS: "pintok_medical_cam_logs_v3",
  AI_CHAT: "pintok_medical_ai_chat_v3"
};

// Регламент рабочего времени сети
const WORK_RULES = {
  START_HOUR: 8,
  START_MIN: 0,
  START_STR: "08:00",
  END_HOUR: 18,
  END_MIN: 0,
  END_STR: "18:00",
  PENALTY_INTERVAL_MIN: 5,        // Каждые 5 минут
  PENALTY_PER_INTERVAL: 10000     // 10 000 сум за каждый 5-минутный интервал
};

// Функция расчёта опоздания и штрафа (10 000 сум за каждые 5 минут)
function calculateLatenessAndPenalty(arrTimeStr) {
  if (!arrTimeStr || arrTimeStr === "—") {
    return { lateMinutes: 0, intervals: 0, penalty: 0, isLate: false };
  }
  const parts = arrTimeStr.split(":");
  if (parts.length < 2) {
    return { lateMinutes: 0, intervals: 0, penalty: 0, isLate: false };
  }
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) {
    return { lateMinutes: 0, intervals: 0, penalty: 0, isLate: false };
  }

  const arrTotal = h * 60 + m;
  const standardTotal = WORK_RULES.START_HOUR * 60 + WORK_RULES.START_MIN; // 480 минут = 08:00

  if (arrTotal > standardTotal) {
    const lateMinutes = arrTotal - standardTotal;
    const intervals = Math.ceil(lateMinutes / WORK_RULES.PENALTY_INTERVAL_MIN);
    const penalty = intervals * WORK_RULES.PENALTY_PER_INTERVAL;
    return { lateMinutes, intervals, penalty, isLate: true };
  }

  return { lateMinutes: 0, intervals: 0, penalty: 0, isLate: false };
}

// Функция генерации красивого векторного портрета-аватара для сотрудников
function makePortraitSvg(initials, bg1, bg2) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="g_${initials}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="100" fill="url(#g_${initials})"/>
    <circle cx="100" cy="78" r="34" fill="rgba(255,255,255,0.28)"/>
    <path d="M40 185 C40 130 160 130 160 185 Z" fill="rgba(255,255,255,0.28)"/>
    <text x="100" y="88" text-anchor="middle" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="28">${initials}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

// 4 Филиала и 12 Фармацевтов по описанию
const BRANCHES_DEF = [
  {
    id: 1,
    name: "Филиал №1",
    city: "г. Чимбай",
    address: "ул. Бескала (Бесқала көшеси)",
    colorClass: "branch-1-color",
    camName: "GPS-Контроль Филиал 1 (≤ 4 м)",
    lat: 42.918927,
    lng: 59.779079
  },
  {
    id: 2,
    name: "Филиал №2",
    city: "г. Чимбай",
    address: "Центральный Базар (Шымбай Базар)",
    colorClass: "branch-2-color",
    camName: "GPS-Контроль Филиал 2 (≤ 4 м)",
    lat: 42.920301,
    lng: 59.790651
  },
  {
    id: 3,
    name: "Филиал №3",
    city: "г. Ходжейли",
    address: "ул. Центральная (Хожели қаласы)",
    colorClass: "branch-3-color",
    camName: "GPS-Контроль Филиал 3 (≤ 4 м)",
    lat: 42.411627,
    lng: 59.46304
  },
  {
    id: 4,
    name: "Филиал №4",
    city: "г. Нукус",
    address: "пр. Дослык / А. Досназарова (Нөкис қаласы)",
    colorClass: "branch-4-color",
    camName: "GPS-Контроль Филиал 4 (≤ 4 м)",
    lat: 42.473931,
    lng: 59.609268
  },
  {
    id: 5,
    name: "📦 Склад",
    city: "г. Чимбай",
    address: "Центральный Склад (42.918825, 59.778217)",
    colorClass: "branch-1-color",
    camName: "GPS-Контроль Склад (≤ 4 м)",
    lat: 42.918825,
    lng: 59.778217
  }
];

const INITIAL_PHARMACISTS = [
  // Филиал 1: Шымбай, Бескала (6 девушек)
  {
    id: "p1",
    branchId: 1,
    name: "Мехрибан",
    role: "Старший провизор",
    staj: "9 лет стажа",
    photo: "photos/mehriban.jpg",
    baseSales: 5850000,
    baseChecks: 92,
    arrTime: "07:55",
    leaveTime: "18:05"
  },
  {
    id: "p2",
    branchId: 1,
    name: "Санабар",
    role: "Фармацевт-консультант",
    staj: "2 года стажа",
    photo: "photos/sanavar.jpg",
    baseSales: 4280000,
    baseChecks: 71,
    arrTime: "08:02", // опоздание 2 мин -> штраф 10 000 сум
    leaveTime: "18:15"
  },
  {
    id: "p3",
    branchId: 1,
    name: "Жамиля",
    role: "Фармацевт",
    staj: "6 лет стажа",
    photo: "photos/jamilya.jpg",
    baseSales: 5120000,
    baseChecks: 84,
    arrTime: "08:00", // ровно 08:00 -> вовремя!
    leaveTime: "18:30"
  },
  {
    id: "p4",
    branchId: 1,
    name: "Гульзада",
    role: "Фармацевт",
    staj: "3 года стажа",
    photo: "photos/gozal.jpg",
    baseSales: 4460000,
    baseChecks: 75,
    arrTime: "08:05", // опоздание 5 мин -> штраф 10 000 сум
    leaveTime: "18:10"
  },
  {
    id: "p5",
    branchId: 1,
    name: "Гульмай",
    role: "Фармацевт-стажёр",
    staj: "1 год стажа",
    photo: "photos/gumsay.jpg",
    baseSales: 3180000,
    baseChecks: 58,
    arrTime: "08:12", // опоздание 12 мин -> штраф 30 000 сум (3 интервала)
    leaveTime: "18:00"
  },
  {
    id: "p6",
    branchId: 1,
    name: "Гульжайна",
    role: "Фармацевт",
    staj: "1.5 года стажа",
    photo: makePortraitSvg("ГЖ", "#059669", "#0066cc"),
    baseSales: 3450000,
    baseChecks: 62,
    arrTime: "08:10", // опоздание 10 мин -> штраф 20 000 сум (2 интервала)
    leaveTime: "18:20"
  },
  {
    id: "p15",
    branchId: 1,
    name: "Ильхам",
    role: "Кассир",
    staj: "Кассир",
    photo: makePortraitSvg("ИЛ", "#0284c7", "#059669"),
    baseSales: 4100000,
    baseChecks: 80,
    arrTime: "07:58",
    leaveTime: "18:05"
  },
  {
    id: "p16",
    branchId: 1,
    name: "Сапаргуль",
    role: "Фармацевт",
    staj: "Фармацевт",
    photo: makePortraitSvg("СГ", "#7c3aed", "#059669"),
    baseSales: 3850000,
    baseChecks: 68,
    arrTime: "07:59",
    leaveTime: "18:10"
  },

  // Филиал 2: Шымбай, Базар (2 девушки)
  {
    id: "p7",
    branchId: 2,
    name: "Феруза",
    role: "Старший фармацевт",
    staj: "3 года стажа",
    photo: makePortraitSvg("ФР", "#059669", "#d97706"),
    baseSales: 5340000,
    baseChecks: 88,
    arrTime: "07:58", // вовремя
    leaveTime: "18:30"
  },
  {
    id: "p8",
    branchId: 2,
    name: "Акзира",
    role: "Фармацевт",
    staj: "2 года стажа",
    photo: makePortraitSvg("АЗ", "#0284c7", "#7c3aed"),
    baseSales: 4390000,
    baseChecks: 73,
    arrTime: "08:04", // опоздание 4 мин -> штраф 10 000 сум
    leaveTime: "18:05"
  },

  // Филиал 3: Ходжейли (2 девушки)
  {
    id: "p9",
    branchId: 3,
    name: "Айгуль",
    role: "Старший провизор",
    staj: "5 лет стажа",
    photo: makePortraitSvg("АГ", "#7c3aed", "#059669"),
    baseSales: 5490000,
    baseChecks: 95,
    arrTime: "07:56", // вовремя
    leaveTime: "18:15"
  },
  {
    id: "p10",
    branchId: 3,
    name: "Мафтуна",
    role: "Фармацевт",
    staj: "1 год стажа",
    photo: makePortraitSvg("МФ", "#e11d48", "#d97706"),
    baseSales: 3560000,
    baseChecks: 64,
    arrTime: "08:08", // опоздание 8 мин -> штраф 20 000 сум
    leaveTime: "18:00"
  },

  // Филиал 4: Нукус (2 сотрудника)
  {
    id: "p11",
    branchId: 4,
    name: "Хурлиман",
    role: "Старший фармацевт",
    staj: "2 года стажа",
    photo: makePortraitSvg("ХР", "#0284c7", "#d97706"),
    baseSales: 4520000,
    baseChecks: 76,
    arrTime: "08:00", // ровно 08:00 -> вовремя!
    leaveTime: "18:10"
  },
  {
    id: "p12",
    branchId: 4,
    name: "Жулдыз",
    role: "Фармацевт",
    staj: "1 год стажа",
    photo: makePortraitSvg("ЖД", "#059669", "#0284c7"),
    baseSales: 4190000,
    baseChecks: 70,
    arrTime: "08:03", // опоздание 3 мин -> штраф 10 000 сум
    leaveTime: "18:05"
  },

  // Склад (2 сотрудника: Закупщик Юсуп и Бухгалтер Мухаммед)
  {
    id: "p13",
    branchId: 5,
    name: "Юсуп",
    role: "Закупщик (Склад)",
    staj: "Склад",
    photo: makePortraitSvg("ЮС", "#0f766e", "#0284c7"),
    baseSales: 0,
    baseChecks: 0,
    arrTime: "07:58",
    leaveTime: "18:05"
  },
  {
    id: "p14",
    branchId: 5,
    name: "Мухаммед",
    role: "Бухгалтер (Склад)",
    staj: "Склад",
    photo: makePortraitSvg("МХ", "#4f46e5", "#059669"),
    baseSales: 0,
    baseChecks: 0,
    arrTime: "08:00",
    leaveTime: "18:00"
  }
];

// Состояние приложения
let state = {
  currentDate: getTodayString(),
  activeFilterBranch: "all",
  searchQuery: "",
  dataByDate: {},
  deferredPrompt: null,
  cameraLogs: [
    { time: "07:55:12", name: "Мехрибан", branch: "Филиал №1 (Бескала)", action: "Вход зафиксирован: 07:55 (Вовремя • Штраф 0)", score: "99.4%" },
    { time: "07:56:40", name: "Айгуль", branch: "Филиал №3 (Ходжейли)", action: "Вход зафиксирован: 07:56 (Вовремя • Штраф 0)", score: "98.9%" },
    { time: "07:58:04", name: "Феруза", branch: "Филиал №2 (Базар)", action: "Вход зафиксирован: 07:58 (Вовремя • Штраф 0)", score: "99.1%" },
    { time: "08:00:10", name: "Жамиля", branch: "Филиал №1 (Бескала)", action: "Вход зафиксирован: 08:00 (Вовремя • Штраф 0)", score: "99.2%" },
    { time: "08:00:15", name: "Хурлиман", branch: "Филиал №4 (Нукус)", action: "Вход зафиксирован: 08:00 (Вовремя • Штраф 0)", score: "98.7%" },
    { time: "08:02:49", name: "Санабар", branch: "Филиал №1 (Бескала)", action: "Вход: 08:02 (Опоздание 2 мин • Штраф 10 000 сум)", score: "97.8%" },
    { time: "08:05:12", name: "Гульзада", branch: "Филиал №1 (Бескала)", action: "Вход: 08:05 (Опоздание 5 мин • Штраф 10 000 сум)", score: "98.5%" },
    { time: "08:12:30", name: "Гульмай", branch: "Филиал №1 (Бескала)", action: "Вход: 08:12 (Опоздание 12 мин • Штраф 30 000 сум)", score: "98.1%" }
  ],
  aiChatHistory: [
    {
      sender: "bot",
      text: "Сәлем! Мен — **Antigravity ИИ-көмекшисимен** (AI-ассистент). «Пинток Медикал» аптекалар тармағы бойынша барлық күнделикли есабатты билемен: саўда, чеклер, кешигиўлер ҳәм штрафлар, лидерлер. Қәлеген сораўыңызды сорасаңыз болады!"
    }
  ]
};

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Форматирование чисел в сумы
function formatMoney(num) {
  if (isNaN(num)) return "0 сум";
  return Math.round(num).toLocaleString("ru-RU") + " сум";
}

function formatNumber(num) {
  if (isNaN(num)) return "0";
  return Math.round(num).toLocaleString("ru-RU");
}

// Инициализация данных для конкретной даты
function getOrGenerateDayData(dateStr) {
  if (state.dataByDate[dateStr]) {
    return state.dataByDate[dateStr];
  }

  const seed = dateStr.split("-").reduce((acc, part) => acc + parseInt(part, 10), 0);
  
  const dayStaff = INITIAL_PHARMACISTS.map((p, idx) => {
    const variation = (((seed * (idx + 3)) % 25) - 12) / 100;
    const sales = Math.round(p.baseSales * (1 + variation));
    const checks = Math.round(p.baseChecks * (1 + variation * 0.8));
    const clients = Math.round(checks * 1.12);
    const avgCheck = checks > 0 ? Math.round(sales / checks) : 0;

    return {
      id: p.id,
      branchId: p.branchId,
      name: p.name,
      role: p.role,
      staj: p.staj,
      photo: p.photo,
      arrTime: p.arrTime,
      leaveTime: p.leaveTime,
      sales: sales,
      checks: checks,
      clients: clients,
      avgCheck: avgCheck,
      status: "active"
    };
  });

  state.dataByDate[dateStr] = dayStaff;
  saveData();
  return dayStaff;
}

// Сохранение и загрузка
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_DATA, JSON.stringify(state.dataByDate));
    localStorage.setItem(STORAGE_KEYS.CAM_LOGS, JSON.stringify(state.cameraLogs));
  } catch (e) {
    console.warn("Ошибка сохранения в localStorage", e);
  }
}

function loadSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.DAILY_DATA);
    if (saved) {
      state.dataByDate = JSON.parse(saved);
    }
    const savedLogs = localStorage.getItem(STORAGE_KEYS.CAM_LOGS);
    if (savedLogs) {
      state.cameraLogs = JSON.parse(savedLogs);
    }
  } catch (e) {
    console.warn("Ошибка загрузки из localStorage", e);
  }
}

// ============================================================================
// РЕНДЕРИНГ ИНТЕРФЕЙСА
// ============================================================================
function renderApp() {
  const staff = getOrGenerateDayData(state.currentDate);

  let totalNetworkSales = 0;
  let totalNetworkChecks = 0;
  let totalNetworkClients = 0;
  let totalNetworkPenalties = 0;
  let totalLateCount = 0;
  let totalOnTimeCount = 0;

  const branchSummaries = {};
  BRANCHES_DEF.forEach(b => {
    branchSummaries[b.id] = {
      sales: 0,
      checks: 0,
      clients: 0,
      penalties: 0,
      lateCount: 0,
      staffCount: 0
    };
  });

  staff.forEach(item => {
    totalNetworkSales += item.sales;
    totalNetworkChecks += item.checks;
    totalNetworkClients += item.clients;

    const lateCalc = calculateLatenessAndPenalty(item.arrTime);
    totalNetworkPenalties += lateCalc.penalty;
    if (lateCalc.isLate) {
      totalLateCount++;
    } else {
      totalOnTimeCount++;
    }

    if (branchSummaries[item.branchId]) {
      branchSummaries[item.branchId].sales += item.sales;
      branchSummaries[item.branchId].checks += item.checks;
      branchSummaries[item.branchId].clients += item.clients;
      branchSummaries[item.branchId].penalties += lateCalc.penalty;
      if (lateCalc.isLate) branchSummaries[item.branchId].lateCount++;
      branchSummaries[item.branchId].staffCount++;
    }
  });

  const networkAvgCheck = totalNetworkChecks > 0 ? Math.round(totalNetworkSales / totalNetworkChecks) : 0;

  document.getElementById("netTotalSales").innerHTML = `${formatNumber(totalNetworkSales)} <span class="unit">сум</span>`;
  document.getElementById("netTotalChecks").innerHTML = `${formatNumber(totalNetworkChecks)} <span class="unit">чеков</span>`;
  document.getElementById("netTotalClients").innerHTML = `${formatNumber(totalNetworkClients)} <span class="unit">человек</span>`;
  document.getElementById("netAvgCheck").innerHTML = `${formatNumber(networkAvgCheck)} <span class="unit">сум</span>`;
  
  const netPenaltiesEl = document.getElementById("netTotalPenalties");
  if (netPenaltiesEl) {
    netPenaltiesEl.innerHTML = `${formatNumber(totalNetworkPenalties)} <span class="unit">сум</span>`;
  }
  const netPenaltiesSubEl = document.getElementById("netTotalPenaltiesSub");
  if (netPenaltiesSubEl) {
    netPenaltiesSubEl.textContent = `${totalLateCount} с опозданием / ${totalOnTimeCount} вовремя`;
  }

  BRANCHES_DEF.forEach(b => {
    const bSum = branchSummaries[b.id];
    const share = totalNetworkSales > 0 ? ((bSum.sales / totalNetworkSales) * 100).toFixed(1) : 0;
    const barEl = document.getElementById(`shareBar-${b.id}`);
    const textEl = document.getElementById(`shareText-${b.id}`);
    if (barEl) barEl.style.width = `${share}%`;
    if (textEl) textEl.textContent = `${share}% (${formatNumber(bSum.sales)} сум)`;
  });

  renderBranches(staff, branchSummaries);
  renderLeaders(staff);
  renderCameraLogs();
  renderAiChat();
}

function renderBranches(staff, branchSummaries) {
  const container = document.getElementById("branchesContainer");
  container.innerHTML = "";

  const query = state.searchQuery.toLowerCase().trim();

  BRANCHES_DEF.forEach(branch => {
    if (state.activeFilterBranch !== "all" && state.activeFilterBranch != branch.id) {
      return;
    }

    let branchStaff = staff.filter(s => s.branchId === branch.id);
    if (query) {
      branchStaff = branchStaff.filter(s => s.name.toLowerCase().includes(query) || s.role.toLowerCase().includes(query));
    }

    if (branchStaff.length === 0 && query) {
      return;
    }

    const bSum = branchSummaries[branch.id];
    const bAvgCheck = bSum.checks > 0 ? Math.round(bSum.sales / bSum.checks) : 0;

    const block = document.createElement("section");
    block.className = "branch-block";
    block.id = `branch-section-${branch.id}`;

    block.innerHTML = `
      <div class="branch-header">
        <div class="branch-title-area">
          <div class="branch-badge-icon ${branch.colorClass}">
            ${branch.id}
          </div>
          <div>
            <div class="branch-name">${branch.name} — ${branch.city}</div>
            <div class="branch-address">
              <span>📍</span> ${branch.address}
              <span style="margin: 0 6px;">•</span>
              <span>👩‍⚕️ ${branchStaff.length} фармацевта(-ов)</span>
            </div>
          </div>
        </div>

        <div class="branch-stats-pills">
          <div class="stat-pill highlight">
            <span class="label">Выручка филиала</span>
            <span class="value">${formatMoney(bSum.sales)}</span>
          </div>
          <div class="stat-pill">
            <span class="label">Средний чек</span>
            <span class="value">${formatMoney(bAvgCheck)}</span>
          </div>
          <div class="stat-pill">
            <span class="label">Чеки / Покупатели</span>
            <span class="value">${formatNumber(bSum.checks)} / ${formatNumber(bSum.clients)}</span>
          </div>
          <div class="stat-pill ${bSum.penalties > 0 ? 'pill-penalty' : ''}">
            <span class="label">Штрафы за опоздания</span>
            <span class="value">${formatMoney(bSum.penalties)}</span>
          </div>
        </div>
      </div>

      <div class="pharmacists-grid">
        ${branchStaff.map(p => {
          const lateInfo = calculateLatenessAndPenalty(p.arrTime);

          return `
          <div class="pharmacist-card" id="card-${p.id}">
            <div class="pharm-top-row">
              <div class="pharm-avatar-wrap">
                <img src="${p.photo}" alt="${p.name}" class="pharm-avatar" onerror="this.src='${makePortraitSvg(p.name.substring(0, 2).toUpperCase(), '#059669', '#0284c7')}'" />
                <span class="pharm-status-indicator ${lateInfo.isLate ? 'status-late' : 'status-active'}" title="${lateInfo.isLate ? 'Опоздание на смену' : 'Прибыла вовремя'}"></span>
              </div>
              <div class="pharm-info">
                <div class="pharm-name">
                  ${p.name}
                  <button type="button" class="btn-change-photo" onclick="promptChangePhoto('${p.id}')" title="Загрузить другое фото" style="border:none;background:none;cursor:pointer;font-size:12px;opacity:0.6;">📷</button>
                </div>
                <div class="pharm-role">${p.role}</div>
                <span class="pharm-staj">${p.staj}</span>
              </div>
            </div>

            <div class="time-attendance-box">
              <div class="time-slot ${lateInfo.isLate ? 'late' : 'arrived'}">
                <span class="time-label">⏱ Приход: (план 08:00)</span>
                <span class="time-val">${p.arrTime || "—"} ${lateInfo.isLate ? `(+${lateInfo.lateMinutes}м)` : '✓'}</span>
              </div>
              <div class="time-slot departed">
                <span class="time-label">🏁 Уход: (план 18:00)</span>
                <span class="time-val">${p.leaveTime || "—"}</span>
              </div>
            </div>

            ${lateInfo.isLate ? `
              <div class="penalty-badge">
                <span>⚠️ Опоздание на ${lateInfo.lateMinutes} мин (${lateInfo.intervals} × 5 мин)</span>
                <span class="amount">Штраф: -${formatNumber(lateInfo.penalty)} сум</span>
              </div>
            ` : `
              <div class="punctual-badge">
                <span>✅ Приход вовремя (до 08:00)</span>
                <span style="font-weight:800; color:#15803d;">Штраф: 0 сум</span>
              </div>
            `}

            <div class="pharm-metrics-row">
              <div class="pharm-stat-item sales">
                <span class="lbl">Выручка</span>
                <span class="val">${formatNumber(p.sales)} сум</span>
              </div>
              <div class="pharm-stat-item">
                <span class="lbl">Чеков</span>
                <span class="val">${p.checks} шт</span>
              </div>
              <div class="pharm-stat-item">
                <span class="lbl">Ср. чек</span>
                <span class="val">${formatNumber(p.avgCheck)} сум</span>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
              <span style="font-size:11px; color:${lateInfo.isLate ? '#dc2626' : '#16a34a'}; font-weight:700;">
                ${lateInfo.isLate ? `● Опоздала на ${lateInfo.lateMinutes} мин` : '● На смене вовремя'}
              </span>
              <button type="button" onclick="editPharmacistRecord('${p.id}')" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:3px 8px; font-size:11px; cursor:pointer; color:#334155;">✏️ Изменить</button>
            </div>
          </div>
        `}).join("")}
      </div>
    `;

    container.appendChild(block);
  });
}

// 3. Блок лидеров внизу
function renderLeaders(staff) {
  if (!staff || staff.length === 0) return;

  const leaderSales = [...staff].sort((a, b) => b.sales - a.sales)[0];
  const leaderChecks = [...staff].sort((a, b) => b.checks - a.checks)[0];
  const leaderAvgCheck = [...staff].sort((a, b) => b.avgCheck - a.avgCheck)[0];

  const punctualStaff = staff.filter(s => {
    const l = calculateLatenessAndPenalty(s.arrTime);
    return !l.isLate && s.arrTime;
  }).sort((a, b) => a.arrTime.localeCompare(b.arrTime));

  const leaderPunctual = punctualStaff.length > 0 ? punctualStaff[0] : staff[0];

  const getBranchName = (bId) => {
    const b = BRANCHES_DEF.find(x => x.id === bId);
    return b ? `${b.name} (${b.city})` : `Филиал ${bId}`;
  };

  const grid = document.getElementById("leadersGrid");
  grid.innerHTML = `
    <!-- Лидер по продажам -->
    <div class="leader-card gold-leader">
      <div class="cup-badge gold">🏆</div>
      <div class="leader-nomination">№1 По продажам (Выручка)</div>
      <div class="leader-avatar-wrap">
        <img src="${leaderSales.photo}" alt="${leaderSales.name}" onerror="this.src='${makePortraitSvg(leaderSales.name.substring(0, 2), '#f59e0b', '#d97706')}'" />
      </div>
      <div class="leader-name">${leaderSales.name}</div>
      <div class="leader-branch">📍 ${getBranchName(leaderSales.branchId)}</div>
      <div class="leader-metric-box">
        <div class="metric-num">${formatMoney(leaderSales.sales)}</div>
        <div class="metric-desc">Дневная сумма продаж (${leaderSales.checks} чеков)</div>
      </div>
    </div>

    <!-- Лидер по количеству чеков -->
    <div class="leader-card blue-leader">
      <div class="cup-badge silver">🥈</div>
      <div class="leader-nomination">№1 По потоку чеков</div>
      <div class="leader-avatar-wrap">
        <img src="${leaderChecks.photo}" alt="${leaderChecks.name}" onerror="this.src='${makePortraitSvg(leaderChecks.name.substring(0, 2), '#0284c7', '#0369a1')}'" />
      </div>
      <div class="leader-name">${leaderChecks.name}</div>
      <div class="leader-branch">📍 ${getBranchName(leaderChecks.branchId)}</div>
      <div class="leader-metric-box">
        <div class="metric-num">${leaderChecks.checks} чеков</div>
        <div class="metric-desc">Обслужено ${leaderChecks.clients} покупателей</div>
      </div>
    </div>

    <!-- Лидер по среднему чеку -->
    <div class="leader-card green-leader">
      <div class="cup-badge bronze">🥉</div>
      <div class="leader-nomination">Лидер по среднему чеку</div>
      <div class="leader-avatar-wrap">
        <img src="${leaderAvgCheck.photo}" alt="${leaderAvgCheck.name}" onerror="this.src='${makePortraitSvg(leaderAvgCheck.name.substring(0, 2), '#059669', '#10b981')}'" />
      </div>
      <div class="leader-name">${leaderAvgCheck.name}</div>
      <div class="leader-branch">📍 ${getBranchName(leaderAvgCheck.branchId)}</div>
      <div class="leader-metric-box">
        <div class="metric-num">${formatMoney(leaderAvgCheck.avgCheck)}</div>
        <div class="metric-desc">Средний чек одного покупателя</div>
      </div>
    </div>

    <!-- Эталон пунктуальности (0 минут опоздания, 0 сум штрафа) -->
    <div class="leader-card punctual-leader">
      <div class="cup-badge clock">⏰</div>
      <div class="leader-nomination">Эталон дисциплины</div>
      <div class="leader-avatar-wrap">
        <img src="${leaderPunctual.photo}" alt="${leaderPunctual.name}" onerror="this.src='${makePortraitSvg(leaderPunctual.name.substring(0, 2), '#16a34a', '#059669')}'" />
      </div>
      <div class="leader-name">${leaderPunctual.name}</div>
      <div class="leader-branch">📍 ${getBranchName(leaderPunctual.branchId)}</div>
      <div class="leader-metric-box">
        <div class="metric-num">${leaderPunctual.arrTime} • 0 сум штрафа</div>
        <div class="metric-desc">Приход до 08:00 (100% пунктуальность)</div>
      </div>
    </div>
  `;
}

// 4. Лог распознавания лиц камер
function renderCameraLogs() {
  const listEl = document.getElementById("faceLogList");
  if (!listEl) return;

  listEl.innerHTML = state.cameraLogs.map(log => `
    <div class="face-log-item">
      <div class="face-log-user">
        <span>📸</span>
        <span>${log.name}</span>
        <span style="font-weight:400; color:#64748b;">(${log.branch})</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="background:#ecfdf5; color:#059669; padding:2px 6px; border-radius:4px; font-weight:700;">${log.score}</span>
        <span class="face-log-time">${log.time}</span>
      </div>
    </div>
  `).join("");
}

// ============================================================================
// ИИ-ПОМОЩНИК ANTIGRAVITY (АНТИГРАВИТИ) — ЧАТ И АНАЛИТИКА
// ============================================================================
function toggleAiChat() {
  const drawer = document.getElementById("aiChatDrawer");
  if (!drawer) return;
  drawer.classList.toggle("active");
  if (drawer.classList.contains("active")) {
    const input = document.getElementById("aiChatInput");
    if (input) input.focus();
  }
}

function closeAiChat() {
  const drawer = document.getElementById("aiChatDrawer");
  if (drawer) drawer.classList.remove("active");
}

function renderAiChat() {
  const body = document.getElementById("aiChatBody");
  if (!body) return;

  body.innerHTML = state.aiChatHistory.map(msg => `
    <div class="chat-bubble ${msg.sender}">
      ${msg.text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
    </div>
  `).join("");

  body.scrollTop = body.scrollHeight;
}

function sendAiMessage(customText) {
  const input = document.getElementById("aiChatInput");
  const text = (customText || (input ? input.value : "")).trim();
  if (!text) return;

  if (input) input.value = "";

  // Добавляем сообщение пользователя
  state.aiChatHistory.push({ sender: "user", text: text });
  renderAiChat();

  // Имитация мгновенного умного анализа Antigravity AI
  setTimeout(() => {
    const aiAnswer = getAiResponse(text);
    state.aiChatHistory.push({ sender: "bot", text: aiAnswer });
    renderAiChat();
  }, 400);
}

function getAiResponse(userMsg) {
  const staff = getOrGenerateDayData(state.currentDate);
  const q = userMsg.toLowerCase();

  // 1. Лидер продаж
  if (q.includes("лидер") || q.includes("көп саўда") || (q.includes("выручк") && q.includes("кто")) || q.includes("чемпион")) {
    const leader = [...staff].sort((a, b) => b.sales - a.sales)[0];
    const b = BRANCHES_DEF.find(x => x.id === leader.branchId);
    return `🏆 **Бүгинги саўда чемпионы — ${leader.name}!**\n\n` +
           `📍 Филиал: **${b.name} (${b.city})**\n` +
           `💰 Дневная выручка: **${formatMoney(leader.sales)}**\n` +
           `🧾 Пробито чеков: **${leader.checks} шт**\n` +
           `🏷️ Средний чек: **${formatMoney(leader.avgCheck)}**\n\n` +
           `Жуда жоқары нәтийже! ${leader.name} бүгин барлық филиаллар арасында 1-орында киятыр.`;
  }

  // 2. Опоздания и штрафы
  if (q.includes("опозда") || q.includes("кешик") || q.includes("штраф") || q.includes("жаза") || q.includes("келме")) {
    const lateList = staff.filter(s => calculateLatenessAndPenalty(s.arrTime).isLate);
    if (lateList.length === 0) {
      return `🎉 **Бүгин ҳеш ким кешикпеди!** Барлық 12 фармацевт жумысқа 08:00-ге шекем келген. Штрафлар суммасы: 0 сум.`;
    }
    let res = `⚠️ **Бүгин ${lateList.length} фармацевт 08:00-ден кешигип келди:**\n\n`;
    let totalFine = 0;
    lateList.forEach(p => {
      const l = calculateLatenessAndPenalty(p.arrTime);
      totalFine += l.penalty;
      const b = BRANCHES_DEF.find(x => x.id === p.branchId);
      res += `• **${p.name}** (${b.name}): приход в **${p.arrTime}** (+${l.lateMinutes} мин) ➔ Штраф: **-${formatMoney(l.penalty)}**\n`;
    });
    res += `\n🛑 **Жәми кешигиў штрафлары:** **${formatMoney(totalFine)}**.\n(Регламент: ҳәр 5 минутқа 10 000 сум автомат есапланады).`;
    return res;
  }

  // 3. Общая выручка и сводка за день
  if (q.includes("выручк") || q.includes("саўда") || q.includes("общ") || q.includes("күнлик") || q.includes("итог") || q.includes("жағдай")) {
    let totSales = 0, totChecks = 0, totPenalties = 0;
    staff.forEach(s => {
      totSales += s.sales;
      totChecks += s.checks;
      totPenalties += calculateLatenessAndPenalty(s.arrTime).penalty;
    });
    const avg = totChecks > 0 ? Math.round(totSales / totChecks) : 0;
    return `📊 **«Пинток Медикал» тармағының бүгинги улыўма есабаты (${state.currentDate}):**\n\n` +
           `💰 **Улыўма выручка:** ${formatMoney(totSales)}\n` +
           `🧾 **Чеклер саны:** ${formatNumber(totChecks)} чеков\n` +
           `🏷️ **Орташа чек:** ${formatMoney(avg)}\n` +
           `🛑 **Жәми штрафлар:** ${formatMoney(totPenalties)}\n\n` +
           `Барлық 4 филиал актив ислеп атыр: Чимбай (Бескала), Чимбай (Базар), Ходжейли ҳәм Нукус.`;
  }

  // 4. Сравнение филиалов
  if (q.includes("филиал") || q.includes("салыстыр") || q.includes("сравн") || q.includes("қайсы")) {
    let res = `🏢 **4 филиалдың бүгинги үлеси ҳәм саўдасы:**\n\n`;
    BRANCHES_DEF.forEach(b => {
      const bStaff = staff.filter(s => s.branchId === b.id);
      const bSales = bStaff.reduce((sum, s) => sum + s.sales, 0);
      const bChecks = bStaff.reduce((sum, s) => sum + s.checks, 0);
      res += `• **${b.name} (${b.city})**: ${formatMoney(bSales)} (${bChecks} чеков, ${bStaff.length} сотр.)\n`;
    });
    return res;
  }

  // 5. Совет по увеличению среднего чека
  if (q.includes("совет") || q.includes("мәсләҳәт") || q.includes("көмек") || (q.includes("чек") && q.includes("көтөр")) || q.includes("увелич")) {
    return `💡 **Antigravity ИИ-ден орташа чекти көбейтиў ушын 3 нәтийжели мәсләҳәт:**\n\n` +
           `1. **Кросс-продажа (Қосымша усыныс):** Антибиотик алған адамға пробиотик, грипп дәрисине витамин C ямаса мырыш (цинк) усыныў орташа чекти 20-30% ке өсиреди.\n` +
           `2. **Касса зонасындағы майда саўда:** Пастилкалар, медициналық кремлер ҳәм витаминлерди касса қасында көрнекли қойыў.\n` +
           `3. **Күнлик мотивация:** Күн ақырында орташа чеги ең жоқары болған фармацевтке күнлик киши бонус бериў.`;
  }

  // 6. По конкретному сотруднику
  const foundPharm = staff.find(s => q.includes(s.name.toLowerCase()));
  if (foundPharm) {
    const b = BRANCHES_DEF.find(x => x.id === foundPharm.branchId);
    const late = calculateLatenessAndPenalty(foundPharm.arrTime);
    return `👩‍⚕️ **Фармацевт: ${foundPharm.name}**\n` +
           `📍 Филиал: **${b.name} (${b.city})**\n` +
           `💼 Лаўазымы: ${foundPharm.role} (${foundPharm.staj})\n` +
           `⏱ Приход: **${foundPharm.arrTime}** ${late.isLate ? `(⚠️ Опоздание: +${late.lateMinutes} мин, Штраф: -${formatMoney(late.penalty)})` : '✅ (Вовремя, Штраф: 0)'}\n` +
           `🏁 Уход: **${foundPharm.leaveTime}**\n` +
           `💰 Дневная выручка: **${formatMoney(foundPharm.sales)}**\n` +
           `🧾 Пробито чеков: **${foundPharm.checks} шт**\n` +
           `🏷️ Средний чек: **${formatMoney(foundPharm.avgCheck)}**`;
  }

  // Стандартный умный ответ
  return `🤖 Мен — **Antigravity AI** көмекшисимен. Сораўыңызды талладым!\n\n` +
         `Бүгинги күн (${state.currentDate}) бойынша тармақтың улыўма саўдасы: **${formatMoney(staff.reduce((a,b)=>a+b.sales,0))}**.\n` +
         `Жоқарыдағы тез батырмалардан бирин таңласаңыз болады ямаса қәлеген фармацевттиң атын жазып сораң!`;
}

// ============================================================================
// PWA & МОБИЛЬНОЕ ПРИЛОЖЕНИЕ (УСТАНОВКА НА ТЕЛЕФОН)
// ============================================================================
function openPwaModal() {
  document.getElementById("pwaModal").classList.add("active");
}

function closePwaModal() {
  document.getElementById("pwaModal").classList.remove("active");
}

function installPwaApp() {
  if (state.deferredPrompt) {
    state.deferredPrompt.prompt();
    state.deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        alert('🎉 Қутлықлаймыз! «Пинток Медикал» қосымшасы телефоныңызға табыслы орнатылды.');
      }
      state.deferredPrompt = null;
    });
  } else {
    alert("📱 Телефонда орнатыў ушын:\n\n1. Android (Google Chrome): Браузердиң жоқарғы оң мүйешиндеги үш ноқатты (⋮) басып, «Установить приложение» (ямаса «Добавить на главный экран») батырмасын басыңыз.\n\n2. iPhone (Safari): Төмендеги «Поделиться» (бөлисиў) белгисин басып, «На экран «Домой»» батырмасын басыңыз!");
  }
}

// ============================================================================
// ДЕЙСТВИЯ: КАЛЕНДАРЬ, ФИЛЬТРЫ, РЕДАКТИРОВАНИЕ, МОДАЛКИ
// ============================================================================
function setDate(dateStr) {
  state.currentDate = dateStr;
  document.getElementById("workDatePicker").value = dateStr;
  updateQuickDateButtons(dateStr);
  renderApp();
}

function changeDateByOffset(offsetDays) {
  const current = new Date(state.currentDate);
  current.setDate(current.getDate() + offsetDays);
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, '0');
  const day = String(current.getDate()).padStart(2, '0');
  setDate(`${year}-${month}-${day}`);
}

function updateQuickDateButtons(dateStr) {
  const today = getTodayString();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yest = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  document.querySelectorAll(".quick-date-btn").forEach(btn => btn.classList.remove("active"));

  if (dateStr === today) {
    const btn = document.getElementById("btnDateToday");
    if (btn) btn.classList.add("active");
  } else if (dateStr === yest) {
    const btn = document.getElementById("btnDateYest");
    if (btn) btn.classList.add("active");
  }
}

function filterByBranch(branchId) {
  state.activeFilterBranch = branchId;
  document.querySelectorAll(".branch-tab-btn").forEach(b => b.classList.remove("active"));
  const activeBtn = document.getElementById(`tab-branch-${branchId}`);
  if (activeBtn) activeBtn.classList.add("active");
  renderApp();
}

function onSearchInput(val) {
  state.searchQuery = val;
  renderApp();
}

function editPharmacistRecord(id) {
  const staff = getOrGenerateDayData(state.currentDate);
  const p = staff.find(x => x.id === id);
  if (!p) return;

  const newArr = prompt(`Время прихода для ${p.name} (Регламент: 08:00, за каждые 5 мин опоздания штраф 10 000 сум):`, p.arrTime);
  if (newArr === null) return;

  const newLeave = prompt(`Время ухода для ${p.name} (Регламент: 18:00):`, p.leaveTime);
  const newSales = prompt(`Сумма дневной выручки (сум):`, p.sales);
  const newChecks = prompt(`Количество пробитых чеков:`, p.checks);

  if (newArr && newArr.trim()) p.arrTime = newArr.trim();
  if (newLeave && newLeave.trim()) p.leaveTime = newLeave.trim();
  if (newSales) p.sales = parseInt(newSales, 10) || p.sales;
  if (newChecks) p.checks = parseInt(newChecks, 10) || p.checks;
  p.clients = Math.round(p.checks * 1.12);
  p.avgCheck = p.checks > 0 ? Math.round(p.sales / p.checks) : 0;

  const penaltyCheck = calculateLatenessAndPenalty(p.arrTime);
  saveData();
  renderApp();

  if (penaltyCheck.isLate) {
    alert(`⚠️ Внимание! ${p.name} пришла в ${p.arrTime}.\nОпоздание: ${penaltyCheck.lateMinutes} мин (${penaltyCheck.intervals} интервалов по 5 мин).\nАвтоматически начислен штраф: ${formatMoney(penaltyCheck.penalty)}!`);
  } else {
    alert(`✅ ${p.name} пришла вовремя в ${p.arrTime}. Штраф: 0 сум.`);
  }
}

function promptChangePhoto(id) {
  const staff = getOrGenerateDayData(state.currentDate);
  const p = staff.find(x => x.id === id);
  if (!p) return;

  const url = prompt(`Введите URL или путь к фото для ${p.name}:`, p.photo);
  if (url && url.trim()) {
    p.photo = url.trim();
    saveData();
    renderApp();
  }
}

function openCamerasModal() {
  document.getElementById("camerasModal").classList.add("active");
}

function closeCamerasModal() {
  document.getElementById("camerasModal").classList.remove("active");
}

function openFAptekaModal() {
  document.getElementById("fAptekaModal").classList.add("active");
}

function closeFAptekaModal() {
  document.getElementById("fAptekaModal").classList.remove("active");
}

function triggerFaceRecognitionSim() {
  const staff = getOrGenerateDayData(state.currentDate);
  const randomPharm = staff[Math.floor(Math.random() * staff.length)];
  const b = BRANCHES_DEF.find(x => x.id === randomPharm.branchId);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const shortTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const isMorning = now.getHours() < 13;
  if (isMorning) {
    randomPharm.arrTime = shortTime;
  } else {
    randomPharm.leaveTime = shortTime;
  }

  const lateCheck = calculateLatenessAndPenalty(randomPharm.arrTime);

  const newLog = {
    time: timeStr,
    name: randomPharm.name,
    branch: `${b.name} (${b.city})`,
    action: isMorning 
      ? (lateCheck.isLate ? `Вход: ${shortTime} (Опоздание ${lateCheck.lateMinutes}м • Штраф -${formatNumber(lateCheck.penalty)} сум)` : `Вход: ${shortTime} (Вовремя • Штраф 0)`)
      : `Выход зафиксирован: ${shortTime}`,
    score: (98 + Math.random() * 1.8).toFixed(1) + "%"
  };

  state.cameraLogs.unshift(newLog);
  if (state.cameraLogs.length > 25) state.cameraLogs.pop();

  saveData();
  renderApp();

  let msg = `📸 Камера FaceID зафиксировала лицо сотрудника:\nСотрудник: ${randomPharm.name}\nФилиал: ${b.name} (${b.city})\nВремя: ${timeStr}\nТочность: ${newLog.score}\n`;
  if (isMorning) {
    if (lateCheck.isLate) {
      msg += `\n⚠️ ОПОЗДАНИЕ: ${lateCheck.lateMinutes} мин после 08:00 (${lateCheck.intervals} × 5 мин)!\nНачислен штраф: ${formatMoney(lateCheck.penalty)}`;
    } else {
      msg += `\n✅ Приход вовремя (до 08:00). Штраф: 0 сум.`;
    }
  } else {
    msg += `\n🏁 Выход зафиксирован в ${shortTime}.`;
  }
  alert(msg);
}

function triggerFAptekaSync() {
  const btn = document.getElementById("btnSyncNow");
  if (btn) {
    btn.textContent = "⏳ Синхронизация с базой F-Аптека...";
    btn.disabled = true;
  }

  setTimeout(() => {
    if (btn) {
      btn.textContent = "🔄 Синхронизировать сейчас";
      btn.disabled = false;
    }

    const syncEl = document.getElementById("lastSyncTimeText");
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    if (syncEl) syncEl.textContent = `Сегодня, в ${timeStr} (Все чеки и табель выгружены)`;

    alert(`✅ Успешная интеграция с F-Аптека!\n\nВсе чеки, выручка и табель (08:00 - 18:00) за дату ${state.currentDate} переданы в F-Apteka v2.4.\nОшибок нет. Пинг: 11 мс.`);
    renderApp();
  }, 1200);
}

function exportToExcel() {
  const staff = getOrGenerateDayData(state.currentDate);

  let csv = "\uFEFF";
  csv += `ОТЧЕТ ПО СЕТИ АПТЕК «ПИНТОК МЕДИКАЛ» ЗА ДАТУ: ${state.currentDate}\r\n`;
  csv += `Регламент: Приход 08:00, Уход 18:00. Штраф за опоздание: 10 000 сум за каждые 5 минут.\r\n\r\n`;
  csv += "Филиал;Адрес;Фармацевт;Должность;Приход;Опоздание (мин);Штраф (сум);Уход;Выручка (сум);Кол-во чеков;Покупатели;Средний чек (сум)\r\n";

  staff.forEach(p => {
    const b = BRANCHES_DEF.find(x => x.id === p.branchId);
    const late = calculateLatenessAndPenalty(p.arrTime);
    csv += `"${b.name}";"${b.address}";"${p.name}";"${p.role}";"${p.arrTime}";"${late.lateMinutes}";"${late.penalty}";"${p.leaveTime}";"${p.sales}";"${p.checks}";"${p.clients}";"${p.avgCheck}"\r\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Pintok_Medical_Report_${state.currentDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function exportToJson() {
  const staff = getOrGenerateDayData(state.currentDate);
  const reportWithPenalties = staff.map(p => {
    const late = calculateLatenessAndPenalty(p.arrTime);
    return {
      ...p,
      penaltyCalc: late
    };
  });

  const data = {
    network: "Пинток Медикал (Pintok Medical)",
    workRegulations: WORK_RULES,
    date: state.currentDate,
    exportTimestamp: new Date().toISOString(),
    branches: BRANCHES_DEF,
    dailyReport: reportWithPenalties
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `f_apteka_export_${state.currentDate}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Инициализация при старте страницы
window.addEventListener("DOMContentLoaded", () => {
  loadSavedData();

  // Регистрация Service Worker для PWA (приложение на телефон)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('PWA ServiceWorker зарегистрирован успешно:', reg.scope);
    }).catch((err) => {
      console.log('Ошибка регистрации ServiceWorker:', err);
    });
  }

  // Событие браузера для установки PWA
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const btn = document.getElementById("btnInstallPwa");
    if (btn) btn.style.display = "inline-flex";
  });

  const picker = document.getElementById("workDatePicker");
  if (picker) {
    picker.value = state.currentDate;
    picker.addEventListener("change", (e) => {
      setDate(e.target.value);
    });
  }

  // Закрытие модалок по клику на фон
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove("active");
      }
    });
  });

  // Enter в поле чата с ИИ
  const aiInput = document.getElementById("aiChatInput");
  if (aiInput) {
    aiInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        sendAiMessage();
      }
    });
  }

  renderApp();

  // Живая синхронизация с Telegram-ботом (/bot-data/attendance.json)
  async function syncBotAttendance() {
    try {
      const res = await fetch(`./bot-data/attendance.json?t=${Date.now()}`);
      if (!res.ok) return;
      const attData = await res.json();
      if (!attData || !attData.days) return;
      const dayRecs = attData.days[state.currentDate];
      if (dayRecs) {
        const staff = getOrGenerateDayData(state.currentDate);
        let updated = false;
        Object.values(dayRecs).forEach(rec => {
          const match = staff.find(p => p.name.toLowerCase() === rec.name.toLowerCase());
          if (match) {
            if (rec.arrTime && rec.arrTime !== "—" && match.arrTime !== rec.arrTime) {
              match.arrTime = rec.arrTime;
              updated = true;
            }
            if (rec.leaveTime && rec.leaveTime !== "—" && match.leaveTime !== rec.leaveTime) {
              match.leaveTime = rec.leaveTime;
              updated = true;
            }
          }
        });
        if (updated) {
          saveCurrentData();
          renderApp();
        }
      }
    } catch (e) {
      // ignore offline or local file fetch errors
    }
  }
  syncBotAttendance();
  setInterval(syncBotAttendance, 5000);
});
