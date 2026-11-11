const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  WORKPLACES,
  EMPLOYEES,
  MAX_DISTANCE_METERS,
  MONTHLY_BONUS_SUM,
  PENALTY_PER_5_MIN,
  calculateDistanceMeters,
  calculateLateness,
  validateLocationMessage,
  AttendanceManager
} = require('./attendance');

console.log('Running attendance.test.js...');

// 1. Verify constants, 5 workplaces, and exact coordinates
assert.strictEqual(MAX_DISTANCE_METERS, 4, 'Max distance must be strictly 4 meters');
assert.strictEqual(MONTHLY_BONUS_SUM, 1000000, 'Monthly bonus for 0 lateness must be 1,000,000 sum');
assert.strictEqual(PENALTY_PER_5_MIN, 10000, 'Penalty per 5 minutes must be 10,000 sum');
assert.strictEqual(WORKPLACES.length, 5, 'Must have 5 workplaces (4 branches + 1 warehouse)');

const f1 = WORKPLACES.find(w => w.id === 'branch_1');
const f2 = WORKPLACES.find(w => w.id === 'branch_2');
const f3 = WORKPLACES.find(w => w.id === 'branch_3');
const f4 = WORKPLACES.find(w => w.id === 'branch_4');
const wh = WORKPLACES.find(w => w.id === 'warehouse');

assert.strictEqual(f1.lat, 42.918927);
assert.strictEqual(f1.lng, 59.779079);
assert.strictEqual(f2.lat, 42.920301);
assert.strictEqual(f2.lng, 59.790651);
assert.strictEqual(f3.lat, 42.411627);
assert.strictEqual(f3.lng, 59.46304);
assert.strictEqual(f4.lat, 42.473931);
assert.strictEqual(f4.lng, 59.609268);
assert.strictEqual(wh.lat, 42.918825);
assert.strictEqual(wh.lng, 59.778217);

// 2. Verify 16 default employees including Ilham & Sapargul in Branch 1 and Yusup & Muhammed in Warehouse
assert.strictEqual(EMPLOYEES.length, 16, 'Must have 16 default employees');
const b1Staff = EMPLOYEES.filter(e => e.workplaceId === 'branch_1');
assert.ok(b1Staff.some(e => e.name === 'Ильхам' && e.role === 'Кассир'), 'Ilham must be Cashier in Branch 1');
assert.ok(b1Staff.some(e => e.name === 'Сапаргуль' && e.role === 'Фармацевт'), 'Sapargul must be Pharmacist in Branch 1');
const whStaff = EMPLOYEES.filter(e => e.workplaceId === 'warehouse');
assert.strictEqual(whStaff.length, 2, 'Warehouse must have 2 employees');
assert.ok(whStaff.some(e => e.name === 'Юсуп' && e.role === 'Закупщик'), 'Yusup must be Purchaser in Warehouse');
assert.ok(whStaff.some(e => e.name === 'Мухаммед' && e.role === 'Бухгалтер'), 'Muhammed must be Accountant in Warehouse');

// 3. Verify Haversine distance calculation
assert.strictEqual(calculateDistanceMeters(42.918927, 59.779079, 42.918927, 59.779079), 0);
const d3 = calculateDistanceMeters(42.918927, 59.779079, 42.918954, 59.779079);
assert.ok(d3 > 2.5 && d3 <= 5.0, `Expected ~3m to be <= 5m, got ${d3}`);
const d8 = calculateDistanceMeters(42.918927, 59.779079, 42.918999, 59.779079);
assert.ok(d8 > 5.0, `Expected ~8m to exceed 5m, got ${d8}`);

// 4. Anti-spoofing checks
const nowSec = Math.floor(Date.now() / 1000);
assert.strictEqual(
  validateLocationMessage(
    { date: nowSec, forward_date: nowSec - 10, location: { latitude: 42.918927, longitude: 59.779079 } },
    { requestedAt: nowSec * 1000 - 2000 },
    nowSec * 1000
  ).reason,
  'FORWARDED_LOCATION'
);
assert.strictEqual(
  validateLocationMessage(
    { date: nowSec, venue: { title: 'Fake' }, location: { latitude: 42.918927, longitude: 59.779079 } },
    { requestedAt: nowSec * 1000 - 2000 },
    nowSec * 1000
  ).reason,
  'MANUAL_VENUE_PIN'
);

// 5. Lateness calculation (08:00 start, 10,000 sum per 5 min)
assert.deepStrictEqual(calculateLateness('07:55'), { isLate: false, lateMinutes: 0, penalty: 0 });
assert.deepStrictEqual(calculateLateness('08:00'), { isLate: false, lateMinutes: 0, penalty: 0 });
assert.deepStrictEqual(calculateLateness('08:02'), { isLate: true, lateMinutes: 2, penalty: 10000 });
assert.deepStrictEqual(calculateLateness('08:12'), { isLate: true, lateMinutes: 12, penalty: 30000 });

// 6. Monthly stats, 1,000,000 bonus & Admin management (add/remove employee, forgive/edit penalty)
const tmpFile = path.join(__dirname, 'bot-data', 'test-attendance.json');
if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

const mgr = new AttendanceManager(tmpFile);

// Bind Muhammed (emp_14) to TG user 1002 and check in ON TIME on 2 days -> eligible for 1,000,000 bonus!
mgr.bindEmployee('emp_14', 1002, 'muhammed_tg');
mgr.recordAction({
  telegramUserId: 1002,
  actionType: 'IN',
  lat: 42.918825,
  lng: 59.778217,
  dateStr: '2026-11-01',
  timeStr: '07:58'
});
mgr.recordAction({
  telegramUserId: 1002,
  actionType: 'IN',
  lat: 42.918825,
  lng: 59.778217,
  dateStr: '2026-11-02',
  timeStr: '08:00'
});

const muhammedMonth = mgr.getEmployeeMonthlyStats('emp_14', '2026-11');
assert.strictEqual(muhammedMonth.totalDaysWorked, 2);
assert.strictEqual(muhammedMonth.lateDaysCount, 0);
assert.strictEqual(muhammedMonth.totalPenalty, 0);
assert.strictEqual(muhammedMonth.bonusEligible, true);
assert.strictEqual(muhammedMonth.bonusAmount, 1000000);

// Bind Yusup (emp_13) to TG user 1001 and check in LATE on 2 days (08:03 -> 10,000; 08:12 -> 30,000) -> 40,000 penalty
mgr.bindEmployee('emp_13', 1001, 'yusup_tg');
mgr.recordAction({
  telegramUserId: 1001,
  actionType: 'IN',
  lat: 42.918825,
  lng: 59.778217,
  dateStr: '2026-11-01',
  timeStr: '08:03'
});
mgr.recordAction({
  telegramUserId: 1001,
  actionType: 'IN',
  lat: 42.918825,
  lng: 59.778217,
  dateStr: '2026-11-02',
  timeStr: '08:12'
});

let yusupMonth = mgr.getEmployeeMonthlyStats('emp_13', '2026-11');
assert.strictEqual(yusupMonth.totalDaysWorked, 2);
assert.strictEqual(yusupMonth.lateDaysCount, 2);
assert.strictEqual(yusupMonth.totalPenalty, 40000);
assert.strictEqual(yusupMonth.bonusEligible, false);
assert.strictEqual(yusupMonth.bonusAmount, 0);

// Admin forgives Yusup's monthly penalties -> bonus restored to 1,000,000 and totalPenalty = 0!
mgr.clearMonthlyPenalties('emp_13', '2026-11');
yusupMonth = mgr.getEmployeeMonthlyStats('emp_13', '2026-11');
assert.strictEqual(yusupMonth.totalPenalty, 0);
assert.strictEqual(yusupMonth.lateDaysCount, 0);
assert.strictEqual(yusupMonth.bonusEligible, true);
assert.strictEqual(yusupMonth.bonusAmount, 1000000);

// Admin sets a custom penalty for Yusup on 2026-11-02 (e.g., 50,000 sum)
mgr.setDayPenalty('emp_13', '2026-11-02', 50000);
yusupMonth = mgr.getEmployeeMonthlyStats('emp_13', '2026-11');
assert.strictEqual(yusupMonth.totalPenalty, 50000);
assert.strictEqual(yusupMonth.bonusEligible, false);

// Admin dynamically adds a new employee to Branch 1 and then removes them
const addRes = mgr.addEmployee({ workplaceId: 'branch_1', name: 'Дилноза', role: 'Фармацевт' });
assert.strictEqual(addRes.ok, true);
assert.strictEqual(mgr.getEmployees().length, 17);

const remRes = mgr.removeEmployee(addRes.employee.id);
assert.strictEqual(remRes.ok, true);
assert.strictEqual(mgr.getEmployees().length, 16);

if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
console.log('ALL TESTS PASSED!');
