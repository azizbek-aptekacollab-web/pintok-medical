// PINTOK APTEKA — ТЕЛЕГРАМ ГРУППА ИНДИВИДУАЛЬ АВТО-ОТВЕТЧИК, КОЛЛ-ЦЕНТР ЕСКЕРТИЎШИ ҲӘМ 450 МАҒЛЫЎМАТ БОТЫ
// Функциялары:
// 1. Ҳәр күни 15 мәрте (саат 08:00 ден 22:00 ге шекем ҳәр 1 саат сайын) интернеттен тематикалық фото +
//    450 уникал пост базасынан (дурыс аўқатланыў, витаминлер, 6 айлықтан 6 жасқа шекемги перзентлер, БАДлар, дәрилер) мағлыўмат жибереди.
// 2. Группада дәри сораған клиент пенен индивидуаль сәўбетлеседи («Кимге керек?», «Неге керек?», «Доставка керек пе?»)
//    ҳәм қатты срочно болса 930763133 (+998 93 076-31-33) номерин көрсетеди.
// 3. Группаға СМС ямаса рецепт келген замат Колл-центрдиң (930763133) жеке Телеграмына «Қараң, СМС келди!» деп ескертиў жибереди.

const fs = require('fs');
const path = require('path');
const { getTashkentNow } = require('./attendance');
const { tgApiRequest } = require('./tg_http');
const {
  POSTS_450,
  DAILY_SCHEDULE_SLOTS,
  formatPost450
} = require('./posts_450');

const DATA_DIR = path.join(__dirname, 'bot-data');
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (_) {}

const CONFIG_FILE = path.join(DATA_DIR, 'bot-config.json');
const GROUP_STATE_FILE = path.join(DATA_DIR, 'group-bot-state.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');

const CONTACT_PHONE = '930763133';
const CONTACT_PHONE_FORMATTED = '+998 93 076-31-33';

const MORNING_0800_TEXT = formatPost450(POSTS_450[0], '08:00', 1, POSTS_450.length);

function buildInitialClientReplyText(customerName, isUrgent = false) {
  const nameLabel = customerName || 'Ҳүрметли клиент';
  const urgentBanner = isUrgent
    ? `🚨 **ҚАТТЫ СРОЧНО БОЛСА ДӘРҲАЛ ҚОҢЫРАЎ ЕТИҢ:**\n📞 **${CONTACT_PHONE}** (${CONTACT_PHONE_FORMATTED})\n\n`
    : '';

  return (
    `🏥 **Ассалаўма алейкум, ${nameLabel}! «Pintok Apteka» сизиң сораўыңызды қабыл етти, тез арада жуўап қайтарамыз.**\n\n` +
    `${urgentBanner}` +
    `Фармацевтимиз сизге дәриниң дурыс мөлшерин (дозасын) ямаса ең жақсы вариантын таўып бериўи ушын айтып жиберсеңиз (ямаса төмендеги түймени басың):\n` +
    `❓ **1. Бул дәри кимге керек?** *(Үлкен адамға ма ямаса 6 айлықтан 6 жасқа шекемги перзентке ме — жасы нешеде?)*\n` +
    `❓ **2. Неге (не себептен) керек?** *(Шипакер жазып берди ме ямаса қандай белги ушын сорап атырсыз?)*\n` +
    `❓ **3. Үйге бийпул доставка (09:00–16:00) керек пе?**\n\n` +
    `⚡ **Егер қатты керек (срочно) болып атырса, мына номерге хабарласың:**\n` +
    `📞 **${CONTACT_PHONE}** (${CONTACT_PHONE_FORMATTED})`
  );
}

const AUTO_REPLY_TEXT = buildInitialClientReplyText('Ҳүрметли клиент');

function getClientInquiryInlineKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '👨 Үлкен адамға', callback_data: 'inq_who:adult' },
        { text: '👶 Перзентке (6 ай–6 жас)', callback_data: 'inq_who:child' }
      ],
      [
        { text: '📋 Рецепт бойынша', callback_data: 'inq_why:recipe' },
        { text: '🩺 Мәсләҳәт керек', callback_data: 'inq_why:advice' }
      ],
      [
        { text: '🚚 Доставка керек', callback_data: 'inq_delivery' },
        { text: '🚨 Қатты срочно — Номер', callback_data: 'inq_urgent' }
      ]
    ]
  };
}

function getGroupBotToken() {
  if (process.env.GROUP_BOT_TOKEN) return process.env.GROUP_BOT_TOKEN;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (cfg.groupBotToken) return cfg.groupBotToken;
      if (cfg.employeeBotToken) return cfg.employeeBotToken;
    }
  } catch (e) {}
  return '9093634525:AAFgoPIGrd4R4epknfjILXoquBZDnP5_ZJ0';
}

async function defaultGroupTgRequest(method, data = {}) {
  const token = getGroupBotToken();
  return tgApiRequest(token, method, data, 'Group Bot');
}

class GroupStateManager {
  constructor(filePath = GROUP_STATE_FILE) {
    this.filePath = filePath;
    this.state = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        return {
          groups: raw.groups || {},
          sentSchedules: raw.sentSchedules || {},
          globalPostIndex: typeof raw.globalPostIndex === 'number' ? raw.globalPostIndex : 0,
          callCenterChats: Array.isArray(raw.callCenterChats) ? raw.callCenterChats : []
        };
      }
    } catch (e) {}
    return {
      groups: {},
      sentSchedules: {},
      globalPostIndex: 0,
      callCenterChats: []
    };
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save group bot state:', e.message);
    }
  }

  registerGroup(chatId, title = 'Pintok Apteka Group') {
    const key = String(chatId);
    const isNew = !this.state.groups[key];
    this.state.groups[key] = {
      chatId: Number(chatId),
      title: title || (this.state.groups[key] && this.state.groups[key].title) || 'Pintok Apteka Group',
      updatedAt: new Date().toISOString(),
      active: true
    };
    this.save();
    return isNew;
  }

  getActiveGroups() {
    return Object.values(this.state.groups).filter(g => g.active !== false);
  }

  registerCallCenterChat(chatId) {
    const numId = Number(chatId);
    if (!numId) return false;
    if (!Array.isArray(this.state.callCenterChats)) {
      this.state.callCenterChats = [];
    }
    if (!this.state.callCenterChats.includes(numId)) {
      this.state.callCenterChats.push(numId);
      this.save();
      return true;
    }
    return false;
  }

  getCallCenterChats() {
    const list = new Set(Array.isArray(this.state.callCenterChats) ? this.state.callCenterChats : []);
    try {
      if (fs.existsSync(ATTENDANCE_FILE)) {
        const att = JSON.parse(fs.readFileSync(ATTENDANCE_FILE, 'utf8'));
        if (Array.isArray(att.adminChats)) {
          for (const id of att.adminChats) {
            if (id) list.add(Number(id));
          }
        }
      }
    } catch (_) {}
    return Array.from(list);
  }

  hasSentSchedule(dateStr, slotKey) {
    const dayMap = this.state.sentSchedules[dateStr] || {};
    return Boolean(dayMap[slotKey]);
  }

  markScheduleSent(dateStr, slotKey) {
    if (!this.state.sentSchedules[dateStr]) {
      this.state.sentSchedules[dateStr] = {};
    }
    this.state.sentSchedules[dateStr][slotKey] = new Date().toISOString();
    this.save();
  }

  nextPost(slotKey = '08:00') {
    const total = POSTS_450.length;
    const idx = (this.state.globalPostIndex || 0) % total;
    this.state.globalPostIndex = (idx + 1) % total;
    this.save();
    const post = POSTS_450[idx];
    const text = formatPost450(post, slotKey, idx + 1, total);
    return { post, text, postNumber: idx + 1, total };
  }
}

function getPostForSlot(slotKey, stateMgr) {
  return stateMgr.nextPost(slotKey).text;
}

function isLikelyStaffReplyToCustomer(msg) {
  if (!msg.reply_to_message) return false;
  if (msg.photo || msg.document) return false;
  const text = (msg.text || '').trim().toLowerCase();
  if (!text) return false;
  const staffAnswerPatterns = [
    /^бар\b/,
    /^жоқ\b/,
    /^жок\b/,
    /^хазир\b/,
    /^ҳәзир\b/,
    /баҳасы/,
    /бахасы/,
    /сум\b/,
    /келип алың/,
    /жибердик/,
    /жеткерип беремиз/
  ];
  return staffAnswerPatterns.some(re => re.test(text));
}

function isUrgentText(text = '') {
  const lower = String(text).toLowerCase();
  return /срочн|тез\b|қатты керек|катты керек|дәрҳал|дархал/.test(lower);
}

function buildMessageLink(chat, messageId) {
  if (!chat || !messageId) return null;
  if (chat.username) {
    return `https://t.me/${chat.username}/${messageId}`;
  }
  const strId = String(chat.id || '');
  if (strId.startsWith('-100')) {
    return `https://t.me/c/${strId.slice(4)}/${messageId}`;
  }
  return null;
}

function createGroupBotHandler({
  tgRequest = defaultGroupTgRequest,
  stateFile = GROUP_STATE_FILE,
  stateMgr = null,
  cooldownMs = 45000
} = {}) {
  stateMgr = stateMgr || new GroupStateManager(stateFile);
  const recentUserReplies = new Map();
  const activeInquiries = new Map();
  const seenMediaGroups = new Set();

  async function notifyCallCenter({
    chat,
    from,
    text,
    messageId,
    hasMedia = false,
    isFollowUp = false,
    isUrgent = false
  }) {
    const recipients = stateMgr.getCallCenterChats();
    if (recipients.length === 0) return;

    const customerName = [from && from.first_name, from && from.last_name].filter(Boolean).join(' ') || 'Клиент';
    const usernameTag = from && from.username ? ` (@${from.username})` : '';
    const groupTitle = (chat && chat.title) || 'Pintok Apteka Группасы';
    const msgLink = buildMessageLink(chat, messageId);

    const header = isUrgent
      ? `🚨 **СРОЧНО! ҚАРАҢ, ГРУППАДА КЛИЕНТ ҚАТТЫ СРОЧНО ДӘРИ СОРAП АТЫР!**`
      : isFollowUp
      ? `📩 **ҚАРАҢ, КЛИЕНТ СОРАЎҒА ҚОСЫМША ЖУЎАП ЖАЗДЫ (КИМГЕ / НЕГЕ):**`
      : `🔔 **ҚАРАҢ, ГРУППАҒА ЖАҢА СМС (ДӘРИ СОРАЎЫ) КЕЛДИ!**`;

    const alertText =
      `${header}\n\n` +
      `👥 **Группа:** ${groupTitle}\n` +
      `👤 **Клиент:** ${customerName}${usernameTag}\n` +
      `💬 **Хабар:** ${text || (hasMedia ? '📷 [Рецепт сүўрети / Файл / Даўыслы хабар]' : '—')}\n` +
      (msgLink ? `🔗 **Хабарға өтиў:** [Группада ашыў](${msgLink})\n` : '') +
      `\n👉 *Группаға кирип клиентке тез арада жуўап қайтарың!*`;

    for (const ccChatId of recipients) {
      try {
        await tgRequest('sendMessage', {
          chat_id: ccChatId,
          text: alertText,
          parse_mode: 'Markdown'
        });
        if (hasMedia && chat && chat.id && messageId) {
          await tgRequest('forwardMessage', {
            chat_id: ccChatId,
            from_chat_id: chat.id,
            message_id: messageId
          });
        }
      } catch (e) {
        console.error(`Call Center notify error (${ccChatId}):`, e.message);
      }
    }
  }

  async function broadcastSlotToAllGroups(slotKey, usePhoto = true) {
    const groups = stateMgr.getActiveGroups();
    if (groups.length === 0) return { sentCount: 0 };

    const { post, text } = stateMgr.nextPost(slotKey);
    let sentCount = 0;

    for (const grp of groups) {
      let res = null;
      if (usePhoto && post.photoUrl && text.length <= 1020) {
        res = await tgRequest('sendPhoto', {
          chat_id: grp.chatId,
          photo: post.photoUrl,
          caption: text,
          text,
          parse_mode: 'Markdown'
        });
      }
      if (!res || !res.ok) {
        res = await tgRequest('sendMessage', {
          chat_id: grp.chatId,
          text,
          parse_mode: 'Markdown'
        });
      }
      if (res && res.ok) sentCount++;
    }
    return { sentCount, text, post };
  }

  async function checkAndRunDailySchedule(nowOverride = null) {
    const now = nowOverride || getTashkentNow();
    const dateStr = now.dateStr;
    let hours = typeof now.hours === 'number' ? now.hours : null;
    let minutes = typeof now.minutes === 'number' ? now.minutes : null;
    if ((hours === null || minutes === null) && now.timeStr) {
      const [hStr, mStr] = String(now.timeStr).split(':');
      hours = parseInt(hStr, 10);
      minutes = parseInt(mStr, 10);
    }

    // Саат 08:00 ден 22:00 ге шекем ҳәр 1 саат сайын (15 СМС/күн, 00..59 минут ишинде бот қосылса да жибереди)
    const triggered = [];
    for (const slotKey of DAILY_SCHEDULE_SLOTS) {
      const slotHour = parseInt(slotKey.split(':')[0], 10);
      if (hours === slotHour && minutes >= 0 && minutes <= 59) {
        if (!stateMgr.hasSentSchedule(dateStr, slotKey)) {
          const res = await broadcastSlotToAllGroups(slotKey);
          if (res.sentCount > 0) {
            stateMgr.markScheduleSent(dateStr, slotKey);
            triggered.push(slotKey);
          }
        }
      }
    }
    return triggered;
  }

  async function handleChatMemberUpdate(chatMemberUpdate) {
    if (!chatMemberUpdate || !chatMemberUpdate.chat) return;
    const chat = chatMemberUpdate.chat;
    if (chat.type === 'group' || chat.type === 'supergroup') {
      const newStatus = chatMemberUpdate.new_chat_member && chatMemberUpdate.new_chat_member.status;
      if (newStatus === 'member' || newStatus === 'administrator') {
        const isNew = stateMgr.registerGroup(chat.id, chat.title);
        if (isNew) {
          await tgRequest('sendMessage', {
            chat_id: chat.id,
            text:
              `✅ **«Pintok Apteka» Индивидуаль Авто-ответчик ҳәм 450 Мағлыўмат боты усы группаға орнатылды!**\n\n` +
              `🤖 **Бот ўазыйпалары:**\n` +
              `1️⃣ Ҳәр күни **15 мәрте (08:00 ден 22:00 ге шекем ҳәр 1 саатта)** интернеттен сүўрет пенен дурыс аўқатланыў, витаминлер, 6 айлықтан 6 жасқа шекемги перзентлер саламатлығы ҳәм дәрилер ҳаққында **450 түрли мағлыўмат** жибереди.\n` +
              `2️⃣ Дәри сораған клиентлер менен индивидуаль сәўбетлеседи («Кимге?», «Неге?», «Доставка керек пе?») ҳәм қатты срочно болса **${CONTACT_PHONE}** номерин береди.\n` +
              `3️⃣ Группаға СМС келген замат Колл-центрдиң (**${CONTACT_PHONE}**) жеке Телеграмына ескертиў жибереди.`,
            parse_mode: 'Markdown'
          });
        }
      }
    }
  }

  async function handleGroupCallbackQuery(callbackQuery) {
    if (!callbackQuery || !callbackQuery.data) return false;
    const data = String(callbackQuery.data);
    if (!data.startsWith('inq_')) return false;

    const chat = callbackQuery.message && callbackQuery.message.chat;
    const from = callbackQuery.from || {};
    if (!chat) return false;

    const customerName = from.first_name || 'Ҳүрметли клиент';

    const labelMap = {
      'inq_who:adult': '👨 Үлкен адам ушын',
      'inq_who:child': '👶 6 айлықтан 6 жасқа шекемги перзент ушын',
      'inq_why:recipe': '📋 Шипакер рецепти бойынша',
      'inq_why:advice': '🩺 Симптом бойынша фармацевт мәсләҳәти керек',
      'inq_delivery': '🚚 Үйге бийпул доставка (09:00–16:00) керек',
      'inq_urgent': '🚨 ҚАТТЫ СРОЧНО КЕРЕК!'
    };
    const chosenLabel = labelMap[data] || data;
    const isUrgent = data === 'inq_urgent';

    try {
      await tgRequest('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: isUrgent
          ? `Срочно номер: ${CONTACT_PHONE} (+998 93 076-31-33)`
          : `Қабыл етилди: ${chosenLabel}`
      });
    } catch (_) {}

    const replyText = isUrgent
      ? `🚨 **${customerName}, егер дәри сизге қатты срочно керек болып атырса, ҳәзирдиң өзинде мына номерге хабарласың:**\n\n` +
        `📞 **${CONTACT_PHONE}** (${CONTACT_PHONE_FORMATTED})\n\n` +
        `⚡ *Бизлер Колл-центрге де «СРОЧНО!» деп белги жибердик, фармацевтимиз ҳәзир сиз бенен байланысады!*`
      : `✅ **Рахмет, ${customerName}!** Таңлаўыңыз қабыл етилди: **${chosenLabel}**.\n` +
        `Мағлыўматыңыз Колл-центрге жиберилди, фармацевтимиз тез арада жуўап жазады.\n\n` +
        `🚨 *Егер қатты керек (срочно) болып атырса, мына номерге хабарласың:* 📞 **${CONTACT_PHONE}** (${CONTACT_PHONE_FORMATTED})`;

    await tgRequest('sendMessage', {
      chat_id: chat.id,
      text: replyText,
      parse_mode: 'Markdown',
      reply_to_message_id: callbackQuery.message.message_id
    });

    await notifyCallCenter({
      chat,
      from,
      text: `${chosenLabel}`,
      messageId: callbackQuery.message.message_id,
      isFollowUp: true,
      isUrgent
    });

    return true;
  }

  async function handleGroupMessage(msg) {
    if (!msg || !msg.chat) return false;
    const chat = msg.chat;
    const isGroup = chat.type === 'group' || chat.type === 'supergroup';

    if (isGroup) {
      stateMgr.registerGroup(chat.id, chat.title);
    }

    if (msg.from && msg.from.is_bot) return true;
    if (msg.new_chat_members || msg.left_chat_member || msg.group_chat_created) {
      return true;
    }

    // Егер жеке чатта Колл-центр операторы өз телефон контактын (930763133) жиберсе
    if (!isGroup && msg.contact && msg.contact.phone_number) {
      const digits = String(msg.contact.phone_number).replace(/\D/g, '');
      if (digits.endsWith(CONTACT_PHONE)) {
        stateMgr.registerCallCenterChat(chat.id);
        await tgRequest('sendMessage', {
          chat_id: chat.id,
          text:
            `✅ **Колл-центр номери (${CONTACT_PHONE_FORMATTED}) табыслы жалғанды!**\n\n` +
            `Енди «Pintok Apteka» группасына клиентлерден СМС ямаса рецепт келген замат сизиң усы Телеграмыңызға дәрҳал ескертиў келип турады.`,
          parse_mode: 'Markdown'
        });
        return true;
      }
    }

    const rawText = (msg.text || msg.caption || '').trim();
    const cmd = rawText.split(/\s+/)[0].split('@')[0].toLowerCase();

    if (cmd === '/callcenter') {
      stateMgr.registerCallCenterChat(chat.id);
      await tgRequest('sendMessage', {
        chat_id: chat.id,
        text:
          `✅ **Сиз «Pintok Apteka» Колл-центр операторы (${CONTACT_PHONE_FORMATTED}) сыпатында дизимге алындыңыз!**\n\n` +
          `🔔 Енди группаға дәри сорап СМС ямаса рецепт келгенде ҳәм клиент «кимге / неге» сораўларына жуўап жазғанда сизиң усы Телеграмыңызға *«Қараң, группаға СМС келди!»* деп ескертиў барып турады.`,
        parse_mode: 'Markdown'
      });
      return true;
    }

    if (cmd === '/activate' || (isGroup && cmd === '/start')) {
      stateMgr.registerGroup(chat.id, chat.title);
      const nextIdx = (stateMgr.state.globalPostIndex || 0) + 1;
      await tgRequest('sendMessage', {
        chat_id: chat.id,
        text:
          `✅ **«Pintok Apteka» группа боты актив ҳалатта ислеп тур!**\n\n` +
          `🕒 **Күнделикли кесте (Күнине 15 СМС + Фото):**\n` +
          `• Саат **08:00 ден 22:00 ге шекем ҳәр 1 саат сайын** (08:00, 09:00 ... 22:00)\n` +
          `• Базадағы мағлыўматлар саны: **450 уникал пост** (Ҳәзирги гезек: **№${nextIdx}/450**)\n` +
          `• Темалар: Дурыс аўқатланыў («правильное питание»), витаминлер, 6 айлықтан 6 жасқа шекемги перзентлер саламатлығы, БАДлар ҳәм дәрилер + интернеттен фото.\n` +
          `• Индивидуаль авто-ответчик + Колл-центрге (**${CONTACT_PHONE}**) жеке ескертиў қосылған.\n\n` +
          `🧪 **Тексериў командалары:**\n` +
          `• /test_post — Гезектеги сүўретли мағлыўматты ҳәзир шығарыў\n` +
          `• /test_8 — 08:00 деги таңғы хабарды шығарыў\n` +
          `• /test_reply — Индивидуаль авто-ответчикти тексериў\n` +
          `• /callcenter — Колл-центр Телеграмын ескертиўге жалғаў`,
        parse_mode: 'Markdown'
      });
      return true;
    }

    if (cmd === '/test_post' || cmd === '/test_8' || cmd === '/test_10' || cmd === '/test_15' || cmd === '/test_19') {
      const slotMap = {
        '/test_8': '08:00',
        '/test_10': '10:00',
        '/test_15': '15:00',
        '/test_19': '19:00',
        '/test_post': '10:00'
      };
      const slotKey = slotMap[cmd] || '10:00';
      const { post, text } = stateMgr.nextPost(slotKey);
      let res = null;
      if (post.photoUrl && text.length <= 1020) {
        res = await tgRequest('sendPhoto', {
          chat_id: chat.id,
          photo: post.photoUrl,
          caption: text,
          text,
          parse_mode: 'Markdown'
        });
      }
      if (!res || !res.ok) {
        await tgRequest('sendMessage', {
          chat_id: chat.id,
          text,
          parse_mode: 'Markdown'
        });
      }
      return true;
    }

    if (cmd === '/test_reply') {
      const customerName = (msg.from && msg.from.first_name) || 'Ҳүрметли клиент';
      await tgRequest('sendMessage', {
        chat_id: chat.id,
        text: buildInitialClientReplyText(customerName, false),
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id,
        reply_markup: getClientInquiryInlineKeyboard()
      });
      return true;
    }

    if (!isGroup) {
      return false;
    }

    // Егер клиент бир неше рецепт сүўретин альбом қылып жиберсе — тек 1 мәрте жуўап қайтарамыз
    if (msg.media_group_id) {
      if (seenMediaGroups.has(msg.media_group_id)) {
        return true;
      }
      seenMediaGroups.add(msg.media_group_id);
      if (seenMediaGroups.size > 500) {
        const firstItem = seenMediaGroups.values().next().value;
        seenMediaGroups.delete(firstItem);
      }
    }

    // Хызметкердиң клиентке жазған жуўабына авто-ответчик қосылмаўы ушын
    if (isLikelyStaffReplyToCustomer(msg)) {
      return true;
    }

    const hasMedia = Boolean(msg.photo || msg.document || msg.voice);
    const hasContent = Boolean(rawText || hasMedia);
    if (!hasContent) return true;

    const userId = (msg.from && msg.from.id) ? msg.from.id : 0;
    const customerName = (msg.from && msg.from.first_name) || 'Ҳүрметли клиент';
    const inquiryKey = `${chat.id}:${userId}`;
    const nowMs = Date.now();
    const urgent = isUrgentText(rawText);

    // Тексериў: бул клиент алдынғы дәри сораўына («Кимге керек? Неге керек? Доставка керек пе?») жуўап жазып атыр ма?
    const existingInquiry = activeInquiries.get(inquiryKey);
    if (existingInquiry && ! existingInquiry.answered && (nowMs - existingInquiry.askedAt < 15 * 60 * 1000)) {
      existingInquiry.answered = true;
      existingInquiry.followUpText = rawText;
      activeInquiries.set(inquiryKey, existingInquiry);

      const followUpReply = urgent
        ? `🚨 **Рахмет, ${customerName}! Сизге дәри қатты срочно керек екенлигин Колл-центрге жибердик!**\n\n` +
          `⚡ Күтип қалмаў ушын ҳәзирдиң өзинде мына номерге қоңыраў етиң ямаса жазың:\n` +
          `📞 **${CONTACT_PHONE}** (${CONTACT_PHONE_FORMATTED})`
        : `✅ **Рахмет, ${customerName}!** Қосымша мағлыўматыңызды (*«${rawText || 'рецепт'}»*) Колл-центрге жибердик, фармацевтимиз ҳәзир сизге жуўап жазады.\n\n` +
          `🚨 **Егер қатты керек (срочно) болып атырса, мына номерге хабарласың:**\n` +
          `📞 **${CONTACT_PHONE}** (${CONTACT_PHONE_FORMATTED})`;

      await tgRequest('sendMessage', {
        chat_id: chat.id,
        text: followUpReply,
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id
      });

      await notifyCallCenter({
        chat,
        from: msg.from,
        text: rawText,
        messageId: msg.message_id,
        hasMedia,
        isFollowUp: true,
        isUrgent: urgent
      });

      return true;
    }

    const lastRepliedAt = recentUserReplies.get(inquiryKey) || 0;
    if (cooldownMs > 0 && nowMs - lastRepliedAt < cooldownMs) {
      // Cooldown ишинде жазса да Колл-центрге хабарын жиберип қоямыз
      await notifyCallCenter({
        chat,
        from: msg.from,
        text: rawText,
        messageId: msg.message_id,
        hasMedia,
        isFollowUp: true,
        isUrgent: urgent
      });
      return true;
    }

    recentUserReplies.set(inquiryKey, nowMs);
    activeInquiries.set(inquiryKey, {
      askedAt: nowMs,
      initialText: rawText,
      answered: false
    });

    await tgRequest('sendMessage', {
      chat_id: chat.id,
      text: buildInitialClientReplyText(customerName, urgent),
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
      reply_markup: getClientInquiryInlineKeyboard()
    });

    await notifyCallCenter({
      chat,
      from: msg.from,
      text: rawText,
      messageId: msg.message_id,
      hasMedia,
      isFollowUp: false,
      isUrgent: urgent
    });

    return true;
  }

  return {
    handleGroupMessage,
    handleGroupCallbackQuery,
    handleChatMemberUpdate,
    checkAndRunDailySchedule,
    broadcastSlotToAllGroups,
    notifyCallCenter,
    stateMgr
  };
}

let lastGroupUpdateId = 0;
async function pollGroupBotUpdates() {
  const groupBot = createGroupBotHandler();

  setInterval(() => {
    groupBot.checkAndRunDailySchedule().catch(err => {
      console.error('Schedule check error:', err.message);
    });
  }, 20000);

  while (true) {
    try {
      await groupBot.checkAndRunDailySchedule();
      const data = await defaultGroupTgRequest('getUpdates', {
        offset: lastGroupUpdateId + 1,
        timeout: 20
      });

      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastGroupUpdateId = update.update_id;
          if (update.my_chat_member) {
            await groupBot.handleChatMemberUpdate(update.my_chat_member);
          }
          if (update.callback_query) {
            await groupBot.handleGroupCallbackQuery(update.callback_query);
          }
          const incomingMsg = update.message || update.edited_message;
          if (incomingMsg) {
            await groupBot.handleGroupMessage(incomingMsg);
          }
        }
      }
    } catch (err) {
      console.error('Group Bot polling error:', err.message);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

module.exports = {
  AUTO_REPLY_TEXT,
  MORNING_0800_TEXT,
  POSTS_450,
  DAILY_SCHEDULE_SLOTS,
  GroupStateManager,
  createGroupBotHandler,
  getPostForSlot,
  pollGroupBotUpdates,
  buildInitialClientReplyText,
  getClientInquiryInlineKeyboard
};

if (require.main === module) {
  console.log('PINTOK APTEKA Group Auto-Responder, Call Center Notifier & 450 Posts Bot is starting...');
  pollGroupBotUpdates();
}
