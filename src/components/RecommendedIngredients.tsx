import { useState } from 'react';
import { pantryDraftFromName } from '../lib/pantryDraft';
import { canBeFrozen } from '../lib/frozenHandling';
import type { RecommendedIngredient } from '../types';

interface RecommendedIngredientsProps {
  items: RecommendedIngredient[];
  dismissedCount: number;
  onAdd: (name: string, note: string) => RecommendedIngredient | null;
  onUpdate: (item: RecommendedIngredient, patch: { name?: string; note?: string }) => void;
  onRemove: (item: RecommendedIngredient) => void;
  onRestoreAutos: () => void;
  onAddToPantry: (item: RecommendedIngredient, opts?: { frozen?: boolean }) => void;
}

export function RecommendedIngredients({
  items,
  dismissedCount,
  onAdd,
  onUpdate,
  onRemove,
  onRestoreAutos,
  onAddToPantry,
}: RecommendedIngredientsProps) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [frozenById, setFrozenById] = useState<Record<string, boolean>>({});

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const added = onAdd(name, note);
    if (!added) {
      setFormError('That ingredient is already on the list.');
      return;
    }
    setName('');
    setNote('');
    setFormError(null);
  }

  function startEdit(item: RecommendedIngredient) {
    setEditingId(item.id);
    setDraftName(item.name);
    setDraftNote(item.note);
  }

  function saveEdit(item: RecommendedIngredient) {
    onUpdate(item, { name: draftName, note: draftNote });
    setEditingId(null);
  }

  return (
    <section className="add-form recommended-section">
      <h3>Recommended ingredients</h3>
      <p className="add-form__hint">
        Based on what you already have — extras that unlock near-ready recipes. Add your own or
        edit any row. Use “Add to pantry” when you have it in stock.
      </p>

      <form className="add-form__grid saves-form-grid" onSubmit={handleAdd}>
        <label className="field field--grow">
          <span className="field__label">Add ingredient</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFormError(null);
            }}
            placeholder="e.g. Lemons"
            required
          />
        </label>
        <label className="field field--grow">
          <span className="field__label">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why you want it…"
          />
        </label>
        <button type="submit" className="btn btn--primary add-form__submit">
          Add to list
        </button>
      </form>
      {formError && (
        <p className="recommended-error" role="status">
          {formError}
        </p>
      )}

      {items.length === 0 ? (
        <p className="empty-state">
          No recommendations yet. Add pantry stock (beyond spices) or add ingredients manually
          above.
        </p>
      ) : (
        <ul className="item-list recommended-list">
          {items.map((item) => (
            <li key={item.id} className="item-row recommended-row">
              {editingId === item.id ? (
                <div className="recommended-edit">
                  <label className="field field--grow">
                    <span className="field__label">Name</span>
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      autoFocus
                    />
                  </label>
                  <label className="field field--grow">
                    <span className="field__label">Note</span>
                    <input
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                    />
                  </label>
                  <div className="clip-card__actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => saveEdit(item)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="item-row__main">
                    <div className="item-row__title">
                      <span className="item-row__name">{item.name}</span>
                      <span className="item-row__meta">
                        <span className="tag">
                          {item.source === 'auto' ? 'Suggested' : 'Manual'}
                        </span>
                        {item.inPantry && <span className="tag">In pantry</span>}
                        {item.reason && <span>{item.reason}</span>}
                        {item.note && <span>{item.note}</span>}
                      </span>
                    </div>
                  </div>
                  <div className="clip-card__actions">
                    {!item.inPantry && (
                      <>
                        {canBeFrozen(pantryDraftFromName(item.name).section) && (
                          <label className="toggle toggle--compact">
                            <input
                              type="checkbox"
                              checked={frozenById[item.id] ?? false}
                              onChange={(e) =>
                                setFrozenById((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.checked,
                                }))
                              }
                            />
                            <span>Frozen</span>
                          </label>
                        )}
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() =>
                            onAddToPantry(item, {
                              frozen: frozenById[item.id] ?? false,
                            })
                          }
                        >
                          Add to pantry
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => onRemove(item)}
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {dismissedCount > 0 && (
        <button type="button" className="btn btn--ghost" onClick={onRestoreAutos}>
          Restore {dismissedCount} dismissed suggestion{dismissedCount === 1 ? '' : 's'}
        </button>
      )}
    </section>
  );
}
