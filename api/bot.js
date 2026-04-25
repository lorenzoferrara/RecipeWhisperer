// api/bot.js — Vercel Serverless Function (Entry Point)
// Receives Telegram webhook and routes to appropriate handlers

import { sendTelegram } from './services/telegram.js';
import { parseCommand } from './utils/parsing.js';
import { handleViewCommand, handleDeleteCommand, handleAddRecipe, handleTestCommand } from './handlers/commands.js';


const ALLOWED_CHAT_ID = process.env.ALLOWED_CHAT_ID;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, msg: 'bot is alive' });
  }

  try {
    const { message } = req.body;
    if (!message) return res.status(200).end();

    const chatId = String(message.chat.id);
    const text   = message.text || '';

    // Security: only respond to authorized user
    if (chatId !== String(ALLOWED_CHAT_ID)) {
      await sendTelegram(chatId, '⛔ Non sei autorizzato.');
      return res.status(200).end();
    }

    // Help/Start command
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(chatId,
        '👨‍🍳 *Recipe Whisperer*\n\n' +
        'Mandami una ricetta in linguaggio naturale e la aggiungo automaticamente al sito.\n\n' +
        '*Comandi disponibili:*\n' +
        '`/view` → lista ricette\n' +
        '`/view <id>` → dettagli ricetta\n' +
        '`/delete <id>` → elimina ricetta\n' +
        '`/test` → test Gemini API\n\n' +
        'Puoi scrivere in modo libero, ad esempio:\n' +
        '_"Pasta al pomodoro: 320g spaghetti, 400g pomodori pelati, aglio, olio, basilico. Soffriggere aglio, aggiungere pomodori, cuocere 15 min, mantecare la pasta."_'
      );
      return res.status(200).end();
    }

    const { command, args } = parseCommand(text);

    // Route to appropriate handler
    if (command === 'view') {
      await handleViewCommand(chatId, args);
      return res.status(200).end();
    }

    if (command === 'delete') {
      await handleDeleteCommand(chatId, args);
      return res.status(200).end();
    }

    if (command === 'test') {
      await handleTestCommand(chatId);
      return res.status(200).end();
    }

    // If no command, treat as recipe submission
    await handleAddRecipe(chatId, text);

  } catch (err) {
    console.error(err);
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      await sendTelegram(chatId, `❌ Errore: ${err.message}`);
    }
  }

  res.status(200).end();
}