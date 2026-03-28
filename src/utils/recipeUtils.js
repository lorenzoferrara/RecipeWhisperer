const TYPE_EMOJI = {
  'Main Dish': '🍝',
  Salad: '🥗',
  Dessert: '🍰',
  Breakfast: '🥑',
  Soup: '🍲',
  Appetizer: '🫒',
};

const TYPE_LABEL_MAP = {
  'Main Dish': 'Secondo',
  Appetizer: 'Antipasto',
  Dessert: 'Dolce',
  Breakfast: 'Colazione',
  Soup: 'Zuppa',
  Salad: 'Insalata',
};

const TYPE_ORDER = [
  'Antipasto',
  'Primo',
  'Secondo',
  'Contorno',
  'Insalata',
  'Zuppa',
  'Colazione',
  'Dolce',
];

export function emojiFor(type) {
  return TYPE_EMOJI[type] || '🍽';
}

export function typeLabel(type) {
  return TYPE_LABEL_MAP[type] || type;
}

export function sortTypes(a, b) {
  const aLabel = typeLabel(a);
  const bLabel = typeLabel(b);
  const aIndex = TYPE_ORDER.indexOf(aLabel);
  const bIndex = TYPE_ORDER.indexOf(bLabel);

  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;
  return aLabel.localeCompare(bLabel, 'it');
}

export function formatQty(amount, unit) {
  const num = Number(amount) % 1 === 0 ? String(Math.floor(amount)) : String(amount);

  const unitMap = {
    n: '',
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'l',
    pizzico: 'pizzico',
    cucchiaio: 'cucchiaio',
    cucchiai: 'cucchiai',
    cucchiaino: 'cucchiaino',
    cucchiaini: 'cucchiaini',
    fette: 'fetta',
    foglie: 'foglia',
    spicchi: 'spicchio',
    cm: 'cm',
  };

  const label = unitMap[unit] ?? unit;

  const plurals = {
    cucchiaio: 'cucchiai',
    cucchiaino: 'cucchiaini',
    fetta: 'fette',
    foglia: 'foglie',
    spicchio: 'spicchi',
    pizzico: 'pizzichi',
  };

  const finalLabel = Number(amount) > 1 && plurals[label] ? plurals[label] : label;
  return finalLabel ? `${num} ${finalLabel}` : num;
}

export function normalizeInstructions(instructions) {
  const steps = Array.isArray(instructions)
    ? instructions
    : String(instructions)
      .split('\n')
      .filter((step) => step.trim());

  return steps.map((step) => step.replace(/^\d+\.\s*/, ''));
}
