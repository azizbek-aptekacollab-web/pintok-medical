// PINTOK APTEKA — ФАРМАЦЕВТЛЕР (ХЫЗМЕТКЕРЛЕР) БОТЫ
// @apteka_kontroll_bot (токен bot-data/bot-config.json файлинан алынады)
// Қағыйдалар:
// 1. 4 филиал, радиус: 50 метр.
//    - 1-Филиал (Шымбай, 5-этажлы Емлеўхана қасында): 1-смена 08:00–16:00, 2-смена 16:30–00:00
//    - 2-Филиал (Шымбай, Базар ишинде): 08:00–19:00
//    - 3-Филиал (Хожели, Емлеўхана қарама-қарсы): 1-смена 08:00–16:00, 2-смена 16:30–00:00
//    - 4-Филиал (Нөкис, Городской Больница қарама-қарсы): 1-смена 08:00–16:00, 2-смена 16:30–00:00
// 2. Ҳәр ким тек өзиниң жеке телефон номеринен киреди (1 телефон = 1 Telegram акк = 1 хызметкер).
// 3. Кешигиў ямаса ўақтынан бурын жаўып кетиў штрафы: ҳәр 1 минутқа 3 000 сум.
// 4. Өз ўақтында ямаса ерте келсе / ўақтында кетсе — 2 қатарлы мотивациялық рахмет СМС жибериледи.
// 5. Кешиккенде 2 сораў соралады (Себепли ме? -> Себебин жазың) ҳәм Басшы ботына жибериледи (айына 3 күн лимит).
// 6. Календарь менюсы ҳәм Больничный режими (тек көриў ушын, өзгерте алмайды).

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  WORKPLACES,
  MAX_DISTANCE_METERS,
  PENALTY_PER_MINUTE,
  MONTHLY_EXCUSE_LIMIT,
  validateContactMessage,
  validateLocationMessage,
  getWorkplaceShiftConfig,
  getTashkentNow,
  AttendanceManager
} = require('./attendance');
const { createGroupBotHandler } = require('./group_bot');

const BOT_TOKEN = process.env.EMPLOYEE_BOT_TOKEN || "9256975178:AAFmH-e7dOiuOx4h6W-L6S2Kv3Rm8Mo850E";

const DATA_DIR = path.join(__dirname, 'bot-data');
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (_) {}
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const CONFIG_FILE = path.join(DATA_DIR, 'bot-config.json');

function formatSum(n) {
  return Number(n || 0).toLocaleString("ru-RU").replace(/\u00A0/g, " ");
}

function getEmployeeBotToken() {
  if (process.env.EMPLOYEE_BOT_TOKEN) return process.env.EMPLOYEE_BOT_TOKEN;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (cfg.employeeBotToken) return cfg.employeeBotToken;
    }
  } catch (e) {}
  return BOT_TOKEN;
}

function getAdminBotToken() {
  if (process.env.ADMIN_BOT_TOKEN) return process.env.ADMIN_BOT_TOKEN;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (cfg.adminBotToken) return cfg.adminBotToken;
    }
  } catch (e) {}
  return "9119556119:AAHrycakPIKnD9D8I_SM5SSELyOzrPnPx2Q";
}

function httpsPostJson(token, method, data = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request(
      {
        hostname: "api.telegram.org",
        port: 443,
        path: `/bot${token}/${method}`,
        method: "POST",
        family: 4,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        },
        timeout: 30000
      },
      res => {
        let raw = "";
        res.on("data", chunk => (raw += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Request timeout"));
    });
    req.write(body);
    req.end();
  });
}

async function defaultTgRequest(method, data = {}) {
  const token = getEmployeeBotToken();
  const maxRetries = method === "getUpdates" ? 1 : 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await httpsPostJson(token, method, data);
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
  const adminToken = getAdminBotToken();
  if (!adminToken) return null;
  try {
    return await httpsPostJson(adminToken, method, data);
  } catch (err) {
    console.error(`Admin notify error on ${method}:`, err.message);
    return null;
  }
}

function getEmployeeMainKeyboard() {
  return {
    keyboard: [
      [
        { text: "🔵 Келдим", style: "primary" },
        { text: "🔴 Кеттим", style: "danger" }
      ],
      [{ text: "📅 Календарь" }, { text: "💰 Штрафым ҳәм Лимитим" }],
      [{ text: "👤 Мениң профилим" }]
    ],
    resize_keyboard: true
  };
}

function getWorkplaceKeyboard() {
  return {
    keyboard: [
      [{ text: "1-Филиал" }, { text: "2-Филиал" }],
      [{ text: "3-Филиал" }, { text: "4-Филиал" }],
      [{ text: "Бас меню" }]
    ],
    resize_keyboard: true
  };
}

function getShiftSelectionKeyboard() {
  return {
    keyboard: [
      [{ text: "☀️ 1-смена (08:00 – 16:00)" }],
      [{ text: "🌙 2-смена (16:30 – 00:00)" }],
      [{ text: "Бас меню" }]
    ],
    resize_keyboard: true
  };
}

function getEmployeesKeyboard(employees) {
  const rows = [
    [{ text: "📱 Өз телефон номеримди тастыйықлаў", request_contact: true }]
  ];
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

function getPhoneRequestKeyboard() {
  return {
    keyboard: [
      [{ text: "📱 Өз телефон номеримди тастыйықлаў", request_contact: true }],
      [{ text: "Бас меню" }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

function getLocationRequestKeyboard(actionType, shiftLabel = "") {
  let btnText = "🔵 📍 Ҳәзирги GPS локациямды жибериў (Келдим)";
  let style = "primary";
  if (actionType === "OUT") {
    btnText = "🔴 📍 Ҳәзирги GPS локациямды жибериў (Кеттим)";
    style = "danger";
  } else if (shiftLabel) {
    btnText = `🔵 📍 Ҳәзирги GPS локациямды жибериў (${shiftLabel})`;
  }
  return {
    keyboard: [
      [{ text: btnText, request_location: true, style }],
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
  SESSION_EXPIRED: "Түймени басқаннан соң 3 минуттан көп ўақыт өтип кетти!",
  STALE_MESSAGE: "Ескирген GPS хабары!",
  NO_ACTIVE_REQUEST: "Алдын «🔵 Келдим» ямаса «🔴 Кеттим» түймесин басыў керек!"
};

function createBotHandler({
  tgRequest = defaultTgRequest,
  adminTgRequest = defaultAdminTgRequest,
  attendanceMgr = new AttendanceManager(ATTENDANCE_FILE),
  groupBot = null
} = {}) {
  const userSessions = attendanceMgr.createSessionStore
    ? attendanceMgr.createSessionStore("user")
    : new Map();
  const groupBotHandler = groupBot || createGroupBotHandler({ tgRequest });

  async function notifyAdmins(text, extra = {}) {
    const adminChats = attendanceMgr.getAdminChats();
    for (const adminChatId of adminChats) {
      try {
        await adminTgRequest("sendMessage", {
          chat_id: adminChatId,
          text,
          parse_mode: "Markdown",
          ...extra
        });
      } catch (err) {
        console.error(`Admin chat ${adminChatId} notification error:`, err.message);
      }
    }
  }

  async function promptLocationStep(chatId, profile, actionType, shiftId = "SHIFT_1") {
    const settings = attendanceMgr.getSettings();
    const maxDist = settings.maxDistanceMeters || MAX_DISTANCE_METERS;
    const shiftCfg = getWorkplaceShiftConfig(profile.workplace, shiftId);

    userSessions.set(chatId, {
      step: "AWAITING_ATTENDANCE_LOCATION",
      actionType,
      shiftId: shiftCfg.id,
      requestedAt: Date.now()
    });

    const isOut = actionType === "OUT";
    const actionTitle = isOut
      ? `🔴 ЖУМЫСТАН КЕТТИМ (${shiftCfg.label})`
      : `🟢 ЖУМЫСҚА КЕЛДИМ (${shiftCfg.label})`;

    const msg =
      `${actionTitle}\n` +
      `👤 Фармацевт: **${profile.employee.name}**\n` +
      `🏥 Филиал: **${profile.workplace.shortName}**\n` +
      `📍 Мәнзил: *${profile.workplace.address}*\n\n` +
      `👇 **Төмендеги «📍 Ҳәзирги GPS локациямды жибериў» түймесин басың!**\n\n` +
      `⚠️ **Талаплар:**\n` +
      `• Сиз филиалдан максимум **${maxDist} метр** радиус ишинде болыўыңыз шәрт.\n` +
      `• Кешиккен ямаса ўақтынан ерте кеткен ҳәр **1 минутқа 3 000 сум** штраф жазылады.`;

    await tgRequest("sendMessage", {
      chat_id: chatId,
      text: msg,
      parse_mode: "Markdown",
      reply_markup: getLocationRequestKeyboard(actionType, shiftCfg.label)
    });
  }

  function formatEmployeeBonusAndPenaltyCard(employeeId) {
    const now = getTashkentNow();
    const stats = attendanceMgr.getEmployeeMonthlyStats(employeeId, now.yearMonth);
    const dayRec = (attendanceMgr.state.days[now.dateStr] || {})[employeeId];
    const limitInfo = stats.excuseLimit;

    const todayIn = dayRec ? dayRec.arrTime : "—";
    const todayOut = dayRec ? dayRec.leaveTime : "—";
    const todayPen = dayRec ? (dayRec.penalty || 0) : 0;
    const isSick = stats.employee.onSickLeave || (dayRec && dayRec.isSickLeave);

    return (
      `💰 **МЕНИҢ ШТРАФЛАРЫМ ҲӘМ СЕБЕПЛИ ЛИМИТИМ**\n\n` +
      `👤 Фармацевт: **${stats.employee.name}** (${stats.employee.role})\n` +
      `🏥 Филиал: **${stats.workplace.shortName}**\n` +
      `📍 Мәнзил: *${stats.workplace.address}*\n` +
      `🩺 Жағдайы: **${isSick ? "🏥 Больничный (Басшы тәрепинен ашылған)" : "🟢 Жумыста (Актив)"}**\n\n` +
      `🕒 **Бүгин (${now.dateStr}):**\n` +
      `• Келди: \`${todayIn}\` | Кетти: \`${todayOut}\`\n` +
      `• Бүгинги штраф: **${formatSum(todayPen)} сум**\n\n` +
      `🎟️ **Айлық себепли кешигиў лимити (Айына ${limitInfo.limit} күн):**\n` +
      `• Пайдаланылды: **${limitInfo.usedDays} күн**\n` +
      `• Сизде қалған лимит: **${limitInfo.remainingDays} күн қалды**\n` +
      `*(3 күн лимит таўсылса, Басшы қабыллаўы да өтпейди!)*\n\n` +
      `📊 **Усы айдағы (${now.yearMonth}) жәми көрсеткишлер:**\n` +
      `• Жумысқа шыққан күнлер: **${stats.totalDaysWorked} күн**\n` +
      `• Өз ўақтында келген: **${stats.onTimeDaysCount} күн**\n` +
      `• Кешиккен күнлер: **${stats.lateDaysCount} күн** (${stats.totalLateMinutes} минут)\n` +
      `• 💸 **ЖӘМИ ШТРАФ (1 мин = 3 000 сум):** **${formatSum(stats.totalPenalty)} сум**`
    );
  }

  async function handleContactMessage(msg) {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);
    const contactCheck = validateContactMessage(msg);

    if (!contactCheck.valid) {
      let errText = "⚠️ Телефон номерди тек төмендеги **«📱 Өз телефон номеримди тастыйықлаў»** түймесин басып жибериң! Басқа адамның контактын переслать етиўге болмайды.";
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: errText,
        parse_mode: "Markdown",
        reply_markup: getPhoneRequestKeyboard()
      });
      return;
    }

    const tgUsername = (msg.from && (msg.from.username || msg.from.first_name)) || "";
    const bindRes = attendanceMgr.bindEmployeeWithPhone({
      employeeId: session ? session.selectedEmployeeId : null,
      workplaceId: session ? session.workplaceId : null,
      rawPhone: msg.contact.phone_number,
      telegramUserId: chatId,
      telegramUsername: tgUsername
    });

    if (!bindRes.ok) {
      if (
        bindRes.error === "TELEGRAM_ALREADY_BOUND_TO_OTHER" ||
        bindRes.error === "PHONE_ALREADY_BOUND_TO_OTHER" ||
        bindRes.error === "PHONE_BELONGS_TO_OTHER_EMPLOYEE" ||
        bindRes.error === "ALREADY_BOUND"
      ) {
        const otherName = bindRes.otherEmployee ? bindRes.otherEmployee.name : (bindRes.employee ? bindRes.employee.name : "басқа хызметкер");
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text:
            `🚫 **ҚАБЫЛ ЕТИЛМЕДИ! АЛДАЎҒА ҚАРСЫ ҚОРҒАЎ!**\n\n` +
            `Бул телефон номери ямаса Telegram аккаунт алдын **${otherName}** атына беккемленген!\n` +
            `⚠️ Бир телефоннан 2 Telegram аккаунт ашып ямаса бир адам 2 адам ушын басыўы қатаң қадаған!`,
          parse_mode: "Markdown",
          reply_markup: getEmployeeMainKeyboard()
        });

        await notifyAdmins(
          `🚨 **2 АККАУНТ ЯМАСА БӨТЕН ТЕЛЕФОННАН КИРИЎГЕ УРЫНЫЎ!**\n` +
          `📱 Телефон: \`${contactCheck.formattedPhone}\`\n` +
          `👤 Урынған аккаунт: ${tgUsername} (ID: \`${chatId}\`)\n` +
          `⚠️ Себеби: **${otherName}** профилине ямаса екинши аккаунтқа кириўге урынды (Блокланды!).`
        );
        userSessions.delete(chatId);
        return;
      }

      if (bindRes.error === "PHONE_MISMATCH") {
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text:
            `🚫 **ТЕЛЕФОН НОМЕР СӘЙКЕС КЕЛМЕДИ!**\n\n` +
            `👤 Таңланған хызметкер: **${bindRes.employee.name}**\n` +
            `📱 Сизиң жиберген номериңиз: \`${contactCheck.formattedPhone}\`\n\n` +
            `⚠️ Басшы дизимге киргизген өз телефон номериңизден кириң!`,
          parse_mode: "Markdown",
          reply_markup: getEmployeeMainKeyboard()
        });
        userSessions.delete(chatId);
        return;
      }

      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `⚠️ Телефон номериңиз бойынша хызметкер табылмады. Илтимас, алдын филиалыңызды ҳәм атыңызды таңлаң ямаса Басшыға мүрәжат етиң.`,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    const pendingAction = session ? session.pendingActionType : null;
    userSessions.delete(chatId);

    await tgRequest("sendMessage", {
      chat_id: chatId,
      text:
        `✅ **Жеке телефон номериңиз ҳәм профилиңиз тастыйықланды!**\n\n` +
        `👤 Фармацевт: **${bindRes.employee.name}** (${bindRes.employee.role})\n` +
        `🏥 Филиал: **${bindRes.workplace.shortName}**\n` +
        `📱 Телефон: \`${bindRes.employee.phone}\`\n` +
        `🔒 *Профиль тек усы телефон ҳәм Telegram аккаунтқа беккемленди.*`,
      parse_mode: "Markdown",
      reply_markup: getEmployeeMainKeyboard()
    });

    await notifyAdmins(
      `🔐 **ХЫЗМЕТКЕР ТЕЛЕФОН НОМЕРИН ТАСТЫЙЫҚЛАП КИРДИ:**\n` +
      `👤 Фармацевт: **${bindRes.employee.name}**\n` +
      `🏥 Филиал: **${bindRes.workplace.shortName}**\n` +
      `📱 Телефон: \`${bindRes.employee.phone}\``
    );

    if (pendingAction === "IN" || pendingAction === "OUT") {
      await startAttendanceFlow(chatId, { employee: bindRes.employee, workplace: bindRes.workplace }, pendingAction);
    }
  }

  async function startAttendanceFlow(chatId, profile, actionType) {
    // 1. Check if employee is on Sick Leave («🏥 Больничный»)
    const freshEmp = attendanceMgr.getEmployeeById(profile.employee.id) || profile.employee;
    if (freshEmp.onSickLeave) {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text:
          `🏥 **СИЗДЕ «БОЛЬНИЧНЫЙ» АШЫЛҒАН!**\n\n` +
          `👤 Фармацевт: **${freshEmp.name}**\n` +
          `🏛️ Филиал: **${profile.workplace.shortName}**\n\n` +
          `Басшы сизге аўырыў себепли **«🏥 Больничный»** ашып қойған. Сизден келип-кетиў локациясы соралмайды ҳәм штраф жазылмайды.\n` +
          `Тез саўалып кетиң! *(Бул статусты тек Басшы өзгерте алады)*`,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    // 2. If actionType === 'OUT', check if they are trying to close/leave early!
    if (actionType === "OUT") {
      const preview = attendanceMgr.checkEarlyDeparturePreview(chatId);
      if (preview.ok && preview.isEarlyLeave) {
        userSessions.set(chatId, {
          step: "CONFIRM_EARLY_LEAVE",
          shiftId: preview.shiftCfg.id,
          earlyLeaveMinutes: preview.earlyLeaveMinutes,
          potentialPenalty: preview.potentialPenalty
        });

        const hours = Math.floor(preview.earlyLeaveMinutes / 60);
        const mins = preview.earlyLeaveMinutes % 60;
        const timeDiffText = hours > 0 ? `${hours} саат ${mins} минут` : `${mins} минут`;

        await tgRequest("sendMessage", {
          chat_id: chatId,
          text:
            `⚠️ **ТОҚТАҢ! ХАЙ, СИЗ ЕЛЕ ЕРТЕ ЖАЎЫП АТЫРСЫЗ!**\n\n` +
            `🏥 Филиал: **${profile.workplace.shortName}**\n` +
            `🕒 Сизиң жумыс ўақтыңыз **${preview.shiftCfg.endTime}** де тамам болады (еле **${timeDiffText}** бар).\n` +
            `🚫 **Ўақтынан бурын жаўыўға рухсат жоқ!**\n` +
            `💸 Қараң, егер ҳәзир ерте жаўып кетсеңиз, ҳәр бир ерте кеткен минутыңызға **3 000 сумнан** (жәми **${formatSum(preview.potentialPenalty)} сум**) штрафқа түсип қаласыз!\n\n` +
            `Солай да ерте шығасыз ба?`,
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "🔙 Яқ, жумысты даўам етемен" }],
              [{ text: "⚠️ Аўа, ерте шығаман (Локация жибериў)" }]
            ],
            resize_keyboard: true
          }
        });
        return;
      }

      const shiftId = preview.ok && preview.shiftCfg ? preview.shiftCfg.id : "SHIFT_1";
      await promptLocationStep(chatId, profile, "OUT", shiftId);
      return;
    }

    // 3. If actionType === 'IN':
    // Branches 1, 3, 4 have 2 shifts (08:00-16:00 and 16:30-00:00). Branch 2 (Bazaar) has 1 shift (08:00-19:00).
    if (profile.workplace.hasTwoShifts) {
      userSessions.set(chatId, {
        step: "SELECT_SHIFT_FOR_IN"
      });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text:
          `🕒 **СМЕНАНЫ ТАҢЛАҢ — ${profile.workplace.shortName}:**\n\n` +
          `Қайсы сменаға жумысқа келдиңиз?\n` +
          `• **☀️ 1-смена:** 08:00 ден 16:00 ге шекем\n` +
          `• **🌙 2-смена:** 16:30 дан 00:00 ге шекем`,
        parse_mode: "Markdown",
        reply_markup: getShiftSelectionKeyboard()
      });
      return;
    }

    await promptLocationStep(chatId, profile, "IN", "SHIFT_1");
  }

  async function handleLocationMessage(msg) {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);
    const profile = attendanceMgr.getEmployeeByTelegramId(chatId);

    if (!profile) {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Алдын **«🔵 Келдим»** түймесин басып, филиал, атыңыз ҳәм телефон номериңизди тастыйықлаң.",
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    const actionType = (session && session.actionType) ? session.actionType : "IN";
    const shiftId = (session && session.shiftId) ? session.shiftId : "SHIFT_1";
    const actionLabel = actionType === "OUT" ? "🔴 Кеттим" : "🔵 Келдим";

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
        `👤 Фармацевт: **${profile.employee.name}**\n` +
        `🏥 Филиал: ${profile.workplace.shortName}\n` +
        `🔘 Түйме: ${actionLabel}\n` +
        `⚠️ Себеби: ${reasonText}`
      );
      return;
    }

    const { latitude, longitude } = msg.location;
    const res = attendanceMgr.recordAction({
      telegramUserId: chatId,
      actionType,
      shiftId,
      lat: latitude,
      lng: longitude,
      isLive: validation.isLive
    });

    userSessions.delete(chatId);

    if (!res.ok && res.error === "ON_SICK_LEAVE") {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `🏥 Сизде ҳәзир **«Больничный»** ашылған. Келип-кетиў белгилеў талап етилмейди.`,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    if (!res.ok && res.error === "TOO_FAR") {
      const rejectText =
        `🚫 **ҚАБЫЛ ЕТИЛМЕДИ! СИЗ ФИЛИАЛДАН УЗАҚТАСЫЗ!**\n\n` +
        `👤 Фармацевт: **${res.employee.name}**\n` +
        `🏥 Филиал: **${res.workplace.shortName}**\n` +
        `📍 Мәнзил: *${res.workplace.address}*\n` +
        `📏 Сиз турған аралық: **${res.distanceMeters} метр**\n` +
        `🎯 Рухсат етилген радиус: **максимум ${res.maxAllowed} метр!**\n\n` +
        `⚠️ *Филиалға жақынласып (${res.maxAllowed} м ишинде), қайтадан «${actionLabel}» түймесин басың!*`;

      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: rejectText,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });

      await notifyAdmins(
        `⚠️ **УЗАҚТАН БАСЫЎ (> ${res.maxAllowed} м):**\n` +
        `👤 Фармацевт: **${res.employee.name}**\n` +
        `🏥 Филиал: **${res.workplace.shortName}**\n` +
        `🔘 Ҳәрекет: ${actionLabel}\n` +
        `📏 Аралық: **${res.distanceMeters} метр** (Шек: ${res.maxAllowed} м)\n` +
        `❌ **Статус:** Қабыл етилмеди!`
      );
      return;
    }

    if (res.ok) {
      const mStats = res.monthlyStats;
      const limitInfo = res.excuseLimit;

      if (actionType !== "OUT") {
        // ARRIVAL (🟢 Келдим)
        if (!res.record.isLate) {
          // Arrived ON TIME or EARLY -> Send motivational 2-line SMS!
          const okMsg =
            `✅ **ЖУМЫСҚА КЕЛГЕНИҢИЗ ДИЗИМГЕ АЛЫНДЫ!**\n\n` +
            `👤 Фармацевт: **${res.employee.name}**\n` +
            `🏥 Филиал: **${res.workplace.shortName}**\n` +
            `🕒 Смена: **${res.record.shiftLabel}**\n` +
            `🕒 Келген ўақты: **${res.timeStr}** (${res.dateStr})\n` +
            `📏 GPS аралық: **${res.distanceMeters} м** (≤ 50 м ✅)\n` +
            `✨ Статус: **Өз ўақтында (ерте) келдиңиз! (Штраф: 0 сум)**\n` +
            `🎟️ Себепли лимитиңиз: **${limitInfo.remainingDays} / ${limitInfo.limit} күн қалды**\n\n` +
            `💌 **Мотивациялық тилек:**\n${res.motivationalSms}`;

          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: okMsg,
            parse_mode: "Markdown",
            reply_markup: getEmployeeMainKeyboard()
          });

          await notifyAdmins(
            `🟢 **ЖУМЫСҚА ӨЗ ЎАҚТЫНДА КЕЛДИ:**\n` +
            `👤 Фармацевт: **${res.employee.name}**\n` +
            `🏥 Филиал: **${res.workplace.shortName}**\n` +
            `🕒 Смена: **${res.record.shiftLabel}**\n` +
            `🕒 Келген ўақты: **${res.timeStr}** (Өз ўақтында ✅)\n` +
            `📏 GPS: **${res.distanceMeters} м**`
          );
        } else {
          // Arrived LATE -> 3 000 sum per minute + 2-question Excused Lateness flow!
          const lateMins = res.record.lateMinutes;
          const latePen = res.record.latePenalty;

          let lateMsg =
            `⏰ **ЖУМЫСҚА КЕШИГИП КЕЛДИҢИЗ!**\n\n` +
            `👤 Фармацевт: **${res.employee.name}**\n` +
            `🏥 Филиал: **${res.workplace.shortName}**\n` +
            `🕒 Смена: **${res.record.shiftLabel}**\n` +
            `🕒 Келген ўақты: **${res.timeStr}** (${lateMins} минут кешиктиңиз)\n` +
            `💸 Есапланған штраф (1 мин = 3 000 сум): **${formatSum(latePen)} сум**\n` +
            `🎟️ Айлық себепли кешигиў лимитиңиз: **${limitInfo.remainingDays} / ${limitInfo.limit} күн қалды**\n\n`;

          if (limitInfo.canUseExcuse) {
            userSessions.set(chatId, {
              step: "LATE_QUESTION_1",
              dateStr: res.dateStr,
              lateMinutes: lateMins,
              penalty: latePen
            });

            lateMsg +=
              `❓ **1-сораў: Неге кешиктиңиз? Кешигиўиңиз себепли ме?**\n` +
              `*(Егер себепли болса, себебин жазасыз ҳәм Басшы қабылласа штраф жазылмайды)*`;

            await tgRequest("sendMessage", {
              chat_id: chatId,
              text: lateMsg,
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "📝 Себепли (Себебин Басшыға жазыў)" }],
                  [{ text: "❌ Себепсиз (Штрафты қабыллаў)" }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
              }
            });
          } else {
            lateMsg +=
              `⚠️ **ЛИМИТ ТАЎСЫЛҒАН:** Сизиң усы айдағы **3 күнлик себепли кешигиў лимитиңиз таўсылған (0 / 3 күн қалды)**!\n` +
              `Енди Басшының қабыллаўы да өтпейди, **${formatSum(latePen)} сум** штраф жазылды.`;

            await tgRequest("sendMessage", {
              chat_id: chatId,
              text: lateMsg,
              parse_mode: "Markdown",
              reply_markup: getEmployeeMainKeyboard()
            });
          }

          await notifyAdmins(
            `⏰ **ЖУМЫСҚА КЕШИГИП КЕЛДИ:**\n` +
            `👤 Фармацевт: **${res.employee.name}**\n` +
            `🏥 Филиал: **${res.workplace.shortName}**\n` +
            `🕒 Смена: **${res.record.shiftLabel}**\n` +
            `🕒 Келди: **${res.timeStr}** (**${lateMins} мин** кешикти)\n` +
            `💸 Штраф: **${formatSum(latePen)} сум**\n` +
            `🎟️ Қалған себепли лимити: **${limitInfo.remainingDays} / ${limitInfo.limit} күн**`
          );
        }
      } else {
        // DEPARTURE (🔴 Кеттим)
        if (!res.record.isEarlyLeave) {
          // Left ON TIME -> Send motivational 2-line SMS!
          const okOutMsg =
            `🔴 **ЖУМЫСТАН ШЫҚҚАНЫҢЫЗ ДИЗИМГЕ АЛЫНДЫ!**\n\n` +
            `👤 Фармацевт: **${res.employee.name}**\n` +
            `🏥 Филиал: **${res.workplace.shortName}**\n` +
            `🕒 Келген ўақты: **${res.record.arrTime}** → Кеткен ўақты: **${res.timeStr}**\n` +
            `📏 GPS аралық: **${res.distanceMeters} м** (≤ 50 м ✅)\n` +
            `✨ Статус: **Жумыс ўақтын толық жуўмақладыңыз!**\n\n` +
            `💌 **Мотивациялық тилек:**\n${res.motivationalSms}`;

          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: okOutMsg,
            parse_mode: "Markdown",
            reply_markup: getEmployeeMainKeyboard()
          });

          await notifyAdmins(
            `🔴 **ЖУМЫСТАН ӨЗ ЎАҚТЫНДА ШЫҚТЫ:**\n` +
            `👤 Фармацевт: **${res.employee.name}**\n` +
            `🏥 Филиал: **${res.workplace.shortName}**\n` +
            `🕒 Келген еди: **${res.record.arrTime}** → Кетти: **${res.timeStr}**\n` +
            `📏 GPS: **${res.distanceMeters} м**`
          );
        } else {
          // Left EARLY -> penalty 3,000 sum per minute
          const earlyMins = res.record.earlyLeaveMinutes;
          const earlyPen = res.record.earlyLeavePenalty;

          const earlyOutMsg =
            `⚠️ **ЕРТЕ ЖАЎЫП ШЫҚҚАНЫҢЫЗ ДИЗИМГЕ АЛЫНДЫ!**\n\n` +
            `👤 Фармацевт: **${res.employee.name}**\n` +
            `🏥 Филиал: **${res.workplace.shortName}**\n` +
            `🕒 Келген ўақты: **${res.record.arrTime}** → Кеткен ўақты: **${res.timeStr}**\n` +
            `⏰ Смена жуўмағынан **${earlyMins} минут бурын** шықтыңыз!\n` +
            `💸 Ерте жаўыў штрафы (1 мин = 3 000 сум): **${formatSum(earlyPen)} сум**\n` +
            `💰 Айлық жәми штрафыңыз: **${formatSum(mStats.totalPenalty)} сум**`;

          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: earlyOutMsg,
            parse_mode: "Markdown",
            reply_markup: getEmployeeMainKeyboard()
          });

          await notifyAdmins(
            `🚨 **ФИЛИАЛДЫ ЕРТЕ ЖАЎЫП КЕТТИ!**\n` +
            `👤 Фармацевт: **${res.employee.name}**\n` +
            `🏥 Филиал: **${res.workplace.shortName}**\n` +
            `🕒 Келген еди: **${res.record.arrTime}** → Ерте кетти: **${res.timeStr}**\n` +
            `⚠️ Ерте кеткен ўақты: **${earlyMins} минут бурын**\n` +
            `💸 Есапланған штраф: **${formatSum(earlyPen)} сум**`
          );
        }
      }
    }
  }

  async function handleUserMessage(msg) {
    if (!msg || !msg.chat) return;
    const chatId = msg.chat.id;

    const handledByGroupBot = await groupBotHandler.handleGroupMessage(msg);
    if (handledByGroupBot) {
      return;
    }

    if (msg.contact) {
      await handleContactMessage(msg);
      return;
    }

    if (msg.location) {
      await handleLocationMessage(msg);
      return;
    }

    const text = (msg.text || "").trim();
    let session = userSessions.get(chatId);

    // /start or Бас меню
    if (text === "/start" || text === "Бас меню" || text === "❌ Бийкар етиў" || text === "🔙 Яқ, жумысты даўам етемен") {
      userSessions.delete(chatId);
      const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
      const limitInfo = profile
        ? attendanceMgr.getExcuseLimitStatus(profile.employee.id)
        : null;

      const profileBadge = profile
        ? `👤 **Фармацевт:** ${profile.employee.name} (${profile.workplace.shortName})\n` +
          `📱 **Телефон:** \`${profile.employee.phone || "Тастыйықланған"}\`\n` +
          `🩺 **Статус:** ${profile.employee.onSickLeave ? "🏥 Больничный" : "🟢 Жумыста"}\n` +
          `🎟️ **Себепли лимит:** айына 3 күн (Қалды: **${limitInfo.remainingDays} күн**)`
        : `ℹ️ *Жумысқа келгенде «🔵 Келдим» түймесин басып, филиалыңызды ҳәм жеке телефон номериңизди тастыйықлаң.*`;

      const welcome =
        `🏥 **«PINTOK APTEKA» — ФАРМАЦЕВТЛЕР КОНТРОЛЬ БОТЫ** 🕒\n\n` +
        `${profileBadge}\n\n` +
        `📌 **Жумыс ўақты ҳәм қағыйдалар:**\n` +
        `• **1, 3, 4-Филиаллар (2 смена):** 1-смена \`08:00–16:00\`, 2-смена \`16:30–00:00\`\n` +
        `• **2-Филиал (Базар ишинде):** \`08:00–19:00\`\n` +
        `• **GPS радиус:** филиалдан **50 метр** ишинде\n` +
        `• **Штраф:** кешиккен ямаса ерте жаўған ҳәр **1 минутқа 3 000 сум**\n` +
        `• **Себепли кешигиў лимити:** айына **3 күн** (Басшы тастыйықлаўы менен)\n\n` +
        `👇 *Төмендеги түймелерден пайдаланың:*`;

      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: welcome,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    // Handle active multi-step sessions first
    if (session) {
      // Confirm early leave warning
      if (session.step === "CONFIRM_EARLY_LEAVE") {
        if (text.includes("Аўа, ерте шығаман")) {
          const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
          if (profile) {
            await promptLocationStep(chatId, profile, "OUT", session.shiftId || "SHIFT_1");
          }
          return;
        }
      }

      // Select shift for 2-shift branches (Branches 1, 3, 4)
      if (session.step === "SELECT_SHIFT_FOR_IN") {
        const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
        if (profile) {
          let shiftId = "SHIFT_1";
          if (text.includes("2-смена") || text.includes("16:30")) {
            shiftId = "SHIFT_2";
          }
          await promptLocationStep(chatId, profile, "IN", shiftId);
          return;
        }
      }

      // 2-question Excused Lateness flow: Question 1 (Себепли ме?)
      if (session.step === "LATE_QUESTION_1") {
        const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
        if (text.includes("Себепли")) {
          session.step = "LATE_QUESTION_2_REASON";
          userSessions.set(chatId, session);
          const limitInfo = profile ? attendanceMgr.getExcuseLimitStatus(profile.employee.id) : { remainingDays: 3, limit: 3 };
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text:
              `✍️ **2-сораў: Не себептен кешиккениңизди анық ҳәм толық жазып жибериң:**\n\n` +
              `🎟️ *Ескертиў: Сизиң усы айдағы себепли лимитиңиз: **${limitInfo.remainingDays} / ${limitInfo.limit} күн қалды**. Жазған себебиңиз туўры Басшы ботына қабыллаў ушын жибериледи.*`,
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [[{ text: "❌ Себепсиз (Штрафты қабыллаў)" }]],
              resize_keyboard: true
            }
          });
          return;
        }
        if (text.includes("Себепсиз")) {
          userSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `📌 Кешигиў штрафы (**${formatSum(session.penalty)} сум**) сақланып қалды. Ендигиде жумысқа өз ўақтында келиўге ҳәрекет етиң!`,
            parse_mode: "Markdown",
            reply_markup: getEmployeeMainKeyboard()
          });
          return;
        }
      }

      // Question 2: Employee types the excuse reason
      if (session.step === "LATE_QUESTION_2_REASON") {
        if (text.includes("Себепсиз")) {
          userSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `📌 Кешигиў штрафы сақланып қалды.`,
            parse_mode: "Markdown",
            reply_markup: getEmployeeMainKeyboard()
          });
          return;
        }

        const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
        userSessions.delete(chatId);
        if (!profile) return;

        const reqRes = attendanceMgr.createExcuseRequest({
          employeeId: profile.employee.id,
          dateStr: session.dateStr,
          reasonText: text
        });

        if (!reqRes.ok && reqRes.error === "EXCUSE_LIMIT_EXCEEDED") {
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text:
              `🚫 **СЕБЕПЛИ ЛИМИТИҢИЗ ТАЎСЫЛҒАН (0 / 3 күн қалды)!**\n\n` +
              `Айына тек 3 күн себепли кешигиўге рухсат бериледи. Одан аржағына Басшының қабыллаўы да өтпейди.`,
            parse_mode: "Markdown",
            reply_markup: getEmployeeMainKeyboard()
          });
          return;
        }

        if (reqRes.ok) {
          const req = reqRes.request;
          const lim = reqRes.limitInfo;

          await tgRequest("sendMessage", {
            chat_id: chatId,
            text:
              `📨 **Себебиңиз Басшыға жиберилди!**\n\n` +
              `📝 Жазған себебиңиз: *"${req.reasonText}"*\n` +
              `🎟️ Егер Басшы қабылласа, бүгинги **${formatSum(req.penalty)} сум** штрафыңыз **0 сум** болады.\n` +
              `ℹ️ Ҳәзирги себепли лимитиңиз: **${lim.remainingDays} / ${lim.limit} күн қалды**.`,
            parse_mode: "Markdown",
            reply_markup: getEmployeeMainKeyboard()
          });

          await notifyAdmins(
            `📩 **СЕБЕПЛИ КЕШИГИЎ БОЙЫНША СОРАЎ КЕЛДИ:**\n\n` +
            `👤 Фармацевт: **${profile.employee.name}** (${profile.employee.role})\n` +
            `🏥 Филиал: **${profile.workplace.shortName}**\n` +
            `📅 Сәне: **${req.dateStr}**\n` +
            `⏰ Кешиккен ўақты: **${req.lateMinutes} минут** (Штраф: **${formatSum(req.penalty)} сум**)\n` +
            `🎟️ Қалған айлық лимити: **${lim.remainingDays} / ${lim.limit} күн**\n` +
            `💬 **Жазған себеби:** *"${req.reasonText}"*\n\n` +
            `Қабыллайсыз ба? (Қабылласаңыз штраф жазылмайды):`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Қабыллаў (Штраф 0 сум)", callback_data: `excuse_approve:${req.id}` },
                    { text: "❌ Қабылламаў (Штраф қалсын)", callback_data: `excuse_reject:${req.id}` }
                  ]
                ]
              }
            }
          );
          return;
        }
      }

      // Registration Step 1: Select Workplace
      if (session.step === "SELECT_WORKPLACE") {
        const workplaces = attendanceMgr.getWorkplaces();
        const selectedWp = workplaces.find(
          w => w.name === text || w.shortName === text || text.includes(`${w.branchNumber}-Филиал`) || text.includes(`Филиал №${w.branchNumber}`)
        );
        if (selectedWp) {
          const staff = attendanceMgr.getEmployees(selectedWp.id);
          session.step = "SELECT_EMPLOYEE";
          session.workplaceId = selectedWp.id;
          userSessions.set(chatId, session);

          await tgRequest("sendMessage", {
            chat_id: chatId,
            text:
              `🏥 Филиал: **${selectedWp.shortName}**\n` +
              `📍 Мәнзил: *${selectedWp.address}*\n` +
              `🕒 Жумыс ўақты: *${selectedWp.workHoursText}*\n\n` +
              `👇 **Дизимнен өз атыңызды таңлаң:**`,
            parse_mode: "Markdown",
            reply_markup: getEmployeesKeyboard(staff)
          });
          return;
        }
      }

      // Registration Step 2: Select Employee -> Ask for Phone Contact (or bind if in test mode)
      if (session.step === "SELECT_EMPLOYEE") {
        const staff = attendanceMgr.getEmployees(session.workplaceId);
        const selectedEmp = staff.find(
          e => text === `👤 ${e.name} (${e.role})` || text === e.name || text.includes(e.name)
        );
        if (selectedEmp) {
          session.step = "VERIFY_PHONE_CONTACT";
          session.selectedEmployeeId = selectedEmp.id;
          userSessions.set(chatId, session);

          await tgRequest("sendMessage", {
            chat_id: chatId,
            text:
              `👤 Таңланды: **${selectedEmp.name}** (${selectedEmp.role})\n\n` +
              `📱 **Енди өзиңиздиң жеке телефон номериңизди тастыйықлаў ушын төмендеги «📱 Өз телефон номеримди тастыйықлаў» түймесин басың!**\n\n` +
              `⚠️ *Қатаң қағыйда: Ҳәр ким өзиниң телефон номеринен кириўи шәрт. Бир телефоннан 2 Telegram аккаунт қосып басыўға жол қойылмайды!*`,
            parse_mode: "Markdown",
            reply_markup: getPhoneRequestKeyboard()
          });
          return;
        }
      }
    }

    // Main Menu Buttons:
    // 1. «🟢 Келдим» / «🔵 Келдим» or «🔴 Кеттим»
    if (
      text === "🟢 Келдим" ||
      text === "🔵 Келдим" ||
      text === "Келдим" ||
      text === "🔴 Кеттим" ||
      text === "Кеттим"
    ) {
      const actionType = (text === "🔴 Кеттим" || text === "Кеттим") ? "OUT" : "IN";
      const profile = attendanceMgr.getEmployeeByTelegramId(chatId);

      if (!profile) {
        userSessions.set(chatId, {
          step: "SELECT_WORKPLACE",
          pendingActionType: actionType
        });
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `👋 **Биринши мәрте кириў:**\n\nСиз қайсы филиалда ислейсиз? Таңлаң:`,
          parse_mode: "Markdown",
          reply_markup: getWorkplaceKeyboard()
        });
        return;
      }

      await startAttendanceFlow(chatId, profile, actionType);
      return;
    }

    // 2. «📅 Календарь» (or legacy «📅 Мениң айлық табелим»)
    if (text === "📅 Календарь" || text === "📅 Мениң айлық табелим") {
      const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
      if (!profile) {
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `⚠️ Алдын **«🔵 Келдим»** түймесин басып, филиал ҳәм телефон номериңизди тастыйықлаң.`,
          parse_mode: "Markdown",
          reply_markup: getEmployeeMainKeyboard()
        });
        return;
      }
      const calText = attendanceMgr.formatEmployeeCalendar(profile.employee.id);
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: calText,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    // 3. «💰 Штрафым ҳәм Лимитим» (or legacy «💰 Штрафым ҳәм 1 млн бонус»)
    if (text === "💰 Штрафым ҳәм Лимитим" || text === "💰 Штрафым ҳәм 1 млн бонус") {
      const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
      if (!profile) {
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `⚠️ Алдын **«🔵 Келдим»** түймесин басып, филиал ҳәм телефон номериңизди тастыйықлаң.`,
          parse_mode: "Markdown",
          reply_markup: getEmployeeMainKeyboard()
        });
        return;
      }
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: formatEmployeeBonusAndPenaltyCard(profile.employee.id),
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    // 4. «👤 Мениң профилим»
    if (text === "👤 Мениң профилим") {
      const profile = attendanceMgr.getEmployeeByTelegramId(chatId);
      if (!profile) {
        userSessions.set(chatId, {
          step: "SELECT_WORKPLACE",
          pendingActionType: null
        });
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `👋 Сиз еле дизимнен өтпегенсиз. Сиз қайсы филиалда ислейсиз? Таңлаң:`,
          parse_mode: "Markdown",
          reply_markup: getWorkplaceKeyboard()
        });
        return;
      }

      const freshEmp = attendanceMgr.getEmployeeById(profile.employee.id) || profile.employee;
      const limitInfo = attendanceMgr.getExcuseLimitStatus(freshEmp.id);

      await tgRequest("sendMessage", {
        chat_id: chatId,
        text:
          `👤 **МЕНИҢ ПРОФИЛИМ:**\n\n` +
          `• Аты-жөни: **${freshEmp.name}**\n` +
          `• Лаўазымы: **${freshEmp.role}**\n` +
          `• Филиал: **${profile.workplace.shortName}**\n` +
          `• Мәнзил: *${profile.workplace.address}*\n` +
          `• Жумыс ўақты: *${profile.workplace.workHoursText}*\n` +
          `• Телефон номери: \`${freshEmp.phone || profile.bindInfo.phone || "Беккемленген"}\`\n` +
          `• Больничный статусы: **${freshEmp.onSickLeave ? "🏥 Больничный (Ашық)" : "🟢 Жумыста (Актив)"}**\n` +
          `• Айлық себепли лимит: **${limitInfo.remainingDays} / ${limitInfo.limit} күн қалды**\n\n` +
          `🔒 *Қәўипсизлик қағыйдасы: Профиль, Больничный ҳәм телефон номери тек Басшы тәрепинен басқарылады (сиз өзгерте алмайсыз).*`,
        parse_mode: "Markdown",
        reply_markup: getEmployeeMainKeyboard()
      });
      return;
    }

    // Default fallback
    await tgRequest("sendMessage", {
      chat_id: chatId,
      text: `🤖 **«PINTOK APTEKA» Фармацевтлер боты**\n\n• Жумысқа келгенде: **«🔵 Келдим»**\n• Жумыс ўақты тамам болғанда: **«🔴 Кеттим»**\n• Кешиккен күнлер ҳәм лимитти көриў ушын: **«📅 Календарь»** түймесин басың.`,
      parse_mode: "Markdown",
      reply_markup: getEmployeeMainKeyboard()
    });
  }

  return {
    handleUserMessage,
    handleContactMessage,
    handleLocationMessage,
    formatEmployeeBonusAndPenaltyCard,
    groupBotHandler
  };
}

let lastUpdateId = 0;
async function pollUpdates() {
  const { handleUserMessage, groupBotHandler } = createBotHandler();

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
        timeout: 15
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

module.exports = {
  createBotHandler,
  pollUpdates,
  getEmployeeMainKeyboard,
  getLocationRequestKeyboard
};

if (require.main === module) {
  console.log("PINTOK APTEKA Employee Bot (@apteka_kontroll_bot) is starting polling...");
  pollUpdates();
}
