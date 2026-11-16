const { createBotHandler } = require('../bot');

const botHandler = createBotHandler();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, bot: '@apteka_kontroll_bot', mode: 'webhook' });
  }
  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (update.my_chat_member && botHandler.groupBotHandler) {
      await botHandler.groupBotHandler.handleChatMemberUpdate(update.my_chat_member);
    }
    const incomingMsg = update.message || update.edited_message;
    if (incomingMsg) {
      await botHandler.handleUserMessage(incomingMsg);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Employee webhook error:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
};
