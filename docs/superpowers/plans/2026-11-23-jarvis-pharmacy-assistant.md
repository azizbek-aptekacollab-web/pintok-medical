# Jarvis Pharmacy AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build **Jarvis**, a mobile-first installable PWA personal AI assistant for the manager of PINTOK APTEKA (4 branches), with multi-AI support (Gemini active via `.env`, plus ChatGPT, Claude, OpenRouter), live staff attendance integration, a plug-and-play F-Apteka integration gateway (Webhook + Pull API + Excel/CSV & Photo reader), competitor tracking, and sales-growth ideation.

**Architecture:** Zero-dependency CommonJS Node.js backend endpoints (`api/jarvis-chat.js`, `api/jarvis-data.js`, `api/f-apteka-sync.js`) wired into both Vercel serverless (`api/*.js`) and the local HTTP server (`start_all.js`), paired with a standalone mobile-first PWA (`jarvis.html`, `jarvis.css`, `jarvis.js`, `jarvis-manifest.json`) linked from `index.html`.

**Tech Stack:** Vanilla HTML5 / CSS3 / ES2020 JavaScript (PWA), Node.js >= 18 built-in `http`/`https`/`fs` (zero npm dependencies).

**Spec:** [2026-11-23-jarvis-pharmacy-assistant-design.md](file:///d:/Программы/pintok-apteka/docs/superpowers/specs/2026-11-23-jarvis-pharmacy-assistant-design.md)

## Global Constraints
- Zero external npm dependencies in `pintok-apteka` (`package.json` stays dependency-free).
- Never commit or hardcode API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `F_APTEKA_API_TOKEN`) into git or client files.
- Never break existing `index.html`, `bot.js`, `admin_bot.js`, `attendance.js`, or existing tests.
- UI language: Karakalpak Cyrillic (`ў` for `w`, pure Karakalpak terminology); AI chat responds in Karakalpak or Russian based on user input.
- Must work identically on local Node server (`start_all.js`) and Vercel (`api/*.js`), with graceful `localStorage` fallback when serverless filesystem is read-only.

## Review Focus
- Read-only filesystem on Vercel when saving sales/competitors: `api/jarvis-data.js` and `api/f-apteka-sync.js` must return `{ ok: true, persistedToDisk: false, data }` instead of crashing with `EROFS`, so the client still stores to `localStorage`.
- Missing or invalid API key for a selected provider: `/api/jarvis-chat` returns a clear JSON error `{ ok: false, error, code: 'MISSING_KEY' | 'PROVIDER_ERROR' }` without leaking any key string.
- F-Apteka webhook payload variations (Russian/Latin/nested field names, missing branch ID, invalid token): `normalizeFAptekaPayload()` handles common F-Apteka field aliases and rejects unauthorized requests with `401`.
- Large F-Apteka screenshot uploads: client resizes/compresses images before base64 upload so Vercel's 4.5 MB body limit is never exceeded.
- Missing `bot-data/attendance.json` on fresh deploy: `/api/jarvis-data` returns an empty 4-branch structure without throwing `ENOENT`.

---

### Task 1: Security & Environment Setup (`.gitignore`, `.env`, `.env.example`, `jarvis_env.js`)

**Files:**
- Create: `d:\Программы\pintok-apteka\.gitignore`
- Create: `d:\Программы\pintok-apteka\.env` (gitignored, stores user's `GEMINI_API_KEY`)
- Create: `d:\Программы\pintok-apteka\.env.example`
- Create: `d:\Программы\pintok-apteka\jarvis_env.js`

**Interfaces:**
- Produces: `loadEnv()` and `getEnv(key, fallback)` in `jarvis_env.js` (loads key-value pairs from `.env` into `process.env` without overwriting existing env vars).

- [ ] **Step 1:** Create `.gitignore` ignoring `.env`, `.env.local`, `bot-data/jarvis-secrets.json`, `node_modules/`.
- [ ] **Step 2:** Create `.env.example` documenting `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `F_APTEKA_API_URL`, `F_APTEKA_API_TOKEN`, `F_APTEKA_WEBHOOK_SECRET`.
- [ ] **Step 3:** Create `.env` locally with the user's `GEMINI_API_KEY` and a generated local `F_APTEKA_WEBHOOK_SECRET`.
- [ ] **Step 4:** Implement `jarvis_env.js` exporting `{ loadEnv, getEnv }` with zero dependencies.

---

### Task 2: Multi-AI Backend Proxy (`api/jarvis-chat.js`)

**Files:**
- Create: `d:\Программы\pintok-apteka\api\jarvis-chat.js`
- Create: `d:\Программы\pintok-apteka\jarvis_ai.test.js`

**Interfaces:**
- Consumes: `loadEnv()` from `../jarvis_env`
- Produces: Vercel/Node handler `POST /api/jarvis-chat` accepting `{ provider, model, messages, systemPrompt, imageBase64, imageMimeType, clientKeys, council }` and returning `{ ok, provider, model, reply, councilReplies?, configuredProviders }`, plus `GET /api/jarvis-chat` returning `{ ok: true, configuredProviders }` (booleans only, never key values).

- [ ] **Step 1:** Implement `api/jarvis-chat.js` supporting:
  - `gemini` (`gemini-2.5-flash` default, multimodal image + text via Google Generative Language REST API)
  - `openai` (`gpt-4o-mini` / `gpt-4o` via OpenAI Chat Completions REST API)
  - `claude` (`claude-3-5-sonnet-latest` via Anthropic Messages REST API)
  - `openrouter` (unified OpenRouter REST API supporting OpenAI/Claude/Gemini model IDs)
  - `council: true` mode querying all configured providers in parallel and returning comparative replies.
- [ ] **Step 2:** Write unit tests in `jarvis_ai.test.js` verifying provider key resolution, missing-key error handling, payload builders, and that `GET` never leaks raw API keys.

---

### Task 3: Live Data & F-Apteka Integration Gateway (`api/jarvis-data.js`, `api/f-apteka-sync.js`, `start_all.js`)

**Files:**
- Create: `d:\Программы\pintok-apteka\api\jarvis-data.js`
- Create: `d:\Программы\pintok-apteka\api\f-apteka-sync.js`
- Modify: `d:\Программы\pintok-apteka\start_all.js`

**Interfaces:**
- Consumes: `AttendanceManager`, `WORKPLACES`, `getTashkentNow` from `../attendance`; `loadEnv` from `../jarvis_env`.
- Produces:
  - `GET /api/jarvis-data?date=YYYY-MM-DD` -> `{ ok, date, branches, attendanceSummary, employees, sales, competitors, fAptekaConfig }`
  - `POST /api/jarvis-data` -> saves `sales` entry or `competitor` entry (with graceful read-only fallback).
  - `POST /api/f-apteka-sync` -> Webhook receiver validating `x-f-apteka-token` / `token`, normalizing F-Apteka daily sales payload (`normalizeFAptekaPayload`), and saving to `bot-data/jarvis-sales.json`.
  - `GET /api/f-apteka-sync?action=pull&date=YYYY-MM-DD` -> Pulls from configured `F_APTEKA_API_URL` + `F_APTEKA_API_TOKEN` (or returns clear `NOT_CONFIGURED` status with setup instructions).
  - `start_all.js` routes `/api/jarvis-chat`, `/api/jarvis-data`, and `/api/f-apteka-sync` with JSON body parsing and CORS.

- [ ] **Step 1:** Implement `api/jarvis-data.js` reading live attendance from `bot-data/attendance.json` and managing `bot-data/jarvis-sales.json` & `bot-data/jarvis-competitors.json`.
- [ ] **Step 2:** Implement `api/f-apteka-sync.js` with `normalizeFAptekaPayload()`, webhook receiver (`POST`), pull sync (`GET`), and test-sync mode.
- [ ] **Step 3:** Update `start_all.js` to load `.env` on startup and route `/api/jarvis-chat`, `/api/jarvis-data`, and `/api/f-apteka-sync`.

---

### Task 4: Jarvis Standalone Mobile-First PWA (`jarvis.html`, `jarvis.css`, `jarvis.js`, `jarvis-manifest.json`, `index.html`)

**Files:**
- Create: `d:\Программы\pintok-apteka\jarvis-manifest.json`
- Create: `d:\Программы\pintok-apteka\jarvis.html`
- Create: `d:\Программы\pintok-apteka\jarvis.css`
- Create: `d:\Программы\pintok-apteka\jarvis.js`
- Modify: `d:\Программы\pintok-apteka\index.html` (add "🤖 Jarvis" button in header)

**Interfaces:**
- Consumes: `/api/jarvis-chat`, `/api/jarvis-data`, `/api/f-apteka-sync`.
- Produces: Installable mobile-first executive PWA with 5 bottom-nav tabs:
  1. **Jarvis** — AI Chat with Gemini/ChatGPT/Claude/OpenRouter switcher, 3-AI Council toggle, voice input button, quick manager prompt chips, and live context injection (today's attendance + latest sales + competitors).
  2. **Саўда** — F-Apteka Integration status bar + 1-tap "F-Apteka синхронлаў" button, F-Apteka Excel/CSV file dropzone, F-Apteka photo/screenshot camera upload (client-resized + analyzed by Gemini Vision), quick manual entry form, daily revenue KPIs, branch breakdown, and pharmacist sales leaderboard.
  3. **Қызлар** — Live 4-branch attendance from `pintok-apteka` (clock-in/out, late minutes, fines, shifts) + 1-tap "AI таллаў" button.
  4. **Идеялар** — Competitor tracker (add/edit/delete nearby pharmacies per branch) + 1-tap "Бәсекилес анализи" & "Саўданы көтериў идеялары" AI generators.
  5. **Сазлаў** — AI Provider API keys (Gemini active badge + optional ChatGPT/Claude/OpenRouter key inputs), F-Apteka Integration config (API URL, API Token, copyable Webhook URL, Test Sync button), optional 4-digit PIN lock, and PWA Install button.

- [ ] **Step 1:** Create `jarvis-manifest.json` with `start_url: "./jarvis.html"`, standalone display, dark executive theme color `#0b1120`.
- [ ] **Step 2:** Create `jarvis.html` and `jarvis.css` with polished dark glassmorphism executive UI, responsive mobile bottom-tab navigation, and accessible touch targets.
- [ ] **Step 3:** Implement `jarvis.js` wiring all 5 tabs, F-Apteka Excel/CSV parser + screenshot image compression + Gemini Vision extraction, live attendance rendering, competitor CRUD, multi-AI chat, voice input, PIN lock, and PWA install prompt.
- [ ] **Step 4:** Add a `🤖 Jarvis` link button to `index.html` header.

---

### Task 5: End-to-End Verification

- [ ] **Step 1:** Verify JavaScript syntax of all created/modified files (`api/jarvis-chat.js`, `api/jarvis-data.js`, `api/f-apteka-sync.js`, `jarvis_env.js`, `jarvis.js`, `start_all.js`).
- [ ] **Step 2:** Verify `.gitignore` excludes `.env` and no API keys appear in tracked files.
- [ ] **Step 3:** Review UI layout, Karakalpak Cyrillic copy, and provide clear launch & phone-install instructions.
