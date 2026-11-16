const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  WORKPLACES,
  MAX_DISTANCE_METERS,
  PENALTY_PER_MINUTE,
  MONTHLY_EXCUSE_LIMIT,
  calculateDistanceMeters,
  calculateWorkplaceDistanceMeters,
  calculateLateness,
  calculateEarlyDeparture,
  validateContactMessage,
  validateLocationMessage,
  AttendanceManager
} = require('./attendance');

console.log('Running attendance.test.js...');

// 1. Verify constants & 4 branches with 50m radius and 3,000 sum/min penalty
assert.strictEqual(MAX_DISTANCE_METERS, 50, 'Radius must be 50 meters');
assert.strictEqual(PENALTY_PER_MINUTE, 3000, 'Penalty per minute must be 3,000 sum');
assert.strictEqual(MONTHLY_EXCUSE_LIMIT, 3, 'Monthly excuse limit must be 3 days');
assert.strictEqual(WORKPLACES.length, 4, 'Must have 4 pharmacy branches');

const b1 = WORKPLACES.find(w => w.id === 'branch_1');
const b2 = WORKPLACES.find(w => w.id === 'branch_2');
const b3 = WORKPLACES.find(w => w.id === 'branch_3');
const b4 = WORKPLACES.find(w => w.id === 'branch_4');

assert.strictEqual(b1.hasTwoShifts, true);
assert.strictEqual(b1.shifts.SHIFT_1.startTime, '08:00');
assert.strictEqual(b1.shifts.SHIFT_1.endTime, '16:00');
assert.strictEqual(b1.shifts.SHIFT_2.startTime, '16:30');
assert.strictEqual(b1.shifts.SHIFT_2.endTime, '00:00');

assert.strictEqual(b2.hasTwoShifts, false);
assert.strictEqual(b2.shifts.SHIFT_1.startTime, '08:00');
assert.strictEqual(b2.shifts.SHIFT_1.endTime, '19:00');

assert.strictEqual(b3.hasTwoShifts, true);
assert.strictEqual(b4.hasTwoShifts, true);

// 2. Verify Lateness calculation (3,000 sum per 1 minute)
assert.deepStrictEqual(calculateLateness('07:50', '08:00'), {
  isLate: false,
  lateMinutes: 0,
  penalty: 0,
  earlyMinutes: 10
});
assert.deepStrictEqual(calculateLateness('08:00', '08:00'), {
  isLate: false,
  lateMinutes: 0,
  penalty: 0,
  earlyMinutes: 0
});
assert.deepStrictEqual(calculateLateness('08:01', '08:00'), {
  isLate: true,
  lateMinutes: 1,
  penalty: 3000,
  earlyMinutes: 0
});
assert.deepStrictEqual(calculateLateness('08:10', '08:00'), {
  isLate: true,
  lateMinutes: 10,
  penalty: 30000,
  earlyMinutes: 0
});
assert.deepStrictEqual(calculateLateness('16:35', '16:30'), {
  isLate: true,
  lateMinutes: 5,
  penalty: 15000,
  earlyMinutes: 0
});

// 3. Verify Early Departure calculation (3,000 sum per 1 minute)
assert.deepStrictEqual(calculateEarlyDeparture('15:40', '16:00'), {
  isEarlyLeave: true,
  earlyLeaveMinutes: 20,
  penalty: 60000
});
assert.deepStrictEqual(calculateEarlyDeparture('16:00', '16:00'), {
  isEarlyLeave: false,
  earlyLeaveMinutes: 0,
  penalty: 0
});
assert.deepStrictEqual(calculateEarlyDeparture('18:30', '19:00'), {
  isEarlyLeave: true,
  earlyLeaveMinutes: 30,
  penalty: 90000
});
assert.deepStrictEqual(calculateEarlyDeparture('23:45', '00:00'), {
  isEarlyLeave: true,
  earlyLeaveMinutes: 15,
  penalty: 45000
});
assert.deepStrictEqual(calculateEarlyDeparture('00:02', '00:00'), {
  isEarlyLeave: false,
  earlyLeaveMinutes: 0,
  penalty: 0
});

// 4. Verify Contact Anti-Spoof & Anti-Multi-Account Binding
const contactOwn = validateContactMessage({
  from: { id: 101 },
  contact: { phone_number: '+998901234567', user_id: 101 }
});
assert.strictEqual(contactOwn.valid, true);

const contactOther = validateContactMessage({
  from: { id: 101 },
  contact: { phone_number: '+998901234567', user_id: 999 }
});
assert.strictEqual(contactOther.valid, false);
assert.strictEqual(contactOther.reason, 'NOT_OWN_CONTACT');

// 5. Test AttendanceManager full workflow: Phone binding, 50m GPS, 3-day excuse limit, and Sick Leave
const tmpFile = path.join(__dirname, 'bot-data', 'test-attendance.json');
if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

const mgr = new AttendanceManager(tmpFile);

// Manager registers phone for Мехрибан (emp_1) in Branch 1
mgr.updateEmployeePhone('emp_1', '+998901112233');

// Wrong phone attempt -> rejected
const wrongBind = mgr.bindEmployeeWithPhone({
  employeeId: 'emp_1',
  workplaceId: 'branch_1',
  rawPhone: '+998909998877',
  telegramUserId: 2001
});
assert.strictEqual(wrongBind.ok, false);
assert.strictEqual(wrongBind.error, 'PHONE_MISMATCH');

// Correct phone binds successfully
const rightBind = mgr.bindEmployeeWithPhone({
  employeeId: 'emp_1',
  workplaceId: 'branch_1',
  rawPhone: '901112233',
  telegramUserId: 2001,
  telegramUsername: 'mehri_tg'
});
assert.strictEqual(rightBind.ok, true);

// Same Telegram user (2001) or same phone trying to bind to Санавар (emp_2) -> BLOCKED!
const multiAccAttempt = mgr.bindEmployeeWithPhone({
  employeeId: 'emp_2',
  workplaceId: 'branch_1',
  rawPhone: '+998905556677',
  telegramUserId: 2001
});
assert.strictEqual(multiAccAttempt.ok, false);
assert.strictEqual(multiAccAttempt.error, 'TELEGRAM_ALREADY_BOUND_TO_OTHER');

const samePhoneAttempt = mgr.bindEmployeeWithPhone({
  employeeId: 'emp_2',
  workplaceId: 'branch_1',
  rawPhone: '+998901112233',
  telegramUserId: 2002
});
assert.strictEqual(samePhoneAttempt.ok, false);
assert.strictEqual(samePhoneAttempt.error, 'PHONE_ALREADY_BOUND_TO_OTHER');

// Check-in within 35 meters (<= 50m) -> passes!
const in35m = mgr.recordAction({
  telegramUserId: 2001,
  actionType: 'IN',
  shiftId: 'SHIFT_1',
  lat: 42.919200, // ~30m from 42.918927
  lng: 59.779079,
  dateStr: '2026-11-01',
  timeStr: '07:55'
});
assert.strictEqual(in35m.ok, true);
assert.strictEqual(in35m.record.isLate, false);
assert.ok(in35m.motivationalSms.includes('Рахмет') || in35m.motivationalSms.includes('рахмет'));

// Test 3-Day Monthly Excuse Limit:
// Day 1 late (08:10 -> 30,000 sum) -> Excuse approved -> 2 days remaining
mgr.recordAction({
  telegramUserId: 2001,
  actionType: 'IN',
  shiftId: 'SHIFT_1',
  lat: 42.918927,
  lng: 59.779079,
  dateStr: '2026-11-02',
  timeStr: '08:10'
});
const req1 = mgr.createExcuseRequest({ employeeId: 'emp_1', dateStr: '2026-11-02', reasonText: 'Автобус кешикти' });
assert.strictEqual(req1.ok, true);
const res1 = mgr.resolveExcuseRequest(req1.request.id, true);
assert.strictEqual(res1.ok, true);
assert.strictEqual(res1.limitInfo.remainingDays, 2);
assert.strictEqual(res1.dayRecord.penalty, 0);

// Day 2 late -> Excuse approved -> 1 day remaining
mgr.recordAction({
  telegramUserId: 2001,
  actionType: 'IN',
  shiftId: 'SHIFT_1',
  lat: 42.918927,
  lng: 59.779079,
  dateStr: '2026-11-03',
  timeStr: '08:05'
});
const req2 = mgr.createExcuseRequest({ employeeId: 'emp_1', dateStr: '2026-11-03', reasonText: 'Пробка' });
const res2 = mgr.resolveExcuseRequest(req2.request.id, true);
assert.strictEqual(res2.limitInfo.remainingDays, 1);

// Day 3 late -> Excuse approved -> 0 days remaining
mgr.recordAction({
  telegramUserId: 2001,
  actionType: 'IN',
  shiftId: 'SHIFT_1',
  lat: 42.918927,
  lng: 59.779079,
  dateStr: '2026-11-04',
  timeStr: '08:05'
});
const req3 = mgr.createExcuseRequest({ employeeId: 'emp_1', dateStr: '2026-11-04', reasonText: 'Үйде жумыс шықты' });
const res3 = mgr.resolveExcuseRequest(req3.request.id, true);
assert.strictEqual(res3.limitInfo.remainingDays, 0);

// Day 4 late -> Limit exhausted (0 remaining) -> Cannot create or approve excuse!
mgr.recordAction({
  telegramUserId: 2001,
  actionType: 'IN',
  shiftId: 'SHIFT_1',
  lat: 42.918927,
  lng: 59.779079,
  dateStr: '2026-11-05',
  timeStr: '08:10'
});
const req4 = mgr.createExcuseRequest({ employeeId: 'emp_1', dateStr: '2026-11-05', reasonText: 'Тағы кешиктим' });
assert.strictEqual(req4.ok, false);
assert.strictEqual(req4.error, 'EXCUSE_LIMIT_EXCEEDED');

// Test Sick Leave («🏥 Больничный»):
mgr.setSickLeave('emp_1', true, '2026-11-06');
const sickAttempt = mgr.recordAction({
  telegramUserId: 2001,
  actionType: 'IN',
  lat: 42.918927,
  lng: 59.779079,
  dateStr: '2026-11-06',
  timeStr: '08:00'
});
assert.strictEqual(sickAttempt.ok, false);
assert.strictEqual(sickAttempt.error, 'ON_SICK_LEAVE');

// Test updateWorkplaceLocation overrides static anchors and never duplicates anchors across reloads
const customLat = 42.991234;
const customLng = 59.881234;
const updRes = mgr.updateWorkplaceLocation('branch_2', customLat, customLng);
assert.strictEqual(updRes.ok, true);
assert.strictEqual(updRes.workplace.customLocation, true);
assert.strictEqual(updRes.workplace.anchors.length, 1);

const mgrReloaded = new AttendanceManager(tmpFile);
const reloadedB2 = mgrReloaded.getWorkplaces().find(w => w.id === 'branch_2');
assert.strictEqual(reloadedB2.lat, customLat);
assert.strictEqual(reloadedB2.lng, customLng);
assert.strictEqual(reloadedB2.customLocation, true);
assert.strictEqual(reloadedB2.anchors.length, 1);
const oldStaticDist = calculateWorkplaceDistanceMeters(reloadedB2, 42.933551, 59.773614);
assert.ok(oldStaticDist > MAX_DISTANCE_METERS, 'Old static branch_2 coordinates must exceed 50m after custom location update');
assert.strictEqual(calculateWorkplaceDistanceMeters(reloadedB2, customLat, customLng), 0);

if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
console.log('ALL ATTENDANCE UNIT TESTS PASSED!');
