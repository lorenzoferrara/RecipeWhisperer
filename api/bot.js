// api/bot.js — Vercel Serverless Function
// Receives Telegram webhook, calls Gemini, commits to GitHub

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
        'Puoi scrivere in modo libero, ad esempio:\n' +
        '_"Pasta al pomodoro: 320g spaghetti, 400g pomodori pelati, aglio, olio, basilico. Soffriggere aglio, aggiungere pomodori, cuocere 15 min, mantecare la pasta."_'
      );
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

    // 2. Load current recipes.json from GitHub
    const { content, sha } = await getFileFromGitHub('recipes.json');
    const recipes = JSON.parse(content);

    // 3. Assign a new id and push
    recipe.id = recipes.length > 0 ? Math.max(...recipes.map(r => r.id)) + 1 : 1;
    recipes.push(recipe);

    // 4. Commit back to GitHub
    await commitToGitHub(
      'recipes.json',
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