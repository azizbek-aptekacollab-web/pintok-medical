// Unit tests for Jarvis AI Proxy & F-Apteka Integration Gateway
const assert = require('assert');
const chatHandler = require('./api/jarvis-chat');
const fAptekaSync = require('./api/f-apteka-sync');

function runTests() {
  // 1. Key sanitization never leaks secret
  const leaked = chatHandler.sanitizeErrorMessage(
    'Request failed for key TEST_FAKE_KEY_123456',
    { gemini: 'TEST_FAKE_KEY_123456' }
  );
  assert.strictEqual(leaked.includes('TEST_FAKE_KEY_123456'), false, 'API key must be redacted');
  assert.strictEqual(leaked.includes('***'), true, 'Redacted marker expected');

  // 2. Message normalization
  const msgs = chatHandler.normalizeMessages([
    { role: 'user', content: '  Салем  ' },
    { role: 'assistant', content: 'Сәлем!' },
    { role: 'user', content: '   ' }
  ]);
  assert.strictEqual(msgs.length, 2);
  assert.strictEqual(msgs[0].content, 'Салем');

  // 3. F-Apteka payload normalization (Russian + English aliases)
  const normalized = fAptekaSync.normalizeFAptekaPayload({
    дата: '2026-11-23',
    филиалы: [
      { филиал: '1-Филиал', выручка: '18500000', чеки: 142, возвраты: 250000 },
      { name: '2-Филиал', revenue: 12400000, checks: 98 }
    ],
    фармацевты: [
      { имя: 'Айгуль', филиал: '1-Филиал', сумма: 9500000, чеки: 74 },
      { name: 'Гулназ', branch: '2-Филиал', sales: 7200000, checks: 55 }
    ]
  });
  assert.strictEqual(normalized.date, '2026-11-23');
  assert.strictEqual(normalized.totalRevenue, 30900000);
  assert.strictEqual(normalized.totalChecks, 240);
  assert.strictEqual(normalized.branches.length, 2);
  assert.strictEqual(normalized.pharmacists.length, 2);
  assert.strictEqual(normalized.pharmacists[0].name, 'Айгуль');

  console.log('✅ All Jarvis AI & F-Apteka tests passed!');
}

runTests();
