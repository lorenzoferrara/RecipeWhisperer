import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import RecipeCard from './components/RecipeCard.jsx';
import RecipeModal from './components/RecipeModal.jsx';
import SidebarFilters from './components/SidebarFilters.jsx';
import TypeTabs from './components/TypeTabs.jsx';
import { sortTypes } from './utils/recipeUtils.js';

export default function App() {
  const [allRecipes, setAllRecipes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCuisine, setSelectedCuisine] = useState('all');
  const [cardsPerRow, setCardsPerRow] = useState(3);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [brokenCardImages, setBrokenCardImages] = useState(() => new Set());
  const [modalImageFailed, setModalImageFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRecipes() {
      try {
        const res = await fetch('/data/recipes.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (active) {
          setAllRecipes(data);
          setLoadError('');
        }
      } catch (err) {
        if (active) {
          setLoadError('Impossibile caricare data/recipes.json.');
        }
        console.error(err);
      }
    }

    loadRecipes();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedRecipe(null);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = selectedRecipe ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedRecipe]);

  const types = useMemo(
    () => [...new Set(allRecipes.map((r) => r.type))].sort(sortTypes),
    [allRecipes]
  );

  const cuisines = useMemo(
    () => [...new Set(allRecipes.map((r) => r.cuisine))].sort(),
    [allRecipes]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allRecipes.filter((recipe) => {
      const matchType = selectedType === 'all' || recipe.type === selectedType;
      const matchCuisine = selectedCuisine === 'all' || recipe.cuisine === selectedCuisine;
      const matchSearch =
        !query ||
        recipe.name.toLowerCase().includes(query) ||
        recipe.ingredients.some((ingredient) => {
          const label = typeof ingredient === 'string' ? ingredient : ingredient.name;
          return String(label).toLowerCase().includes(query);
        }) ||
        (recipe.tags || []).some((tag) => tag.toLowerCase().includes(query));

      return matchType && matchCuisine && matchSearch;
    });
  }, [allRecipes, search, selectedType, selectedCuisine]);

  const resultsCount =
    filtered.length === allRecipes.length
      ? `Tutte le ${allRecipes.length} ricette`
      : `${filtered.length} di ${allRecipes.length} ricette`;

  function clearFilters() {
    setSearch('');
    setSelectedType('all');
    setSelectedCuisine('all');
  }

  function openModal(recipe) {
    setModalImageFailed(false);
    setSelectedRecipe(recipe);
  }

  function markCardImageBroken(code) {
    setBrokenCardImages((prev) => {
      const next = new Set(prev);
      next.add(code);
      return next;
    });
  }

  return (
    <>
      <Header />

      <div className="page-layout">
        <SidebarFilters
          search={search}
          selectedType={selectedType}
          selectedCuisine={selectedCuisine}
          types={types}
          cuisines={cuisines}
          resultsCount={resultsCount}
          cardsPerRow={cardsPerRow}
          onSearchChange={setSearch}
          onTypeChange={setSelectedType}
          onCuisineChange={setSelectedCuisine}
          onCardsPerRowChange={setCardsPerRow}
          onClearFilters={clearFilters}
        />

        <main>
          <TypeTabs types={types} selectedType={selectedType} onSelectType={setSelectedType} />

          {loadError ? (
            <p style={{ color: '#b85c38', padding: '24px' }}>{loadError}</p>
          ) : (
            <div
              className="recipe-grid"
              id="recipe-grid"
              style={{ '--cards-per-row': cardsPerRow }}
            >
              {filtered.map((recipe, i) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  index={i}
                  imageBroken={brokenCardImages.has(recipe.code)}
                  onImageError={() => markCardImageBroken(recipe.code)}
                  onOpen={() => openModal(recipe)}
                />
              ))}
            </div>
          )}

          {!loadError && filtered.length === 0 ? (
            <div className="empty-state" id="empty-state">
              <span className="empty-icon">🍽</span>
              <p>Nessuna ricetta corrisponde ai filtri selezionati.</p>
              <button onClick={clearFilters}>Azzera filtri</button>
            </div>
          ) : null}
        </main>
      </div>

      {selectedRecipe ? (
        <RecipeModal
          recipe={selectedRecipe}
          modalImageFailed={modalImageFailed}
          onImageError={() => setModalImageFailed(true)}
          onClose={() => setSelectedRecipe(null)}
        />
      ) : null}
    </>
  );
}
