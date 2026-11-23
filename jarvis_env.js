// Zero-dependency .env loader for PINTOK APTEKA Jarvis
const fs = require('fs');
const path = require('path');

let loaded = false;

function loadEnv(envPath) {
  if (loaded && !envPath) return process.env;
  const target = envPath || path.join(__dirname, '.env');
  try {
    if (fs.existsSync(target)) {
      const raw = fs.readFileSync(target, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (key && (process.env[key] === undefined || process.env[key] === '')) {
          process.env[key] = val;
        }
      }
    }
  } catch (_) {
    // Ignore read errors on serverless environments without local .env
  }
  if (!envPath) loaded = true;
  return process.env;
}

function getEnv(key, fallback = '') {
  loadEnv();
  const val = process.env[key];
  return val !== undefined && val !== '' ? val : fallback;
}

module.exports = { loadEnv, getEnv };
