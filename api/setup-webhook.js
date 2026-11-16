const { tgApiRequest } = require('../tg_http');

const EMP_TOKEN = process.env.EMPLOYEE_BOT_TOKEN || "9256975178:AAFmH-e7dOiuOx4h6W-L6S2Kv3Rm8Mo850E";
const ADMIN_TOKEN = process.env.ADMIN_BOT_TOKEN || "9119556119:AAHrycakPIKnD9D8I_SM5SSELyOzrPnPx2Q";

module.exports = async function handler(req, res) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    const baseUrl = `https://${host}`;
    const empWebhookUrl = `${baseUrl}/api/bot`;
    const adminWebhookUrl = `${baseUrl}/api/admin-bot`;

    const empRes = await tgApiRequest(EMP_TOKEN, 'setWebhook', { url: empWebhookUrl }, 'EmployeeBot');
    const adminRes = await tgApiRequest(ADMIN_TOKEN, 'setWebhook', { url: adminWebhookUrl }, 'AdminBot');

    return res.status(200).json({
      ok: true,
      message: "Еки бот да Vercel серверге (Webhook) табыслы қосылды! Енди компьютер өшик турса да 24/7 ислей береди.",
      employeeBot: { url: empWebhookUrl, telegramResponse: empRes },
      adminBot: { url: adminWebhookUrl, telegramResponse: adminRes }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
