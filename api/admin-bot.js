const { createAdminBotHandler } = require('../admin_bot');

const adminHandler = createAdminBotHandler();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, bot: '@apteka_uprav_bot', mode: 'webhook' });
  }
  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (update.my_chat_member && adminHandler.groupBotHandler) {
      await adminHandler.groupBotHandler.handleChatMemberUpdate(update.my_chat_member);
    }
    if (update.callback_query) {
      await adminHandler.handleCallbackQuery(update.callback_query);
    }
    const incomingMsg = update.message || update.edited_message;
    if (incomingMsg) {
      await adminHandler.handleAdminMessage(incomingMsg);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Admin webhook error:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
};
