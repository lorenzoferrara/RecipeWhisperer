import { emojiFor, formatQty, normalizeInstructions } from '../utils/recipeUtils.js';

export default function RecipeModal({ recipe, modalImageFailed, onImageError, onClose }) {
  function renderModalImage() {
    if (!recipe.code || modalImageFailed) {
      return <div className="modal-placeholder">{emojiFor(recipe.type)}</div>;
    }

    return (
      <picture>
        <source srcSet={`/images/web/${recipe.code}.webp`} type="image/webp" />
        <img src={`/images/${recipe.code}.png`} alt={recipe.name} onError={onImageError} />
      </picture>
    );
  }

  return (
    <div
      className="modal-backdrop"
      id="modal-backdrop"
      aria-modal="true"
      role="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" id="modal">
        <button className="modal-close" id="modal-close" aria-label="Chiudi ricetta" onClick={onClose}>
          ✕
        </button>
        <div className="modal-image-wrap">{renderModalImage()}</div>
        <div className="modal-body">
          <h2 id="modal-title">{recipe.name}</h2>
          <div className="modal-badges" id="modal-badges">
            <span className="modal-badge terracotta">{recipe.type}</span>
            <span className="modal-badge">{recipe.cuisine}</span>
          </div>
          <div className="modal-meta" id="modal-meta">
            {recipe.time ? <span>⏱ {recipe.time} min</span> : null}
            {recipe.servings ? <span>👤 {recipe.servings} persone</span> : null}
            {recipe.difficulty ? <span>◈ {recipe.difficulty}</span> : null}
          </div>

          <div className="modal-section">
            <h3>Ingredienti</h3>
            <ul id="modal-ingredients">
              {recipe.ingredients.map((ingredient, idx) => {
                if (typeof ingredient === 'string') {
                  return (
                    <li key={`${ingredient}-${idx}`}>
                      <span className="ing-name">{ingredient}</span>
                    </li>
                  );
                }

                return (
                  <li key={`${ingredient.name}-${idx}`}>
                    <span className="ing-qty">{formatQty(ingredient.amount, ingredient.unit)}</span>
                    <span className="ing-name">{ingredient.name}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="modal-section">
            <h3>Preparazione</h3>
            <ol id="modal-instructions">
              {normalizeInstructions(recipe.instructions).map((step, idx) => (
                <li key={`${idx}-${step}`}>{step}</li>
              ))}
            </ol>
          </div>

          {recipe.notes && recipe.notes.trim() ? (
            <div className="modal-section" id="modal-notes-section">
              <h3>Note</h3>
              <p id="modal-notes">{recipe.notes.trim()}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
