import { emojiFor } from '../utils/recipeUtils.js';

export default function RecipeCard({ recipe, index, onOpen, imageBroken, onImageError }) {
  function renderCardImage() {
    if (!recipe.code || imageBroken) {
      return <div className="card-placeholder">{emojiFor(recipe.type)}</div>;
    }

    return (
      <picture>
        <source srcSet={`/images/web/${recipe.code}.webp`} type="image/webp" />
        <img
          src={`/images/${recipe.code}.png`}
          alt={recipe.name}
          loading="lazy"
          decoding="async"
          onError={onImageError}
        />
      </picture>
    );
  }

  return (
    <article
      className="recipe-card"
      style={{ animationDelay: `${index * 40}ms` }}
      role="button"
      tabIndex={0}
      aria-label={`Apri ricetta: ${recipe.name}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
    >
      <div className="card-image-wrap">
        {renderCardImage()}
        <span className="card-badge">{recipe.type}</span>
      </div>
      <div className="card-body">
        <p className="card-cuisine">{recipe.cuisine}</p>
        <h2 className="card-title">{recipe.name}</h2>
        <div className="card-meta">
          {recipe.time ? <span>⏱ {recipe.time} min</span> : null}
          {recipe.servings ? <span>👤 {recipe.servings} pers.</span> : null}
          {recipe.difficulty ? <span>◈ {recipe.difficulty}</span> : null}
        </div>
      </div>
    </article>
  );
}
