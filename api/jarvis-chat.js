// PINTOK APTEKA — Jarvis Multi-AI Backend Proxy (Gemini, ChatGPT, Claude, OpenRouter)
const https = require('https');
const { URL } = require('url');
const { getEnv } = require('../jarvis_env');

const DEFAULT_SYSTEM_PROMPT = `Сен — «Jarvis», «PINTOK APTEKA» (4 филиал: 1-Филиал Шымбай 5-этажлы Емлеўхана қасы, 2-Филиал Шымбай Базар, 3-Филиал Хожели, 4-Филиал Нөкис) аптекалар тармағы басқарыўшысының жеке AI жәрдемшисисең.
Ўазыйпаларың:
1. Күнделикли саўда (F-Apteka есабатлары), чеклер саны, орташа чек ҳәм филиаллар нәтийжелерин анық таллаў.
2. Хызметкер қызлардың келип-кетиў тәртибин, кешигиўлерин ҳәм сатыў нәтийжелилигин баҳалаў.
3. Әтираптағы бәсекилес (конкурент) аптекаларды таллап, утқыр стратегиялар усыныў.
4. Саўданы көтериў ушын әмелий идеялар, акциялар, қосымша сатыў (допродажа) скриптлерин бериў.
5. Басқарыўшыға күнделикли жумысларда тез, қысқа, анық ҳәм пайдалы жәрдем бериў.

Қағыйдалар:
- Пайдаланыўшы қайсы тилде жазса (қарақалпақша ямаса русша), сол тилде жуўап бер. Қарақалпақшада w ҳәрибин ў деп жаз.
- Артықша узын сөзсиз, нақты санлар, кесте ямаса пунктлер менен анық усыныс бер.`;

function httpsJsonRequest(urlString, headers, bodyObj, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const payload = JSON.stringify(bodyObj);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) {
            json = { raw: data };
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            const msg =
              (json && json.error && (json.error.message || json.error)) ||
              (json && json.message) ||
              `HTTP ${res.statusCode}`;
            const err = new Error(String(msg));
            err.statusCode = res.statusCode;
            reject(err);
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('AI сўраў ўақты таўсылды (timeout)'));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function resolveKeys(clientKeys = {}) {
  const safeClient = clientKeys && typeof clientKeys === 'object' ? clientKeys : {};
  return {
    gemini: getEnv('GEMINI_API_KEY') || String(safeClient.gemini || '').trim(),
    openai: getEnv('OPENAI_API_KEY') || String(safeClient.openai || '').trim(),
    claude: getEnv('ANTHROPIC_API_KEY') || String(safeClient.claude || '').trim(),
    openrouter: getEnv('OPENROUTER_API_KEY') || String(safeClient.openrouter || '').trim()
  };
}

function getConfiguredProviders(clientKeys = {}) {
  const keys = resolveKeys(clientKeys);
  return {
    gemini: Boolean(keys.gemini),
    openai: Boolean(keys.openai),
    claude: Boolean(keys.claude),
    openrouter: Boolean(keys.openrouter)
  };
}

function sanitizeErrorMessage(msg, keys) {
  let clean = String(msg || 'Белгисиз қәте');
  for (const val of Object.values(keys || {})) {
    if (val && val.length > 6) {
      clean = clean.split(val).join('***');
    }
  }
  return clean;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.trim()
    }));
}

async function callGemini({ apiKey, model, messages, systemPrompt, imageBase64, imageMimeType }) {
  const chosenModel = model || 'gemini-2.5-flash';
  const contents = messages.map((m, idx) => {
    const parts = [{ text: m.content }];
    const isLastUser = idx === messages.length - 1 && m.role === 'user';
    if (isLastUser && imageBase64) {
      parts.push({
        inline_data: {
          mime_type: imageMimeType || 'image/jpeg',
          data: imageBase64
        }
      });
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosenModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048
    }
  };
  const data = await httpsJsonRequest(url, {}, body);
  const text =
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    Array.isArray(data.candidates[0].content.parts)
      ? data.candidates[0].content.parts.map((p) => p.text || '').join('').trim()
      : '';
  return { provider: 'gemini', model: chosenModel, reply: text || 'Жуўап бос келди.' };
}

async function callOpenAI({ apiKey, model, messages, systemPrompt, imageBase64, imageMimeType, baseUrl, extraHeaders }) {
  const chosenModel = model || 'gpt-4o-mini';
  const formatted = [{ role: 'system', content: systemPrompt }];
  messages.forEach((m, idx) => {
    const isLastUser = idx === messages.length - 1 && m.role === 'user';
    if (isLastUser && imageBase64) {
      formatted.push({
        role: 'user',
        content: [
          { type: 'text', text: m.content },
          {
            type: 'image_url',
            image_url: { url: `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}` }
          }
        ]
      });
    } else {
      formatted.push({ role: m.role, content: m.content });
    }
  });

  const url = baseUrl || 'https://api.openai.com/v1/chat/completions';
  const data = await httpsJsonRequest(
    url,
    { Authorization: `Bearer ${apiKey}`, ...(extraHeaders || {}) },
    { model: chosenModel, messages: formatted, temperature: 0.4, max_tokens: 2048 }
  );
  const text =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
      ? String(data.choices[0].message.content).trim()
      : '';
  return {
    provider: baseUrl ? 'openrouter' : 'openai',
    model: chosenModel,
    reply: text || 'Жуўап бос келди.'
  };
}

async function callClaude({ apiKey, model, messages, systemPrompt, imageBase64, imageMimeType }) {
  const chosenModel = model || 'claude-3-5-sonnet-latest';
  const formatted = messages.map((m, idx) => {
    const isLastUser = idx === messages.length - 1 && m.role === 'user';
    if (isLastUser && imageBase64) {
      return {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMimeType || 'image/jpeg',
              data: imageBase64
            }
          },
          { type: 'text', text: m.content }
        ]
      };
    }
    return { role: m.role, content: m.content };
  });

  const data = await httpsJsonRequest(
    'https://api.anthropic.com/v1/messages',
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    {
      model: chosenModel,
      max_tokens: 2048,
      system: systemPrompt,
      messages: formatted
    }
  );
  const text =
    data && Array.isArray(data.content)
      ? data.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim()
      : '';
  return { provider: 'claude', model: chosenModel, reply: text || 'Жуўап бос келди.' };
}

async function invokeProvider(provider, opts) {
  if (provider === 'gemini') return callGemini(opts);
  if (provider === 'openai') return callOpenAI(opts);
  if (provider === 'claude') return callClaude(opts);
  if (provider === 'openrouter') {
    return callOpenAI({
      ...opts,
      model: opts.model || 'openai/gpt-4o-mini',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      extraHeaders: {
        'HTTP-Referer': 'https://pintok-apteka.local',
        'X-Title': 'PINTOK APTEKA Jarvis'
      }
    });
  }
  throw new Error(`Белгисиз AI провайдер: ${provider}`);
}

function sendJson(res, status, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(payload);
  }
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'jarvis-chat',
      configuredProviders: getConfiguredProviders()
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (_) {
    return sendJson(res, 400, { ok: false, error: 'Қәте JSON формат' });
  }

  const keys = resolveKeys(body.clientKeys);
  const configured = {
    gemini: Boolean(keys.gemini),
    openai: Boolean(keys.openai),
    claude: Boolean(keys.claude),
    openrouter: Boolean(keys.openrouter)
  };

  const messages = normalizeMessages(body.messages);
  if (!messages.length) {
    return sendJson(res, 400, { ok: false, error: 'Хабар бос болмаўы керек', configuredProviders: configured });
  }

  const systemPrompt = body.systemContext
    ? `${DEFAULT_SYSTEM_PROMPT}\n\n--- АПТЕКА ҲӘЗИРГИ МАҒЛЫЎМАТЛАРЫ ---\n${String(body.systemContext).slice(0, 6000)}`
    : DEFAULT_SYSTEM_PROMPT;

  // Council Mode: query all configured providers in parallel
  if (body.council) {
    const activeList = ['gemini', 'openai', 'claude'].filter((p) => Boolean(keys[p]));
    if (!activeList.length && keys.openrouter) {
      activeList.push('openrouter');
    }
    if (!activeList.length) {
      return sendJson(res, 400, {
        ok: false,
        code: 'MISSING_KEY',
        error: 'Ҳеш бир AI гилти табылмады. «Сазлаў» бөлиминен гилт киритиң.',
        configuredProviders: configured
      });
    }

    const settled = await Promise.allSettled(
      activeList.map((prov) =>
        invokeProvider(prov, {
          apiKey: keys[prov],
          messages,
          systemPrompt,
          imageBase64: body.imageBase64 || '',
          imageMimeType: body.imageMimeType || ''
        })
      )
    );

    const councilReplies = settled.map((item, idx) => {
      const prov = activeList[idx];
      if (item.status === 'fulfilled') {
        return { ok: true, provider: prov, model: item.value.model, reply: item.value.reply };
      }
      return {
        ok: false,
        provider: prov,
        error: sanitizeErrorMessage(item.reason && item.reason.message, keys)
      };
    });

    const combined = councilReplies
      .map((r) => `### ${r.provider.toUpperCase()}\n${r.ok ? r.reply : `Қәте: ${r.error}`}`)
      .join('\n\n---\n\n');

    return sendJson(res, 200, {
      ok: true,
      provider: 'council',
      reply: combined,
      councilReplies,
      configuredProviders: configured
    });
  }

  const provider = String(body.provider || 'gemini').toLowerCase();
  const apiKey = keys[provider];
  if (!apiKey) {
    return sendJson(res, 400, {
      ok: false,
      code: 'MISSING_KEY',
      error: `${provider.toUpperCase()} ушын API гилти киритилмеген. «Сазлаў» бөлиминен гилт қосың ямаса Gemini таңлаң.`,
      configuredProviders: configured
    });
  }

  try {
    const result = await invokeProvider(provider, {
      apiKey,
      model: body.model,
      messages,
      systemPrompt,
      imageBase64: body.imageBase64 || '',
      imageMimeType: body.imageMimeType || ''
    });
    return sendJson(res, 200, {
      ok: true,
      ...result,
      configuredProviders: configured
    });
  } catch (err) {
    return sendJson(res, 502, {
      ok: false,
      code: 'PROVIDER_ERROR',
      error: sanitizeErrorMessage(err && err.message, keys),
      configuredProviders: configured
    });
  }
}

handler.resolveKeys = resolveKeys;
handler.getConfiguredProviders = getConfiguredProviders;
handler.sanitizeErrorMessage = sanitizeErrorMessage;
handler.normalizeMessages = normalizeMessages;

module.exports = handler;
