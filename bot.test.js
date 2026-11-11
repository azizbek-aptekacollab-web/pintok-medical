const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { createBotHandler } = require('./bot');
const { createAdminBotHandler } = require('./admin_bot');
const { AttendanceManager } = require('./attendance');

async function runTests() {
  console.log('Running bot.test.js (Employee Bot + Admin Bot)...');
  const tmpAttFile = path.join(__dirname, 'bot-data', 'test-bot-att.json');
  if (fs.existsSync(tmpAttFile)) fs.unlinkSync(tmpAttFile);

  const empMessages = [];
  const adminMessages = [];

  const mockEmpTg = async (method, payload) => {
    empMessages.push({ method, payload });
    return { ok: true };
  };
  const mockAdminTg = async (method, payload) => {
    adminMessages.push({ method, payload });
    return { ok: true };
  };

  const attMgr = new AttendanceManager(tmpAttFile);
  const empBot = createBotHandler({
    tgRequest: mockEmpTg,
    adminTgRequest: mockAdminTg,
    attendanceMgr: attMgr
  });
  const adminBot = createAdminBotHandler({
    tgRequest: mockAdminTg,
    attendanceMgr: attMgr
  });

  // 1. Owner starts Admin Bot -> registered for real-time notifications
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Азизбек' },
    text: '/start'
  });
  assert.ok(attMgr.getAdminChats().includes(777), 'Owner chat 777 must be registered in Admin Bot');

  // 2. Yusup (chatId 501) starts Employee Bot -> binds to Warehouse -> Yusup (Закупщик)
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Юсуп' },
    text: '🟢 Келдим'
  });
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Юсуп' },
    text: '📦 Склад'
  });
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Юсуп' },
    text: '👤 Юсуп (Закупщик)'
  });

  const bound = attMgr.getEmployeeByTelegramId(501);
  assert.ok(bound && bound.employee.name === 'Юсуп', 'Yusup must be bound to chatId 501');

  // 3. Employee cannot change profile or access admin commands in Employee Bot
  empMessages.length = 0;
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Юсуп' },
    text: '👤 Мениң профилим'
  });
  assert.ok(
    empMessages[0].payload.text.includes('өзгерте алмайсыз'),
    'Bound employee must not be allowed to change profile'
  );

  // 4. Yusup sends location from 25m away -> REJECTED (> 4m) and Owner notified in Admin Bot!
  empMessages.length = 0;
  adminMessages.length = 0;
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Юсуп' },
    text: '🟢 Келдим'
  });
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Юсуп' },
    date: Math.floor(Date.now() / 1000),
    location: { latitude: 42.919230, longitude: 59.778285 } // ~45m away
  });
  assert.ok(empMessages.some(m => m.payload.text.includes('4 метр')), 'Employee told max radius is 4m');
  assert.ok(adminMessages.some(m => m.payload.chat_id === 777 && m.payload.text.includes('Юсуп')), 'Owner notified in Admin Bot');

  // 5. Yusup checks in within 4m -> ACCEPTED!
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Юсуп' },
    text: '🟢 Келдим'
  });
  empMessages.length = 0;
  adminMessages.length = 0;
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Юсуп' },
    date: Math.floor(Date.now() / 1000),
    location: { latitude: 42.918828, longitude: 59.778217 } // ~0.3m away
  });
  assert.ok(empMessages.some(m => m.payload.text.includes('ДИЗИМГЕ АЛЫНДЫ')), 'Check-in within 4m succeeded');
  assert.ok(adminMessages.some(m => m.payload.chat_id === 777 && m.payload.text.includes('ЖУМЫСҚА КЕЛДИ')), 'Owner notified of arrival');

  // 6. Yusup presses dedicated button "💰 Штрафым ҳәм 1 млн бонус"
  empMessages.length = 0;
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Юсуп' },
    text: '💰 Штрафым ҳәм 1 млн бонус'
  });
  const bonusReply = empMessages[0].payload.text;
  assert.ok(bonusReply.includes('1 000 000'), 'Must display 1,000,000 sum bonus info');
  assert.ok(bonusReply.includes('10 000'), 'Must display 10,000 sum per 5 min rule');

  // 7. Owner in Admin Bot adds a new employee ("Сардор", "Экспедитор") to Warehouse
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Азизбек' },
    text: '➕ Хызметкер қосыў'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Азизбек' },
    text: '📦 Склад'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Азизбек' },
    text: 'Сардор'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Азизбек' },
    text: 'Экспедитор'
  });
  assert.ok(attMgr.getEmployees('warehouse').some(e => e.name === 'Сардор'), 'Owner added new employee via Admin Bot');

  // 8. Owner in Admin Bot forgives Yusup's monthly penalties
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Азизбек' },
    text: '⚖️ Штрафты өзгертиў / Кешириў'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Азизбек' },
    text: '📦 Склад'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Азизбек' },
    text: '👤 Юсуп (Закупщик)'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Азизбек' },
    text: '🧹 Айлық штраflарын 0 сум етиў (1 млн бонусты тиклеў)'
  });

  const yusupStatsAfter = attMgr.getEmployeeMonthlyStats('emp_13');
  assert.strictEqual(yusupStatsAfter.totalPenalty, 0, 'Yusup penalty must be cleared to 0 by Owner');
  assert.strictEqual(yusupStatsAfter.bonusEligible, true, 'Yusup 1M bonus eligibility restored');

  if (fs.existsSync(tmpAttFile)) fs.unlinkSync(tmpAttFile);
  console.log('ALL EMPLOYEE & ADMIN BOT TESTS PASSED!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
