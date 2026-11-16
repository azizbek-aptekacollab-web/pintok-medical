const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  createBotHandler,
  getEmployeeMainKeyboard,
  getLocationRequestKeyboard
} = require('./bot');
const { createAdminBotHandler } = require('./admin_bot');
const { AttendanceManager } = require('./attendance');

async function runTests() {
  console.log('Running bot.test.js (Employee Bot + Admin Bot end-to-end)...');
  const mainKb = getEmployeeMainKeyboard();
  assert.deepStrictEqual(mainKb.keyboard[0], [
    { text: '🔵 Келдим', style: 'primary' },
    { text: '🔴 Кеттим', style: 'danger' }
  ]);
  const inLocKb = getLocationRequestKeyboard('IN');
  assert.strictEqual(inLocKb.keyboard[0][0].style, 'primary');
  assert.ok(inLocKb.keyboard[0][0].text.includes('🔵'));
  const outLocKb = getLocationRequestKeyboard('OUT');
  assert.strictEqual(outLocKb.keyboard[0][0].style, 'danger');
  assert.ok(outLocKb.keyboard[0][0].text.includes('🔴'));
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
    employeeTgRequest: mockEmpTg,
    attendanceMgr: attMgr
  });

  // 1. Manager starts Admin Bot & adds Мехри with phone number via quick line: "1-Филиал Мехри +998994568584"
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Управляющий' },
    text: '/start'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Управляющий' },
    text: '1-Филиал Мехри +998994568584'
  });

  const emp1 = attMgr.getEmployees('branch_1').find(e => e.name === 'Мехри');
  assert.strictEqual(emp1.phone, '+998994568584');

  // 2. Мехри (chatId 501) enters Employee Bot -> selects 1-Филиал -> Мехри -> sends her own phone contact
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Мехри' },
    text: '🔵 Келдим'
  });
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Мехри' },
    text: '1-Филиал'
  });
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Мехри' },
    text: '👤 Мехри (Фармацевт)'
  });

  // Send contact
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Мехри' },
    contact: { phone_number: '+998994568584', user_id: 501 }
  });

  const bound = attMgr.getEmployeeByTelegramId(501);
  assert.ok(bound && bound.employee.name === 'Мехри', 'Мехри must be bound via phone contact');

  // 3. Because 1-Филиал has 2 shifts, bot asks her to select 1-смена (08:00-16:00) or 2-смена (16:30-00:00)
  assert.ok(
    empMessages.some(m => m.payload.text && m.payload.text.includes('СМЕНАНЫ ТАҢЛАҢ')),
    'Bot must prompt for shift selection in Branch 1'
  );

  // She selects 1-смена (08:00 – 16:00)
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Мехри' },
    text: '☀️ 1-смена (08:00 – 16:00)'
  });

  // 4. She sends GPS location from 120m away (> 50m) -> REJECTED!
  empMessages.length = 0;
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Мехри' },
    date: Math.floor(Date.now() / 1000),
    location: { latitude: 42.920200, longitude: 59.779079 } // ~140m away
  });
  assert.ok(
    empMessages.some(m => m.payload.text.includes('50 метр')),
    'Must reject location > 50m and show 50m limit'
  );

  // 5. Manager opens «🏥 Больничный» for Мехри from Admin Bot -> Employee sees it and cannot check in
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Управляющий' },
    text: '🏥 Больничный басқарыў'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Управляющий' },
    text: '1-Филиал'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Управляющий' },
    text: 'Мехри'
  });
  empMessages.length = 0;
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Управляющий' },
    text: '🏥 Больничный АШЫЎ (Аўырып қалды)'
  });

  assert.strictEqual(attMgr.getEmployeeById('emp_1').onSickLeave, true);
  assert.ok(
    empMessages.some(m => m.payload.chat_id === 501 && m.payload.text.includes('Больничный')),
    'Employee notified when Manager opens Sick Leave'
  );

  // Employee tries to press «🟢 Келдим» while on Sick Leave -> told she is on Sick Leave
  empMessages.length = 0;
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Мехри' },
    text: '🔵 Келдим'
  });
  assert.ok(
    empMessages.some(m => m.payload.text.includes('СИЗДЕ «БОЛЬНИЧНЫЙ» АШЫЛҒАН')),
    'Employee on sick leave is not asked for location'
  );

  // Manager closes «🏥 Больничный»
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Управляющий' },
    text: '🏥 Больничный басқарыў'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Управляющий' },
    text: '1-Филиал'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Управляющий' },
    text: 'Мехри'
  });
  await adminBot.handleAdminMessage({
    chat: { id: 777 },
    from: { id: 777, first_name: 'Управляющий' },
    text: '🟢 Больничныйды ЖАБЫЎ (Жумысқа шықты)'
  });
  assert.strictEqual(attMgr.getEmployeeById('emp_1').onSickLeave, false);

  // 6. Employee checks «📅 Календарь»
  empMessages.length = 0;
  await empBot.handleUserMessage({
    chat: { id: 501 },
    from: { id: 501, first_name: 'Мехрибан' },
    text: '📅 Календарь'
  });
  assert.ok(
    empMessages[0].payload.text.includes('АЙЛЫҚ КАЛЕНДАРЬ') &&
    empMessages[0].payload.text.includes('3 күн'),
    'Calendar must display monthly history and 3-day excuse limit'
  );

  if (fs.existsSync(tmpAttFile)) fs.unlinkSync(tmpAttFile);
  console.log('ALL EMPLOYEE & ADMIN BOT E2E TESTS PASSED!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
