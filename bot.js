// PINTOK APTEKA — ХЫЗМЕТКЕРЛЕР БОТЫ (Сатыўшылар, Закупщик Юсуп ҳәм Бухгалтер Мухаммед ушын)
// Токен: 9093634525:AAFgoPIGrd4R4epknfjILXoquBZDnP5_ZJ0 (@apekaaabot)
// Қағыйдалар:
// 1. Хызметкерлер усы ботта ТЕК ҒАНА:
//    - «🟢 Келдим» (5 метр GPS радиус тексериўи менен)
//    - «🔴 Кеттим» (5 метр GPS радиус тексериўи менен)
//    - «💰 Штрафым ҳәм 1 млн бонус» (1 айда жыйналған штрафы ҳәм кешикпесе 1 000 000 сум бонус есабаты)
//    - «👤 Мениң профилим» (тек көриў ушын — хызметкер ештеңени өзгерте алмайды!)
// 2. Кешигиў штрафы: 08:00 ден кейин ҳәр 5 минутқа 10 000 сум.
// 3. Бонус: 1 ай даўамында улыўма кешикпей келсе — 1 000 000 сум бонус!

const fs = require('fs');
const path = require('path');
const {
  WORKPLACES,
  MAX_DISTANCE_METERS,
  MONTHLY_BONUS_SUM,
  PENALTY_PER_5_MIN,
  validateLocationMessage,
  getTashkentNow,
  AttendanceManager
} = require('./attendance');
const { createGroupBotHandler } = require('./group_bot');

const BOT_TOKEN = process.env.EMPLOYEE_BOT_TOKEN || "9093634525:AAFgoPIGrd4R4epknfjILXoquBZDnP5_ZJ0";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const DATA_DIR = path.join(__dirname, 'bot-data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const CONFIG_FILE = path.join(DATA_DIR, 'bot-config.json');

function formatSum(n) {
  return Number(n || 0).toLocaleString("ru-RU").replace(/\u00A0/g, " ");
}

function getAdminBotToken() {
  if (process.env.ADMIN_BOT_TOKEN) return process.env.ADMIN_BOT_TOKEN;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (cfg.adminBotToken) return cfg.adminBotToken;
    }
  } catch (e) {}
  return "9222521770:AAGDhjYGJ02BcMKtsg52Zz9oEz1V-8WYI3U";
}

async function defaultTgRequest(method, data = {}) {
  const maxRetries = method === "getUpdates" ? 1 : 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${TELEGRAM_API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`Employee Bot API error on ${method}:`, err.message);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

async function defaultAdminTgRequest(method, data = {}) {
  const token = getAdminBotToken();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err) {
      if (attempt === 3) {
        console.error(`Admin Bot notify error on ${method}:`, err.message);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// Хызметкерлер ушын ТЕК 4 түйме (ешқандай өзгертиў ямаса басшы функциясы жоқ!)
function getEmployeeMainKeyboard() {
  return {
    keyboard: [
      [{ text: "🟢 Келдим" }, { text: "🔴 Кеттим" }],
      [{ text: "⚫ Кешки смена (17:00 - 00:00)" }],
      [{ text: "💰 Штрафым ҳәм 1 млн бонус" }],
      [{ text: "📅 Мениң айлық табелим" }, { text: "👤 Мениң профилим" }]
    ],
    resize_keyboard: true
  };
}

function getWorkplaceKeyboard() {
  return {
    keyboard: [
      [{ text: "Филиал №1" }, { text: "Филиал №2" }],
      [{ text: "Филиал №3" }, { text: "Филиал №4" }],
      [{ text: "📦 Склад" }],
      [{ text: "Бас меню" }]
    ],
    resize_keyboard: true
  };
}

function getEmployeesKeyboard(employees) {
  const rows = [];
  for (let i = 0; i < employees.length; i += 2) {
    const row = [{ text: `👤 ${employees[i].name} (${employees[i].role})` }];
    if (employees[i + 1]) {
      row.push({ text: `👤 ${employees[i + 1].name} (${employees[i + 1].role})` });
    }
    rows.push(row);
  }
  rows.push([{ text: "Бас меню" }]);
  return {
    keyboard: rows,
    resize_keyboard: true
  };
}

function getLocationRequestKeyboard(actionType) {
  let btnText = "📍 Ҳәзирги GPS локациямды жибериў (Келдим)";
  if (actionType === "IN_EVENING") {
    btnText = "📍 Ҳәзирги GPS локациямды жибериў (⚫ Кешки смена 17:00 - 00:00)";
  } else if (actionType === "OUT") {
    btnText = "📍 Ҳәзирги GPS локациямды жибериў (Кеттим)";
  }
  return {
    keyboard: [
      [{ text: btnText, request_location: true }],
      [{ text: "Бас меню" }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

const SPOOF_REASON_LABELS = {
  FORWARDED_LOCATION: "Басқа адамнан ямаса ески хабардан переслать (forward) етилген локация!",
  MANUAL_VENUE_PIN: "Картадан қол менен таңланған (venue) локация!",
  EDITED_MESSAGE: "Қолда өзгертилген локация хабары!",
  SESSION_EXPIRED: "Түймени басқаннан соң 2 минуттан көп ўақыт өтип кетти!",
  STALE_MESSAGE: "Ескирген GPS хабары!",
  NO_ACTIVE_REQUEST: "Алдын «🟢 Келдим» ямаса «🔴 Кеттим» түймесин басыў керек!"
};

function createBotHandler({
  tgRequest = defaultTgRequest,
  adminTgRequest = defaultAdminTgRequest,
  attendanceMgr = new AttendanceManager(ATTENDANCE_FILE),
  groupBot = null
} = {}) {
  const userSessions = new Map();
  const groupBotHandler = groupBot || createGroupBotHandler({ tgRequest });

  async function notifyAdmins(text) {
    const adminChats = attendanceMgr.getAdminChats();
    for (const adminChatId of adminChats) {
      await adminTgRequest("sendMessage", {
        chat_id: adminChatId,
        text,
        parse_mode: "Markdown"
      });
    }
  }

  async function promptLocationStep(chatId, profile, actionType) {
    const settings = attendanceMgr.getSettings();
    const maxDist = settings.maxDistanceMeters || MAX_DISTANCE_METERS;
    userSessions.set(chatId, {
      step: "AWAITING_ATTENDANCE_LOCATION",
      actionType,
      requestedAt: Date.now()
    });
    let actionTitle = "🟢 ЖУМЫСҚА КЕЛДИМ (08:00 смена)";
    if (actionType === "IN_EVENING") {
      actionTitle = "⚫ КЕШКИ СМЕНАҒА КЕЛДИМ (17:00 - 00:00)";
    } else if (actionType === "OUT") {
      actionTitle = "🔴 ЖУМЫСТАН КЕТТИМ";
    }
    const shiftRuleLine = actionType === "IN_EVENING"
      ? `• Кешки смена ўақты: **17:00 ден 00:00 ге шекем** (17:00 ден кешиккен ҳәр 5 минутқа 10 000 сум штраф).\n`
      : "";
    const msg =
      `${actionTitle} — **${profile.employee.name}** (${profile.workplace.shortName})\n\n` +
      `📍 **Төмендеги «📍 Ҳәзирги GPS локациямды жибериў» түймесин басың!**\n\n` +
      `⚠️ **Қатаң талаплар:**\n` +
      `${shiftRuleLine}` +
      `• Сиз **${profile.workplace.shortName}** ишинде (максимум **${maxDist} метр** радиуста) болыўыңыз шәрт!\n` +
      `• Картаны қол менен жылжытып ямаса переслать етип алдай алмайсыз.`;

    await tgRequest("sendMessage", {
      chat_id: chatId,
      text: msg,
      parse_mode: "Markdown",
      reply_markup: getLocationRequestKeyboard(actionType)
    });
  }

  function formatEmployeeBonusAndPenaltyCard(employeeId) {
    const now = getTashkentNow();
    const settings = attendanceMgr.getSettings();
    const stats = attendanceMgr.getEmployeeMonthlyStats(employeeId, now.yearMonth);
    const dayRec = (attendanceMgr.state.days[now.dateStr] || {})[employeeId];

    const todayIn = dayRec ? dayRec.arrTime : "—";
    const todayOut = dayRec ? dayRec.leaveTime : "—";
    const todayPen = dayRec ? (dayRec.penalty || 0) : 0;

    const bonusTargetStr = formatSum(settings.monthlyBonusSum || MONTHLY_BONUS_SUM);
    const penRuleStr = formatSum(settings.penaltyPer5Min || PENALTY_PER_5_MIN);

    let bonusStatusBlock = "";
    if (stats.bonusEligible) {
      bonusStatusBlock =
        `🏆 **1 АЙЛЫҚ БОНУС ЖАҒДАЙЫ:**\n` +
        `✅ **СИЗДЕ ${bonusTargetStr} СУМ БОНУС САҚЛАНЫП ТУР!**\n` +
        `🎉 Сиз усы айда улыўма кешикпедиңиз! Ай ақырына шекем кешикпей келсеңиз, **+${bonusTargetStr} сум** сыйлық аласыз!`;
    } else {
      bonusStatusBlock =
        `🏆 **1 АЙЛЫҚ БОНУС ЖАҒДАЙЫ:**\n` +
        `❌ **Бонус күйди (0 сум)** — себеби усы айда ${stats.lateDaysCount} мәрте кешигиў дизимге алынған.\n` +
        `*(1 ай даўамында улыўма кешикпей келген хызметкерге ${bonusTargetStr} сум бериледи).*`;
    }

    return (
      `💰 **МЕНИҢ АЙЛЫҚ ШТРАФЫМ ҲӘМ 1 000 000 СУМ БОНУСЫМ**\n\n` +
      `👤 Хызметкер: **${stats.employee.name}** (${stats.employee.role})\n` +
      `🏛️ Жумыс орны: **${stats.workplace.shortName}**\n` +
      `📅 Ай: **${now.yearMonth}**\n\n` +
      `🕒 **Бүгин (${now.dateStr}):**\n` +
      `• Келген ўақты: \`${todayIn}\` | Кеткен ўақты: \`${todayOut}\`\n` +
      `• Бүгинги штраф: **${formatSum(todayPen)} сум**\n\n` +
      `📊 **Усы айдағы жәми көрсеткишлер:**\n` +
      `• Жумысқа шыққан күнлер: **${stats.totalDaysWorked} күн**\n` +
      `• Өз ўақтында келген: **${stats.onTimeDaysCount} күн**\n` +
      `• Кешиккен күнлер: **${stats.lateDaysCount} күн** (жәми ${stats.totalLateMinutes} мин)\n` +
      `• 💸 **1 АЙДА ЖЫЙНАЛҒАН ЖӘМИ ШТРАФ:** **${formatSum(stats.totalPenalty)} сум**\n\n` +
      `${bonusStatusBlock}\n\n` +
      `📌 *Қағыйда: Күндизги смена ${settings.startTime || '08:00'}, Кешки смена ${settings.eveningStartTime || '17:00'} ден ${settings.eveningEndTime || '00:00'} ге шекем. Кешиккен ҳәр 5 минут ушын ${penRuleStr} сум штраф жазылады.*`
    );
  }

  async function handleLocationMessage(msg) {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);
    const profile = attendanceMgr.getEmployeeByTelegramId(chatId);

    if (!profile) {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Алдын **«🟢 Келдим»** түймесин басып, филиал ҳәм өз атыңызды таңлаң.",
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    const actionType = (session && session.actionType) ? session.actionType : "IN";
    let actionLabel = "🟢 Келдим";
    if (actionType === "IN_EVENING") actionLabel = "⚫ Кешки смена (17:00 - 00:00)";
    else if (actionType === "OUT") actionLabel = "🔴 Кеттим";

    const validation = validateLocationMessage(msg, session, Date.now());
    if (!validation.valid) {
      const reasonText = SPOOF_REASON_LABELS[validation.reason] || validation.reason;
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `🚫 **ҚАБЫЛ ЕТИЛМЕДИ (Анти-Фейк қорғаўы)!**\n\nСебеби: ${reasonText}\n\nИлтимас, **«${actionLabel}»** түймесин қайта басып, туўры GPS түймеси арқалы жибериң.`,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });

      await notifyAdmins(
        `🚨 **АЛДАЎҒА УРЫНЫЎ (АНТИ-ФЕЙК):**\n` +
        `👤 Хызметкер: **${profile.employee.name}** (${profile.employee.role})\n` +
        `🏛️ Орын: ${profile.workplace.shortName}\n` +
        `🔘 Басқан түймеси: ${actionLabel}\n` +
        `⚠️ Себеби: ${reasonText}`
      );
      return;
    }

    const { latitude, longitude } = msg.location;
    const res = attendanceMgr.recordAction({
      telegramUserId: chatId,
      actionType,
      lat: latitude,
      lng: longitude,
      isLive: validation.isLive
    });

    userSessions.delete(chatId);

    if (!res.ok && res.error === "TOO_FAR") {
      const rejectText =
        `🚫 **ҚАБЫЛ ЕТИЛМЕДИ! СИЗ ЖУМЫС ОРНЫНАН УЗАҚТАСЫЗ!**\n\n` +
        `👤 Хызметкер: **${res.employee.name}** (${res.employee.role})\n` +
        `🏛️ Жумыс орны: **${res.workplace.shortName}**\n` +
        `📏 Сиз турған аралық: **${res.distanceMeters} метр**\n` +
        `🎯 Рухсат етилген радиус: **максимум ${res.maxAllowed} метр!**\n\n` +
        `⚠️ *Жумыс орнына (${res.workplace.shortName}) кирип, ${res.maxAllowed} метр ишинде қайтадан «${actionLabel}» түймесин басың!*`;

      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: rejectText,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });

      await notifyAdmins(
        `⚠️ **УЗАҚТАН БАСЫЎ (> ${res.maxAllowed} м):**\n` +
        `👤 Хызметкер: **${res.employee.name}** (${res.employee.role})\n` +
        `🏛️ Орын: **${res.workplace.shortName}**\n` +
        `🔘 Ҳәрекет: ${actionLabel}\n` +
        `📏 Аралық: **${res.distanceMeters} метр** (Шек: ${res.maxAllowed} м)\n` +
        `❌ **Статус:** Қабыл етилмеди!`
      );
      return;
    }

    if (res.ok) {
      const mStats = res.monthlyStats;
      const bonusLine = mStats.bonusEligible
        ? `🏆 **Айлық бонус:** 1 000 000 сум сақланып тур! ✅`
        : `💸 **Ай даўамында жыйналған штраф:** ${mStats.totalPenalty.toLocaleString("ru-RU")} сум`;

      if (actionType === "IN" || actionType === "IN_EVENING") {
        const isEvening = actionType === "IN_EVENING";
        const shiftBadge = isEvening ? "⚫ Кешки смена (17:00 - 00:00)" : "🟢 Күндизги смена (08:00 - 18:00)";
        const penaltyLine = res.record.isLate
          ? `⚠️ **Бүгинги кешигиў (${isEvening ? "17:00 ден" : "08:00 ден"}):** ${res.record.lateMinutes} минут (Штраф: **${res.record.penalty.toLocaleString("ru-RU")} сум**)`
          : `✅ **Өз ўақтында келдиңиз!** (Бүгинги штраф: 0 сум)`;

        const okMsg =
          `${isEvening ? "⚫ **КЕШКИ СМЕНАҒА (17:00 - 00:00)" : "✅ **ЖУМЫСҚА"} КЕЛГЕНИҢИЗ ДИЗИМГЕ АЛЫНДЫ!**\n\n` +
          `👤 Хызметкер: **${res.employee.name}** (${res.employee.role})\n` +
          `🏛️ Орын: **${res.workplace.shortName}**\n` +
          `🕒 Смена: **${shiftBadge}**\n` +
          `🕒 Келген ўақты: **${res.timeStr}** (${res.dateStr})\n` +
          `📏 GPS дәллиги: **${res.distanceMeters} м** (≤ 4 м ✅)\n` +
          `${penaltyLine}\n` +
          `${bonusLine}`;

        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: okMsg,
          parse_mode: "Markdown",
          reply_markup: getEmployeeMainKeyboard()
        });

        await notifyAdmins(
          `${isEvening ? "⚫ **КЕШКИ СМЕНАҒА КЕЛДИ (17:00 - 00:00):**" : "🟢 **ЖУМЫСҚА КЕЛДИ:**"}\n` +
          `👤 **${res.employee.name}** (${res.employee.role})\n` +
          `🏛️ Орын: **${res.workplace.shortName}**\n` +
          `🕒 Смена: **${shiftBadge}**\n` +
          `🕒 Келген ўақты: **${res.timeStr}**\n` +
          `📏 Аралық: **${res.distanceMeters} м** (≤ 4 м ✅)\n` +
          `${penaltyLine}\n` +
          `💰 Айлық жәми штрафы: **${mStats.totalPenalty.toLocaleString("ru-RU")} сум**`
        );
      } else {
        const okOutMsg =
          `🔴 **ЖУМЫСТАН ШЫҚҚАНЫҢЫЗ ДИЗИМГЕ АЛЫНДЫ!**\n\n` +
          `👤 Хызметкер: **${res.employee.name}** (${res.employee.role})\n` +
          `🏛️ Орын: **${res.workplace.shortName}**\n` +
          `🕒 Келген ўақты: **${res.record.arrTime}**\n` +
          `🕒 Кеткен ўақты: **${res.timeStr}** (${res.dateStr})\n` +
          `📏 GPS дәллиги: **${res.distanceMeters} м** (≤ 4 м ✅)\n` +
          `${bonusLine}`;

        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: okOutMsg,
          parse_mode: "Markdown",
          reply_markup: getEmployeeMainKeyboard()
        });

        await notifyAdmins(
          `🔴 **ЖУМЫСТАН КЕТТИ:**\n` +
          `👤 **${res.employee.name}** (${res.employee.role})\n` +
          `🏛️ Орын: **${res.workplace.shortName}**\n` +
          `🕒 Келген еди: **${res.record.arrTime}** → Кетти: **${res.timeStr}**\n` +
          `📏 Аралық: **${res.distanceMeters} м** (≤ 4 м ✅)`
        );
      }
    }
  }

  async function handleUserMessage(msg) {
    if (!msg || !msg.chat) return;
    const chatId = msg.chat.id;

    // Группа хабарлары (дәри сораў, рецепт жибериў) ҳәм тест командалары (/test_8, /test_10, /test_15, /test_19, /test_reply, /activate)
    const handledByGroupBot = await groupBotHandler.handleGroupMessage(msg);
    if (handledByGroupBot) {
      return;
    }

    if (msg.location) {
      await handleLocationMessage(msg);
      return;
    }

    const text = (msg.text || "").trim();
    const userName = (msg.from && msg.from.first_name) ? msg.from.first_name : "Хызметкер";
    let session = userSessions.get(chatId);

    // /start ямаса Бас меню
    if (text === "/start" || text === "Бас меню" || text === "❌ Бийкар етиў") {
      userSessions.delete(chatId);
      const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
      const profileBadge = profile
        ? `👤 **Сизиң профилиңиз:** ${profile.employee.name} (${profile.employee.role} — ${profile.workplace.shortName})\n🔒 *Профиль сизиң телефоныңызға беккемленген.*`
        : `ℹ️ *Жумысқа келгенде «🟢 Келдим» түймесин басып, бир мәрте өз атыңызды таңлаң.*`;

      const welcome =
        `🏥 **«PINTOK APTEKA» — ХЫЗМЕТКЕРЛЕР ТАБЕЛЬ БОТЫ** 🕒\n\n` +
        `${profileBadge}\n\n` +
        `📌 **Қағыйдалар:**\n` +
        `• Күндизги смена (08:00): **«🟢 Келдим»**, шыққанда **«🔴 Кеттим»** түймесин басың.\n` +
        `• Кешки смена (17:00 - 00:00): **«⚫ Кешки смена (17:00 - 00:00)»** түймесин басың.\n` +
        `• Барлық түймелер тек жумыс орнында **4 метр** ишинде ислейди.\n` +
        `• Кешиккен ҳәр **5 минут** ушын **10 000 сум** штраф жазылады.\n` +
        `• 🏆 **1 ай даўамында улыўма кешикпей келсеңиз — 1 000 000 сум бонус бериледи!**\n\n` +
        `👇 *Төмендеги түймелерден пайдаланың:*`;

      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: welcome,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    // 1. «🟢 Келдим», «⚫ Кешки смена (17:00 - 00:00)» ямаса «🔴 Кеттим»
    if (text === "🟢 Келдим" || text === "🔴 Кеттим" || text === "⚫ Кешки смена (17:00 - 00:00)" || text.includes("Кешки смена")) {
      let actionType = "IN";
      if (text === "🔴 Кеттим") actionType = "OUT";
      else if (text.includes("Кешки смена")) actionType = "IN_EVENING";
      const profile = attendanceMgr.getEmployeeByTelegramId(chatId);

      if (!profile) {
        userSessions.set(chatId, {
          step: "SELECT_WORKPLACE",
          pendingActionType: actionType
        });
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `👋 **Биринши мәрте дизимнен өтиў:**\n\nҚайсы филиал ямаса складта ислейсиз? Таңлаң:`,
          parse_mode: "Markdown",
          reply_markup: getWorkplaceKeyboard()
        });
        return;
      }

      await promptLocationStep(chatId, profile, actionType);
      return;
    }

    // 2. «💰 Штрафым ҳәм 1 млн бонус» (Арнаўлы түйме)
    if (text === "💰 Штрафым ҳәм 1 млн бонус") {
      const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
      if (!profile) {
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `⚠️ Алдын **«🟢 Келдим»** түймесин басып, филиал ҳәм өз атыңызды таңлаң.`,
          parse_mode: "Markdown",
          reply_markup: getEmployeeMainKeyboard()
        });
        return;
      }
      const cardText = formatEmployeeBonusAndPenaltyCard(profile.employee.id);
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: cardText,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    // 3. «📅 Мениң айлық табелим» (тек өз күнлерин көриў)
    if (text === "📅 Мениң айлық табелим") {
      const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
      if (!profile) {
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `⚠️ Алдын **«🟢 Келдим»** түймесин басып, өз атыңызды таңлаң.`,
          parse_mode: "Markdown",
          reply_markup: getEmployeeMainKeyboard()
        });
        return;
      }
      const now = getTashkentNow();
      const stats = attendanceMgr.getEmployeeMonthlyStats(profile.employee.id, now.yearMonth);
      let histText = `📅 **${profile.employee.name} — УСЫ АЙДАҒЫ КЕЛИП-КЕТИЎ ТАРИЙХЫ (${now.yearMonth}):**\n\n`;
      if (stats.history.length === 0) {
        histText += `Усы айда еле белгиленген күнлер жоқ.\n`;
      } else {
        stats.history.forEach((h, i) => {
          const penInfo = h.penalty > 0 ? ` | ⚠️ Штраф: ${h.penalty.toLocaleString("ru-RU")} сум` : ` | ✅ Өз ўақтында`;
          histText += `${i + 1}. **${h.date}**: Келди \`${h.arrTime}\` → Кетти \`${h.leaveTime}\`${penInfo}\n`;
        });
      }
      histText += `\n💸 **Жәми жыйналған штраф:** ${stats.totalPenalty.toLocaleString("ru-RU")} сум\n`;
      histText += `🏆 **1 000 000 сум бонус:** ${stats.bonusEligible ? 'Сақланып тур ✅' : 'Кешигиў себепли күйди ❌'}`;

      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: histText,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    // 4. «👤 Мениң профилим» — Байланысқаннан соң хызметкер ОНЫ ӨЗГЕРТЕ АЛМАЙДЫ!
    if (text === "👤 Мениң профилим") {
      const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
      if (profile) {
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text:
            `👤 **СИЗИҢ ПРОФИЛИҢИЗ (Қулыпланған 🔒):**\n\n` +
            `• Аты-жөни: **${profile.employee.name}**\n` +
            `• Лаўазымы: **${profile.employee.role}**\n` +
            `• Жумыс орны: **${profile.workplace.shortName}**\n\n` +
            `🚫 *Қәўипсизлик қағыйдасы бойынша хызметкер өз профилин ямаса штрафларын өзгерте алмайсыз! Тек Басшы (Админ бот арқалы) өзгерте алады.*`,
          parse_mode: "Markdown",
          reply_markup: getEmployeeMainKeyboard()
        });
        return;
      }

      userSessions.set(chatId, {
        step: "SELECT_WORKPLACE",
        pendingActionType: null
      });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `Қайсы филиал ямаса складта ислейсиз? Таңлаң:`,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    // Биринши мәрте дизимнен өтиў сессиясы
    if (session && session.step === "SELECT_WORKPLACE") {
      const matchedWp = WORKPLACES.find(w => w.name === text || w.shortName === text);
      if (matchedWp) {
        session.step = "SELECT_EMPLOYEE";
        session.workplaceId = matchedWp.id;
        userSessions.set(chatId, session);

        const emps = attendanceMgr.getEmployees(matchedWp.id);
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `🏛️ **${matchedWp.shortName}** таңланды.\n\nДизимнен өз атыңызды таңлаң (⚠️ Дизимнен өткеннен соң оны өзгерте алмайсыз!):`,
          parse_mode: "Markdown",
          reply_markup: getEmployeesKeyboard(emps)
        });
        return;
      }
    }

    if (session && session.step === "SELECT_EMPLOYEE") {
      const emps = attendanceMgr.getEmployees(session.workplaceId);
      const matchedEmp = emps.find(
        e => text === `👤 ${e.name} (${e.role})` || text.includes(e.name)
      );
      if (matchedEmp) {
        const bindRes = attendanceMgr.bindEmployee(
          matchedEmp.id,
          chatId,
          (msg.from && msg.from.username) ? msg.from.username : userName
        );
        if (!bindRes.ok && bindRes.error === "ALREADY_BOUND") {
          userSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🚫 **Қәтелик!** «${matchedEmp.name}» профили әллеқашан басқа телефонға беккемленген! Басқа адамның атынан кириўге болмайды.`,
            parse_mode: "Markdown",
            reply_markup: getEmployeeMainKeyboard()
          });
          return;
        }

        const pendingAction = session.pendingActionType;
        userSessions.delete(chatId);

        const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `✅ **Профиль сизиң телефоныңызға беккемленди!**\n👤 Хызметкер: **${bindRes.employee.name}** (${bindRes.employee.role})\n🏛️ Орын: **${bindRes.workplace.shortName}**`,
          parse_mode: "Markdown",
          reply_markup: getEmployeeMainKeyboard()
        });

        if (pendingAction && profile) {
          await promptLocationStep(chatId, profile, pendingAction);
        }
        return;
      }
    }

    await tgRequest("sendMessage", {
      chat_id: chatId,
      text: `🤖 **«PINTOK APTEKA» Хызметкерлер боты**\n\n• Жумысқа келгенде: **«🟢 Келдим»**\n• Жумыстан шыққанда: **«🔴 Кеттим»**\n• Айлық штраф ҳәм 1 000 000 сум бонусты көриў ушын: **«💰 Штрафым ҳәм 1 млн бонус»** түймесин басың.`,
      parse_mode: "Markdown",
      reply_markup: getEmployeeMainKeyboard()
    });
  }

  return {
    handleUserMessage,
    handleLocationMessage,
    formatEmployeeBonusAndPenaltyCard,
    groupBotHandler
  };
}

let lastUpdateId = 0;
async function pollUpdates() {
  const { handleUserMessage, groupBotHandler } = createBotHandler();

  // Ҳәр 20 секундта группаларға 08:00, 10:00, 15:00, 19:00 хабарларын тексерип жибериў
  setInterval(() => {
    groupBotHandler.checkAndRunDailySchedule().catch(err => {
      console.error("Group schedule error:", err.message);
    });
  }, 20000);

  while (true) {
    try {
      await groupBotHandler.checkAndRunDailySchedule();
      const data = await defaultTgRequest("getUpdates", {
        offset: lastUpdateId + 1,
        timeout: 25
      });

      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          if (update.my_chat_member) {
            await groupBotHandler.handleChatMemberUpdate(update.my_chat_member);
          }
          const incomingMsg = update.message || update.edited_message;
          if (incomingMsg) {
            await handleUserMessage(incomingMsg);
          }
        }
      }
    } catch (err) {
      console.error("Polling error:", err);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

module.exports = { createBotHandler };

if (require.main === module) {
  console.log("PINTOK APTEKA Employee Bot (@apekaaabot) is starting polling...");
  pollUpdates();
}
