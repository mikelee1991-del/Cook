import type { CookFilters, PantryItem, Recipe, RecipeSource } from '../types';
import {
  APPARATUS_OPTIONS,
  EASE_OPTIONS,
  FLAVOR_OPTIONS,
  SOURCE_OPTIONS,
  TIME_OPTIONS,
  useCookSuggestions,
} from '../hooks/useCookSuggestions';

interface CookTabProps {
  pantry: PantryItem[];
}

export function CookTab({ pantry }: CookTabProps) {
  const { filters, setFilters, suggestions } = useCookSuggestions(pantry);

  function toggleSource(source: RecipeSource) {
    setFilters((f) => {
      const has = f.sources.includes(source);
      const sources = has
        ? f.sources.filter((s) => s !== source)
        : [...f.sources, source];
      return { ...f, sources: sources.length ? sources : f.sources };
    });
  }

  function patch(partial: Partial<CookFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  return (
    <div className="tab-panel cook-panel">
      <header className="panel-intro">
        <h2>What should you cook?</h2>
        <p>
          Suggestions ranked by what you already have. NYT Cooking links open on their site;
          &ldquo;Your NYT saves&rdquo; is a starter set until you share a real saved-recipe list.
        </p>
      </header>

      <div className="filters">
        <label className="toggle">
          <input
            type="checkbox"
            checked={filters.requireAllIngredients}
            onChange={(e) => patch({ requireAllIngredients: e.target.checked })}
          />
          <span>Only recipes I have all ingredients for</span>
        </label>

        <div className="filters__row">
          <label className="field">
            <span className="field__label">Time</span>
            <select
              value={filters.maxMinutes ?? ''}
              onChange={(e) =>
                patch({
                  maxMinutes: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              {TIME_OPTIONS.map((o) => (
                <option key={String(o.value)} value={o.value ?? ''}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Ease</span>
            <select
              value={filters.ease}
              onChange={(e) => patch({ ease: e.target.value as CookFilters['ease'] })}
            >
              {EASE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Apparatus</span>
            <select
              value={filters.apparatus}
              onChange={(e) =>
                patch({ apparatus: e.target.value as CookFilters['apparatus'] })
              }
            >
              {APPARATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Flavor</span>
            <select
              value={filters.flavor}
              onChange={(e) => patch({ flavor: e.target.value as CookFilters['flavor'] })}
            >
              {FLAVOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="source-fieldset">
          <legend>Sources</legend>
          <div className="source-chips">
            {SOURCE_OPTIONS.map((o) => (
              <label key={o.value} className="chip">
                <input
                  type="checkbox"
                  checked={filters.sources.includes(o.value)}
                  onChange={() => toggleSource(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p className="result-count" aria-live="polite">
        {suggestions.length} dinner idea{suggestions.length === 1 ? '' : 's'}
      </p>

      <ul className="recipe-list">
        {suggestions.map(({ recipe, match }) => (
          <RecipeSuggestion key={recipe.id} recipe={recipe} match={match} />
        ))}
      </ul>

      {suggestions.length === 0 && (
        <p className="empty-state">
          Nothing matches these filters. Loosen time, ease, or ingredient requirements.
        </p>
      )}
    </div>
  );
}

function RecipeSuggestion({
  recipe,
  match,
}: {
  recipe: Recipe;
  match: {
    have: string[];
    missing: string[];
    optionalHave: string[];
    coverage: number;
    hasAll: boolean;
  };
}) {
  const pct = Math.round(match.coverage * 100);

  return (
    <li className="recipe">
      <div className="recipe__top">
        <div>
          <p className="recipe__source">{recipe.sourceLabel}</p>
          <h3 className="recipe__title">{recipe.title}</h3>
          <p className="recipe__desc">{recipe.description}</p>
        </div>
        <div className="recipe__coverage" aria-label={`${pct}% of ingredients on hand`}>
          <span className="recipe__coverage-num">{pct}%</span>
          <span className="recipe__coverage-label">on hand</span>
        </div>
      </div>

      <div className="recipe__meta">
        <span>{recipe.minutes} min</span>
        <span>{recipe.ease}</span>
        <span>{recipe.apparatus.join(' · ')}</span>
        <span>{recipe.flavors.join(' · ')}</span>
        <span>{recipe.servings} servings</span>
      </div>

      <div className="recipe__ingredients">
        <p>
          <strong>Have:</strong> {match.have.length ? match.have.join(', ') : '—'}
        </p>
        {match.missing.length > 0 && (
          <p className="recipe__missing">
            <strong>Need:</strong> {match.missing.join(', ')}
          </p>
        )}
        {match.optionalHave.length > 0 && (
          <p>
            <strong>Bonus on hand:</strong> {match.optionalHave.join(', ')}
          </p>
        )}
      </div>

      {recipe.url && (
        <a className="btn btn--primary" href={recipe.url} target="_blank" rel="noreferrer">
          Open recipe
        </a>
      )}
    </li>
  );
}
