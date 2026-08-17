import { useState } from 'react';
import { CookTab } from './components/CookTab';
import { PantryTab } from './components/PantryTab';
import { SavesTab } from './components/SavesTab';
import { usePantry } from './hooks/usePantry';
import { useSavedRecipes } from './hooks/useSavedRecipes';
import './App.css';

type Tab = 'pantry' | 'cook' | 'saves';

export default function App() {
  const [tab, setTab] = useState<Tab>('pantry');
  const { items, addItem, removeItem, resetPantry } = usePantry();
  const {
    recipes: savedRecipes,
    error: savesError,
    addPhotoRecipe,
    addLinkRecipe,
    removeRecipe,
    addImagesToRecipe,
  } = useSavedRecipes();

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />

      <header className="hero">
        <div className="hero__media" aria-hidden="true" />
        <div className="hero__content">
          <p className="brand">Dinner</p>
          <h1 className="hero__headline">Figure out dinner from what you already have.</h1>
          <p className="hero__lede">
            Keep a living pantry, filter what to cook, and save recipe photos or internet favorites.
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
            onAdd={addItem}
            onRemove={removeItem}
            onReset={resetPantry}
          />
        )}
        {tab === 'cook' && <CookTab pantry={items} />}
        {tab === 'saves' && (
          <SavesTab
            recipes={savedRecipes}
            storageError={savesError}
            onAddPhotos={addPhotoRecipe}
            onAddLink={addLinkRecipe}
            onRemove={removeRecipe}
            onAddImages={addImagesToRecipe}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          Pantry and saves persist in this browser. Only basic spices are auto-loaded — store
          purchase history is never invented.
        </p>
      </footer>
    </div>
  );
}
