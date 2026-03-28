// api/bot.js — Vercel Serverless Function
// Receives Telegram webhook, calls Gemini, commits to GitHub

const fs = require('fs');
const path = require('path');

const TELEGRAM_TOKEN  = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY  = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN    = process.env.GITHUB_TOKEN;
const GITHUB_REPO     = process.env.GITHUB_REPO;     // es. "lorenzoferrara/RecipeWhisperer"
const ALLOWED_CHAT_ID = process.env.ALLOWED_CHAT_ID; // il tuo chat_id numerico

// ─── ENTRY POINT ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, msg: 'bot is alive' });
  }

  try {
    const { message } = req.body;
    if (!message) return res.status(200).end();

    const chatId = String(message.chat.id);
    const text   = message.text || '';

    // Security: only respond to you
    if (chatId !== String(ALLOWED_CHAT_ID)) {
      await sendTelegram(chatId, '⛔ Non sei autorizzato.');
      return res.status(200).end();
    }

    // Commands
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(chatId,
        '👨‍🍳 *Recipe Whisperer*\n\n' +
        'Mandami una ricetta in linguaggio naturale e la aggiungo automaticamente al sito.\n\n' +
        '*Comandi disponibili:*\n' +
        '`/view` → lista ricette\n' +
        '`/view <id>` → dettagli ricetta\n' +
        '`/delete <id>` → elimina ricetta\n\n' +
        'Puoi scrivere in modo libero, ad esempio:\n' +
        '_"Pasta al pomodoro: 320g spaghetti, 400g pomodori pelati, aglio, olio, basilico. Soffriggere aglio, aggiungere pomodori, cuocere 15 min, mantecare la pasta."_'
      );
      return res.status(200).end();
    }

    const { command, args } = parseCommand(text);

    if (command === 'view') {
      const { content } = await getFileFromGitHub('data/recipes.json');
      const recipes = JSON.parse(content);

      if (!recipes.length) {
        await sendTelegram(chatId, '📭 Nessuna ricetta disponibile.');
        return res.status(200).end();
      }

      const requestedId = parseNumericId(args);
      if (args && requestedId === null) {
        await sendTelegram(chatId, '⚠️ Uso corretto: `/view` oppure `/view <id>`');
        return res.status(200).end();
      }

      if (requestedId !== null) {
        const recipe = recipes.find((r) => Number(r.id) === requestedId);
        if (!recipe) {
          await sendTelegram(chatId, `❌ Ricetta con id ${requestedId} non trovata.`);
          return res.status(200).end();
        }

        const ingredientList = (recipe.ingredients || [])
          .map((i) => `• ${i.amount} ${i.unit !== 'n' ? i.unit : ''} ${i.name}`.trim())
          .join('\n');

        await sendTelegram(chatId,
          `📖 *${recipe.name}* (id: ${recipe.id})\n` +
          `🆔 *Codice:* ${recipe.code || 'n/a'}\n\n` +
          `📋 *Tipo:* ${recipe.type}\n` +
          `🌍 *Cucina:* ${recipe.cuisine}\n` +
          `⏱ *Tempo:* ${recipe.time} min\n` +
          `💪 *Difficoltà:* ${recipe.difficulty}\n` +
          `👤 *Porzioni:* ${recipe.servings}\n\n` +
          `*Ingredienti:*\n${ingredientList || 'Nessun ingrediente'}\n\n` +
          `*Procedimento:*\n${recipe.instructions || 'Nessun procedimento'}`
        );
        return res.status(200).end();
      }

      const list = recipes
        .slice()
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map((r) => `• ${r.id} — ${r.name}`)
        .join('\n');

      await sendTelegram(chatId,
        `📚 *Ricette disponibili (${recipes.length})*\n\n${list}\n\n` +
        'Usa `/view <id>` per vedere i dettagli.'
      );
      return res.status(200).end();
    }

    if (command === 'delete') {
      const requestedId = parseNumericId(args);
      if (requestedId === null) {
        await sendTelegram(chatId, '⚠️ Uso corretto: `/delete <id>`');
        return res.status(200).end();
      }

      const { content, sha } = await getFileFromGitHub('data/recipes.json');
      const recipes = JSON.parse(content);
      const recipeIndex = recipes.findIndex((r) => Number(r.id) === requestedId);

      if (recipeIndex === -1) {
        await sendTelegram(chatId, `❌ Ricetta con id ${requestedId} non trovata.`);
        return res.status(200).end();
      }

      const [removedRecipe] = recipes.splice(recipeIndex, 1);

      await commitToGitHub(
        'data/recipes.json',
        JSON.stringify(recipes, null, 2),
        sha,
        `🗑 Elimina ricetta: ${removedRecipe.name}`
      );

      await sendTelegram(chatId, `🗑 Ricetta eliminata: *${removedRecipe.name}* (id: ${removedRecipe.id})`);
      return res.status(200).end();
    }

    if (text.trim().length < 20) {
      await sendTelegram(chatId, '⚠️ Messaggio troppo corto. Scrivi la ricetta completa con ingredienti e procedimento.');
      return res.status(200).end();
    }

    // Let the user know we're working
    await sendTelegram(chatId, '⏳ Sto elaborando la ricetta...');

    // 1. Call Gemini to structure the recipe
    const recipe = await structureWithGemini(text);

    // 2. Load current data/recipes.json from GitHub
    const { content, sha } = await getFileFromGitHub('data/recipes.json');
    const recipes = JSON.parse(content);

    // 3. Assign a new id and push
    recipe.id = recipes.length > 0 ? Math.max(...recipes.map(r => r.id)) + 1 : 1;
    recipes.push(recipe);

    // 4. Commit back to GitHub
    await commitToGitHub(
      'data/recipes.json',
      JSON.stringify(recipes, null, 2),
      sha,
      `🍽 Aggiungi ricetta: ${recipe.name}`
    );

    // 5. Confirm to user
    const ingredientList = recipe.ingredients
      .map(i => `• ${i.amount} ${i.unit !== 'n' ? i.unit : ''} ${i.name}`.trim())
      .join('\n');

    await sendTelegram(chatId,
      `✅ *${recipe.name}* aggiunta!\n\n` +
      `📋 *Tipo:* ${recipe.type}\n` +
      `🌍 *Cucina:* ${recipe.cuisine}\n` +
      `⏱ *Tempo:* ${recipe.time} min\n` +
      `👤 *Porzioni:* ${recipe.servings}\n\n` +
      `*Ingredienti:*\n${ingredientList}\n\n` +
      `_Il sito si aggiornerà in circa 1 minuto._`
    );

  } catch (err) {
    console.error(err);
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      await sendTelegram(chatId, `❌ Errore: ${err.message}`);
    }
  }

  res.status(200).end();
}

// ─── GEMINI ───────────────────────────────────────────────────
async function structureWithGemini(recipeText) {
  const prompt = `
Sei un assistente che converte ricette scritte in linguaggio naturale in JSON strutturato.

Dato il seguente testo di una ricetta, restituisci SOLO un oggetto JSON valido, senza markdown, senza backtick, senza spiegazioni.

Il JSON deve avere esattamente questa struttura:
{
  "name": "Nome della ricetta",
  "code": "codice univoco breve, lowercase, underscore (es. pasta_al_pomodoro)",
  "type": "uno tra: Primo, Secondo, Contorno, Dolce, Colazione, Antipasto, Zuppa",
  "cuisine": "es. Italiana, Francese, Indiana, Greca, Moderna, Giapponese, ecc.",
  "ingredients": [
    { "name": "nome ingrediente", "amount": 200, "unit": "g" }
  ],
  "instructions": "1. Primo passo.\n2. Secondo passo.\n3. ...",
  "time": 30,
  "difficulty": "uno tra: Facile, Media, Difficile",
  "servings": "numero d servings",
  "tags": ["tag1", "tag2"],
  "image": "",
  "notes": "eventuali note aggiuntive, varianti, suggerimenti o informazioni extra sulla ricetta (stringa vuota se non presenti)"
}

Unità di misura valide per "unit": g, kg, ml, l, n, pizzico, cucchiaio, cucchiai, cucchiaino, cucchiaini, fette, foglie, spicchi, cm.
Usa "n" per elementi contabili senza unità (es. 2 uova → amount: 2, unit: "n").
Non usare mai amount: 0. Se una quantità non è numerica (es. sale, pepe, olio), usa amount: 1 e unit: "pizzico".
Il campo "image" lascialo sempre stringa vuota "".
Tutti i testi devono essere in italiano.

Ricetta da convertire:
${recipeText}
`;

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error: ${err}`);
  }

  const data = await response.json();
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return normalizeRecipe(parsed);
  } catch {
    throw new Error(`Gemini ha restituito JSON non valido:\n${cleaned}`);
  }
}

function slugifyName(name) {
  let base = String(name || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (base.length <= 32) return base;

  const words = base.split('_').filter(Boolean);
  const parts = [];
  for (const w of words) {
    const candidate = parts.concat(w).join('_');
    if (candidate.length <= 32) {
      parts.push(w);
    } else {
      break;
    }
  }

  const stopWords = new Set(['e', 'di', 'a', 'da', 'in', 'con', 'per', 'al', 'alla', 'del', 'della', 'dello']);
  if (parts.length > 1 && stopWords.has(parts[parts.length - 1])) {
    parts.pop();
  }

  return parts.length > 0 ? parts.join('_') : base.slice(0, 32).replace(/_$/g, '');
}

function normalizeRecipe(recipe) {
  if (!recipe || !Array.isArray(recipe.ingredients)) return recipe;

  recipe.ingredients = recipe.ingredients.map((ing) => {
    if (typeof ing.amount !== 'number' || ing.amount !== 0) {
      return ing;
    }

    const name = (ing.name || '').toLowerCase();
    if (name.includes('sale') || name.includes('pepe') || name.includes('olio')) {
      return { ...ing, amount: 1, unit: 'pizzico' };
    }

    if (ing.unit === 'n') {
      return { ...ing, amount: 1, unit: 'n' };
    }

    return { ...ing, amount: 1, unit: 'pizzico' };
  });

  if (!recipe.code || typeof recipe.code !== 'string' || !recipe.code.trim()) {
    recipe.code = slugifyName(recipe.name || 'ricetta');
  }


  return recipe;
}

// ─── GITHUB API ───────────────────────────────────────────────
async function getFileFromGitHub(path) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    }
  });

  if (!res.ok) throw new Error(`GitHub GET error: ${res.status}`);

  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { content, sha: data.sha };
}

async function commitToGitHub(path, content, sha, message) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const encoded = Buffer.from(content).toString('base64');

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: encoded, sha })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub commit error: ${res.status} — ${err}`);
  }
}

// ─── TELEGRAM ────────────────────────────────────────────────
async function sendTelegram(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    })
  });
}

function parseCommand(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^\/([a-zA-Z]+)(?:@\w+)?(?:\s+([\s\S]*))?$/);

  if (!match) {
    return { command: null, args: '' };
  }

  return {
    command: match[1].toLowerCase(),
    args: (match[2] || '').trim(),
  };
}

function parseNumericId(raw) {
  const normalized = String(raw || '').trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return null;
  return Number(normalized);
}