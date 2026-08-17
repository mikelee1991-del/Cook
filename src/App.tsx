import { useState } from 'react';
import { CookTab } from './components/CookTab';
import { PantryTab } from './components/PantryTab';
import { usePantry } from './hooks/usePantry';
import './App.css';

type Tab = 'pantry' | 'cook';

export default function App() {
  const [tab, setTab] = useState<Tab>('pantry');
  const { items, addItem, removeItem, resetPantry } = usePantry();

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />

      <header className="hero">
        <div className="hero__media" aria-hidden="true" />
        <div className="hero__content">
          <p className="brand">Supper</p>
          <h1 className="hero__headline">Figure out dinner from what you already have.</h1>
          <p className="hero__lede">
            Keep a living pantry, then filter recipes by ingredients, time, ease, apparatus, and
            flavor.
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
      </nav>

      <main className="main">
        {tab === 'pantry' ? (
          <PantryTab
            items={items}
            onAdd={addItem}
            onRemove={removeItem}
            onReset={resetPantry}
          />
        ) : (
          <CookTab pantry={items} />
        )}
      </main>

      <footer className="footer">
        <p>
          Pantry persists in this browser. Purchase-history and NYT saved recipes are starter
          seeds until live exports are connected.
        </p>
      </footer>
    </div>
  );
}
