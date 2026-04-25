// api/utils/recipes.js

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

function formatIngredientsForTelegram(ingredients) {
  return (ingredients || [])
    .map((i) => `• ${i.amount} ${i.unit !== 'n' ? i.unit : ''} ${i.name}`.trim())
    .join('\n');
}

export { slugifyName, formatIngredientsForTelegram };
