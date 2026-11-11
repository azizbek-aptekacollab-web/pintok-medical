# Employee Attendance & 5-Meter Anti-Spoof Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5-location (4 branches + 1 warehouse), 14-employee one-button arrival/departure («🟢 Келдим» / «🔴 Кеттим») tracking with strict 5-meter GPS verification and anti-spoofing to the PINTOK APTEKA Telegram bot and dashboard.

**Architecture:** Extract pure, testable attendance, Haversine distance, anti-spoofing validation, and persistence logic into `attendance.js`, verified by `attendance.test.js`. Integrate the employee menu, location verification flow, and admin notifications into `bot.js` and sync `bot-data/attendance.json` with `app.js`.

**Tech Stack:** Node.js (CommonJS), Telegram Bot API (`fetch` long-polling), vanilla JS (`app.js`).

**Spec:** `d:\Программы\pintok-apteka\docs\superpowers\specs\2026-11-10-attendance-bot-design.md`

## Global Constraints
- `MAX_DISTANCE_METERS = 5` (strictly `<= 5.0` meters from assigned workplace coordinates).
- 5 workplaces with exact coordinates:
  - Филиал №1: `42.918927, 59.779079`
  - Филиал №2: `42.933515, 59.773716`
  - Филиал №3: `42.411680, 59.462674`
  - Филиал №4: `42.473931, 59.609268`
  - Склад: `42.919013, 59.778285`
- 14 employees across the 5 workplaces, including `Юсуп (Закупщик)` and `Мухаммед (Бухгалтер)` at `Склад`.
- Lateness rule: `08:00` start, `10 000 сум` per started 5-minute interval late.

## Review Focus
- Forwarded location message (`forward_date` / `forward_origin`) must be rejected as a spoof attempt.
- Venue attachment (`msg.venue`) dragged on map must be rejected as a spoof attempt.
- Location at 5.0m passes; location at 5.1m or 20m fails with exact distance reported.
- Employee trying to bind to a profile already bound to another `telegramUserId` must be blocked.
- Lateness at `08:02` produces `10 000 сум` penalty; `08:00` produces `0 сум`.

---

### Task 1: Core Attendance, 5m Haversine & Anti-Spoof Engine (`attendance.js`)
**Files:**
- Create: `d:\Программы\pintok-apteka\attendance.test.js`
- Create: `d:\Программы\pintok-apteka\attendance.js`

- [ ] Write failing unit tests in `attendance.test.js` covering all 5 workplace coordinates, 14 employees, Haversine 5m boundary, spoof detection (forward, venue, stale timestamp), account binding, and lateness penalties.
- [ ] Run `attendance.test.js` with `agy-node.cmd` and verify it fails (RED).
- [ ] Implement `attendance.js` and run `attendance.test.js` until all assertions pass (GREEN).

### Task 2: Telegram Bot Integration (`bot.js`) & Web Dashboard Sync (`app.js`)
**Files:**
- Modify: `d:\Программы\pintok-apteka\bot.js`
- Modify: `d:\Программы\pintok-apteka\app.js`

- [ ] Update `bot.js` to handle employee registration, «🟢 Келдим (Жумысқа келдим)» and «🔴 Кеттим (Жумыстан шықтым)» buttons, `msg.location` events, real-time owner notifications, and daily attendance table across all 4 branches + Warehouse.
- [ ] Update `app.js` to include Warehouse (`Склад`) with Юсуп (Закупщик) and Мухаммед (Бухгалтер) and sync live attendance data from `/bot-data/attendance.json`.
- [ ] Verify syntax and test end-to-end bot handler behavior with an integration test.
