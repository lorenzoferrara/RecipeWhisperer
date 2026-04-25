// api/handlers/commands.js
import { getFileFromGitHub, commitToGitHub } from '../services/github.js';
import { sendTelegram } from '../services/telegram.js';
import { parseNumericId, parseCommand } from '../utils/parsing.js';
import { formatIngredientsForTelegram } from '../utils/recipes.js';
import { structureWithGemini } from '../services/gemini.js';

async function handleTestCommand(chatId) {
  await sendTelegram(chatId, '🧪 Testing Gemini API...');

  try {
    const testRecipe = `
Pasta al pomodoro

Ingredienti:
- 400g di pasta spaghetti
- 500g di pomodori pelati
- 3 spicchi di aglio
- 5 foglie di basilico fresco
- 60ml di olio extravergine di oliva
- Sale e pepe q.b.

Procedimento:
1. Scaldare l'olio in una padella grande
2. Aggiungere l'aglio affettato e rosolare leggermente
3. Versare i pomodori pelati e lasciare cuocere 15 minuti
4. Nel frattempo, cuocere la pasta in acqua salata
5. Scolare la pasta e aggiungerla al sugo
6. Mantecare bene e servire con basilico fresco
    `;

    const recipe = await structureWithGemini(testRecipe);

    const ingredientList = formatIngredientsForTelegram(recipe.ingredients);

    await sendTelegram(chatId,
      `✅ *Gemini API is working!*\n\n` +
      `📖 *${recipe.name}*\n` +
      `📋 *Tipo:* ${recipe.type}\n` +
      `🌍 *Cucina:* ${recipe.cuisine}\n` +
      `⏱ *Tempo:* ${recipe.time} min\n` +
      `💪 *Difficoltà:* ${recipe.difficulty}\n` +
      `👤 *Porzioni:* ${recipe.servings}\n\n` +
      `*Ingredienti:*\n${ingredientList}\n\n` +
      `_Test completed successfully!_`
    );
  } catch (err) {
    await sendTelegram(chatId, `❌ Test failed: ${err.message}`);
  }
}

async function handleViewCommand(chatId, args) {
  const { content } = await getFileFromGitHub('data/recipes.json');
  const recipes = JSON.parse(content);

  if (!recipes.length) {
    await sendTelegram(chatId, '📭 Nessuna ricetta disponibile.');
    return;
  }

  const requestedId = parseNumericId(args);
  if (args && requestedId === null) {
    await sendTelegram(chatId, '⚠️ Uso corretto: `/view` oppure `/view <id>`');
    return;
  }

  if (requestedId !== null) {
    const recipe = recipes.find((r) => Number(r.id) === requestedId);
    if (!recipe) {
      await sendTelegram(chatId, `❌ Ricetta con id ${requestedId} non trovata.`);
      return;
    }

    const ingredientList = formatIngredientsForTelegram(recipe.ingredients);

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
    return;
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
}

async function handleDeleteCommand(chatId, args) {
  const requestedId = parseNumericId(args);
  if (requestedId === null) {
    await sendTelegram(chatId, '⚠️ Uso corretto: `/delete <id>`');
    return;
  }

  const { content, sha } = await getFileFromGitHub('data/recipes.json');
  const recipes = JSON.parse(content);
  const recipeIndex = recipes.findIndex((r) => Number(r.id) === requestedId);

  if (recipeIndex === -1) {
    await sendTelegram(chatId, `❌ Ricetta con id ${requestedId} non trovata.`);
    return;
  }

  const [removedRecipe] = recipes.splice(recipeIndex, 1);

  await commitToGitHub(
    'data/recipes.json',
    JSON.stringify(recipes, null, 2),
    sha,
    `🗑 Elimina ricetta: ${removedRecipe.name}`
  );

  await sendTelegram(chatId, `🗑 Ricetta eliminata: *${removedRecipe.name}* (id: ${removedRecipe.id})`);
}

async function handleAddRecipe(chatId, recipeText) {
  if (recipeText.trim().length < 20) {
    await sendTelegram(chatId, '⚠️ Messaggio troppo corto. Scrivi la ricetta completa con ingredienti e procedimento.');
    return;
  }

  // Let the user know we're working
  await sendTelegram(chatId, '⏳ Sto elaborando la ricetta...');

  // 1. Call Gemini to structure the recipe
  const recipe = await structureWithGemini(recipeText);

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
  const ingredientList = formatIngredientsForTelegram(recipe.ingredients);

  await sendTelegram(chatId,
    `✅ *${recipe.name}* aggiunta!\n\n` +
    `📋 *Tipo:* ${recipe.type}\n` +
    `🌍 *Cucina:* ${recipe.cuisine}\n` +
    `⏱ *Tempo:* ${recipe.time} min\n` +
    `👤 *Porzioni:* ${recipe.servings}\n\n` +
    `*Ingredienti:*\n${ingredientList}\n\n` +
    `_Il sito si aggiornerà in circa 1 minuto._`
  );
}

export { handleViewCommand, handleDeleteCommand, handleAddRecipe, handleTestCommand };
