# Jarvis — Personal AI Assistant for PINTOK APTEKA Manager

**Date:** 2026-11-23
**Project:** `pintok-apteka` (4 branches: Shımbay 5-etaj, Shımbay Bazar, Xojeli, Nókis)
**Status:** Approved by user (with F-Apteka plug-and-play integration gateway)

---

## 1. Intent & Why

The manager of **PINTOK APTEKA** needs a personal AI assistant ("Jarvis") installable on their phone as an app. It acts as a daily executive copilot for pharmacy management: tracking daily sales from **F-Apteka**, monitoring staff ("қызлар") attendance and discipline from the existing Telegram bot system, analyzing local competitors, generating actionable sales-growth ideas, and helping with day-to-day management tasks in Karakalpak and Russian.

---

## 2. Approaches Considered

1. **PWA inside `pintok-apteka` + Vercel/Render backend (Chosen)**
   - Installs directly to Android and iPhone home screens with its own app icon (`jarvis-manifest.json`).
   - Connects directly to the existing `pintok-apteka` data (`bot-data/attendance.json`) and zero-dependency Node.js server (`start_all.js` + `api/*.js`).
   - Easy to update without rebuilding APKs; supports full-screen mobile dashboard + AI chat + multimodal F-Apteka screenshot/Excel uploads.
   - *Trade-off:* Installed via browser "Add to Home Screen" rather than Play Store; requires internet for AI calls.

2. **Telegram Bot + Mini App**
   - Lives alongside `@apteka_uprav_bot` inside Telegram.
   - *Trade-off:* Not a standalone phone app icon; tables and multi-tab analytics feel cramped inside Telegram WebView.

3. **Native Android APK (React Native / Capacitor)**
   - Standalone `.apk` installer.
   - *Trade-off:* Slow update cycle (rebuild/reinstall per change), poor iPhone support without Apple Developer account, still requires a backend server.

**Decision:** Approach 1 (PWA inside `pintok-apteka`).

---

## 3. Goals, Non-Goals & Anti-Goals

### Goals
- **Mobile-first installable PWA** (`jarvis.html`, `jarvis.css`, `jarvis.js`, `jarvis-manifest.json`) with a sleek executive Jarvis UI and bottom navigation bar for one-handed phone use.
- **Multi-AI Provider Engine** (`/api/jarvis-chat`):
  - **Gemini** (Google AI — active immediately using `GEMINI_API_KEY` from `.env` / server env).
  - **ChatGPT** (OpenAI API — ready via `OPENAI_API_KEY` or in-app Settings).
  - **Claude** (Anthropic API — ready via `ANTHROPIC_API_KEY` or in-app Settings).
  - **OpenRouter** (optional single-key mode unlocking GPT + Claude + Gemini together).
  - **AI Selector** in chat header (switch model anytime, or run "3-AI Compare" when multiple keys are configured).
- **Live Staff Attendance & Reports ("Қызлар")**:
  - Reads live data from `bot-data/attendance.json` via `/api/jarvis-data`.
  - Displays all 4 branches' daily clock-ins, clock-outs, late minutes, fines, excuses, and shift status.
  - 1-tap AI daily staff summary & coaching suggestions.
- **F-Apteka Plug-and-Play Integration Gateway (`/api/f-apteka-sync`) & Sales Analyzer ("Саўда")**:
  - Ready-to-connect **F-Apteka API / Webhook Gateway**:
    - `POST /api/f-apteka-sync` (Webhook receiver for `REPORT.exe` / FOM Group push with `x-f-apteka-token` auth, normalizing branch/pharmacist daily sales JSON).
    - `GET /api/f-apteka-sync?action=pull` (Pulls daily sales from configured `F_APTEKA_API_URL` + `F_APTEKA_API_TOKEN` when connected).
    - In-app **F-Apteka Integration Settings** (API URL, API Token, Webhook URL copy button, Test Sync button) so the manager only has to paste credentials when FOM Group activates them.
  - Immediate fallback modes that work today: upload **F-Apteka Excel/CSV** exports OR take/upload a **photo/screenshot** of the F-Apteka report screen (analyzed via Gemini Vision / multimodal AI), or quick manual entry.
  - Extracts and saves daily sales by branch and pharmacist into `bot-data/jarvis-sales.json` (plus browser `localStorage` fallback when deployed on read-only serverless).
  - Tracks daily revenue, check count, average check, branch comparison, and pharmacist sales leaderboard.
- **Competitor Analysis ("Бәсекилеслер")**:
  - Track competing pharmacies around each of the 4 branches (name, location, pricing level, promos, strengths/weaknesses) in `bot-data/jarvis-competitors.json`.
  - 1-tap AI competitor audit & counter-strategy recommendations.
- **Sales Growth Ideas ("Идеялар")**:
  - Context-aware AI idea generator producing concrete pharmacy promos, seasonal bundles, pharmacist upsell scripts, and retention ideas tailored to Shımbay, Xojeli, and Nókis.
- **Personal Daily Assistant Chat ("Jarvis")**:
  - Full-context chat aware of today's attendance, latest F-Apteka sales, and competitors.
  - Speaks Karakalpak (Cyrillic/Latin) and Russian naturally.
  - Quick-action chips + browser voice input (microphone button via Web Speech API).

### Non-Goals
- Direct integration with FOM Group's private `REPORT.exe` API (can be added in a future phase if FOM Group issues API credentials).
- Publishing to Google Play Store or Apple App Store.

### Anti-Goals
- **Never commit or expose API keys** (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`) in git or public client files.
- **Never break existing `pintok-apteka` functionality** (`index.html`, `bot.js`, `admin_bot.js`, `attendance.js`, existing tests).

---

## 4. Technical Architecture

### Backend (Zero-dependency Node.js, works both locally via `start_all.js` and on Vercel `api/`)
- `api/jarvis-chat.js`:
  - `POST /api/jarvis-chat`
  - Accepts `{ provider: 'gemini' | 'openai' | 'claude' | 'openrouter', model?, messages, imageBase64?, imageMimeType?, systemContext, clientKeys? }`.
  - Resolves API key from server environment (`process.env.*` / gitignored `.env`) first, falling back to optional `clientKeys` sent over HTTPS from the manager's device Settings.
  - Uses native Node `https` / `fetch` (zero external npm packages needed).
- `api/jarvis-data.js`:
  - `GET /api/jarvis-data?date=YYYY-MM-DD`: Returns live attendance summary from `bot-data/attendance.json` (using existing `AttendanceManager`), plus saved sales (`jarvis-sales.json`) and competitors (`jarvis-competitors.json`).
  - `POST /api/jarvis-data`: Saves sales records (parsed from F-Apteka Excel/CSV/photo or quick entry) and competitor entries (gracefully falls back to client-side `localStorage` if filesystem is read-only on Vercel).
- `start_all.js`:
  - Add routing for `/api/jarvis-chat` and `/api/jarvis-data` + lightweight `.env` loader at startup.
- `.gitignore`:
  - Ensure `.env` and `bot-data/jarvis-secrets.json` are ignored.

### Frontend (Standalone Mobile-First PWA)
- `jarvis.html` + `jarvis.css` + `jarvis.js` + `jarvis-manifest.json`
- 5 bottom-nav tabs:
  1. **Jarvis** (AI Chat + Voice + Model switcher + Quick prompts)
  2. **Саўда** (F-Apteka Excel/CSV & Photo upload + Daily sales cards & pharmacist ranking)
  3. **Қызлар** (Live 4-branch attendance from `pintok-apteka` + AI discipline report)
  4. **Идеялар** (Competitor tracker + AI competitor analysis + Sales-growth ideas)
  5. **Сазлаў** (AI Keys status/input for Gemini/ChatGPT/Claude/OpenRouter, language preference, PIN lock, PWA Install button)
- Add a quick **🤖 Jarvis** launch button to the existing `index.html` header.

---

## 5. Decisions Made by Builder (Confirm or Adjust)
- **Language:** Jarvis UI in Karakalpak Cyrillic (matching the manager's preference), with AI responding in whichever language the manager writes (Karakalpak or Russian).
- **Security:** Your Gemini API key will be placed in a local gitignored `.env` file (and can be set as `GEMINI_API_KEY` in Vercel/Render settings) — never committed to code.
- **Zero-dependency stack:** Keeps `pintok-apteka` lightweight (no heavy `node_modules` required to run).
