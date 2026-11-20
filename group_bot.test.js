const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  POSTS_450,
  DAILY_SCHEDULE_SLOTS,
  formatPost450
} = require('./posts_450');

const {
  createGroupBotHandler,
  GroupStateManager
} = require('./group_bot');

async function runGroupBotTests() {
  console.log('Running group_bot.test.js (450 posts, 15 daily slots, interactive Q&A, Call Center alerts)...');

  // 1. Verify 450 unique posts and 15 daily schedule slots
  assert.ok(Array.isArray(POSTS_450), 'POSTS_450 must be an array');
  assert.strictEqual(POSTS_450.length, 450, `Expected exactly 450 posts, got ${POSTS_450.length}`);
  assert.strictEqual(DAILY_SCHEDULE_SLOTS.length, 15, 'Expected 15 daily hourly slots (08:00..22:00)');
  assert.strictEqual(DAILY_SCHEDULE_SLOTS[0], '08:00');
  assert.strictEqual(DAILY_SCHEDULE_SLOTS[14], '22:00');

  const titles = new Set();
  const questions = new Set();
  for (let i = 0; i < POSTS_450.length; i++) {
    const p = POSTS_450[i];
    assert.ok(p && p.title && p.title.length > 5, `Post ${i} missing title`);
    assert.ok(p.body && p.body.length > 20, `Post ${i} missing body`);
    assert.ok(p.qaQuestion && p.qaQuestion.length > 5, `Post ${i} missing qaQuestion`);
    assert.ok(p.qaAnswer && p.qaAnswer.length > 10, `Post ${i} missing qaAnswer`);
    titles.add(p.title);
    questions.add(p.qaQuestion);
  }
  assert.strictEqual(titles.size, 450, `All 450 post titles must be unique, got ${titles.size}`);
  assert.strictEqual(questions.size, 450, `All 450 QA questions must be unique, got ${questions.size}`);

  const formattedSample = formatPost450(POSTS_450[0], '08:00', 1, 450);
  assert.ok(formattedSample.includes('930763133'), 'Formatted post must include contact phone 930763133');
  assert.ok(formattedSample.includes('1/450'), 'Formatted post must include post counter 1/450');

  // 2. Verify 15 daily scheduled messages across 30 days = 450 unique messages
  const tmpStateFile = path.join(__dirname, 'bot-data', 'test-group-state.json');
  if (fs.existsSync(tmpStateFile)) fs.unlinkSync(tmpStateFile);

  const sentCalls = [];
  const mockTg = async (method, payload) => {
    sentCalls.push({ method, payload });
    return { ok: true, result: { message_id: sentCalls.length } };
  };

  const handler = createGroupBotHandler({
    tgRequest: mockTg,
    stateFile: tmpStateFile,
    cooldownMs: 30000
  });

  // Register a pharmacy group (-100123456) and a Call Center operator chat (999001)
  handler.stateMgr.registerGroup(-100123456, 'Pintok Apteka Группасы');
  await handler.handleGroupMessage({
    chat: { id: 999001, type: 'private' },
    from: { id: 999001, first_name: 'Колл-центр Оператор' },
    text: '/callcenter'
  });
  assert.ok(
    handler.stateMgr.getCallCenterChats().includes(999001),
    '/callcenter must register private chat as Call Center recipient'
  );

  // Check mid-hour schedule trigger (e.g., 08:37 should still send 08:00 slot!)
  sentCalls.length = 0;
  const trig08 = await handler.checkAndRunDailySchedule({
    dateStr: '2026-11-20',
    hours: 8,
    minutes: 37
  });
  assert.deepStrictEqual(trig08, ['08:00'], '08:37 must trigger 08:00 slot if not sent yet');
  assert.strictEqual(sentCalls.length, 1);
  assert.strictEqual(sentCalls[0].payload.chat_id, -100123456);

  // Calling again in the same hour does not duplicate
  const trig08Again = await handler.checkAndRunDailySchedule({
    dateStr: '2026-11-20',
    hours: 8,
    minutes: 52
  });
  assert.deepStrictEqual(trig08Again, [], 'Must not duplicate 08:00 slot on same day');

  // Night hour (23:15 or 03:00) must not send anything
  const trigNight = await handler.checkAndRunDailySchedule({
    dateStr: '2026-11-20',
    hours: 23,
    minutes: 15
  });
  assert.deepStrictEqual(trigNight, [], 'Night hours must not send scheduled posts');

  // Simulate remaining 14 hours of day 1 (09:00..22:00)
  sentCalls.length = 0;
  for (let h = 9; h <= 22; h++) {
    const trig = await handler.checkAndRunDailySchedule({
      dateStr: '2026-11-20',
      hours: h,
      minutes: 5
    });
    assert.strictEqual(trig.length, 1, `Hour ${h}:00 must trigger 1 post`);
  }
  assert.strictEqual(sentCalls.length, 14, '14 remaining slots of the day must send 14 posts (total 15/day)');
  assert.strictEqual(handler.stateMgr.state.globalPostIndex, 15, 'After 1 full day, globalPostIndex must be 15');

  // 3. Verify Interactive Client Q&A + Urgent Phone + Call Center Notification
  sentCalls.length = 0;
  await handler.handleGroupMessage({
    message_id: 501,
    chat: { id: -100123456, type: 'supergroup', title: 'Pintok Apteka Группасы' },
    from: { id: 111222, first_name: 'Азамат', username: 'azamat_kr' },
    text: 'Ассалаўма алейкум, Цефтриаксон 1г ҳәм Лидокаин бар ма?'
  });

  // Should send 1 reply in group + 1 notification to Call Center (999001)
  const groupReply = sentCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === -100123456);
  const ccAlert = sentCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === 999001);

  assert.ok(groupReply, 'Must reply to customer in the group');
  assert.ok(groupReply.payload.text.includes('Азамат'), 'Group reply must address customer by name');
  assert.ok(groupReply.payload.text.includes('ким'), 'Group reply must ask who the medicine is for');
  assert.ok(groupReply.payload.text.includes('930763133'), 'Group reply must show urgent phone number 930763133');
  assert.ok(
    groupReply.payload.reply_markup && Array.isArray(groupReply.payload.reply_markup.inline_keyboard),
    'Group reply must include interactive inline buttons'
  );

  assert.ok(ccAlert, 'Must send real-time alert to Call Center private Telegram');
  assert.ok(ccAlert.payload.text.includes('Азамат'), 'Call Center alert must include customer name');
  assert.ok(ccAlert.payload.text.includes('Цефтриаксон'), 'Call Center alert must include requested medicine text');

  // 4. Customer replies to the individual questions ("Үлкен адамға, шамаллағанға, доставка керек")
  sentCalls.length = 0;
  await handler.handleGroupMessage({
    message_id: 502,
    chat: { id: -100123456, type: 'supergroup', title: 'Pintok Apteka Группасы' },
    from: { id: 111222, first_name: 'Азамат', username: 'azamat_kr' },
    text: 'Үлкен адамға, врач жазып берди, үйге доставка керек'
  });

  const followUpGroupReply = sentCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === -100123456);
  const followUpCcAlert = sentCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === 999001);

  assert.ok(followUpGroupReply, 'Must confirm customer follow-up details in group');
  assert.ok(followUpGroupReply.payload.text.includes('930763133'), 'Follow-up confirmation must include phone number');
  assert.ok(followUpCcAlert, 'Must forward customer follow-up details to Call Center');
  assert.ok(followUpCcAlert.payload.text.includes('үйге доставка керек'), 'Call Center must receive follow-up details');

  // 5. Customer clicks inline button "🚨 Қатты срочно" (callback_query)
  sentCalls.length = 0;
  await handler.handleGroupCallbackQuery({
    id: 'cb_1',
    from: { id: 111222, first_name: 'Азамат', username: 'azamat_kr' },
    message: {
      message_id: 503,
      chat: { id: -100123456, type: 'supergroup', title: 'Pintok Apteka Группасы' }
    },
    data: 'inq_urgent'
  });

  const urgentGroupMsg = sentCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === -100123456);
  const urgentCcMsg = sentCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === 999001);
  assert.ok(urgentGroupMsg && urgentGroupMsg.payload.text.includes('930763133'), 'Urgent button must display phone number prominently');
  assert.ok(urgentCcMsg && urgentCcMsg.payload.text.includes('СРОЧНО'), 'Urgent button must alert Call Center as СРОЧНО');

  // 6. Staff reply in group must not trigger auto-responder
  sentCalls.length = 0;
  await handler.handleGroupMessage({
    message_id: 504,
    chat: { id: -100123456, type: 'supergroup', title: 'Pintok Apteka Группасы' },
    from: { id: 777888, first_name: 'Фармацевт Мехри' },
    reply_to_message: { message_id: 501 },
    text: 'Бар, баҳасы 18 000 сум, ҳәзир жеткерип беремиз'
  });
  assert.strictEqual(sentCalls.length, 0, 'Staff reply must not trigger customer auto-responder');

  if (fs.existsSync(tmpStateFile)) fs.unlinkSync(tmpStateFile);
  console.log('ALL GROUP BOT 450 POSTS & INTERACTIVE Q&A TESTS PASSED!');
}

runGroupBotTests().catch(err => {
  console.error(err);
  process.exit(1);
});
