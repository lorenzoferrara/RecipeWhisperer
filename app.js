/* ─── STATE ─────────────────────────────────────────────── */
let allRecipes  = [];
let filtered    = [];

/* ─── EMOJI FALLBACKS (shown when image is missing) ─────── */
const TYPE_EMOJI = {
  'Main Dish': '🍝',
  'Salad':     '🥗',
  'Dessert':   '🍰',
  'Breakfast': '🥑',
  'Soup':      '🍲',
  'Appetizer': '🫒',
};
function emojiFor(type) { return TYPE_EMOJI[type] || '🍽'; }

/* ─── DOM REFS ───────────────────────────────────────────── */
const grid        = document.getElementById('recipe-grid');
const emptyState  = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const typeSelect  = document.getElementById('type-select');
const cuisineSelect = document.getElementById('cuisine-select');
const clearBtn    = document.getElementById('clear-btn');
const resultsCount = document.getElementById('results-count');

const backdrop    = document.getElementById('modal-backdrop');
const modalClose  = document.getElementById('modal-close');
const modalImg    = document.getElementById('modal-img');
const modalBadges = document.getElementById('modal-badges');
const modalMeta   = document.getElementById('modal-meta');
const modalTitle  = document.getElementById('modal-title');
const modalIngredients = document.getElementById('modal-ingredients');
const modalInstructions = document.getElementById('modal-instructions');

/* ─── INIT ───────────────────────────────────────────────── */
async function init() {
  try {
    const res  = await fetch('data/recipes.json');
    allRecipes = await res.json();
    populateFilters();
    applyFilters();
  } catch (err) {
    grid.innerHTML = `<p style="color:#b85c38;padding:24px">
      Impossibile caricare data/recipes.json — controlla che il file esista.
    </p>`;
    console.error(err);
  }
}

/* ─── POPULATE FILTER DROPDOWNS ─────────────────────────── */
function populateFilters() {
  const types    = [...new Set(allRecipes.map(r => r.type))].sort();
  const cuisines = [...new Set(allRecipes.map(r => r.cuisine))].sort();

  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  cuisines.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    cuisineSelect.appendChild(opt);
  });
}

/* ─── FILTER LOGIC ───────────────────────────────────────── */
function applyFilters() {
  const query   = searchInput.value.trim().toLowerCase();
  const type    = typeSelect.value;
  const cuisine = cuisineSelect.value;

  filtered = allRecipes.filter(r => {
    const matchType    = type    === 'all' || r.type    === type;
    const matchCuisine = cuisine === 'all' || r.cuisine === cuisine;
    const matchSearch  = !query  ||
      r.name.toLowerCase().includes(query) ||
      r.ingredients.some(i => i.toLowerCase().includes(query)) ||
      (r.tags || []).some(t => t.toLowerCase().includes(query));
    return matchType && matchCuisine && matchSearch;
  });

  renderCards();
  updateCount();
}

function clearFilters() {
  searchInput.value   = '';
  typeSelect.value    = 'all';
  cuisineSelect.value = 'all';
  applyFilters();
}

/* ─── RENDER CARDS ───────────────────────────────────────── */
function renderCards() {
  grid.innerHTML = '';
  const show = filtered.length > 0;
  emptyState.hidden = show;

  filtered.forEach((recipe, i) => {
    const card = document.createElement('article');
    card.className = 'recipe-card';
    card.style.animationDelay = `${i * 40}ms`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Apri ricetta: ${recipe.name}`);

        // Prefer optimized web images, then fallback to original png.
        const webImagePath = recipe.code ? `images/web/${recipe.code}.webp` : null;
        const pngImagePath = recipe.code ? `images/${recipe.code}.png` : null;
        const imgHtml = webImagePath
          ? `<img src="${webImagePath}" alt="${recipe.name}" loading="lazy" decoding="async"
            onerror="if(this.dataset.retried){this.parentNode.innerHTML='<div class=card-placeholder>${emojiFor(recipe.type)}</div>';}else{this.src='${pngImagePath}';this.dataset.retried='1';}" />`
      : `<div class="card-placeholder">${emojiFor(recipe.type)}</div>`;

    card.innerHTML = `
      <div class="card-image-wrap">
        ${imgHtml}
        <span class="card-badge">${escHtml(recipe.type)}</span>
      </div>
      <div class="card-body">
        <p class="card-cuisine">${escHtml(recipe.cuisine)}</p>
        <h2 class="card-title">${escHtml(recipe.name)}</h2>
        <div class="card-meta">
          ${recipe.time    ? `<span>⏱ ${recipe.time} min</span>` : ''}
          ${recipe.servings ? `<span>👤 ${recipe.servings} pers.</span>` : ''}
          ${recipe.difficulty ? `<span>◈ ${recipe.difficulty}</span>` : ''}
        </div>
      </div>`;

    const open = () => openModal(recipe);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
    grid.appendChild(card);
  });
}

function updateCount() {
  const total = allRecipes.length;
  const shown = filtered.length;
  resultsCount.textContent = shown === total
    ? `Tutte le ${total} ricette`
    : `${shown} di ${total} ricette`;
}

/* ─── FORMAT QUANTITY ────────────────────────────────────── */
function formatQty(amount, unit) {
  // Format number: remove trailing .0 but keep .5 etc.
  const num = Number(amount) % 1 === 0 ? String(Math.floor(amount)) : String(amount);

  const unitMap = {
    'n':          '',          // bare number, no unit label
    'g':          'g',
    'kg':         'kg',
    'ml':         'ml',
    'l':          'l',
    'pizzico':    'pizzico',
    'cucchiaio':  'cucchiaio',
    'cucchiai':   'cucchiai',
    'cucchiaino': 'cucchiaino',
    'cucchiaini': 'cucchiaini',
    'fette':      'fetta',
    'foglie':     'foglia',
    'spicchi':    'spicchio',
    'cm':         'cm',
  };

  const label = unitMap[unit] ?? unit;

  // Pluralise a handful of irregular Italian units
  const plurals = {
    'cucchiaio': 'cucchiai',
    'cucchiaino': 'cucchiaini',
    'fetta': 'fette',
    'foglia': 'foglie',
    'spicchio': 'spicchi',
    'pizzico': 'pizzichi',
  };
  const finalLabel = (Number(amount) > 1 && plurals[label]) ? plurals[label] : label;

  return finalLabel ? `${num} ${finalLabel}` : num;
}


function openModal(recipe) {
  // Image or emoji placeholder
  const webImagePath = recipe.code ? `images/web/${recipe.code}.webp` : null;
  const pngImagePath = recipe.code ? `images/${recipe.code}.png` : null;
  if (webImagePath) {
    modalImg.src   = webImagePath;
    modalImg.alt   = recipe.name;
    modalImg.style.display = '';
    modalImg.onerror = () => {
      // Try original png if optimized web image fails.
      if (!modalImg.dataset.retried) {
        modalImg.src = pngImagePath;
        modalImg.dataset.retried = '1';
      } else {
        // Both failed, show emoji
        modalImg.style.display = 'none';
        const existing = document.querySelector('.modal-placeholder');
        if (existing) existing.remove();
        const ph = document.createElement('div');
        ph.className = 'modal-placeholder';
        ph.textContent = emojiFor(recipe.type);
        modalImg.parentNode.insertBefore(ph, modalImg);
      }
    };
  } else {
    modalImg.style.display = 'none';
    const existing = document.querySelector('.modal-placeholder');
    if (existing) existing.remove();
    const ph = document.createElement('div');
    ph.className = 'modal-placeholder';
    ph.textContent = emojiFor(recipe.type);
    modalImg.parentNode.insertBefore(ph, modalImg);
  }

  // Badges
  modalBadges.innerHTML = `
    <span class="modal-badge terracotta">${escHtml(recipe.type)}</span>
    <span class="modal-badge">${escHtml(recipe.cuisine)}</span>
  `;

  // Meta
  modalMeta.innerHTML = [
    recipe.time       ? `<span>⏱ ${recipe.time} min</span>` : '',
    recipe.servings   ? `<span>👤 ${recipe.servings} persone</span>` : '',
    recipe.difficulty ? `<span>◈ ${recipe.difficulty}</span>` : '',
  ].join('');

  // Title
  modalTitle.textContent = recipe.name;

  // Ingredients
  modalIngredients.innerHTML = recipe.ingredients.map(ing => {
    if (typeof ing === 'string') {
      return `<li><span class="ing-name">${escHtml(ing)}</span></li>`;
    }
    const qty = formatQty(ing.amount, ing.unit);
    return `<li>
      <span class="ing-qty">${escHtml(qty)}</span>
      <span class="ing-name">${escHtml(ing.name)}</span>
    </li>`;
  }).join('');

  // Instructions — support both plain text (newline-separated) and arrays
  const steps = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : recipe.instructions.split('\n').filter(s => s.trim());

  modalInstructions.innerHTML = steps
    .map(s => `<li>${escHtml(s.replace(/^\d+\.\s*/, ''))}</li>`).join('');

  // Notes
  const notesSection = document.getElementById('modal-notes-section');
  const notesEl = document.getElementById('modal-notes');
  if (recipe.notes && recipe.notes.trim()) {
    notesEl.textContent = recipe.notes.trim();
    notesSection.hidden = false;
  } else {
    notesEl.textContent = '';
    notesSection.hidden = true;
  }

  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  modalClose.focus();
}

function closeModal() {
  backdrop.hidden = true;
  document.body.style.overflow = '';
  // Clean up any dynamic placeholder
  document.querySelector('.modal-placeholder')?.remove();
  modalImg.style.display = '';
  delete modalImg.dataset.retried;
  modalImg.src = '';
}

/* ─── EVENT LISTENERS ────────────────────────────────────── */
searchInput.addEventListener('input',  applyFilters);
typeSelect.addEventListener('change',  applyFilters);
cuisineSelect.addEventListener('change', applyFilters);
clearBtn.addEventListener('click',     clearFilters);
modalClose.addEventListener('click',   closeModal);
backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ─── UTILS ──────────────────────────────────────────────── */
function escHtml(str = '') {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── START ──────────────────────────────────────────────── */
init();