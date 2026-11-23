// PINTOK APTEKA — Jarvis AI Mobile PWA Client
(() => {
  'use strict';

  const LS_KEYS = {
    aiKeys: 'jarvis_ai_keys_v1',
    fApteka: 'jarvis_f_apteka_cfg_v1',
    salesCache: 'jarvis_sales_cache_v1',
    competitors: 'jarvis_competitors_v1',
    pin: 'jarvis_pin_v1'
  };

  const state = {
    date: getTodayTashkent(),
    provider: 'gemini',
    configuredProviders: { gemini: true, openai: false, claude: false, openrouter: false },
    messages: [],
    attendance: null,
    salesToday: null,
    salesHistory: [],
    competitors: [],
    fAptekaConfig: {},
    deferredInstallPrompt: null,
    isSending: false
  };

  function getTodayTashkent() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const tash = new Date(utc + 5 * 3600000);
    const y = tash.getFullYear();
    const m = String(tash.getMonth() + 1).padStart(2, '0');
    const d = String(tash.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatSum(n) {
    return `${Math.round(Number(n || 0)).toLocaleString('ru-RU').replace(/\u00A0/g, ' ')} сум`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMarkdownLite(text) {
    const escaped = escapeHtml(text);
    const lines = escaped.split(/\r?\n/);
    let html = '';
    let inList = false;
    for (const rawLine of lines) {
      const line = rawLine
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      if (/^###\s+/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p><strong>${line.replace(/^###\s+/, '')}</strong></p>`;
      } else if (/^[-*•]\s+/.test(line)) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${line.replace(/^[-*•]\s+/, '')}</li>`;
      } else if (!line.trim()) {
        if (inList) { html += '</ul>'; inList = false; }
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p>${line}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html || '<p></p>';
  }

  function loadJsonLS(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJsonLS(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  let toastTimer = null;
  function showToast(msg, ms = 3200) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  function getClientAiKeys() {
    return loadJsonLS(LS_KEYS.aiKeys, { gemini: '', openai: '', claude: '', openrouter: '' });
  }

  function getFAptekaLocalCfg() {
    return loadJsonLS(LS_KEYS.fApteka, { apiUrl: '', apiToken: '' });
  }

  // ==================== NAVIGATION ====================
  function switchTab(tabName) {
    document.querySelectorAll('.tab-view').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `tab-${tabName}`);
    });
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
  }

  // ==================== DATA LOADING ====================
  async function loadAllData() {
    try {
      const [dataRes, chatRes] = await Promise.all([
        fetch(`/api/jarvis-data?date=${encodeURIComponent(state.date)}`),
        fetch('/api/jarvis-chat')
      ]);

      if (chatRes.ok) {
        const chatInfo = await chatRes.json();
        if (chatInfo && chatInfo.configuredProviders) {
          updateProviderIndicators(chatInfo.configuredProviders);
        }
      }

      if (dataRes.ok) {
        const data = await dataRes.json();
        state.attendance = data.attendance || null;
        state.fAptekaConfig = data.fAptekaConfig || {};

        // Merge server sales with localStorage cache (in case Vercel FS is read-only)
        const localSalesMap = loadJsonLS(LS_KEYS.salesCache, {});
        state.salesToday = data.salesToday || localSalesMap[state.date] || null;
        state.salesHistory = data.salesHistory || [];

        const localComps = loadJsonLS(LS_KEYS.competitors, []);
        state.competitors =
          Array.isArray(data.competitors) && data.competitors.length
            ? data.competitors
            : localComps;
      }
    } catch (err) {
      // Offline / localStorage fallback
      const localSalesMap = loadJsonLS(LS_KEYS.salesCache, {});
      state.salesToday = localSalesMap[state.date] || null;
      state.competitors = loadJsonLS(LS_KEYS.competitors, []);
    }

    renderStaff();
    renderSales();
    renderCompetitors();
    renderSettingsStatus();
  }

  function updateProviderIndicators(serverConfigured) {
    const clientKeys = getClientAiKeys();
    state.configuredProviders = {
      gemini: Boolean(serverConfigured.gemini || clientKeys.gemini),
      openai: Boolean(serverConfigured.openai || clientKeys.openai),
      claude: Boolean(serverConfigured.claude || clientKeys.claude),
      openrouter: Boolean(serverConfigured.openrouter || clientKeys.openrouter)
    };

    for (const p of ['gemini', 'openai', 'claude', 'openrouter']) {
      const dot = document.getElementById(`dot-${p}`);
      if (dot) dot.classList.toggle('on', Boolean(state.configuredProviders[p]));
    }
    renderSettingsStatus();
  }

  function renderSettingsStatus() {
    const pillsEl = document.getElementById('aiStatusPills');
    if (pillsEl) {
      const labels = {
        gemini: 'Gemini',
        openai: 'ChatGPT',
        claude: 'Claude',
        openrouter: 'OpenRouter'
      };
      pillsEl.innerHTML = Object.entries(labels)
        .map(([k, label]) => {
          const on = state.configuredProviders[k];
          return `<span class="pill ${on ? 'green' : 'amber'}">${label}: ${on ? 'Актив' : 'Гилт жоқ'}</span>`;
        })
        .join('');
    }

    const webhookInput = document.getElementById('fAptekaWebhookUrl');
    if (webhookInput) {
      webhookInput.value = `${window.location.origin}/api/f-apteka-sync`;
    }

    const statusEl = document.getElementById('fAptekaStatusText');
    if (statusEl) {
      const localCfg = getFAptekaLocalCfg();
      const configured = Boolean(state.fAptekaConfig.apiConfigured || localCfg.apiUrl);
      if (state.salesToday && state.salesToday.syncedAt) {
        const t = new Date(state.salesToday.syncedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        statusEl.textContent = `Соңғы жаңалаў: ${t} (${state.salesToday.source || 'F-Apteka'})`;
      } else if (configured) {
        statusEl.textContent = 'F-Apteka API жалғанған — «Синхронлаў» басың';
      } else {
        statusEl.textContent = 'Тайын — API мәнзили киритилсе автомат жалғанады, ямаса сүўрет/CSV жүклең';
      }
    }
  }

  // ==================== LIVE CONTEXT FOR AI ====================
  function buildSystemContext() {
    const parts = [`Сәне: ${state.date}`];

    if (state.attendance && state.attendance.summary) {
      const s = state.attendance.summary;
      parts.push(
        `ТАБЕЛЬ (ҚЫЗЛАР КЕЛИП-КЕТИЎИ): Жәми ${s.totalStaff} хызметкер, жумыста: ${s.present}, кешиккен: ${s.late}, келмеген: ${s.absent}, жәми штраф: ${formatSum(s.totalFine)}.`
      );
      for (const br of state.attendance.branches || []) {
        const emps = (br.employees || [])
          .map((e) => {
            const st =
              e.status === 'present'
                ? `келди ${e.checkInTime || ''}`
                : e.status === 'late'
                ? `кешикти ${e.lateMinutes} мин (${e.checkInTime || ''})`
                : e.status === 'sick'
                ? 'больничный'
                : 'келмеди';
            return `${e.name}: ${st}`;
          })
          .join('; ');
        parts.push(`- ${br.name}: ${br.present}/${br.totalStaff} (${emps || 'хызметкер жоқ'})`);
      }
    }

    if (state.salesToday) {
      const st = state.salesToday;
      parts.push(
        `F-APTEKA САЎДА ЕСАБАТЫ (${st.date}): Жәми саўда ${formatSum(st.totalRevenue)}, чеклер: ${st.totalChecks}, орташа чек: ${formatSum(st.avgCheck)}, қайтарыўлар: ${formatSum(st.totalReturns)}.`
      );
      if (st.branches && st.branches.length) {
        parts.push(
          'Филиаллар: ' +
            st.branches.map((b) => `${b.name}: ${formatSum(b.revenue)} (${b.checks} чек)`).join(' | ')
        );
      }
      if (st.pharmacists && st.pharmacists.length) {
        parts.push(
          'Фармацевтлер: ' +
            st.pharmacists.map((p) => `${p.name} (${p.branch || '-'}): ${formatSum(p.revenue)} (${p.checks} чек)`).join(' | ')
        );
      }
    } else {
      parts.push('F-APTEKA САЎДА ЕСАБАТЫ: Бүгин ушын еле жүкленбеген.');
    }

    if (state.competitors && state.competitors.length) {
      parts.push(
        'БӘСЕКИЛЕС АПТЕКАЛАР: ' +
          state.competitors
            .map(
              (c) =>
                `${c.name} (${c.branchArea}, баҳа: ${c.priceLevel}, күшли: ${c.strengths || '-'}, әззи: ${c.weaknesses || '-'}, акция: ${c.promos || '-'})`
            )
            .join(' ; ')
      );
    }

    return parts.join('\n');
  }

  // ==================== AI CHAT ====================
  function appendMessage(role, meta, text) {
    const feed = document.getElementById('chatFeed');
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = `<div class="msg-meta">${escapeHtml(meta)}</div><div class="msg-body">${renderMarkdownLite(text)}</div>`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
    return div;
  }

  async function callJarvisAI({ prompt, imageBase64, imageMimeType, providerOverride, keepHistory = true }) {
    const prov = providerOverride || state.provider;
    const isCouncil = prov === 'council';
    const historyToSend = keepHistory
      ? [...state.messages.slice(-10), { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }];

    const res = await fetch('/api/jarvis-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: isCouncil ? 'gemini' : prov,
        council: isCouncil,
        messages: historyToSend,
        systemContext: buildSystemContext(),
        imageBase64: imageBase64 || '',
        imageMimeType: imageMimeType || '',
        clientKeys: getClientAiKeys()
      })
    });

    const data = await res.json();
    if (data && data.configuredProviders) {
      updateProviderIndicators(data.configuredProviders);
    }
    if (!res.ok || !data.ok) {
      throw new Error((data && data.error) || 'AI жуўап бермеди');
    }
    return data;
  }

  async function sendChatMessage(text) {
    const clean = String(text || '').trim();
    if (!clean || state.isSending) return;

    state.isSending = true;
    const sendBtn = document.getElementById('btnSend');
    if (sendBtn) sendBtn.disabled = true;

    appendMessage('user', 'Сиз', clean);
    state.messages.push({ role: 'user', content: clean });

    const label = state.provider === 'council' ? 'JARVIS · 3-AI Кеңес' : `JARVIS · ${state.provider.toUpperCase()}`;
    const typingEl = appendMessage('assistant', label, 'Ойланып атырман...');

    try {
      const data = await callJarvisAI({ prompt: clean });
      typingEl.querySelector('.msg-body').innerHTML = renderMarkdownLite(data.reply);
      state.messages.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      typingEl.querySelector('.msg-body').innerHTML = `<p style="color:#f87171;">⚠️ ${escapeHtml(err.message)}</p>`;
    } finally {
      state.isSending = false;
      if (sendBtn) sendBtn.disabled = false;
      const feed = document.getElementById('chatFeed');
      if (feed) feed.scrollTop = feed.scrollHeight;
    }
  }

  // ==================== VOICE INPUT ====================
  function setupVoiceInput() {
    const btn = document.getElementById('btnVoice');
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!btn) return;
    if (!SpeechRec) {
      btn.addEventListener('click', () => showToast('Бул браузерде даўыс пенен жазыў қоллап-қуўатланбайды'));
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    let listening = false;

    btn.addEventListener('click', () => {
      if (listening) {
        rec.stop();
        return;
      }
      try {
        rec.start();
        listening = true;
        btn.classList.add('listening');
        showToast('Тыңлап атырман, сөйлең...');
      } catch (_) {}
    });

    rec.onresult = (e) => {
      const transcript = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '';
      const input = document.getElementById('chatInput');
      if (input && transcript) {
        input.value = (input.value ? input.value + ' ' : '') + transcript;
        input.focus();
      }
    };
    rec.onend = () => {
      listening = false;
      btn.classList.remove('listening');
    };
    rec.onerror = () => {
      listening = false;
      btn.classList.remove('listening');
    };
  }

  // ==================== RENDER STAFF ====================
  function renderStaff() {
    const att = state.attendance;
    const sum = (att && att.summary) || { totalStaff: 0, present: 0, late: 0, absent: 0, totalFine: 0 };

    document.getElementById('attTotal').textContent = sum.totalStaff;
    document.getElementById('attPresent').textContent = sum.present;
    document.getElementById('attLate').textContent = sum.late;
    document.getElementById('attFine').textContent = formatSum(sum.totalFine);

    const list = document.getElementById('staffBranchesList');
    if (!att || !att.branches || !att.branches.length) {
      list.innerHTML = '<div class="empty-state">Табель мағлыўматы табылмады.</div>';
      return;
    }

    list.innerHTML = att.branches
      .map((br) => {
        const empHtml =
          br.employees && br.employees.length
            ? br.employees
                .map((e) => {
                  const pillClass =
                    e.status === 'present'
                      ? 'green'
                      : e.status === 'late'
                      ? 'amber'
                      : e.status === 'sick'
                      ? 'blue'
                      : 'red';
                  const pillText =
                    e.status === 'present'
                      ? `✅ ${e.checkInTime || 'Келди'}`
                      : e.status === 'late'
                      ? `⏰ +${e.lateMinutes} мин`
                      : e.status === 'sick'
                      ? '🏥 Больничный'
                      : '❌ Келмеди';
                  return `<div class="emp-row">
                    <div>
                      <strong>${escapeHtml(e.name)}</strong>
                      <div class="item-sub">${e.checkInTime ? `Келди: ${e.checkInTime}` : 'Келмеген'}${e.checkOutTime ? ` · Кетти: ${e.checkOutTime}` : ''}</div>
                    </div>
                    <span class="pill ${pillClass}">${pillText}</span>
                  </div>`;
                })
                .join('')
            : '<div class="item-sub">Бул филиалда хызметкер дизимге алынбаған</div>';

        return `<div class="list-item">
          <div class="list-item-row" style="margin-bottom:8px;">
            <div>
              <div class="item-title">${escapeHtml(br.name)}</div>
              <div class="item-sub">${escapeHtml(br.address || '')}</div>
            </div>
            <span class="pill blue">${br.present}/${br.totalStaff}</span>
          </div>
          ${empHtml}
        </div>`;
      })
      .join('');
  }

  // ==================== RENDER SALES (F-APTEKA) ====================
  function renderSales() {
    const st = state.salesToday;
    document.getElementById('kpiTotalRevenue').textContent = formatSum(st ? st.totalRevenue : 0);
    document.getElementById('kpiTotalChecks').textContent = st ? st.totalChecks : 0;
    document.getElementById('kpiAvgCheck').textContent = formatSum(st ? st.avgCheck : 0);
    document.getElementById('kpiReturns').textContent = formatSum(st ? st.totalReturns : 0);

    const brList = document.getElementById('salesBranchesList');
    if (st && st.branches && st.branches.length) {
      brList.innerHTML = st.branches
        .map(
          (b) => `<div class="list-item">
          <div class="list-item-row">
            <div class="item-title">${escapeHtml(b.name)}</div>
            <span class="pill green">${formatSum(b.revenue)}</span>
          </div>
          <div class="item-sub">Чеклер: ${b.checks} · Орташа чек: ${formatSum(b.avgCheck)}${b.returns ? ` · Қайтарыў: ${formatSum(b.returns)}` : ''}</div>
        </div>`
        )
        .join('');
    } else {
      brList.innerHTML =
        '<div class="empty-state">Бүгин ушын F-Apteka саўда есабаты еле киритилмеген. Скриншот жүклең, CSV ашың ямаса «Синхронлаў» басың.</div>';
    }

    const phList = document.getElementById('salesPharmacistsList');
    if (st && st.pharmacists && st.pharmacists.length) {
      phList.innerHTML = st.pharmacists
        .map(
          (p, i) => `<div class="list-item">
          <div class="list-item-row">
            <div>
              <div class="item-title">${i + 1}. ${escapeHtml(p.name)}</div>
              <div class="item-sub">${escapeHtml(p.branch || 'Филиал көрсетилмеген')} · ${p.checks} чек</div>
            </div>
            <span class="pill blue">${formatSum(p.revenue)}</span>
          </div>
        </div>`
        )
        .join('');
    } else {
      phList.innerHTML = '<div class="empty-state">Фармацевтлер бойынша мағлыўмат F-Apteka есабатынан түседи.</div>';
    }
  }

  async function saveSalesData(payload) {
    const full = { ...payload, date: state.date };
    try {
      const res = await fetch('/api/jarvis-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sales', date: state.date, payload: full })
      });
      const data = await res.json();
      if (data && data.ok && data.report) {
        state.salesToday = data.report;
      }
    } catch (_) {
      state.salesToday = full;
    }
    const cache = loadJsonLS(LS_KEYS.salesCache, {});
    cache[state.date] = state.salesToday;
    saveJsonLS(LS_KEYS.salesCache, cache);
    renderSales();
    renderSettingsStatus();
  }

  // Pull from F-Apteka API
  async function pullFromFApteka() {
    const cfg = getFAptekaLocalCfg();
    showToast('F-Apteka сервери менен байланысып атыр...');
    try {
      const headers = {};
      if (cfg.apiUrl) headers['x-f-apteka-url'] = cfg.apiUrl;
      if (cfg.apiToken) headers['x-f-apteka-api-token'] = cfg.apiToken;
      const res = await fetch(`/api/f-apteka-sync?action=pull&date=${encodeURIComponent(state.date)}`, { headers });
      const data = await res.json();
      if (data.ok && data.report) {
        state.salesToday = data.report;
        const cache = loadJsonLS(LS_KEYS.salesCache, {});
        cache[state.date] = data.report;
        saveJsonLS(LS_KEYS.salesCache, cache);
        renderSales();
        renderSettingsStatus();
        showToast('✅ F-Apteka саўда мағлыўматлары жаңаланды!');
      } else if (data.code === 'NOT_CONFIGURED') {
        showToast(data.message, 5000);
        switchTab('settings');
      } else {
        showToast(`⚠️ ${data.error || 'Синхронлаў қәтеси'}`, 4500);
      }
    } catch (err) {
      showToast(`⚠️ Байланыс қәтеси: ${err.message}`, 4000);
    }
  }

  // Compress image before uploading to Gemini Vision
  function compressImageToBase64(file, maxDim = 1400, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64 = dataUrl.split(',')[1] || '';
          resolve({ base64, mimeType: 'image/jpeg' });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFAptekaImageUpload(file) {
    if (!file) return;
    showToast('📷 F-Apteka скриншотын AI оқып атыр...', 5000);
    try {
      const { base64, mimeType } = await compressImageToBase64(file);
      const extractPrompt = `Бул F-Apteka программасының саўда есабаты сүўрети. Тек ғана таза JSON қайтар (markdown белгилерисиз):
{
  "totalRevenue": 0,
  "totalChecks": 0,
  "totalReturns": 0,
  "branches": [{"name": "1-Филиал", "revenue": 0, "checks": 0, "returns": 0}],
  "pharmacists": [{"name": "Аты", "branch": "1-Филиал", "revenue": 0, "checks": 0}]
}
Сүўреттеги барлық санларды анық оқып толтыр. Егер бир өрис көринбесе 0 ямаса бос массив қой.`;

      const data = await callJarvisAI({
        prompt: extractPrompt,
        imageBase64: base64,
        imageMimeType: mimeType,
        providerOverride: state.configuredProviders.gemini ? 'gemini' : state.provider,
        keepHistory: false
      });

      const match = String(data.reply || '').match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Сүўреттен санларды ажыратып болмады');
      const parsed = JSON.parse(match[0]);
      await saveSalesData({ ...parsed, source: 'f-apteka-photo' });
      showToast('✅ F-Apteka сүўрети оқылды ҳәм сақланды!');
    } catch (err) {
      showToast(`⚠️ Сүўретти оқыў қәтеси: ${err.message}`, 4500);
    }
  }

  async function handleFAptekaFileUpload(file) {
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const json = JSON.parse(text);
        await saveSalesData({ ...json, source: 'f-apteka-json' });
        showToast('✅ F-Apteka JSON файлы жүкленди!');
        return;
      }

      // Simple CSV/TSV parser (supports ; , \t)
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error('Файл бос ямаса қатарлар жетиспейди');
      const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
      const branches = [];
      const pharmacists = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
        const name = row['фармацевт'] || row['кассир'] || row['имя'] || row['сотрудник'] || '';
        const branch = row['филиал'] || row['аптека'] || row['branch'] || cols[0];
        const revenue = Number(String(row['выручка'] || row['сумма'] || row['revenue'] || row['итого'] || cols[1] || '0').replace(/[^\d.-]/g, '')) || 0;
        const checks = Number(String(row['чеки'] || row['checks'] || row['кол-во чеков'] || cols[2] || '0').replace(/[^\d.-]/g, '')) || 0;
        if (name) {
          pharmacists.push({ name, branch, revenue, checks });
        } else if (branch && revenue > 0) {
          branches.push({ name: branch, revenue, checks });
        }
      }

      await saveSalesData({ branches, pharmacists, source: 'f-apteka-csv' });
      showToast('✅ F-Apteka CSV файлы жүкленди!');
    } catch (err) {
      showToast(`⚠️ Файлды оқыў қәтеси: ${err.message}`, 4000);
    }
  }

  // ==================== COMPETITORS & IDEAS ====================
  function renderCompetitors() {
    const list = document.getElementById('competitorsList');
    if (!state.competitors || !state.competitors.length) {
      list.innerHTML =
        '<div class="empty-state">Әтираптағы бәсекилес аптекаларды қосың — Jarvis оларды таллап береди.</div>';
      return;
    }
    list.innerHTML = state.competitors
      .map(
        (c) => `<div class="list-item">
        <div class="list-item-row">
          <div>
            <div class="item-title">${escapeHtml(c.name)}</div>
            <div class="item-sub">${escapeHtml(c.branchArea)} · Баҳа: ${escapeHtml(c.priceLevel)}</div>
          </div>
          <button type="button" class="btn-ghost sm" data-del-comp="${escapeHtml(c.id)}">🗑</button>
        </div>
        ${c.promos ? `<div class="item-sub">🎁 Акция: ${escapeHtml(c.promos)}</div>` : ''}
        ${c.strengths ? `<div class="item-sub">💪 Күшли: ${escapeHtml(c.strengths)}</div>` : ''}
        ${c.weaknesses ? `<div class="item-sub">⚡ Әззи: ${escapeHtml(c.weaknesses)}</div>` : ''}
      </div>`
      )
      .join('');

    list.querySelectorAll('[data-del-comp]').forEach((btn) => {
      btn.addEventListener('click', () => deleteCompetitor(btn.dataset.delComp));
    });
  }

  async function saveCompetitor(item) {
    try {
      const res = await fetch('/api/jarvis-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'competitor', ...item })
      });
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.competitors)) {
        state.competitors = data.competitors;
      } else {
        state.competitors.unshift({ ...item, id: `comp_${Date.now()}` });
      }
    } catch (_) {
      state.competitors.unshift({ ...item, id: `comp_${Date.now()}` });
    }
    saveJsonLS(LS_KEYS.competitors, state.competitors);
    renderCompetitors();
    showToast('✅ Бәсекилес сақланды');
  }

  async function deleteCompetitor(id) {
    state.competitors = state.competitors.filter((c) => c.id !== id);
    saveJsonLS(LS_KEYS.competitors, state.competitors);
    renderCompetitors();
    try {
      await fetch('/api/jarvis-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'delete_competitor', id })
      });
    } catch (_) {}
  }

  async function runIdeaGenerator(prompt) {
    const out = document.getElementById('ideasOutput');
    out.classList.remove('hidden');
    out.textContent = '⏳ Jarvis таллап атыр...';
    try {
      const data = await callJarvisAI({ prompt, keepHistory: false });
      out.innerHTML = renderMarkdownLite(data.reply);
    } catch (err) {
      out.textContent = `⚠️ ${err.message}`;
    }
  }

  // ==================== PIN LOCK & PWA ====================
  function initPinLock() {
    const savedPin = localStorage.getItem(LS_KEYS.pin) || '';
    if (!savedPin) return;
    const overlay = document.getElementById('pinOverlay');
    const input = document.getElementById('pinUnlockInput');
    const errEl = document.getElementById('pinError');
    overlay.classList.remove('hidden');

    const tryUnlock = () => {
      if (input.value === savedPin) {
        overlay.classList.add('hidden');
        errEl.textContent = '';
      } else {
        errEl.textContent = 'PIN-код қәте!';
        input.value = '';
      }
    };
    document.getElementById('btnPinUnlock').addEventListener('click', tryUnlock);
    input.addEventListener('keyup', (e) => {
      if (input.value.length === 4 || e.key === 'Enter') tryUnlock();
    });
  }

  function initPwaInstall() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
    });
    document.getElementById('btnInstallPwa').addEventListener('click', async () => {
      if (state.deferredInstallPrompt) {
        state.deferredInstallPrompt.prompt();
        await state.deferredInstallPrompt.userChoice;
        state.deferredInstallPrompt = null;
      } else {
        showToast('Браузер менюсынан «Экранға қосыў» (Add to Home Screen) таңлаң', 4500);
      }
    });
  }

  // ==================== INIT EVENTS ====================
  function bindEvents() {
    // Date picker
    const datePicker = document.getElementById('jarvisDatePicker');
    datePicker.value = state.date;
    datePicker.addEventListener('change', () => {
      if (datePicker.value) {
        state.date = datePicker.value;
        loadAllData();
      }
    });

    // Bottom nav
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Provider chips
    document.querySelectorAll('.prov-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.provider = chip.dataset.provider;
        document.querySelectorAll('.prov-chip').forEach((c) => c.classList.toggle('active', c === chip));
      });
    });

    // Quick prompts
    document.querySelectorAll('.quick-chip').forEach((chip) => {
      chip.addEventListener('click', () => sendChatMessage(chip.dataset.prompt));
    });

    // Chat form
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = chatInput.value;
      chatInput.value = '';
      sendChatMessage(val);
    });
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.requestSubmit();
      }
    });

    // Sales actions
    document.getElementById('btnPullFApteka').addEventListener('click', pullFromFApteka);
    document.getElementById('fAptekaImageInput').addEventListener('change', (e) => {
      handleFAptekaImageUpload(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('fAptekaFileInput').addEventListener('change', (e) => {
      handleFAptekaFileUpload(e.target.files[0]);
      e.target.value = '';
    });

    const manualCard = document.getElementById('manualSalesCard');
    document.getElementById('btnToggleManualSales').addEventListener('click', () => {
      manualCard.classList.toggle('hidden');
    });
    document.getElementById('btnCancelManualSales').addEventListener('click', () => {
      manualCard.classList.add('hidden');
    });
    document.getElementById('btnSaveManualSales').addEventListener('click', async () => {
      const branch = document.getElementById('manualBranch').value;
      const revenue = Number(document.getElementById('manualRevenue').value || 0);
      const checks = Number(document.getElementById('manualChecks').value || 0);
      const pharmacist = document.getElementById('manualPharmacist').value.trim();
      if (!revenue) {
        showToast('Саўда суммасын киритиң');
        return;
      }

      const current = state.salesToday
        ? JSON.parse(JSON.stringify(state.salesToday))
        : { date: state.date, branches: [], pharmacists: [], source: 'manual' };
      current.branches = current.branches || [];
      current.pharmacists = current.pharmacists || [];

      const bIdx = current.branches.findIndex((b) => b.name === branch);
      const branchEntry = { name: branch, revenue, checks, returns: 0 };
      if (bIdx >= 0) current.branches[bIdx] = branchEntry;
      else current.branches.push(branchEntry);

      if (pharmacist) {
        current.pharmacists.push({ name: pharmacist, branch, revenue, checks });
      }
      current.totalRevenue = current.branches.reduce((s, b) => s + Number(b.revenue || 0), 0);
      current.totalChecks = current.branches.reduce((s, b) => s + Number(b.checks || 0), 0);

      await saveSalesData(current);
      manualCard.classList.add('hidden');
      document.getElementById('manualRevenue').value = '';
      document.getElementById('manualChecks').value = '';
      document.getElementById('manualPharmacist').value = '';
      showToast('✅ Күнлик саўда сақланды!');
    });

    document.getElementById('btnAnalyzeSalesAI').addEventListener('click', () => {
      switchTab('chat');
      sendChatMessage('Бүгинги F-Apteka саўда есабатын филиаллар ҳәм қызлар бойынша таллап, қайсы филиалды күшейтиў кереклигин айт.');
    });

    document.getElementById('btnAnalyzeStaffAI').addEventListener('click', () => {
      switchTab('chat');
      sendChatMessage('Бүгинги 4 филиал хызметкерлериниң келип-кетиў табелин таллап, басқарыўшы ушын қысқа есабат ҳәм усыныс бер.');
    });

    // Competitors & Ideas
    const compForm = document.getElementById('compForm');
    document.getElementById('btnToggleCompForm').addEventListener('click', () => compForm.classList.toggle('hidden'));
    document.getElementById('btnCancelComp').addEventListener('click', () => compForm.classList.add('hidden'));
    compForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveCompetitor({
        name: document.getElementById('compName').value,
        branchArea: document.getElementById('compBranch').value,
        priceLevel: document.getElementById('compPrice').value,
        promos: document.getElementById('compPromos').value,
        strengths: document.getElementById('compStrengths').value,
        weaknesses: document.getElementById('compWeaknesses').value
      });
      compForm.reset();
      compForm.classList.add('hidden');
    });

    document.getElementById('btnGenIdeasPromo').addEventListener('click', () =>
      runIdeaGenerator('PINTOK APTEKA (Шымбай, Хожели, Нөкис) ушын усы ҳәптеде ислетиўге болатуғын 5 эффектив акция идеясын бер. Ҳәр биринде күтилетуғын нәтийжесин жаз.')
    );
    document.getElementById('btnGenIdeasUpsell').addEventListener('click', () =>
      runIdeaGenerator('Аптека сатыўшы қызлары ушын орташа чекти 15-25% көтеретуғын әпиўайы ҳәм сыпайы қосымша сатыў (допродажа) скриптлерин (қарақалпақша) таярлап бер.')
    );
    document.getElementById('btnGenCompetitorStrategy').addEventListener('click', () =>
      runIdeaGenerator('Киритилген бәсекилес аптекаларды таллап, PINTOK APTEKA олардан қалай озып кетиўи мүмкинлиги бойынша нақты 5 қәдемлик стратегия дүз.')
    );

    // Settings — AI keys
    const savedKeys = getClientAiKeys();
    document.getElementById('keyGemini').value = savedKeys.gemini || '';
    document.getElementById('keyOpenAI').value = savedKeys.openai || '';
    document.getElementById('keyClaude').value = savedKeys.claude || '';
    document.getElementById('keyOpenRouter').value = savedKeys.openrouter || '';

    document.getElementById('btnSaveAiKeys').addEventListener('click', () => {
      const next = {
        gemini: document.getElementById('keyGemini').value.trim(),
        openai: document.getElementById('keyOpenAI').value.trim(),
        claude: document.getElementById('keyClaude').value.trim(),
        openrouter: document.getElementById('keyOpenRouter').value.trim()
      };
      saveJsonLS(LS_KEYS.aiKeys, next);
      updateProviderIndicators(state.configuredProviders);
      showToast('✅ AI гилтлери сақланды');
    });

    // Settings — F-Apteka Gateway
    const fCfg = getFAptekaLocalCfg();
    document.getElementById('fAptekaUrlInput').value = fCfg.apiUrl || '';
    document.getElementById('fAptekaTokenInput').value = fCfg.apiToken || '';

    document.getElementById('btnSaveFApteka').addEventListener('click', () => {
      saveJsonLS(LS_KEYS.fApteka, {
        apiUrl: document.getElementById('fAptekaUrlInput').value.trim(),
        apiToken: document.getElementById('fAptekaTokenInput').value.trim()
      });
      renderSettingsStatus();
      showToast('✅ F-Apteka сазлаўлары сақланды');
    });

    document.getElementById('btnCopyWebhook').addEventListener('click', async () => {
      const url = document.getElementById('fAptekaWebhookUrl').value;
      try {
        await navigator.clipboard.writeText(url);
        showToast('📋 Webhook мәнзили көширилди!');
      } catch (_) {
        showToast(url, 4000);
      }
    });

    document.getElementById('btnTestFApteka').addEventListener('click', async () => {
      showToast('🧪 F-Apteka тест синхронлаў жиберилип атыр...');
      const samplePayload = {
        mode: 'test',
        date: state.date,
        source: 'f-apteka-test',
        branches: [
          { name: '1-Филиал (Шымбай 5-этаж)', revenue: 21400000, checks: 168, returns: 180000 },
          { name: '2-Филиал (Шымбай Базар)', revenue: 16850000, checks: 142, returns: 95000 },
          { name: '3-Филиал (Хожели)', revenue: 19200000, checks: 151, returns: 120000 },
          { name: '4-Филиал (Нөкис)', revenue: 24900000, checks: 189, returns: 210000 }
        ],
        pharmacists: [
          { name: 'Гүлназ', branch: '4-Филиал (Нөкис)', revenue: 13200000, checks: 101 },
          { name: 'Айгүл', branch: '1-Филиал (Шымбай 5-этаж)', revenue: 11800000, checks: 92 },
          { name: 'Дилбар', branch: '3-Филиал (Хожели)', revenue: 10400000, checks: 83 },
          { name: 'Айзада', branch: '2-Филиал (Шымбай Базар)', revenue: 9600000, checks: 79 }
        ]
      };
      try {
        const res = await fetch('/api/f-apteka-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(samplePayload)
        });
        const data = await res.json();
        if (data && data.ok && data.report) {
          state.salesToday = data.report;
          const cache = loadJsonLS(LS_KEYS.salesCache, {});
          cache[state.date] = data.report;
          saveJsonLS(LS_KEYS.salesCache, cache);
          renderSales();
          renderSettingsStatus();
          showToast('✅ Тест есабат түсти! «Саўда» бөлимин қараң.');
          switchTab('sales');
        }
      } catch (err) {
        showToast(`⚠️ Тест қәтеси: ${err.message}`);
      }
    });

    // PIN setup
    document.getElementById('btnSavePin').addEventListener('click', () => {
      const val = document.getElementById('pinSetupInput').value.trim();
      if (val && !/^\d{4}$/.test(val)) {
        showToast('PIN-код дәл 4 саннан ибарат болыўы керек');
        return;
      }
      if (val) {
        localStorage.setItem(LS_KEYS.pin, val);
        showToast('🔐 PIN-код орнатылды');
      } else {
        localStorage.removeItem(LS_KEYS.pin);
        showToast('🔓 PIN-код өширилди');
      }
      document.getElementById('pinSetupInput').value = '';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPinLock();
    initPwaInstall();
    setupVoiceInput();
    bindEvents();
    loadAllData();
  });
})();
