// PINTOK APTEKA — БАСШЫ (УПРАВЛЯЮЩИЙ / КОНТРОЛЬ) БОТЫ (2-БОТ)
// @apteka_uprav_bot (токен bot-data/bot-config.json файлинан алынады)
// Басшы мүмкиншиликлери:
// 1. Барлық 4 филиалдың бүгинги келип-кетиў табелин реал ўақытта көриў
// 2. Кешиккен хызметкерлердиң себепли сораўларын «✅ Қабыллаў» ямаса «❌ Қабылламаў» (айына 3 күн лимит пенен)
// 3. 🏥 Больничный ашыў ҳәм жабыў (аўырып қалған фармацевтке келип-кетиў соралмайды, оларға көринеди, бирақ өзгерте алмайды)
// 4. ➕ Жаңа хызметкер қосыў (Филиал + Аты + Телефон номери, ямаса дизим менен бирден жибериў)
// 5. 📍 4 филиалдың ҳәр бирине геолокация таслаў (Радиус: 50 м)
// 6. ⚖️ Штрафты өзгертиў / кешириў, 🔄 Телефон байланысын босатыў, 📅 Айлық календарь ҳәм есабат

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  WORKPLACES,
  MAX_DISTANCE_METERS,
  PENALTY_PER_MINUTE,
  MONTHLY_EXCUSE_LIMIT,
  formatPhoneDisplay,
  getTashkentNow,
  AttendanceManager
} = require('./attendance');
const { createGroupBotHandler } = require('./group_bot');

const DATA_DIR = path.join(__dirname, 'bot-data');
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (_) {}
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const CONFIG_FILE = path.join(DATA_DIR, 'bot-config.json');

const EMPLOYEE_BOT_TOKEN = process.env.EMPLOYEE_BOT_TOKEN || "9256975178:AAFmH-e7dOiuOx4h6W-L6S2Kv3Rm8Mo850E";

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
  return EMPLOYEE_BOT_TOKEN;
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

async function defaultAdminTgRequest(method, data = {}) {
  const token = getAdminBotToken();
  if (!token) return null;
  const maxRetries = method === "getUpdates" ? 1 : 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await httpsPostJson(token, method, data);
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`Admin Bot API error on ${method}:`, err.message);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

async function defaultEmployeeTgRequest(method, data = {}) {
  const empToken = getEmployeeBotToken();
  if (!empToken) return null;
  try {
    return await httpsPostJson(empToken, method, data);
  } catch (err) {
    console.error(`Employee notify error on ${method}:`, err.message);
    return null;
  }
}

function getAdminMainKeyboard() {
  return {
    keyboard: [
      [{ text: "📊 Бүгинги табель (4 филиал)" }, { text: "📅 Айлық есабат ҳәм Календарь" }],
      [{ text: "🏥 Больничный басқарыў" }, { text: "⏳ Себепли сораўлар" }],
      [{ text: "➕ Хызметкер қосыў" }, { text: "➖ Хызметкерди өшириў" }],
      [{ text: "📍 Филиал локациясын өзгертиў" }, { text: "⚖️ Штрафты өзгертиў / Кешириў" }],
      [{ text: "🔄 Телефон байланысын босатыў" }, { text: "📋 Соңғы 20 GPS лог" }]
    ],
    resize_keyboard: true
  };
}

function getWorkplaceKeyboard() {
  return {
    keyboard: [
      [{ text: "1-Филиал" }, { text: "2-Филиал" }],
      [{ text: "3-Филиал" }, { text: "4-Филиал" }],
      [{ text: "⬅️ Бас меню" }]
    ],
    resize_keyboard: true
  };
}

function getEmployeesKeyboard(employees) {
  const rows = [];
  for (let i = 0; i < employees.length; i += 2) {
    const phoneTag1 = employees[i].phone ? ` [${employees[i].phone}]` : "";
    const sickTag1 = employees[i].onSickLeave ? " 🏥" : "";
    const row = [{ text: `👤 ${employees[i].name} (${employees[i].role})${sickTag1}${phoneTag1}` }];
    if (employees[i + 1]) {
      const phoneTag2 = employees[i + 1].phone ? ` [${employees[i + 1].phone}]` : "";
      const sickTag2 = employees[i + 1].onSickLeave ? " 🏥" : "";
      row.push({ text: `👤 ${employees[i + 1].name} (${employees[i + 1].role})${sickTag2}${phoneTag2}` });
    }
    rows.push(row);
  }
  rows.push([{ text: "⬅️ Бас меню" }]);
  return {
    keyboard: rows,
    resize_keyboard: true
  };
}

// Helper to parse quick bulk text like: "1-Филиал Мехри +998901234567"
function parseBulkEmployeeLines(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const branchMatch = line.match(/([1-4])\s*[-–]?\s*филиал/i) || line.match(/филиал\s*№?\s*([1-4])/i);
    if (!branchMatch) continue;
    const branchNum = parseInt(branchMatch[1], 10);
    const workplaceId = `branch_${branchNum}`;
    const phoneMatch = line.match(/(\+?\d[\d\s\-()]{7,16}\d)/);
    const rawPhone = phoneMatch ? phoneMatch[1] : "";
    let namePart = line
      .replace(branchMatch[0], "")
      .replace(rawPhone, "")
      .replace(/[,:;—–-]+/g, " ")
      .trim();
    if (namePart) {
      parsed.push({
        workplaceId,
        name: namePart,
        phone: rawPhone
      });
    }
  }
  return parsed;
}

function findWorkplaceByInput(text, workplaces = WORKPLACES) {
  const clean = String(text || "").trim();
  return workplaces.find(
    w =>
      w.name === clean ||
      w.shortName === clean ||
      clean.includes(`${w.branchNumber}-Филиал`) ||
      clean.includes(`Филиал №${w.branchNumber}`) ||
      clean.includes(`Филиал ${w.branchNumber}`)
  );
}

function createAdminBotHandler({
  tgRequest = defaultAdminTgRequest,
  employeeTgRequest = defaultEmployeeTgRequest,
  attendanceMgr = new AttendanceManager(ATTENDANCE_FILE),
  groupBot = null
} = {}) {
  const adminSessions = attendanceMgr.createSessionStore
    ? attendanceMgr.createSessionStore("admin")
    : new Map();
  const groupBotHandler = groupBot || createGroupBotHandler({
    tgRequest,
    stateFile: path.join(DATA_DIR, 'admin-group-bot-state.json')
  });

  async function notifyEmployee(employeeId, text) {
    attendanceMgr.refresh();
    const bindInfo = attendanceMgr.state.bindings[employeeId];
    if (bindInfo && bindInfo.telegramUserId) {
      await employeeTgRequest("sendMessage", {
        chat_id: bindInfo.telegramUserId,
        text,
        parse_mode: "Markdown"
      });
    }
  }

  function formatDailyReport() {
    const now = getTashkentNow();
    const settings = attendanceMgr.getSettings();
    const summary = attendanceMgr.getDailySummary(now.dateStr);
    const allEmps = attendanceMgr.getEmployees();

    let report = `📊 **PINTOK APTEKA — БҮГИНГИ ТАБЕЛЬ (${now.dateStr}, ${now.timeStr})**\n`;
    report += `🎯 *Радиус: ≤ ${settings.maxDistanceMeters} м | Штраф: ${formatSum(settings.penaltyPerMinute)} сум / 1 мин | Лимит: айына ${settings.monthlyExcuseLimit} күн*\n\n`;

    let totalPresent = 0;
    let totalSick = 0;
    let totalTodayPenalties = 0;

    summary.forEach(group => {
      report += `🏥 **${group.workplace.shortName}**\n`;
      report += `📍 *${group.workplace.address}* (${group.workplace.workHoursText})\n`;
      group.staff.forEach(s => {
        if (s.isSickLeave) {
          totalSick++;
          report += `  • **${s.name}**: 🏥 **Больничный** *(аўырыў себепли босатылған)*\n`;
          return;
        }
        if (s.arrTime !== '—') totalPresent++;
        totalTodayPenalties += s.penalty || 0;
        const distInfo = s.inDistance !== null ? ` (${s.inDistance}м)` : '';
        const penInfo = s.penalty > 0 ? ` | 💸 Штраф: ${formatSum(s.penalty)} сум` : '';
        const phoneBadge = s.boundPhone ? ` 📱\`${s.boundPhone}\`` : ' *(телефон кирилмеген)*';
        report += `  • **${s.name}**${phoneBadge}: ${s.status} | Келди: \`${s.arrTime}\`${distInfo} | Кетти: \`${s.leaveTime}\`${penInfo} | Лимит: ${s.remainingExcuses}/3\n`;
      });
      report += `\n`;
    });

    report += `👥 **Жумысқа келгенлер:** ${totalPresent} / ${allEmps.length} фармацевт`;
    if (totalSick > 0) report += ` (🏥 Больничныйда: ${totalSick})`;
    report += `\n💸 **Бүгинги жәми штрафлар:** ${formatSum(totalTodayPenalties)} сум`;
    return report;
  }

  function formatMonthlyReport() {
    const now = getTashkentNow();
    const summary = attendanceMgr.getDailySummary(now.dateStr);

    let report = `📅 **1 АЙЛЫҚ ҚЫСҚА ЕСАБАТ (${now.yearMonth})**\n\n`;
    let totalMonthPenalties = 0;
    let totalStaff = 0;
    let totalLateStaff = 0;

    summary.forEach(group => {
      report += `🏥 **${group.workplace.name}** *(${group.workplace.address.split(',')[0]})*\n`;
      group.staff.forEach(s => {
        totalStaff++;
        const pen = s.monthlyPenalty || 0;
        totalMonthPenalties += pen;
        const worked = s.monthlyWorkedDays || 0;
        const lateDays = s.monthlyLateDays || 0;
        const lateMins = s.monthlyLateMinutes || 0;
        if (lateDays > 0 || pen > 0) totalLateStaff++;

        if (s.isSickLeave) {
          report += `• **${s.name}**: 🏥 Больничный | Иследи: ${worked} к | 0 сум\n`;
        } else if (pen > 0 || lateDays > 0) {
          report +=
            `• **${s.name}**: Иследи ${worked} к | ⏰ Кеш: ${lateDays} к (${lateMins} мин) | ` +
            `Лимит: ${s.remainingExcuses}/3 | 💸 **${formatSum(pen)} сум**\n`;
        } else {
          report +=
            `• **${s.name}**: Иследи ${worked} к | ✅ Кеш: 0 | Лимит: ${s.remainingExcuses}/3 | **0 сум**\n`;
        }
      });
      report += `\n`;
    });

    report += `━━━━━━━━━━━━━━\n`;
    report += `👥 Хызметкерлер: **${totalStaff}** (кешиккен: **${totalLateStaff}**)\n`;
    report += `💸 **Жәми айлық штраф:** **${formatSum(totalMonthPenalties)} сум**\n\n`;
    report += `👇 **Жеке 1 айлық отчётты көриў ушын хызметкердиң үстине басың:**`;
    return report;
  }

  function getMonthlyEmployeeInlineKeyboard() {
    const now = getTashkentNow();
    const summary = attendanceMgr.getDailySummary(now.dateStr);
    const rows = [];
    summary.forEach(group => {
      const bNum = group.workplace.branchNumber || group.workplace.name.charAt(0);
      const staff = group.staff;
      for (let i = 0; i < staff.length; i += 2) {
        const s1 = staff[i];
        const badge1 = s1.isSickLeave ? "🏥" : (s1.monthlyPenalty > 0 ? "💸" : "👤");
        const row = [
          {
            text: `${badge1} ${bNum}-Ф: ${s1.name}`,
            callback_data: `emp_report:${s1.id}`
          }
        ];
        if (staff[i + 1]) {
          const s2 = staff[i + 1];
          const badge2 = s2.isSickLeave ? "🏥" : (s2.monthlyPenalty > 0 ? "💸" : "👤");
          row.push({
            text: `${badge2} ${bNum}-Ф: ${s2.name}`,
            callback_data: `emp_report:${s2.id}`
          });
        }
        rows.push(row);
      }
    });
    return { inline_keyboard: rows };
  }

  async function processExcuseDecision(chatId, reqId, approve, callbackQueryId = null) {
    const res = attendanceMgr.resolveExcuseRequest(reqId, approve);
    if (!res.ok) {
      let errText = "⚠️ Бул сораў табылмады ямаса алдын шешилген.";
      if (res.error === "EXCUSE_LIMIT_EXCEEDED") {
        errText = `🚫 **ҚАБЫЛЛАЎ ӨТПЕДИ!**\nХызметкер **${res.employee ? res.employee.name : ""}** усы айдағы **3 күнлик себепли лимитин толық таўысқан (0 / 3 күн қалды)**! Одан аржағына қабыллаў өтпейди, штраф сақланып қалды.`;
        if (res.employee) {
          await notifyEmployee(
            res.employee.id,
            `🚫 **Себепли кешигиў лимитиңиз таўсылған (0 / 3 күн)!**\nБасшы қабыллаўы өтпеди, бүгинги штраф сақланып қалды.`
          );
        }
      }
      if (callbackQueryId) {
        await tgRequest("answerCallbackQuery", { callback_query_id: callbackQueryId, text: "Лимит таўсылған ямаса алдын шешилген!" });
      }
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: errText,
        parse_mode: "Markdown",
        reply_markup: getAdminMainKeyboard()
      });
      return;
    }

    const req = res.request;
    const lim = res.limitInfo;

    if (callbackQueryId) {
      await tgRequest("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text: approve ? "✅ Себеби қабылланды! Штраф 0 сум етилди." : "❌ Қабылланбады! Штраф қалды."
      });
    }

    if (approve) {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text:
          `✅ **СЕБЕПЛИ КЕШИГИЎ ҚАБЫЛЛАНДЫ!**\n\n` +
          `👤 Фармацевт: **${req.employeeName}** (${req.workplaceName})\n` +
          `📅 Сәне: **${req.dateStr}**\n` +
          `💬 Себеби: *"${req.reasonText}"*\n` +
          `💸 Штраф: **0 сум етилди** (кеширилди)\n` +
          `🎟️ Хызметкердиң қалған айлық лимити: **${lim.remainingDays} / ${lim.limit} күн қалды**`,
        parse_mode: "Markdown",
        reply_markup: getAdminMainKeyboard()
      });

      await notifyEmployee(
        req.employeeId,
        `✅ **БАСШЫ СИЗИҢ СЕБЕБИҢИЗДИ ҚАБЫЛЛАДЫ!**\n\n` +
        `📅 Сәне: **${req.dateStr}**\n` +
        `💬 Себебиңиз: *"${req.reasonText}"*\n` +
        `🎉 Бүгинги кешигиў штрафыңыз **0 сум** етилди (жазылмады)!\n` +
        `🎟️ **Ескертиў:** Сизиң усы айдағы себепли лимитиңиз: **${lim.remainingDays} / ${lim.limit} күн қалды**.`
      );
    } else {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text:
          `❌ **СЕБЕП ҚАБЫЛЛАНБАДЫ (ШТРАФ ҚАЛДЫ)!**\n\n` +
          `👤 Фармацевт: **${req.employeeName}** (${req.workplaceName})\n` +
          `📅 Сәне: **${req.dateStr}**\n` +
          `💸 Штраф: **${formatSum(req.penalty)} сум** өз күшинде қалды.`,
        parse_mode: "Markdown",
        reply_markup: getAdminMainKeyboard()
      });

      await notifyEmployee(
        req.employeeId,
        `❌ **Басшы сизиң кешигиў себебиңизди қабылламады.**\n\n` +
        `📅 Сәне: **${req.dateStr}**\n` +
        `💸 Бүгинги штраф (**${formatSum(req.penalty)} сум**) өз күшинде қалды.\n` +
        `🎟️ Сизиң себепли лимитиңиз: **${lim.remainingDays} / ${lim.limit} күн қалды**.`
      );
    }
  }

  async function handleCallbackQuery(callbackQuery) {
    if (!callbackQuery || !callbackQuery.data) return;
    const chatId = callbackQuery.message ? callbackQuery.message.chat.id : callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data.startsWith("emp_report:")) {
      const empId = data.replace("emp_report:", "").trim();
      const emp = attendanceMgr.getEmployeeById(empId);
      await tgRequest("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: emp ? `👤 ${emp.name} — жеке есабаты` : "Есабат"
      });
      const calText = attendanceMgr.formatEmployeeCalendar(empId);
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: calText,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🧹 Айлық штрафы 0 сум етиў (Кешириў)", callback_data: `emp_clear_month:${empId}` }],
            [{ text: "⬅️ Жалпы 1 айлық есабатқа қайтыў", callback_data: "monthly_summary" }]
          ]
        }
      });
      return;
    }

    if (data === "monthly_summary") {
      await tgRequest("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "📅 1 айлық есабат"
      });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: formatMonthlyReport(),
        parse_mode: "Markdown",
        reply_markup: getMonthlyEmployeeInlineKeyboard()
      });
      return;
    }

    if (data.startsWith("emp_clear_month:")) {
      const empId = data.replace("emp_clear_month:", "").trim();
      const emp = attendanceMgr.getEmployeeById(empId);
      const now = getTashkentNow();
      attendanceMgr.clearMonthlyPenalties(empId, now.yearMonth);
      await tgRequest("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "✅ Айлық штрафлар 0 сум етилди!"
      });
      if (emp) {
        await notifyEmployee(emp.id, `🎉 **Басшы сизиң усы айдағы барлық штрафларыңызды кеширди (0 сум етилди)!**`);
      }
      const calText = attendanceMgr.formatEmployeeCalendar(empId);
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `✅ **${emp ? emp.name : ""}** айлық штрафы 0 сум етилди!\n\n` + calText,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Жалпы 1 айлық есабатқа қайтыў", callback_data: "monthly_summary" }]
          ]
        }
      });
      return;
    }

    if (data.startsWith("excuse_approve:")) {
      const reqId = data.replace("excuse_approve:", "").trim();
      await processExcuseDecision(chatId, reqId, true, callbackQuery.id);
      return;
    }
    if (data.startsWith("excuse_reject:")) {
      const reqId = data.replace("excuse_reject:", "").trim();
      await processExcuseDecision(chatId, reqId, false, callbackQuery.id);
      return;
    }
  }

  async function handleAdminMessage(msg) {
    if (!msg || !msg.chat) return;
    const chatId = msg.chat.id;
    const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";

    const handledByGroupBot = await groupBotHandler.handleGroupMessage(msg);
    if (handledByGroupBot || isGroup) {
      return;
    }

    const text = (msg.text || "").trim();
    attendanceMgr.addAdminChat(chatId);

    if (text === "/start" || text === "⬅️ Бас меню" || text === "Бас меню") {
      adminSessions.delete(chatId);
      const settings = attendanceMgr.getSettings();
      const welcome =
        `👑 **«PINTOK APTEKA» — БАСШЫ (УПРАВЛЯЮЩИЙ) БОТЫ**\n\n` +
        `🔔 Барлық **4 филиалдағы** фармацевтлердиң келип-кетиўи, кешигиў себеплери ҳәм ерте жаўыў хабарлары усы ботқа туўрыдан-туўры келеди.\n\n` +
        `🏥 **Филиаллар ҳәм жумыс ўақты:**\n` +
        `• **1-Филиал** (Шымбай, 5-этажлы Емлеўхана қасында): \`08:00–16:00\` ҳәм \`16:30–00:00\`\n` +
        `• **2-Филиал** (Шымбай, Базар ишинде): \`08:00–19:00\`\n` +
        `• **3-Филиал** (Хожели, Емлеўхана қарама-қарсы): \`08:00–16:00\` ҳәм \`16:30–00:00\`\n` +
        `• **4-Филиал** (Нөкис, Городской Больница қарама-қарсы): \`08:00–16:00\` ҳәм \`16:30–00:00\`\n\n` +
        `⚙️ **Қағыйдалар:**\n` +
        `• GPS тексериў радиусы: **≤ ${settings.maxDistanceMeters} метр**\n` +
        `• Кешигиў ҳәм ерте жаўыў штрафы: **1 минут = ${formatSum(settings.penaltyPerMinute)} сум**\n` +
        `• Себепли кешигиў лимити: **айына ${settings.monthlyExcuseLimit} күн**\n\n` +
        `💡 *Хызметкерлерди тез қосыў ушын усы чатқа туўрыдан-туўры: \`1-Филиал Мехри +998901234567\` деп жазып жиберсеңиз де болады!*`;

      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: welcome,
        parse_mode: "Markdown",
        reply_markup: getAdminMainKeyboard()
      });
      return;
    }

    // Quick bulk employee parser if Manager sends lines like "1-Филиал Мехри +998901234567"
    const bulkList = parseBulkEmployeeLines(text);
    if (bulkList.length > 0) {
      let addedReport = `✅ **Хызметкерлер дизимге киргизилди (${bulkList.length} адам):**\n\n`;
      for (const item of bulkList) {
        const r = attendanceMgr.addEmployee({
          workplaceId: item.workplaceId,
          name: item.name,
          phone: item.phone,
          role: "Фармацевт"
        });
        if (r.ok) {
          addedReport += `• **${r.workplace.name}** — **${r.employee.name}** (${r.employee.phone || "номерсиз"})\n`;
        }
      }
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: addedReport,
        parse_mode: "Markdown",
        reply_markup: getAdminMainKeyboard()
      });
      return;
    }

    // 1. Бүгинги табель
    if (text === "📊 Бүгинги табель (4 филиал)" || text === "📊 Бүгинги табель (5 объект)") {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: formatDailyReport(),
        parse_mode: "Markdown",
        reply_markup: getAdminMainKeyboard()
      });
      return;
    }

    // 2. Айлық есабат ҳәм Календарь
    if (text === "📅 Айлық есабат ҳәм Календарь" || text === "💰 Айлық штраф ҳәм 1 млн бонус") {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: formatMonthlyReport(),
        parse_mode: "Markdown",
        reply_markup: getMonthlyEmployeeInlineKeyboard()
      });
      return;
    }

    // 3. 🏥 Больничный басқарыў
    if (text === "🏥 Больничный басқарыў") {
      adminSessions.set(chatId, { step: "SICK_WORKPLACE" });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text:
          `🏥 **БОЛЬНИЧНЫЙ БАСҚАРЫЎ**\n\n` +
          `Аўырып қалған фармацевтке «Больничный» ашсаңыз, оның келип-кетиўи соралмайды ҳәм штраф жазылмайды (хызметкерге көринеди, бирақ өзи өзгерте алмайды).\n\n` +
          `Қайсы филиалдағы фармацевтти таңлайсыз?`,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    // 4. ⏳ Себепли сораўлар
    if (text === "⏳ Себепли сораўлар") {
      attendanceMgr.refresh();
      const allReqs = Object.values(attendanceMgr.state.excuseRequests || {}).filter(r => r.status === "PENDING");
      if (allReqs.length === 0) {
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: `✅ Ҳәзирше жуўап күтип турған себепли кешигиў сораўлары жоқ.`,
          parse_mode: "Markdown",
          reply_markup: getAdminMainKeyboard()
        });
        return;
      }
      for (const req of allReqs) {
        const lim = attendanceMgr.getExcuseLimitStatus(req.employeeId, req.yearMonth);
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text:
            `📩 **СЕБЕПЛИ КЕШИГИЎ СОРАЎЫ:**\n` +
            `👤 Фармацевт: **${req.employeeName}** (${req.workplaceName})\n` +
            `📅 Сәне: **${req.dateStr}** | Кешикти: **${req.lateMinutes} мин** (${formatSum(req.penalty)} сум)\n` +
            `🎟️ Қалған лимити: **${lim.remainingDays} / ${lim.limit} күн**\n` +
            `💬 **Себеби:** *"${req.reasonText}"*`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Қабыллаў (Штраф 0 сум)", callback_data: `excuse_approve:${req.id}` },
                { text: "❌ Қабылламаў (Штраф қалсын)", callback_data: `excuse_reject:${req.id}` }
              ]
            ]
          }
        });
      }
      return;
    }

    // 5. 📋 Соңғы 20 GPS лог
    if (text === "📋 Соңғы 20 GPS лог") {
      attendanceMgr.refresh();
      const logs = attendanceMgr.state.logs.slice(0, 20);
      let logText = `📋 **СОҢҒЫ 20 GPS ТЕКСЕРИЎ ЛОГЫ:**\n\n`;
      if (logs.length === 0) {
        logText += `Ҳәзирше логлар жоқ.`;
      } else {
        logs.forEach((l, i) => {
          const icon = l.status === 'ACCEPTED' ? (l.actionType === 'OUT' ? '🔴' : '🟢') : '🚫';
          logText += `${i + 1}. ${icon} **${l.name}** (${l.workplaceName}) — ${l.actionType === 'OUT' ? 'Кеттим' : 'Келдим'} | Аралық: **${l.distanceMeters} м** | ${l.timestamp}\n`;
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

    // 6. ➕ Хызметкер қосыў
    if (text === "➕ Хызметкер қосыў") {
      adminSessions.set(chatId, { step: "ADD_EMP_WORKPLACE" });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `➕ **ЖАҢА ФАРМАЦЕВТ (ХЫЗМЕТКЕР) ҚОСЫЎ**\n\nҚайсы филиалға хызметкер қосасыз? Таңлаң:`,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    // 7. ➖ Хызметкерди өшириў
    if (text === "➖ Хызметкерди өшириў") {
      adminSessions.set(chatId, { step: "REMOVE_EMP_WORKPLACE" });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `➖ **ХЫЗМЕТКЕРДИ ӨШИРИЎ**\n\nҚайсы филиалдан өширесиз? Таңлаң:`,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    // 8. ⚖️ Штрафты өзгертиў / Кешириў
    if (text === "⚖️ Штрафты өзгертиў / Кешириў") {
      adminSessions.set(chatId, { step: "PENALTY_WORKPLACE" });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `⚖️ **ШТРАФТЫ ӨЗГЕРТИЎ ЯМАСА КЕШИРИЎ**\n\nФармацевт ислейтуғын филиалды таңлаң:`,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    // 9. 🔄 Телефон байланысын босатыў
    if (text === "🔄 Телефон байланысын босатыў") {
      adminSessions.set(chatId, { step: "UNBIND_WORKPLACE" });
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: `🔄 **ТЕЛЕФОН БАЙЛАНЫСЫН БОСАТЫЎ**\n\nҚайсы филиалдағы хызметкердиң телефонын босатасыз?`,
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "1-Филиал" }, { text: "2-Филиал" }],
            [{ text: "3-Филиал" }, { text: "4-Филиал" }],
            [{ text: "🧹 Ҳәммесин босатыў" }, { text: "⬅️ Бас меню" }]
          ],
          resize_keyboard: true
        }
      });
      return;
    }

    // 10. 📍 Филиал локациясын өзгертиў
    if (text === "📍 Филиал локациясын өзгертиў") {
      adminSessions.set(chatId, { step: "LOC_WORKPLACE" });
      const wps = attendanceMgr.getWorkplaces();
      let curText = `📍 **4 ФИЛИАЛДЫҢ ГЕОЛОКАЦИЯСЫН ТАСЛАЎ / ӨЗГЕРТИЎ (Радиус: 50 м):**\n\n`;
      wps.forEach(w => {
        curText += `• **${w.shortName}:** \`${w.lat}, ${w.lng}\`\n`;
      });
      curText += `\nҚайсы филиалдың локациясын таслайсыз? Таңлаң:`;
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: curText,
        parse_mode: "Markdown",
        reply_markup: getWorkplaceKeyboard()
      });
      return;
    }

    const session = adminSessions.get(chatId);
    if (session) {
      // --- SICK LEAVE («🏥 Больничный») FLOW ---
      if (session.step === "SICK_WORKPLACE") {
        const wp = findWorkplaceByInput(text, attendanceMgr.getWorkplaces());
        if (wp) {
          const emps = attendanceMgr.getEmployees(wp.id);
          session.workplaceId = wp.id;
          session.step = "SICK_SELECT_EMP";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🏥 **${wp.shortName}** — қайсы фармацевтке Больничный ашасыз ямаса жабасыз?`,
            parse_mode: "Markdown",
            reply_markup: getEmployeesKeyboard(emps)
          });
          return;
        }
      }

      if (session.step === "SICK_SELECT_EMP") {
        const emps = attendanceMgr.getEmployees(session.workplaceId);
        const emp = emps.find(e => text.includes(e.name));
        if (emp) {
          session.employeeId = emp.id;
          session.employeeName = emp.name;
          session.step = "SICK_TOGGLE_ACTION";
          adminSessions.set(chatId, session);

          await tgRequest("sendMessage", {
            chat_id: chatId,
            text:
              `👤 Фармацевт: **${emp.name}**\n` +
              `🩺 Ҳәзирги статусы: **${emp.onSickLeave ? "🏥 Больничныйда (Ашық)" : "🟢 Жумыста (Актив)"}**\n\n` +
              `Қандай буйрық бересиз?`,
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: "🏥 Больничный АШЫЎ (Аўырып қалды)" }],
                [{ text: "🟢 Больничныйды ЖАБЫЎ (Жумысқа шықты)" }],
                [{ text: "⬅️ Бас меню" }]
              ],
              resize_keyboard: true
            }
          });
          return;
        }
      }

      if (session.step === "SICK_TOGGLE_ACTION") {
        if (text.includes("Больничный АШЫЎ")) {
          const r = attendanceMgr.setSickLeave(session.employeeId, true);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🏥 **${session.employeeName}** ушын **«Больничный» АШЫЛДЫ!**\nОның келип-кетиўи соралмайды ҳәм өз календарында «🏥 Больничный» болып көринип турады.`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          if (r.ok) {
            await notifyEmployee(
              session.employeeId,
              `🏥 **Басшы сизге «Больничный» ашты!**\n\nСизден жумысқа келип-кетиў локациясы соралмайды ҳәм штраф жазылмайды. Тез саўалып кетиң!`
            );
          }
          return;
        }
        if (text.includes("Больничныйды ЖАБЫЎ")) {
          const r = attendanceMgr.setSickLeave(session.employeeId, false);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🟢 **${session.employeeName}** ушын **«Больничный» ЖАБЫЛДЫ!** Енди әдеттегидей жумысқа келип-кетиўин белгилейди.`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          if (r.ok) {
            await notifyEmployee(
              session.employeeId,
              `🟢 **Басшы сизиң «Больничный» статусыңызды жапты.**\nСаўалып шыққаныңыз бенен! Енди жумысқа келгенде «🔵 Келдим» түймесин басып белгилей бериң.`
            );
          }
          return;
        }
      }

      // --- ADD EMPLOYEE FLOW (Branch -> Name -> Phone -> Role) ---
      if (session.step === "ADD_EMP_WORKPLACE") {
        const wp = findWorkplaceByInput(text, attendanceMgr.getWorkplaces());
        if (wp) {
          session.workplaceId = wp.id;
          session.workplaceName = wp.shortName;
          session.step = "ADD_EMP_NAME";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🏥 Филиал: **${wp.shortName}**\n\n✍️ **Фармацевттиң атын жазың:**`,
            parse_mode: "Markdown",
            reply_markup: { keyboard: [[{ text: "⬅️ Бас меню" }]], resize_keyboard: true }
          });
          return;
        }
      }

      if (session.step === "ADD_EMP_NAME") {
        session.empName = text;
        session.step = "ADD_EMP_PHONE";
        adminSessions.set(chatId, session);
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text:
            `👤 Аты: **${text}**\n\n` +
            `📱 **Телефон номерин жазың** *(мәселен: \`+998901234567\` ямаса \`901234567\`, ямаса лаўазымын таңлаң)*:`,
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "Фармацевт" }, { text: "Бас провизор" }],
              [{ text: "Кассир" }, { text: "⬅️ Бас меню" }]
            ],
            resize_keyboard: true
          }
        });
        return;
      }

      if (session.step === "ADD_EMP_PHONE") {
        const hasDigits = /\d{7,}/.test(text);
        const phoneVal = hasDigits ? text : "";
        const roleVal = hasDigits ? "Фармацевт" : text;

        const res = attendanceMgr.addEmployee({
          workplaceId: session.workplaceId,
          name: session.empName,
          phone: phoneVal,
          role: roleVal
        });
        adminSessions.delete(chatId);
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text:
            `✅ **Фармацевт дизимге қосылды!**\n\n` +
            `👤 Аты: **${res.employee.name}**\n` +
            `📱 Телефон: \`${res.employee.phone || "Киритилген жоқ (биринши киргенде беккемленеди)"}\`\n` +
            `🏥 Филиал: **${res.workplace.shortName}**\n\n` +
            `Енди ол тек усы телефон номеринен ғана ботқа кире алады!`,
          parse_mode: "Markdown",
          reply_markup: getAdminMainKeyboard()
        });
        return;
      }

      // --- REMOVE EMPLOYEE FLOW ---
      if (session.step === "REMOVE_EMP_WORKPLACE") {
        const wp = findWorkplaceByInput(text, attendanceMgr.getWorkplaces());
        if (wp) {
          const emps = attendanceMgr.getEmployees(wp.id);
          session.workplaceId = wp.id;
          session.step = "REMOVE_EMP_SELECT";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🏥 **${wp.shortName}** — қайсы хызметкерди өширесиз? Таңлаң:`,
            parse_mode: "Markdown",
            reply_markup: getEmployeesKeyboard(emps)
          });
          return;
        }
      }

      if (session.step === "REMOVE_EMP_SELECT") {
        const emps = attendanceMgr.getEmployees(session.workplaceId);
        const emp = emps.find(e => text.includes(e.name));
        if (emp) {
          attendanceMgr.removeEmployee(emp.id);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🗑️ **${emp.name}** дизимнен өширилди!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }

      // --- PENALTY EDIT / FORGIVE FLOW ---
      if (session.step === "PENALTY_WORKPLACE") {
        const wp = findWorkplaceByInput(text, attendanceMgr.getWorkplaces());
        if (wp) {
          const emps = attendanceMgr.getEmployees(wp.id);
          session.workplaceId = wp.id;
          session.step = "PENALTY_SELECT_EMP";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🏥 **${wp.shortName}** — қайсы фармацевттиң штрафы ямаса календарын көресиз?`,
            parse_mode: "Markdown",
            reply_markup: getEmployeesKeyboard(emps)
          });
          return;
        }
      }

      if (session.step === "PENALTY_SELECT_EMP") {
        const emps = attendanceMgr.getEmployees(session.workplaceId);
        const emp = emps.find(e => text.includes(e.name));
        if (emp) {
          const mStats = attendanceMgr.getEmployeeMonthlyStats(emp.id);
          session.employeeId = emp.id;
          session.employeeName = emp.name;
          session.step = "PENALTY_ACTION";
          adminSessions.set(chatId, session);

          await tgRequest("sendMessage", {
            chat_id: chatId,
            text:
              `${attendanceMgr.formatEmployeeCalendar(emp.id)}\n\n` +
              `👇 **Қандай өзгерис киритесиз?**`,
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: "✅ Бүгинги штрафы 0 сум етиў (Кешириў)" }],
                [{ text: "🧹 Айлық штрафларын 0 сум етиў" }],
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

        if (text.includes("Айлық штрафларын 0 сум етиў")) {
          attendanceMgr.clearMonthlyPenalties(session.employeeId, now.yearMonth);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🎉 **${session.employeeName}** ушын усы айдағы барлық штрафлар **0 сум** етилди!`,
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
            text: `✍️ **${session.employeeName}** ушын бүгинги штраф суммасын сан менен жазың (мәселен: \`15000\` ямаса \`0\`):`,
            parse_mode: "Markdown",
            reply_markup: { keyboard: [[{ text: "⬅️ Бас меню" }]], resize_keyboard: true }
          });
          return;
        }
      }

      if (session.step === "PENALTY_CUSTOM_AMOUNT") {
        const val = parseInt(text.replace(/\s+/g, ""), 10);
        if (!isNaN(val) && val >= 0) {
          const now = getTashkentNow();
          attendanceMgr.setDayPenalty(session.employeeId, now.dateStr, val);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `✅ **${session.employeeName}** ушын бүгинги штраф **${formatSum(val)} сум** етип белгиленди!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }

      // --- UNBIND PHONE FLOW ---
      if (session.step === "UNBIND_WORKPLACE") {
        if (text === "🧹 Ҳәммесин босатыў") {
          attendanceMgr.resetBindings();
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🧹 Барлық хызметкерлердиң телефон байланыслары тазаланды!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
        const wp = findWorkplaceByInput(text, attendanceMgr.getWorkplaces());
        if (wp) {
          const emps = attendanceMgr.getEmployees(wp.id);
          session.workplaceId = wp.id;
          session.step = "UNBIND_SELECT_EMP";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🏥 **${wp.shortName}** — қайсы фармацевттиң телефон байланысын босатасыз?`,
            parse_mode: "Markdown",
            reply_markup: getEmployeesKeyboard(emps)
          });
          return;
        }
      }

      if (session.step === "UNBIND_SELECT_EMP") {
        const emps = attendanceMgr.getEmployees(session.workplaceId);
        const emp = emps.find(e => text.includes(e.name));
        if (emp) {
          attendanceMgr.unbindEmployee(emp.id);
          adminSessions.delete(chatId);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text: `🔄 **${emp.name}** телефон байланысы босатылды!`,
            parse_mode: "Markdown",
            reply_markup: getAdminMainKeyboard()
          });
          return;
        }
      }

      // --- UPDATE WORKPLACE LOCATION FLOW ---
      if (session.step === "LOC_WORKPLACE") {
        const wps = attendanceMgr.getWorkplaces();
        const wp = findWorkplaceByInput(text, wps);
        if (wp) {
          session.workplaceId = wp.id;
          session.workplaceName = wp.shortName;
          session.step = "LOC_AWAIT_COORDS";
          adminSessions.set(chatId, session);
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text:
              `📍 **${wp.shortName}** ушын жаңа локация киритиў (Радиус: 50 м):\n\n` +
              `1️⃣ Төмендеги **«📍 Ҳәзирги турған жеримди белгилеў»** түймесин басың (ямаса Telegram-нан Геопозиция таслаң),\n` +
              `2️⃣ Ямаса координатаны сан менен жазып жибериң (мәселен: \`42.918927, 59.779079\`).`,
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: "📍 Ҳәзирги турған жеримди белгилеў", request_location: true }],
                [{ text: "⬅️ Бас меню" }]
              ],
              resize_keyboard: true
            }
          });
          return;
        }
      }

      if (session.step === "LOC_AWAIT_COORDS") {
        let newLat = null;
        let newLng = null;
        if (msg.location) {
          newLat = msg.location.latitude;
          newLng = msg.location.longitude;
        } else if (text.includes(",")) {
          const parts = text.split(",").map(s => parseFloat(s.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            newLat = parts[0];
            newLng = parts[1];
          }
        }
        if (newLat !== null && newLng !== null) {
          const updated = attendanceMgr.updateWorkplaceLocation(session.workplaceId, newLat, newLng);
          adminSessions.delete(chatId);
          if (updated.ok) {
            await tgRequest("sendMessage", {
              chat_id: chatId,
              text:
                `✅ **${updated.workplace.shortName}** геолокациясы сақланды!\n\n` +
                `📍 Жаңа координаталар: \`${updated.workplace.lat}, ${updated.workplace.lng}\`\n` +
                `📏 Тексериў радиусы: **≤ ${attendanceMgr.getSettings().maxDistanceMeters} метр**`,
              parse_mode: "Markdown",
              reply_markup: getAdminMainKeyboard()
            });
            return;
          }
        }
      }
    }

    await tgRequest("sendMessage", {
      chat_id: chatId,
      text: `👑 **Басшы менюсы:** Төмендеги бөлимлерден бирин таңлаң:`,
      parse_mode: "Markdown",
      reply_markup: getAdminMainKeyboard()
    });
  }

  return {
    handleAdminMessage,
    handleCallbackQuery,
    formatDailyReport,
    formatMonthlyReport,
    groupBotHandler
  };
}

let lastAdminUpdateId = 0;
async function pollAdminUpdates() {
  const { handleAdminMessage, handleCallbackQuery, groupBotHandler } = createAdminBotHandler();

  setInterval(() => {
    groupBotHandler.checkAndRunDailySchedule().catch(err => {
      console.error("Admin group schedule error:", err.message);
    });
  }, 20000);

  while (true) {
    try {
      await groupBotHandler.checkAndRunDailySchedule();
      const data = await defaultAdminTgRequest("getUpdates", {
        offset: lastAdminUpdateId + 1,
        timeout: 15
      });

      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastAdminUpdateId = update.update_id;
          if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
          }
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
      console.error("Admin polling error:", err);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

module.exports = { createAdminBotHandler, pollAdminUpdates };

if (require.main === module) {
  console.log("PINTOK APTEKA Admin Bot (@apteka_uprav_bot) is starting polling...");
  pollAdminUpdates();
}
