import { useMemo, useState } from 'react';
import { groceryCatalog } from '../data/pantrySeed';
import type { PantryItem, PantrySection, Store } from '../types';
import {
  formatExpiryLabel,
  getExpirationStatus,
  todayISO,
} from '../lib/pantryUtils';

const STORES: Store[] = [
  "Ralph's",
  'Vons',
  'Whole Foods',
  "Trader Joe's",
  'Costco',
  'Other',
  'Staple',
];

const SECTIONS: { id: PantrySection; label: string }[] = [
  { id: 'fresh', label: 'Fresh produce' },
  { id: 'refrigerated', label: 'Refrigerated' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'dry', label: 'Dry goods & staples' },
];

interface PantryTabProps {
  items: PantryItem[];
  onAdd: (input: {
    name: string;
    store: Store;
    section: PantrySection;
    quantity: string;
    expiresAt: string;
  }) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
}

export function PantryTab({ items, onAdd, onRemove, onReset }: PantryTabProps) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [store, setStore] = useState<Store>("Ralph's");
  const [section, setSection] = useState<PantrySection>('fresh');
  const [quantity, setQuantity] = useState('');
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [filterStore, setFilterStore] = useState<Store | 'all'>('all');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 1) return [];
    return groceryCatalog
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [name]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filterStore !== 'all' && item.store !== filterStore) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.store.toLowerCase().includes(q)
      );
    });
  }, [items, query, filterStore]);

  const expired = filtered.filter((i) => getExpirationStatus(i.expiresAt) === 'expired');
  const soon = filtered.filter((i) => getExpirationStatus(i.expiresAt) === 'soon');

  function selectSuggestion(catalogName: string) {
    const hit = groceryCatalog.find((c) => c.name === catalogName);
    if (!hit) return;
    setName(hit.name);
    setStore(hit.store);
    setSection(hit.section);
    const d = new Date();
    d.setDate(d.getDate() + hit.defaultDaysToExpire);
    setExpiresAt(d.toISOString().slice(0, 10));
    if (hit.quantity) setQuantity(hit.quantity);
    setShowSuggestions(false);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name, store, section, quantity, expiresAt });
    setName('');
    setQuantity('');
    setShowSuggestions(false);
  }

  return (
    <div className="tab-panel pantry-panel">
      <header className="panel-intro">
        <h2>Your pantry</h2>
        <p>
          Search, add, or remove groceries. Only basic spices are preloaded — nothing from store
          purchase history is guessed. Add items yourself, or connect a real order export when
          available.
        </p>
      </header>

      {(expired.length > 0 || soon.length > 0) && (
        <aside className="expiry-banner" role="status">
          {expired.length > 0 && (
            <p className="expiry-banner__expired">
              <strong>{expired.length} item{expired.length === 1 ? '' : 's'} past expiration.</strong>{' '}
              Dispose safely and delete from the pantry.
            </p>
          )}
          {soon.length > 0 && (
            <p className="expiry-banner__soon">
              {soon.length} item{soon.length === 1 ? '' : 's'} expiring within 2 days — cook soon.
            </p>
          )}
        </aside>
      )}

      <div className="pantry-toolbar">
        <label className="field field--grow">
          <span className="field__label">Search pantry</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chicken, Whole Foods, beans…"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span className="field__label">Store filter</span>
          <select
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value as Store | 'all')}
          >
            <option value="all">All stores</option>
            {STORES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          Reset to basic spices
        </button>
      </div>

      <form className="add-form" onSubmit={handleAdd}>
        <h3>Add an item</h3>
        <p className="add-form__hint">
          Search the multi-store catalog or type a custom name from any store.
        </p>
        <div className="add-form__grid">
          <label className="field field--grow suggest-wrap">
            <span className="field__label">Item</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search Ralph’s, Vons, Whole Foods, Trader Joe’s…"
              required
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="suggest-list" role="listbox">
                {suggestions.map((s) => (
                  <li key={`${s.store}-${s.name}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSuggestion(s.name)}
                    >
                      <span>{s.name}</span>
                      <em>{s.store}</em>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>
          <label className="field">
            <span className="field__label">Store</span>
            <select value={store} onChange={(e) => setStore(e.target.value as Store)}>
              {STORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Section</span>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as PantrySection)}
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Quantity</span>
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1 lb"
            />
          </label>
          <label className="field">
            <span className="field__label">Expires</span>
            <input
              type="date"
              value={expiresAt}
              min={todayISO()}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn--primary add-form__submit">
            Add to pantry
          </button>
        </div>
      </form>

      <div className="pantry-sections">
        {SECTIONS.map(({ id, label }) => {
          const sectionItems = filtered.filter((i) => i.section === id);
          if (sectionItems.length === 0) return null;
          return (
            <section key={id} className="pantry-section">
              <h3>{label}</h3>
              <ul className="item-list">
                {sectionItems.map((item) => (
                  <PantryRow key={item.id} item={item} onRemove={onRemove} />
                ))}
              </ul>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <p className="empty-state">No items match your search. Try another store or clear filters.</p>
        )}
      </div>
    </div>
  );
}

function PantryRow({
  item,
  onRemove,
}: {
  item: PantryItem;
  onRemove: (id: string) => void;
}) {
  const status = getExpirationStatus(item.expiresAt);

  return (
    <li className={`item-row item-row--${status}`}>
      <div className="item-row__main">
        <div className="item-row__title">
          <span className="item-row__name">{item.name}</span>
          <span className="item-row__meta">
            {item.quantity} · {item.store}
            {item.fromPurchaseHistory && <span className="tag">Purchase history</span>}
            {item.isStaple && <span className="tag tag--staple">Staple</span>}
          </span>
        </div>
        <div className={`item-row__expiry item-row__expiry--${status}`}>
          {formatExpiryLabel(item.expiresAt)}
        </div>
      </div>
      {status === 'expired' && (
        <p className="item-row__dispose">
          Past expiration — dispose of this item and remove it from your pantry.
        </p>
      )}
      <button
        type="button"
        className={status === 'expired' ? 'btn btn--danger' : 'btn btn--ghost'}
        onClick={() => onRemove(item.id)}
      >
        {status === 'expired' ? 'Dispose & delete' : 'Remove'}
      </button>
    </li>
  );
}
