// api/services/gemini.js
import { slugifyName } from '../utils/recipes.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
  "notes": "eventuali note aggiuntive, varianti, suggerimenti o informazioni extra sulla ricetta (stringa vuota se non presenti)"
}

REQUISITI CAMPO "name":
Il nome deve riflettere esclusivamente l'unione dei componenti principali e della tecnica. Escludi qualsiasi informazione non essenziale:
- Riferimenti dietetici/salutistici (es. Low Carb, Senza Glutine).
- Note parentetiche su ingredienti minori.
- Aggettivazione soggettiva o narrativa (es. Classico, Fantastico, Della Nonna).

Unità di misura valide per "unit": g, kg, ml, l, n, pizzico, cucchiaio, cucchiai, cucchiaino, cucchiaini, fette, foglie, spicchi, cm.
Usa "n" per elementi contabili senza unità (es. 2 uova → amount: 2, unit: "n").
Non usare mai amount: 0. Se una quantità non è numerica (es. sale, pepe, olio), usa amount: 1 e unit: "pizzico".
Tutti i testi devono essere in italiano.

Ricetta da convertire:
${recipeText}
`;

  // Try with gemini-2.5-flash up to 3 times, then fall back to gemini-2.5-flash-lite
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 2000;

  for (let modelAttempt = 0; modelAttempt < 2; modelAttempt++) {
    const model = modelAttempt === 0 ? 'gemini-2.5-flash' : 'gemini-2.5-flash-lite';
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
          throw new Error(`Gemini error: ${response.status} — ${err}`);
        }

        const data = await response.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Strip any accidental markdown fences
        const cleaned = raw.replace(/```json|```/g, '').trim();

        try {
          const parsed = JSON.parse(cleaned);
          return normalizeRecipe(parsed);
        } catch {
          throw new Error(`Gemini ha restituito JSON non valido:\n${cleaned}`);
        }
      } catch (err) {
        const isLastRetry = attempt === MAX_RETRIES;
        const isLastModel = modelAttempt === 1;

        if (isLastRetry && isLastModel) {
          // All retries exhausted, throw error
          throw err;
        }

        if (!isLastRetry) {
          // Retry with same model after delay
          console.warn(`Attempt ${attempt + 1} failed for ${model}, retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } else if (modelAttempt === 0) {
          // All retries for gemini-2.5-flash exhausted, fall back to gemini-2.5-flash-lite
          console.warn(`${model} failed after ${MAX_RETRIES + 1} attempts, falling back to gemini-2.5-flash-lite...`);
        }
      }
    }
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

  if (!recipe.code || typeof recipe.code !== 'string' || !recipe.code.trim()) {
    recipe.code = slugifyName(recipe.name || 'ricetta');
  }

  return recipe;
}

export { structureWithGemini, normalizeRecipe };
