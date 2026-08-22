import type { CookFilters, CookingApparatus, FlavorProfile, PantryItem, Recipe, RecipeSource } from '../types';
import type { FrozenCookTiming } from '../lib/frozenHandling';
import { SOURCE_OPTIONS, useCookSuggestions } from '../hooks/useCookSuggestions';
import {
  AVAILABLE_APPARATUS,
  EASE_SLIDER_LABELS,
  EASE_SLIDER_MAX,
  FLAVOR_OPTIONS,
  TIME_SLIDER_MAX,
  TIME_SLIDER_MIN,
  TIME_SLIDER_STEP,
  formatEaseFilter,
  formatTimeFilter,
} from '../lib/cookFilters';

interface CookTabProps {
  pantry: PantryItem[];
}

export function CookTab({ pantry }: CookTabProps) {
  const { filters, setFilters, suggestions } = useCookSuggestions(pantry);

  function patch(partial: Partial<CookFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function toggleSource(source: RecipeSource) {
    setFilters((f) => {
      const has = f.sources.includes(source);
      const sources = has
        ? f.sources.filter((s) => s !== source)
        : [...f.sources, source];
      return { ...f, sources: sources.length ? sources : f.sources };
    });
  }

  function toggleApparatus(id: CookingApparatus) {
    setFilters((f) => {
      const has = f.apparatus.includes(id);
      const apparatus = has ? f.apparatus.filter((a) => a !== id) : [...f.apparatus, id];
      return { ...f, apparatus };
    });
  }

  function toggleFlavor(flavor: FlavorProfile) {
    setFilters((f) => {
      const has = f.flavors.includes(flavor);
      const flavors = has ? f.flavors.filter((item) => item !== flavor) : [...f.flavors, flavor];
      return { ...f, flavors };
    });
  }

  return (
    <div className="tab-panel cook-panel">
      <header className="panel-intro">
        <h2>What should you cook?</h2>
        <p>
          Suggestions ranked by flavor fit with your pantry — taste first, then what you
          already have. Pick flavor chips to steer the mood. Frozen stock adds cook-from-frozen
          or rapid-thaw time, not an overnight defrost.
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

        <div className="slider-grid">
          <label className="slider-field">
            <span className="slider-field__top">
              <span className="field__label">Time</span>
              <span className="slider-field__value">{formatTimeFilter(filters.maxMinutes)}</span>
            </span>
            <input
              type="range"
              min={TIME_SLIDER_MIN}
              max={TIME_SLIDER_MAX}
              step={TIME_SLIDER_STEP}
              value={filters.maxMinutes}
              aria-valuetext={formatTimeFilter(filters.maxMinutes)}
              onChange={(e) => patch({ maxMinutes: Number(e.target.value) })}
            />
            <span className="slider-field__ticks" aria-hidden="true">
              <span>{TIME_SLIDER_MIN} min</span>
              <span>Any</span>
            </span>
          </label>

          <label className="slider-field">
            <span className="slider-field__top">
              <span className="field__label">Effort</span>
              <span className="slider-field__value">{formatEaseFilter(filters.maxEase)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={EASE_SLIDER_MAX}
              step={1}
              value={filters.maxEase}
              aria-valuetext={formatEaseFilter(filters.maxEase)}
              onChange={(e) => patch({ maxEase: Number(e.target.value) })}
            />
            <span className="slider-field__ticks" aria-hidden="true">
              {EASE_SLIDER_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </span>
          </label>
        </div>

        <fieldset className="source-fieldset">
          <legend>What you can cook with</legend>
          <div className="source-chips">
            {AVAILABLE_APPARATUS.map((o) => (
              <label key={o.id} className="chip">
                <input
                  type="checkbox"
                  checked={filters.apparatus.includes(o.id)}
                  onChange={() => toggleApparatus(o.id)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="source-fieldset">
          <legend>Flavor</legend>
          <div className="source-chips">
            {FLAVOR_OPTIONS.map((o) => (
              <label key={o.value} className="chip">
                <input
                  type="checkbox"
                  checked={filters.flavors.includes(o.value)}
                  onChange={() => toggleFlavor(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

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
        {suggestions.map(({ recipe, match, timing }) => (
          <RecipeSuggestion key={recipe.id} recipe={recipe} match={match} timing={timing} />
        ))}
      </ul>

      {suggestions.length === 0 && (
        <p className="empty-state">
          Nothing matches these filters. Give the time or effort sliders more room, or tick more
          gear.
        </p>
      )}
    </div>
  );
}

function RecipeSuggestion({
  recipe,
  match,
  timing,
}: {
  recipe: Recipe;
  match: {
    have: string[];
    missing: string[];
    optionalHave: string[];
    coverage: number;
    hasAll: boolean;
  };
  timing: FrozenCookTiming;
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
        <span>
          {timing.minutes} min
          {timing.extraMinutes > 0 ? ` (${recipe.minutes} + ${timing.extraMinutes} frozen)` : ''}
        </span>
        <span>{timing.ease}{timing.ease !== recipe.ease ? ' with thaw' : ''}</span>
        <span>{recipe.apparatus.join(' · ')}</span>
        <span>{recipe.flavors.join(' · ')}</span>
        <span>{recipe.servings} servings</span>
      </div>

      {timing.notes.length > 0 && (
        <p className="recipe__frozen">{timing.notes.join(' · ')}</p>
      )}

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
