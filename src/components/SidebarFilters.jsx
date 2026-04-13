import { typeLabel } from '../utils/recipeUtils.js';

export default function SidebarFilters({
  search,
  selectedType,
  selectedCuisine,
  types,
  cuisines,
  resultsCount,
  cardsPerRow,
  onSearchChange,
  onTypeChange,
  onCuisineChange,
  onCardsPerRowChange,
  onClearFilters,
}) {
  return (
    <aside className="sidebar">
      <p className="sidebar-heading">Filtri</p>

      <div className="filter-group">
        <label htmlFor="search-input">Cerca</label>
        <input
          type="text"
          id="search-input"
          placeholder="ingrediente o nome…"
          autoComplete="off"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="type-select">Tipo di piatto</label>
        <select id="type-select" value={selectedType} onChange={(e) => onTypeChange(e.target.value)}>
          <option value="all">Tutti i tipi</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {typeLabel(type)}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="cuisine-select">Cucina</label>
        <select
          id="cuisine-select"
          value={selectedCuisine}
          onChange={(e) => onCuisineChange(e.target.value)}
        >
          <option value="all">Tutte le cucine</option>
          {cuisines.map((cuisine) => (
            <option key={cuisine} value={cuisine}>
              {cuisine}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="rows-select">Ricette per riga</label>
        <select
          id="rows-select"
          value={cardsPerRow}
          onChange={(e) => onCardsPerRowChange(Number(e.target.value))}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
          <option value={5}>5</option>
        </select>
      </div>

      <button id="clear-btn" className="clear-btn" onClick={onClearFilters}>
        Azzera filtri
      </button>

      <p className="results-count" id="results-count">
        {resultsCount}
      </p>
    </aside>
  );
}
