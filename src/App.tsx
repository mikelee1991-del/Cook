import { useState } from 'react';
import { CookTab } from './components/CookTab';
import { PantryTab } from './components/PantryTab';
import { SavesTab } from './components/SavesTab';
import { usePantry } from './hooks/usePantry';
import { usePantryMedia } from './hooks/usePantryMedia';
import { usePhotoScans } from './hooks/usePhotoScans';
import { useRecommendedIngredients } from './hooks/useRecommendedIngredients';
import { useSavedRecipes } from './hooks/useSavedRecipes';
import { pantryDraftFromName } from './lib/pantryDraft';
import type { RecommendedIngredient } from './types';
import './App.css';

type Tab = 'pantry' | 'cook' | 'saves';

export default function App() {
  const [tab, setTab] = useState<Tab>('pantry');
  const { items, addItem, removeItem, resetPantry } = usePantry();
  const { media, error: mediaError, addMedia, removeMedia } = usePantryMedia();
  const {
    items: recommended,
    dismissedCount,
    addManual: addRecommended,
    updateItem: updateRecommended,
    removeItem: removeRecommended,
    clearDismissed: restoreRecommended,
  } = useRecommendedIngredients(items);
  const {
    recipes: savedRecipes,
    error: savesError,
    addPhotoRecipe,
    addLinkRecipe,
    removeRecipe,
    addImagesToRecipe,
  } = useSavedRecipes();
  const {
    scans,
    error: scanError,
    runScan,
    removeScan,
    removeClip,
    setClipKind,
  } = usePhotoScans();

  function addRecommendedToPantry(item: RecommendedIngredient) {
    addItem(pantryDraftFromName(item.name));
    removeRecommended(item);
  }

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />

      <header className="hero">
        <div className="hero__media" aria-hidden="true" />
        <div className="hero__content">
          <p className="brand">Dinner</p>
          <h1 className="hero__headline">Figure out dinner from what you already have.</h1>
          <p className="hero__lede">
            Scan pantry shelves and recipe pages, filter what to cook, and keep what matters.
          </p>
          <div className="hero__cta" role="group" aria-label="Choose a tab">
            <button
              type="button"
              className={tab === 'pantry' ? 'btn btn--primary' : 'btn btn--on-media'}
              onClick={() => setTab('pantry')}
            >
              Open pantry
            </button>
            <button
              type="button"
              className={tab === 'cook' ? 'btn btn--primary' : 'btn btn--on-media'}
              onClick={() => setTab('cook')}
            >
              Decide dinner
            </button>
            <button
              type="button"
              className={tab === 'saves' ? 'btn btn--primary' : 'btn btn--on-media'}
              onClick={() => setTab('saves')}
            >
              Save recipes
            </button>
          </div>
        </div>
      </header>

      <nav className="tabs" aria-label="Primary">
        <button
          type="button"
          className={tab === 'pantry' ? 'tabs__btn is-active' : 'tabs__btn'}
          onClick={() => setTab('pantry')}
          aria-current={tab === 'pantry' ? 'page' : undefined}
        >
          Pantry
        </button>
        <button
          type="button"
          className={tab === 'cook' ? 'tabs__btn is-active' : 'tabs__btn'}
          onClick={() => setTab('cook')}
          aria-current={tab === 'cook' ? 'page' : undefined}
        >
          Cook
        </button>
        <button
          type="button"
          className={tab === 'saves' ? 'tabs__btn is-active' : 'tabs__btn'}
          onClick={() => setTab('saves')}
          aria-current={tab === 'saves' ? 'page' : undefined}
        >
          Saves
        </button>
      </nav>

      <main className="main">
        {tab === 'pantry' && (
          <PantryTab
            items={items}
            media={media}
            mediaError={mediaError}
            recommended={recommended}
            dismissedCount={dismissedCount}
            onAdd={addItem}
            onRemove={removeItem}
            onReset={resetPantry}
            onAddMedia={addMedia}
            onRemoveMedia={removeMedia}
            onAddRecommended={addRecommended}
            onUpdateRecommended={updateRecommended}
            onRemoveRecommended={removeRecommended}
            onRestoreRecommended={restoreRecommended}
            onAddRecommendedToPantry={addRecommendedToPantry}
          />
        )}
        {tab === 'cook' && <CookTab pantry={items} />}
        {tab === 'saves' && (
          <SavesTab
            recipes={savedRecipes}
            scans={scans}
            storageError={savesError || scanError}
            onAddPhotos={addPhotoRecipe}
            onAddLink={addLinkRecipe}
            onRemove={removeRecipe}
            onAddImages={addImagesToRecipe}
            onRunScan={runScan}
            onRemoveScan={removeScan}
            onRemoveClip={removeClip}
            onSetClipKind={setClipKind}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          Data stays in this browser. Recipe page scans sort recipes vs other text automatically —
          keep or discard each clip.
        </p>
      </footer>
    </div>
  );
}
