// api/bot.js — Vercel Serverless Function
// Telegram webhook → Gemini → conferma con bottoni → commit GitHub

import Redis from 'ioredis';

const TELEGRAM_TOKEN  = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY  = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN    = process.env.GITHUB_TOKEN;
const GITHUB_REPO     = process.env.GITHUB_REPO;
const ALLOWED_CHAT_ID = process.env.ALLOWED_CHAT_ID;

const KV_TTL = 600; // secondi — la ricetta scade dopo 10 minuti

// Redis client — riutilizzato tra invocazioni warm
let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      tls: { rejectUnauthorized: false }, // richiesto da Vercel Redis
      maxRetriesPerRequest: 3,
    });
  }
  return redis;
}

// ─── ENTRY POINT ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, msg: 'bot is alive' });
  }

  try {
    const body = req.body;

    if (body.callback_query) {
      await handleCallback(body.callback_query);
      return res.status(200).end();
    }

    const { message } = body;
    if (!message) return res.status(200).end();

    const chatId = String(message.chat.id);
    const text   = (message.text || '').trim();

    if (chatId !== String(ALLOWED_CHAT_ID)) {
      await sendMessage(chatId, '⛔ Non sei autorizzato.');
      return res.status(200).end();
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendMessage(chatId,
        '👨‍🍳 *Recipe Whisperer*\n\n' +
        'Mandami una ricetta in linguaggio naturale e la aggiungo al sito.\n\n' +
        '*Esempio:*\n' +
        '_Pasta al pomodoro per 4: 320g spaghetti, 400g pomodori pelati, 2 spicchi aglio, olio, basilico. ' +
        'Soffriggere aglio, aggiungere pomodori, cuocere 15 min, mantecare la pasta._'
      );
      return res.status(200).end();
    }

    if (text.length < 20) {
      await sendMessage(chatId, '⚠️ Messaggio troppo corto. Scrivi la ricetta completa con ingredienti e procedimento.');
      return res.status(200).end();
    }

    await sendMessage(chatId, '⏳ Sto elaborando la ricetta con Gemini...');

    const recipe = await structureWithGemini(text);

    // Salva la ricetta in Redis con TTL di 10 minuti
    const db = getRedis();
    await db.set(`recipe:${chatId}`, JSON.stringify(recipe), 'EX', KV_TTL);

    await sendMessageWithButtons(
      chatId,
      `📋 *Riepilogo ricetta*\n\n${buildPreview(recipe)}\n\nAggiungo questa ricetta al sito?`,
      [[
        { text: '✅ Sì, aggiungi', callback_data: 'confirm' },
        { text: '❌ No, annulla',  callback_data: 'cancel'  },
      ]]
    );

  } catch (err) {
    console.error(err);
    const chatId = req.body?.message?.chat?.id || req.body?.callback_query?.message?.chat?.id;
    if (chatId) await sendMessage(String(chatId), `❌ Errore: ${err.message}`);
  }

  res.status(200).end();
}

// ─── GESTIONE BOTTONI ─────────────────────────────────────────
async function handleCallback(cb) {
  const chatId = String(cb.message.chat.id);
  const msgId  = cb.message.message_id;
  const action = cb.data;

  if (chatId !== String(ALLOWED_CHAT_ID)) return;

  await answerCallback(cb.id);

  const db = getRedis();

  if (action === 'cancel') {
    await db.del(`recipe:${chatId}`);
    await editText(chatId, msgId, '❌ Ricetta annullata.');
    return;
  }

  if (action === 'confirm') {
    await editText(chatId, msgId, '⏳ Sto salvando sul sito...');

    const raw = await db.get(`recipe:${chatId}`);
    if (!raw) {
      await editText(chatId, msgId, '❌ Ricetta scaduta (10 min). Rimandala da capo.');
      return;
    }

    const recipe = JSON.parse(raw);

    const { content, sha } = await githubGet('recipes.json');
    const recipes = JSON.parse(content);
    recipe.id = recipes.length > 0 ? Math.max(...recipes.map(r => r.id)) + 1 : 1;
    recipes.push(recipe);

    await githubCommit(
      'recipes.json',
      JSON.stringify(recipes, null, 2),
      sha,
      `🍽 Aggiungi ricetta: ${recipe.name}`
    );

    await db.del(`recipe:${chatId}`);

    await editText(chatId, msgId,
      `✅ *${recipe.name}* aggiunta!\n\n_Il sito si aggiornerà in circa 1 minuto._`
    );
  }
}

// ─── PREVIEW ─────────────────────────────────────────────────
function buildPreview(recipe) {
  const ings = recipe.ingredients
    .map(i => {
      const qty = i.unit && i.unit !== 'n' ? `${i.amount} ${i.unit}` : `${i.amount}`;
      return `• ${qty} ${i.name}`;
    })
    .join('\n');

  const steps = recipe.instructions.split('\n');
  const stepsPreview = steps.slice(0, 3).join('\n') + (steps.length > 3 ? '\n_..._' : '');

  return (
    `*${recipe.name}*\n` +
    `📋 ${recipe.type}  🌍 ${recipe.cuisine}\n` +
    `⏱ ${recipe.time} min  👤 ${recipe.servings} persone  ◈ ${recipe.difficulty}\n\n` +
    `*Ingredienti:*\n${ings}\n\n` +
    `*Preparazione:*\n${stepsPreview}`
  );
}

// ─── GEMINI ───────────────────────────────────────────────────
async function structureWithGemini(recipeText) {
  const prompt = `
Sei un assistente che converte ricette scritte in linguaggio naturale in JSON strutturato.
Restituisci SOLO un oggetto JSON valido, senza markdown, senza backtick, senza spiegazioni.

Struttura richiesta:
{
  "name": "Nome della ricetta",
  "type": "uno tra: Primo, Secondo, Contorno, Dolce, Colazione, Antipasto, Zuppa",
  "cuisine": "es. Italiana, Francese, Indiana, Greca, Moderna, Giapponese, ecc.",
  "ingredients": [
    { "name": "nome ingrediente", "amount": 200, "unit": "g" }
  ],
  "instructions": "1. Primo passo.\n2. Secondo passo.\n3. ...",
  "time": 30,
  "difficulty": "uno tra: Facile, Media, Difficile",
  "servings": 4,
  "tags": ["tag1", "tag2"],
  "image": ""
}

Unità valide per "unit": g, kg, ml, l, n, pizzico, cucchiaio, cucchiai, cucchiaino, cucchiaini, fette, foglie, spicchi, cm.
Usa "n" per elementi contabili (es. 2 uova → amount: 2, unit: "n").
Il campo "image" lascialo sempre "".
Tutti i testi in italiano.

Ricetta:
${recipeText}
`;

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    }
  );

  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data    = await res.json();
  const raw     = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = raw.replace(/```json|```/g, '').trim();

  try { return JSON.parse(cleaned); }
  catch { throw new Error(`JSON non valido da Gemini:\n${cleaned}`); }
}

// ─── GITHUB ───────────────────────────────────────────────────
async function githubGet(path) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) throw new Error(`GitHub GET error: ${res.status}`);
  const data = await res.json();
  return { content: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
}

async function githubCommit(path, content, sha, message) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), sha })
    }
  );
  if (!res.ok) throw new Error(`GitHub commit error: ${res.status} — ${await res.text()}`);
}

// ─── TELEGRAM ────────────────────────────────────────────────
async function sendMessage(chatId, text, extra = {}) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
  });
  return res.json();
}

async function sendMessageWithButtons(chatId, text, buttons) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    })
  });
  return res.json();
}

async function editText(chatId, messageId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown' })
  });
}

async function answerCallback(callbackQueryId) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId })
  });
}