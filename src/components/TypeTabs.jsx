import { typeLabel } from '../utils/recipeUtils.js';

export default function TypeTabs({ types, selectedType, onSelectType }) {
  return (
    <section className="dish-tabs-wrap" aria-label="Filtro rapido per tipo di piatto">
      <div className="dish-tabs-scroll" id="type-tabs">
        <button
          type="button"
          className={`dish-tab ${selectedType === 'all' ? 'active' : ''}`}
          onClick={() => onSelectType('all')}
        >
          Tutti
        </button>
        {types.map((type) => (
          <button
            key={type}
            type="button"
            className={`dish-tab ${selectedType === type ? 'active' : ''}`}
            onClick={() => onSelectType(type)}
          >
            {typeLabel(type)}
          </button>
        ))}
      </div>
    </section>
  );
}
