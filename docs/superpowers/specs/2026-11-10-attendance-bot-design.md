# PINTOK APTEKA — Employee Attendance & 5-Meter Anti-Spoof Bot Design Spec

## 1. Intent & Why
The pharmacy network owner needs a single unified Telegram bot (`@apekaaabot` in `d:\Программы\pintok-apteka\bot.js`) where all 14 employees across 4 pharmacy branches and 1 central warehouse check in when arriving at work (**«🟢 Келдим»**) and check out when leaving (**«🔴 Кеттим»**). Employees must not be able to cheat their location or check in from outside a strict **5-meter** radius of their assigned workplace.

## 2. Workplaces & Employees (5 Locations, 14 Staff)
1. **Филиал №1** (`42.918927, 59.779079`, radius `5m`):
   - Мехрибан, Санавар, Жамиля, Гөзал, Гумсай, Гульжайна
2. **Филиал №2** (`42.933515, 59.773716`, radius `5m`):
   - Фируза, Ахзира
3. **Филиал №3** (`42.411680, 59.462674`, radius `5m`):
   - Айгуль, Мафтуна
4. **Филиал №4** (`42.473931, 59.609268`, radius `5m`):
   - Хурлиман, Жулдыз
5. **📦 Склад** (`42.919013, 59.778285`, radius `5m`):
   - Юсуп (Закупщик), Мухаммед (Бухгалтер)

## 3. Anti-Spoofing & 5-Meter Enforcement Rules
- **Maximum Allowed Distance:** `5.0` meters (`MAX_DISTANCE_METERS = 5`) computed via Haversine formula from the employee's assigned workplace coordinates.
- **Anti-Spoof Checks on Telegram Location Messages:**
  1. Reject forwarded messages (`msg.forward_from`, `msg.forward_date`, `msg.forward_origin`).
  2. Reject manual map-pin / venue selections (`msg.venue`).
  3. Reject stale messages (`now - msg.date > 60` seconds) or expired check-in sessions (`now - session.requestedAt > 120` seconds).
  4. Require an active `AWAITING_CHECKIN_LOCATION` or `AWAITING_CHECKOUT_LOCATION` session initiated by clicking **«🟢 Келдим»** or **«🔴 Кеттим»**.
  5. Bind each employee profile to a single Telegram `chatId` (`telegramUserId`) on first registration so one employee cannot check in on behalf of another (with an Admin reset option).
- **Lateness & Penalty Calculation:**
  - Standard start time: `08:00` (`Asia/Tashkent` / `UTC+5`).
  - Lateness after `08:00`: `10 000 сум` per started 5-minute interval (`Math.ceil(lateMinutes / 5) * 10000`).
- **Owner/Admin Real-Time Alerts & Dashboard:**
  - Owner can subscribe via **«👑 Басшы (Админ) режими»** (or `/admin`) to receive instant Telegram notifications on every check-in, check-out, and rejected/spoof attempt (with distance in meters, time, and penalty).
  - Attendance records are saved to `bot-data/attendance.json` and exposed via `server.ps1` so the web dashboard (`index.html` / `app.js`) also displays live bot check-ins.
