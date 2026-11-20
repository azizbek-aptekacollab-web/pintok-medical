# «Pintok Apteka» Group Bot (450 Posts, 15 Daily Messages, Interactive Client Q&A & Call Center Alert) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 450-post Karakalpak health/nutrition/medicine knowledge base (`posts_450.js`) and upgrade `group_bot.js` to send 15 scheduled messages per day (`08:00`–`22:00` hourly), conduct an interactive individual Q&A with customers asking for medicines in the group (with urgent phone contact `930763133`), and immediately notify the Call Center (`930763133`) in private Telegram.

**Architecture:** A standalone module `posts_450.js` exports 450 unique, non-repeating structured posts in Karakalpak Cyrillic covering healthy nutrition (`правильное питание`), vitamins/minerals, pharmacy medicines, supplements (`БАДлар`), and herbal remedies, each with a Q&A and pharmacy delivery footer. `group_bot.js` manages the 15 daily hourly slots (`08:00`..`22:00`), tracks the `0..449` cycle in `bot-data/group-bot-state.json`, runs a two-step interactive client inquiry dialogue (text or inline callback buttons) showing the urgent number `930763133`, and pushes real-time alerts + forwarded media to registered Call Center and Admin Telegram chats.

**Tech Stack:** Node.js (CommonJS, zero external npm dependencies), Telegram Bot HTTP API (`tg_http.js`).

**Spec:** `d:\Программы\pintok-apteka\docs\superpowers\specs\2026-11-20-group-bot-450-posts-design.md`

## Global Constraints

- All user-facing messages must be in clean Karakalpak Cyrillic (`ў`, `ҳ`, `қ`, `ғ`, `ң`, `ә`, `ө`, `ү`, `ы`).
- Contact phone: `930763133` (`+998 93 076-31-33`), free delivery hours: `09:00`–`16:00`.
- Daily schedule: 15 hourly slots from `08:00` through `22:00` inclusive (`["08:00", "09:00", ..., "22:00"]`), total 450 unique posts per 30-day cycle (`POSTS_450.length === 450`).
- Zero external npm dependencies; run tests via `"C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd"`.

## Review Focus

- Late-started bot within any hour (`08:00`–`22:59`, minutes `00`–`59`) must still send that hour's post once per day without skipping.
- Album/multi-photo prescription uploads (`media_group_id`) must trigger only one group reply while still forwarding/notifying Call Center.
- Staff replies in the group (`Бар`, `Жоқ`, `Баҳасы`, `Жеткерип беремиз`, or messages from registered Call Center / Admin users) must never trigger customer auto-reply.
- Customer follow-up reply (answering "who is it for / why" or pressing inline buttons) must send a confirmation in the group and a follow-up update to Call Center without re-sending the initial 3-question prompt.
- Urgent keywords (`срочно`, `тез`, `ҳәзир`, `қатты керек`) or pressing the `[🚨 Қатты срочно]` inline button must highlight `930763133` (`+998 93 076-31-33`) and send an urgent flag to Call Center.

---

### Task 1: 450 Unique Karakalpak Health, Nutrition & Medicine Posts (`posts_450.js`)

**Files:**
- Create: `d:\Программы\pintok-apteka\posts_450.js`
- Test: `d:\Программы\pintok-apteka\group_bot.test.js`

**Interfaces:**
- Produces: `POSTS_450` (Array of 450 objects `{ id: number, category: string, badge: string, title: string, body: string, qaQuestion: string, qaAnswer: string }`), `DAILY_SCHEDULE_SLOTS` (`["08:00", "09:00", ..., "22:00"]`, length 15), `formatPost450(post, slotKey, postNumber, totalPosts)`.

- [ ] **Step 1: Create `posts_450.js` with 450 unique, rich Karakalpak posts across 15 daily thematic categories (30 days × 15 slots = 450 posts)**
- [ ] **Step 2: Verify `POSTS_450.length === 450` and uniqueness of titles/questions in `group_bot.test.js`**

### Task 2: Upgrade `group_bot.js` & `bot.js` for 15 Daily Messages, Individual Client Q&A, Urgent Number & Call Center Alerts

**Files:**
- Modify: `d:\Программы\pintok-apteka\group_bot.js`
- Modify: `d:\Программы\pintok-apteka\bot.js`
- Modify: `d:\Программы\pintok-apteka\start_all.js`
- Test: `d:\Программы\pintok-apteka\group_bot.test.js`

**Interfaces:**
- Consumes: `POSTS_450`, `DAILY_SCHEDULE_SLOTS`, `formatPost450` from `./posts_450`.
- Produces: `createGroupBotHandler({ tgRequest, notifyCallCenterFn, stateFile, stateMgr, cooldownMs })` with `handleGroupMessage(msg)`, `handleGroupCallbackQuery(callbackQuery)`, `handleChatMemberUpdate(update)`, `checkAndRunDailySchedule(nowOverride)`.

- [ ] **Step 1: Update `GroupStateManager` in `group_bot.js` to track `globalPostIndex` (0..449), `callCenterChats`, `groups`, and `sentSchedules` for all 15 hourly slots (`08:00`..`22:00`)**
- [ ] **Step 2: Implement individual client inquiry dialogue (`clientInquiries` session map + inline keyboard buttons + urgent phone response) and Call Center private Telegram notifications (`notifyCallCenter` + `forwardMessage`)**
- [ ] **Step 3: Wire `callback_query` in `group_bot.js` and `bot.js`, and ensure `start_all.js` runs the group bot cleanly**
- [ ] **Step 4: Run `group_bot.test.js` and `bot.test.js` to verify all tests pass**
