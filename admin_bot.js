// PINTOK APTEKA — БАСШЫ (АДМИН / БАСҚАРЫЎШЫ) БОТЫ
// Бул бот тек ғана Басшы ушын арналған!
// Басшы мүмкиншиликлери:
// 1. Барлық 4 филиал ҳәм 📦 Складтың бүгинги келип-кетиў табелин реал ўақытта көриў
// 2. Айлық жыйналған штрафлар ҳәм 1 000 000 сум бонус алыўшылар дизимин көриў
// 3. ➕ Жаңа хызметкер қосыў (қәлеген филиалға ямаса складқа)
// 4. ➖ Хызметкерди өшириў
// 5. ⚖️ Штрафты өзгертиў / кешириў (бүгинги штрафы ямаса айлық штраflарын 0 сум етиў, 1 млн бонусты тиклеў)
// 6. ⚙️ Қағыйдаларды өзгертиў (штраф суммасы, 1 млн бонус суммасы, жумыс ўақты 08:00, GPS радиус 5 м)
// 7. 🔄 Телефон байланысын босатыў

const fs = require('fs');
const path = require('path');
const {
  WORKPLACES,
  MAX_DISTANCE_METERS,
  MONTHLY_BONUS_SUM,
  PENALTY_PER_5_MIN,
  getTashkentNow,
  AttendanceManager
} = require('./attendance');
const { createGroupBotHandler } = require('./group_bot');
const { tgApiRequest } = require('./tg_http');

const DATA_DIR = path.join(__dirname, 'bot-data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const CONFIG_FILE = path.join(DATA_DIR, 'bot-config.json');

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

async function defaultAdminTgRequest(method, data = {}) {
  const token = getAdminBotToken();
  if (!token) {
    console.error("ADMIN_BOT_TOKEN is not set in bot-data/bot-config.json or environment.");
    return null;
  }
  return tgApiRequest(token, method, data, 'Admin Bot');
}

function getAdminMainKeyboard() {
  return {
    keyboard: [
      [{ text: "📊 Бүгинги табель (5 объект)" }, { text: "💰 Айлық штраф ҳәм 1 млн бонус" }],
      [{ text: "⚖️ Штрафты өзгертиў / Кешириў" }, { text: "📍 Филиал локациясын өзгертиў" }],
      [{ text: "➕ Хызметкер қосыў" }, { text: "➖ Хызметкерди өшириў" }],
      [{ text: "⚙️ Қағыйдаларды өзгертиў" }, { text: "🔄 Телефон байланысын босатыў" }],
      [{ text: "📋 Соңғы 20 GPS лог" }]
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
      [{ text: "⬅️ Бас меню" }]
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
  rows.push([{ text: "⬅️ Бас меню" }]);
  return {
    keyboard: rows,
    resize_keyboard: true
  };
}

function createAdminBotHandler({
  tgRequest = defaultAdminTgRequest,
  attendanceMgr = new AttendanceManager(ATTENDANCE_FILE),
  groupBot = null
} = {}) {
  const adminSessions = new Map();
  const groupBotHandler = groupBot || createGroupBotHandler({
    tgRequest,
    stateFile: path.join(DATA_DIR, 'admin-group-bot-state.json')
  });

  function formatDailyReport() {
    const now = getTashkentNow();
    const settings = attendanceMgr.getSettings();
    const summary = attendanceMgr.getDailySummary(now.dateStr);
    const allEmps = attendanceMgr.getEmployees();

    let report = `📊 **PINTOK APTEKA — БҮГИНГИ ТАБЕЛЬ (${now.dateStr}, ${now.timeStr})**\n`;
    report += `🎯 *Регламент: ${settings.startTime} | Радиус: ≤ ${settings.maxDistanceMeters} м | Штраф: ${settings.penaltyPer5Min.toLocaleString("ru-RU")} сум / 5 мин*\n\n`;

    let totalPresent = 0;
    let totalTodayPenalties = 0;

    summary.forEach(group => {
      report += `🏛️ **${group.workplace.shortName}**\n`;
      group.staff.forEach(s => {
        if (s.arrTime !== '—') totalPresent++;
        totalTodayPenalties += s.penalty || 0;
        const distInfo = s.inDistance !== null ? ` (${s.inDistance}м)` : '';
        const penInfo = s.penalty > 0 ? ` | ⚠️ Бүгин: ${s.penalty.toLocaleString("ru-RU")} сум` : '';
        report += `  • **${s.name}** (${s.role}): ${s.status} | Келди: \`${s.arrTime}\`${distInfo} | Кетти: \`${s.leaveTime}\`${penInfo}\n`;
      });
      report += `\n`;
    });

    report += `👥 **Жумысқа келгенлер:** ${totalPresent} / ${allEmps.length} хызметкер\n`;
    report += `💸 **Бүгинги жәми штрафлар:** ${totalTodayPenalties.toLocaleString("ru-RU")} сум`;
    return report;
  }

  function formatMonthlyReport() {
    const now = getTashkentNow();
    const settings = attendanceMgr.getSettings();
    const summary = attendanceMgr.getDailySummary(now.dateStr);
    const bonusStr = (settings.monthlyBonusSum || MONTHLY_BONUS_SUM).toLocaleString("ru-RU");

    let report = `💰 **АЙЛЫҚ ШТРАФЛАР ҲӘМ 1 000 000 СУМ БОНУС ЕСАБАТЫ (${now.yearMonth})**\n\n`;
    let totalMonthPenalties = 0;
    let totalBonusWinners = 0;

    summary.forEach(group => {
      report += `🏛️ **${group.workplace.shortName}**\n`;
      group.staff.forEach(s => {
        totalMonthPenalties += s.monthlyPenalty || 0;
        if (s.bonusEligible) totalBonusWinners++;
        const bonusTag = s.bonusEligible
          ? `🏆 **Бонус: +${bonusStr} сум** (Кешикпеген ✅)`
          : `❌ Бонус жоқ (${s.monthlyLateDays} күн кешиккен)`;
        report += `  • **${s.name}** (${s.role}): Жыйналған штраф: **${(s.monthlyPenalty || 0).toLocaleString("ru-RU")} сум** | ${bonusTag}\n`;
      });
      report += `\n`;
    });

    report += `💸 **Ай бойынша жәми штрафлар:** ${totalMonthPenalties.toLocaleString("ru-RU")} сум\n`;
    report += `🏆 **1 млн сум бонусқа ылайық хызметкерлер:** ${totalBonusWinners} адам`;
    return report;
  }

  async function handleAdminMessage(msg) {
    if (!msg || !msg.chat) return;
    const chatId = msg.chat.id;
    const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";

    // Егер бот группаға қосылған болса ямаса тест командалары терилсе — Группа Авто-ответчик ислейди
    const handledByGroupBot = await groupBotHandler.handleGroupMessage(msg);
    if (handledByGroupBot || isGroup) {
      return;
    }

    const text = (msg.text || "").trim();

    // Register this private chat as an admin chat for real-time notifications
    attendanceMgr.addAdminChat(chatId);

    if (text === "/start" || text === "⬅️ Бас меню" || text === "Бас меню") {
      adminSessions.delete(chatId);
      const settings = attendanceMgr.getSettings();
      const welcome =
        `👑 **«PINTOK APTEKA» — БАСШЫ (БАСҚАРЫЎШЫ) БОТЫ**\n\n` +
        `🔔 Барлық 4 филиал ҳәм 📦 Складтағы хызметкерлердиң келип-кетиўи усы ботқа туўрыдан-туўры хабар болып келеди.\n\n` +
        `⚙️ **Ҳәзирги қағыйдалар:**\n` +
        `• Жумыс басланыў ўақты: **${settings.startTime}**\n` +
        `• Ҳәр 5 минут кешигиў штрафы: **${settings.penaltyPer5Min.toLocaleString("ru-RU")} сум**\n` +
        `• 1 ай кешикпегенге бонус: **${settings.monthlyBonusSum.toLocaleString("ru-RU")} сум**\n` +
        `• GPS тексериў радиусы: **≤ ${settings.maxDistanceMeters} метр**\n\n` +
        `👇 *Басқарыў ушын керекли бөлимди таңлаң:*`;

      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: welcome,
        parse_mode: "Markdown",
        reply_markup: getAdminMainKeyboard()
      });
      return;
    }

    // 1. Бүгинги табель
    if (text === "📊 Бүгинги табель (5 объект)") {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: formatDailyReport(),
        parse_mode: "Markdown",
        reply_markup: getAdminMainKeyboard()
      });
      return;
    }

    // 2. Айлық штраф ҳәм 1 млн бонус
    if (text === "💰 Айлық штраф ҳәм 1 млн бонус") {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: formatMonthlyReport(),
        parse_mode: "Markdown",
        reply_markup: getAdminMainKeyboard()
      });
      return;
    }

    // 3. Соңғы 20 GPS лог
    if (text === "📋 Соңғы 20 GPS лог") {
      attendanceMgr.refresh();
      const logs = attendanceMgr.state.logs.slice(0, 20);
      let logText = `📋 **СОҢҒЫ 20 GPS ТЕКСЕРИЎ ЛОГЫ:**\n\n`;
      if (logs.length === 0) {
        logText += `Ҳәзирше логлар жоқ.`;
      } else {
        logs.forEach((l, i) => {
          const icon = l.status === 'ACCEPTED' ? (l.actionType === 'IN' ? '🟢' : '🔴') : '🚫';
          logText += `${i + 1}. ${icon} **${l.name}** (${l.workplaceName}) — ${l.actionType === 'IN' ? 'Келдим' : 'Кеттим'} | Аралық: **${l.distanceMeters} м** | ${l.timestamp}\n`;
        });
      }
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: logText,
        parse_mode: "Markdown",
        reply_markup: getAdminMainKeyboard()
      });
      return;
    }

    // 4. ➕ Хызметкер қосыў
    if (text === "➕ Хызметкер қосыў") {
      adminSessions.set(chatId, { step: "ADD_EMP_WORKPLACE" });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `➕ **ЖАҢА ХЫЗМЕТКЕР ҚОСЫЎ**\n\nҚайсы филиал ямаса складқа хызметкер қосасыз? Таңлаң:`,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    // 5. ➖ Хызметкерди өшириў
    if (text === "➖ Хызметкерди өшириў") {
      adminSessions.set(chatId, { step: "REMOVE_EMP_WORKPLACE" });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `➖ **ХЫЗМЕТКЕРДИ ӨШИРИЎ**\n\nҚайсы филиал ямаса складтан өширесиз? Таңлаң:`,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    // 6. ⚖️ Штрафты өзгертиў / Кешириў
    if (text === "⚖️ Штрафты өзгертиў / Кешириў") {
      adminSessions.set(chatId, { step: "PENALTY_WORKPLACE" });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `⚖️ **ШТРАФТЫ ӨЗГЕРТИЎ ЯМАСА КЕШИРИЎ**\n\nХызметкер ислейтуғын филиал ямаса складты таңлаң:`,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    // 7. 🔄 Телефон байланысын босатыў
    if (text === "🔄 Телефон байланысын босатыў") {
      adminSessions.set(chatId, { step: "UNBIND_WORKPLACE" });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `🔄 **ТЕЛЕФОН БАЙЛАНЫСЫН БОСАТЫЎ**\n\nҚайсы филиал ямаса складтағы хызметкердиң телефонын жаңалайсыз?`,
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "Филиал №1" }, { text: "Филиал №2" }],
            [{ text: "Филиал №3" }, { text: "Филиал №4" }],
            [{ text: "📦 Склад" }, { text: "🧹 Ҳәммесин босатыў" }],
            [{ text: "⬅️ Бас меню" }]
          ],
          resize_keyboard: true
        }
      });
      return;
    }

    // 8. 📍 Филиал локациясын өзгертиў
    if (text === "📍 Филиал локациясын өзгертиў") {
      adminSessions.set(chatId, { step: "LOC_WORKPLACE" });
      const wps = attendanceMgr.getWorkplaces();
      let curText = `📍 **ФИЛИАЛ ЯМАСА СКЛАД ЛОКАЦИЯСЫН ӨЗГЕРТИЎ:**\n\nҲәзирги координаталар (Радиус: ≤ ${attendanceMgr.getSettings().maxDistanceMeters} м):\n`;
      wps.forEach(w => {
        curText += `• **${w.shortName}:** \`${w.lat}, ${w.lng}\`\n`;
      });
      curText += `\nҚайсы объекттиң локациясын өзгертесиз? Таңлаң:`;
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: curText,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    // 9. ⚙️ Қағыйдаларды өзгертиў
    if (text === "⚙️ Қағыйдаларды өзгертиў") {
      const s = attendanceMgr.getSettings();
      adminSessions.set(chatId, { step: "SETTINGS_MENU" });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text:
          `⚙️ **ҚАҒЫЙДАЛАРДЫ ӨЗГЕРТИЎ:**\n\n` +
          `1. Ҳәр 5 минут кешигиў штрафы: **${s.penaltyPer5Min.toLocaleString("ru-RU")} сум**\n` +
          `2. 1 ай кешикпегенге бонус: **${s.monthlyBonusSum.toLocaleString("ru-RU")} сум**\n` +
          `3. Жумыс басланыў ўақты: **${s.startTime}**\n` +
          `4. GPS радиус шеги: **${s.maxDistanceMeters} метр**\n\n` +
          `Қайсы бирин өзгертесиз?`,
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "💸 5 мин штраф суммасын өзгертиў" }, { text: "🏆 1 млн бонус суммасын өзгертиў" }],
            [{ text: "🕒 Жумыс басланыў ўақтын өзгертиў" }, { text: "📏 GPS радиусты өзгертиў" }],
            [{ text: "⬅️ Бас меню" }]
          ],
          resize_keyboard: true
        }
      });
      return;
    }

    const session = adminSessions.get(chatId);
    if (session) {
      // --- ADD EMPLOYEE FLOW ---
      if (session.step === "ADD_EMP_WORKPLACE") {
        const wp = WORKPLACES.find(w => w.name === text || w.shortName === text);
        if (wp) {
          session.workplaceId = wp.id;
          session.workplaceName = wp.shortName;
          session.step = "ADD_EMP_NAME";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🏛️ Орын: **${wp.shortName}**\n\n✍️ **Жаңа хызметкердиң атын жазың:**`,
            parse_mode: "Markdown",
            reply_markup: { keyboard: [[{ text: "⬅️ Бас меню" }]], resize_keyboard: true }
          });
          return;
        }
      }

      if (session.step === "ADD_EMP_NAME") {
        session.empName = text;
        session.step = "ADD_EMP_ROLE";
        adminSessions.set(chatId, session);
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `👤 Аты: **${text}**\n\n💼 **Лаўазымын таңлаң ямаса жазың:**`,
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "Фармацевт" }, { text: "Бас провизор" }],
              [{ text: "Закупщик" }, { text: "Бухгалтер" }],
              [{ text: "Кассир" }, { text: "⬅️ Бас меню" }]
            ],
            resize_keyboard: true
          }
        });
        return;
      }

      if (session.step === "ADD_EMP_ROLE") {
        const res = attendanceMgr.addEmployee({
          workplaceId: session.workplaceId,
          name: session.empName,
          role: text
        });
        adminSessions.delete(chatId);
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `✅ **Жаңа хызметкер қосылды!**\n\n👤 Аты: **${res.employee.name}**\n💼 Лаўазымы: **${res.employee.role}**\n🏛️ Орын: **${res.workplace.shortName}**\n\nЕнди ол хызметкерлер ботында өз атын таңлап кире алады!`,
          parse_mode: "Markdown",
          reply_markup: getAdminMainKeyboard()
        });
        return;
      }

      // --- REMOVE EMPLOYEE FLOW ---
      if (session.step === "REMOVE_EMP_WORKPLACE") {
        const wp = WORKPLACES.find(w => w.name === text || w.shortName === text);
        if (wp) {
          const emps = attendanceMgr.getEmployees(wp.id);
          session.workplaceId = wp.id;
          session.step = "REMOVE_EMP_SELECT";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🏛️ **${wp.shortName}** — қайсы хызметкерди өширесиз? Таңлаң:`,
            parse_mode: "Markdown",
            reply_markup: getEmployeesKeyboard(emps)
          });
          return;
        }
      }

      if (session.step === "REMOVE_EMP_SELECT") {
        const emps = attendanceMgr.getEmployees(session.workplaceId);
        const emp = emps.find(e => text === `👤 ${e.name} (${e.role})` || text.includes(e.name));
        if (emp) {
          attendanceMgr.removeEmployee(emp.id);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🗑️ **${emp.name}** (${emp.role}) дизимнен өширилди!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }

      // --- PENALTY EDIT / FORGIVE FLOW ---
      if (session.step === "PENALTY_WORKPLACE") {
        const wp = WORKPLACES.find(w => w.name === text || w.shortName === text);
        if (wp) {
          const emps = attendanceMgr.getEmployees(wp.id);
          session.workplaceId = wp.id;
          session.step = "PENALTY_SELECT_EMP";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🏛️ **${wp.shortName}** — қайсы хызметкердиң штрафы ямаса бонусын өзгертесиз?`,
            parse_mode: "Markdown",
            reply_markup: getEmployeesKeyboard(emps)
          });
          return;
        }
      }

      if (session.step === "PENALTY_SELECT_EMP") {
        const emps = attendanceMgr.getEmployees(session.workplaceId);
        const emp = emps.find(e => text === `👤 ${e.name} (${e.role})` || text.includes(e.name));
        if (emp) {
          const mStats = attendanceMgr.getEmployeeMonthlyStats(emp.id);
          session.employeeId = emp.id;
          session.employeeName = emp.name;
          session.step = "PENALTY_ACTION";
          adminSessions.set(chatId, session);

          await tgRequest("sendMessage", {
            chat_id: chatId,
            text:
              `👤 Хызметкер: **${emp.name}** (${emp.role})\n` +
              `💸 Усы айдағы жәми штрафы: **${mStats.totalPenalty.toLocaleString("ru-RU")} сум** (${mStats.lateDaysCount} күн кешиккен)\n` +
              `🏆 1 млн бонус жағдайы: **${mStats.bonusEligible ? 'Сақланып тур ✅' : 'Күйген ❌'}**\n\n` +
              `Қандай өзгерис киритесиз?`,
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: "✅ Бүгинги штрафы 0 сум етиў (Кешириў)" }],
                [{ text: "🧹 Айлық штраflарын 0 сум етиў (1 млн бонусты тиклеў)" }],
                [{ text: "✏️ Бүгинге басқа штраф суммасын жазыў" }],
                [{ text: "⬅️ Бас меню" }]
              ],
              resize_keyboard: true
            }
          });
          return;
        }
      }

      if (session.step === "PENALTY_ACTION") {
        const now = getTashkentNow();
        if (text === "✅ Бүгинги штрафы 0 сум етиў (Кешириў)") {
          attendanceMgr.setDayPenalty(session.employeeId, now.dateStr, 0);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✅ **${session.employeeName}** ушын бүгинги (${now.dateStr}) штраф **0 сум** етилди!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }

        if (text === "🧹 Айлық штраflарын 0 сум етиў (1 млн бонусты тиклеў)") {
          attendanceMgr.clearMonthlyPenalties(session.employeeId, now.yearMonth);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🎉 **${session.employeeName}** ушын усы айдағы (${now.yearMonth}) барлық штрафлар **0 сум** етилди ҳәм **1 000 000 сум бонус** ҳуқықы толық тикленди!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }

        if (text === "✏️ Бүгинге басқа штраф суммасын жазыў") {
          session.step = "PENALTY_CUSTOM_AMOUNT";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✍️ **${session.employeeName}** ушын бүгинги штраф суммасын сан менен жазың (мысалы: \`10000\`, \`30000\` ямаса \`0\`):`,
            parse_mode: "Markdown",
            reply_markup: { keyboard: [[{ text: "⬅️ Бас меню" }]], resize_keyboard: true }
          });
          return;
        }
      }

      if (session.step === "PENALTY_CUSTOM_AMOUNT") {
        const amount = parseInt(text.replace(/\s+/g, ''), 10);
        if (!isNaN(amount) && amount >= 0) {
          const now = getTashkentNow();
          attendanceMgr.setDayPenalty(session.employeeId, now.dateStr, amount);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✅ **${session.employeeName}** ушын бүгинги (${now.dateStr}) штраф **${amount.toLocaleString("ru-RU")} сум** етип белгиленди!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }

      // --- UNBIND FLOW ---
      if (session.step === "UNBIND_WORKPLACE") {
        if (text === "🧹 Ҳәммесин босатыў") {
          attendanceMgr.resetBindings();
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✅ Барлық хызметкерлердиң телефон байланыслары тазаланды!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
        const wp = WORKPLACES.find(w => w.name === text || w.shortName === text);
        if (wp) {
          const emps = attendanceMgr.getEmployees(wp.id);
          session.workplaceId = wp.id;
          session.step = "UNBIND_SELECT_EMP";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `Қайсы хызметкердиң телефон байланысын босатасыз?`,
            parse_mode: "Markdown",
            reply_markup: getEmployeesKeyboard(emps)
          });
          return;
        }
      }

      if (session.step === "UNBIND_SELECT_EMP") {
        const emps = attendanceMgr.getEmployees(session.workplaceId);
        const emp = emps.find(e => text === `👤 ${e.name} (${e.role})` || text.includes(e.name));
        if (emp) {
          attendanceMgr.unbindEmployee(emp.id);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✅ **${emp.name}** профили телефоннан босатылды. Енди ол жаңа телефонынан кире алады!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }

      // --- SETTINGS FLOW ---
      if (session.step === "SETTINGS_MENU") {
        if (text === "💸 5 мин штраф суммасын өзгертиў") {
          session.step = "SET_PENALTY_AMOUNT";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `Ҳәр 5 минут кешигиў ушын жаңа штраф суммасын жазың (мысалы: \`10000\`):`,
            parse_mode: "Markdown"
          });
          return;
        }
        if (text === "🏆 1 млн бонус суммасын өзгертиў") {
          session.step = "SET_BONUS_AMOUNT";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `1 ай кешикпеген хызметкерге берилетуғын бонус суммасын жазың (мысалы: \`1000000\`):`,
            parse_mode: "Markdown"
          });
          return;
        }
        if (text === "🕒 Жумыс басланыў ўақтын өзгертиў") {
          session.step = "SET_START_TIME";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `Жумыс басланыў саатын жазың (мысалы: \`08:00\`):`,
            parse_mode: "Markdown"
          });
          return;
        }
        if (text === "📏 GPS радиусты өзгертиў") {
          session.step = "SET_RADIUS";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `Максимал GPS радиусты метрде жазың (мысалы: \`5\`):`,
            parse_mode: "Markdown"
          });
          return;
        }
      }

      if (session.step === "SET_PENALTY_AMOUNT") {
        const val = parseInt(text.replace(/\s+/g, ''), 10);
        if (!isNaN(val) && val >= 0) {
          attendanceMgr.updateSettings({ penaltyPer5Min: val });
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✅ Ҳәр 5 минут кешигиў штрафы **${val.toLocaleString("ru-RU")} сум** етип өзгертилди!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }

      if (session.step === "SET_BONUS_AMOUNT") {
        const val = parseInt(text.replace(/\s+/g, ''), 10);
        if (!isNaN(val) && val >= 0) {
          attendanceMgr.updateSettings({ monthlyBonusSum: val });
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✅ 1 айлық кешикпеў бонусы **${val.toLocaleString("ru-RU")} сум** етип өзгертилди!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }

      if (session.step === "SET_START_TIME") {
        if (/^\d{2}:\d{2}$/.test(text)) {
          attendanceMgr.updateSettings({ startTime: text });
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✅ Жумыс басланыў ўақты **${text}** етип өзгертилди!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }

      if (session.step === "LOC_WORKPLACE") {
        const wps = attendanceMgr.getWorkplaces();
        const wp = wps.find(w => w.name === text || w.shortName === text);
        if (wp) {
          session.workplaceId = wp.id;
          session.workplaceName = wp.shortName;
          session.step = "LOC_COORDS";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `📍 **${wp.shortName}** ушын жаңа Google Maps силтемесин, координатаны (\`42.933551, 59.773614\`) ямаса Telegram геопозиция жибериң:`,
            parse_mode: "Markdown",
            reply_markup: { keyboard: [[{ text: "⬅️ Бас меню" }]], resize_keyboard: true }
          });
          return;
        }
      }

      if (session.step === "LOC_COORDS") {
        let lat = null;
        let lng = null;
        if (msg.location) {
          lat = msg.location.latitude;
          lng = msg.location.longitude;
        } else {
          const m = text.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
          if (m) {
            lat = parseFloat(m[1]);
            lng = parseFloat(m[2]);
          }
        }
        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
          attendanceMgr.updateWorkplaceLocation(session.workplaceId, lat, lng);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✅ **${session.workplaceName}** локациясы жаңаланды!\n📌 Жаңа координата: \`${lat}, ${lng}\` (Радиус: ≤ ${attendanceMgr.getSettings().maxDistanceMeters} м)`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }

      if (session.step === "SET_RADIUS") {
        const val = parseFloat(text);
        if (!isNaN(val) && val > 0) {
          attendanceMgr.updateSettings({ maxDistanceMeters: val });
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✅ GPS тексериў радиусы **${val} метр** етип өзгертилди!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }
    }

    await tgRequest("sendMessage", {
      chat_id: chatId,
      text: `👑 **Басшы панели:** Төмендеги түймелерден бирин таңлаң:`,
      parse_mode: "Markdown",
      reply_markup: getAdminMainKeyboard()
    });
  }

  return { handleAdminMessage, formatDailyReport, formatMonthlyReport, groupBotHandler };
}

let lastUpdateId = 0;
async function pollAdminUpdates() {
  const token = getAdminBotToken();
  if (!token) {
    console.log("=================================================================");
    console.log("⚠️ БАСШЫ БОТЫ (admin_bot.js) УШЫН ТОКЕН КЕРЕК:");
    console.log("Telegram-да @BotFather-ден 2-ши бот ашып, токенин:");
    console.log("bot-data/bot-config.json файлына {\"adminBotToken\": \"ТОКЕН\"} деп жазың.");
    console.log("=================================================================");
    return;
  }
  const { handleAdminMessage, groupBotHandler } = createAdminBotHandler();

  setInterval(() => {
    groupBotHandler.checkAndRunDailySchedule().catch(err => {
      console.error("Admin Group schedule error:", err.message);
    });
  }, 20000);

  while (true) {
    try {
      await groupBotHandler.checkAndRunDailySchedule();
      const data = await defaultAdminTgRequest("getUpdates", {
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
            await handleAdminMessage(incomingMsg);
          }
        }
      }
    } catch (err) {
      console.error("Admin Bot Polling error:", err);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

module.exports = { createAdminBotHandler, pollAdminUpdates };

if (require.main === module) {
  console.log("PINTOK APTEKA Admin Bot is starting polling...");
  pollAdminUpdates();
}
