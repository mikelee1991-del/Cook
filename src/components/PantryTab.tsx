import { useMemo, useState } from 'react';
import { groceryCatalog } from '../data/pantrySeed';
import type { PantryItem, PantryMedia, PantrySection, RecommendedIngredient, Store } from '../types';
import { compressImageBatch } from '../lib/imageCompress';
import { isLikelyImageFile, isLikelyVideoFile } from '../lib/imageFiles';
import {
  formatExpiryLabel,
  getExpirationStatus,
  pantryHasIngredient,
  todayISO,
} from '../lib/pantryUtils';
import { canBeFrozen, canToggleFrozen, isFrozenItem } from '../lib/frozenHandling';
import { pantryDraftFromName } from '../lib/pantryDraft';
import { identifyPantryPhotos } from '../lib/scanImages';
import { hasVisionAccess, usesGlobalVision } from '../lib/visionConfig';
import type { IdentifiedPantryItem } from '../lib/visionPantry';
import { BulkUploadZone } from './BulkUploadZone';
import { RecommendedIngredients } from './RecommendedIngredients';
import { VisionKeyField } from './VisionKeyField';

const MAX_VIDEO_BYTES = 12 * 1024 * 1024;

const SECTIONS: { id: PantrySection; label: string }[] = [
  { id: 'fresh', label: 'Fresh produce' },
  { id: 'refrigerated', label: 'Refrigerated' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'dry', label: 'Dry goods & staples' },
];

interface PantryTabProps {
  items: PantryItem[];
  media: PantryMedia[];
  mediaError: string | null;
  recommended: RecommendedIngredient[];
  dismissedCount: number;
  onAdd: (input: {
    name: string;
    store: Store;
    section: PantrySection;
    quantity: string;
    expiresAt: string;
    frozen?: boolean;
    fromMediaScan?: boolean;
  }) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PantryItem>) => void;
  onReset: () => void;
  onAddMedia: (items: Omit<PantryMedia, 'id' | 'createdAt'>[]) => void;
  onRemoveMedia: (id: string) => void;
  onUpdateRecommended: (
    item: RecommendedIngredient,
    patch: { name?: string; note?: string },
  ) => void;
  onRemoveRecommended: (item: RecommendedIngredient) => void;
  onRestoreRecommended: () => void;
  onAddRecommendedToPantry: (item: RecommendedIngredient, opts?: { frozen?: boolean }) => void;
}

export function PantryTab({
  items,
  media,
  mediaError,
  recommended,
  dismissedCount,
  onAdd,
  onRemove,
  onUpdate,
  onReset,
  onAddMedia,
  onRemoveMedia,
  onUpdateRecommended,
  onRemoveRecommended,
  onRestoreRecommended,
  onAddRecommendedToPantry,
}: PantryTabProps) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState<PantrySection>('fresh');
  const [quantity, setQuantity] = useState('');
  const [frozen, setFrozen] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Processing…');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [foundItems, setFoundItems] = useState<IdentifiedPantryItem[]>([]);
  const [foundSelected, setFoundSelected] = useState<Record<string, boolean>>({});
  const [foundFrozen, setFoundFrozen] = useState<Record<string, boolean>>({});
  const [visionReady, setVisionReady] = useState(() => hasVisionAccess());

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 1) return [];
    const seen = new Set<string>();
    return groceryCatalog
      .filter((c) => {
        if (!c.name.toLowerCase().includes(q)) return false;
        if (seen.has(c.name.toLowerCase())) return false;
        seen.add(c.name.toLowerCase());
        return true;
      })
      .slice(0, 8);
  }, [name]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!q) return true;
      return item.name.toLowerCase().includes(q);
    });
  }, [items, query]);

  const expired = filtered.filter((i) => getExpirationStatus(i.expiresAt) === 'expired');
  const soon = filtered.filter((i) => getExpirationStatus(i.expiresAt) === 'soon');

  const showFrozenToggle = canBeFrozen(section, name);

  function selectSuggestion(catalogName: string) {
    const hit = groceryCatalog.find((c) => c.name === catalogName);
    if (!hit) return;
    setName(hit.name);
    setSection(hit.section);
    setFrozen(hit.section === 'frozen');
    const d = new Date();
    d.setDate(d.getDate() + hit.defaultDaysToExpire);
    setExpiresAt(d.toISOString().slice(0, 10));
    if (hit.quantity) setQuantity(hit.quantity);
    setShowSuggestions(false);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name,
      store: 'Other',
      section,
      quantity,
      expiresAt,
      frozen,
    });
    setName('');
    setQuantity('');
    setFrozen(false);
    setShowSuggestions(false);
  }

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setUploadError(null);
    setBusyLabel(`Preparing ${files.length} file${files.length === 1 ? '' : 's'}…`);
    try {
      const images: File[] = [];
      const videos: File[] = [];
      files.forEach((f) => {
        if (isLikelyImageFile(f)) images.push(f);
        else if (isLikelyVideoFile(f)) videos.push(f);
      });

      const added: Omit<PantryMedia, 'id' | 'createdAt'>[] = [];
      let videoSkipError: string | null = null;

      if (images.length) {
        const { items, failed } = await compressImageBatch(images, (done, total) => {
          setBusyLabel(`Compressing ${done} of ${total}…`);
        });
        items.forEach((item) => {
          added.push({
            kind: 'image',
            src: item.dataUrl,
            name: item.file.name || 'pantry.jpg',
          });
        });
        if (failed.length && !videoSkipError) {
          videoSkipError = failed[0].reason;
        }
      }

      for (const video of videos) {
        if (video.size > MAX_VIDEO_BYTES) {
          videoSkipError =
            `"${video.name}" is over 12MB. Trim it or upload still photos of each shelf instead.`;
          continue;
        }
        const src = await readFileAsDataUrl(video);
        added.push({ kind: 'video', src, name: video.name });
      }

      if (videoSkipError) setUploadError(videoSkipError);
      if (!added.length) {
        setUploadError(videoSkipError || 'Choose photos or videos of your pantry shelves.');
        return;
      }
      onAddMedia(added);

      const photoSources = added.filter((item) => item.kind === 'image').map((item) => item.src);
      if (!photoSources.length) return;
      if (!visionReady && !hasVisionAccess()) {
        setUploadError(
          usesGlobalVision()
            ? 'Photos saved. Shared vision is not configured on the worker yet.'
            : 'Photos saved. Add a Gemini API key in Devices so Dinner can identify items from packaging and produce.',
        );
        return;
      }
      const { items: found, warnings } = await identifyPantryPhotos(photoSources, setBusyLabel);
      const fresh = found.filter((item) => !pantryHasIngredient(items, item.name));
      if (!fresh.length) {
        setUploadError(
          warnings[0]
            ? `Page ${warnings[0].page}: ${warnings[0].message}`
            : 'Those photos match items already in your pantry.',
        );
        return;
      }
      setFoundItems(fresh);
      setFoundSelected(Object.fromEntries(fresh.map((item) => [item.name, true])));
      setFoundFrozen(Object.fromEntries(fresh.map((item) => [item.name, item.frozen])));
      if (warnings.length) {
        setUploadError(warnings.map((w) => `Photo ${w.page}: ${w.message}`).join(' '));
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Could not read one or more files. Try JPG/PNG or a shorter MP4.',
      );
    } finally {
      setBusy(false);
      setBusyLabel('Processing…');
    }
  }

  function addFoundItems(names?: string[]) {
    const chosen = foundItems.filter((item) => (names ? names.includes(item.name) : foundSelected[item.name]));
    for (const item of chosen) {
      const draft = pantryDraftFromName(item.name);
      const frozen = foundFrozen[item.name] ?? item.frozen;
      onAdd({
        ...draft,
        quantity: item.quantity || draft.quantity,
        frozen,
        fromMediaScan: true,
      });
    }
    setFoundItems((prev) => prev.filter((item) => !chosen.some((c) => c.name === item.name)));
  }

  return (
    <div className="tab-panel pantry-panel">
      <header className="panel-intro">
        <h2>Your pantry</h2>
        <p>
          See what you have, add items by hand, or upload shelf photos so Dinner can match packaging
          and produce to your catalog. Only basic spices are preloaded.
        </p>
      </header>

      {(expired.length > 0 || soon.length > 0) && (
        <aside className="expiry-banner" role="status">
          {expired.length > 0 && (
            <p className="expiry-banner__expired">
              <strong>
                {expired.length} item{expired.length === 1 ? '' : 's'} past expiration.
              </strong>{' '}
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

      <div className="pantry-toolbar pantry-toolbar--simple">
        <label className="field field--grow">
          <span className="field__label">Search pantry</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chicken, beans, spinach…"
            autoComplete="off"
          />
        </label>
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          Reset to basic spices
        </button>
      </div>

      <div className="pantry-sections">
        {SECTIONS.map(({ id, label }) => {
          const sectionItems = filtered.filter((i) => i.section === id);
          if (sectionItems.length === 0) return null;
          return (
            <section key={id} className="pantry-section">
              <h3>{label}</h3>
              <ul className="item-list">
                {sectionItems.map((item) => (
                  <PantryRow
                    key={item.id}
                    item={item}
                    onRemove={onRemove}
                    onUpdate={onUpdate}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <p className="empty-state">No items match your search. Clear the filter to see everything.</p>
        )}
      </div>

      <form className="add-form" onSubmit={handleAdd}>
        <h3>Add an item</h3>
        <p className="add-form__hint">Search the catalog or type any item name.</p>
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
              placeholder="Search or type an item…"
              required
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="suggest-list" role="listbox">
                {suggestions.map((s) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSuggestion(s.name)}
                    >
                      <span>{s.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>
          <label className="field">
            <span className="field__label">Section</span>
            <select
              value={section}
              onChange={(e) => {
                const next = e.target.value as PantrySection;
                setSection(next);
                if (next === 'frozen') setFrozen(true);
                else if (!canBeFrozen(next)) setFrozen(false);
              }}
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
        {showFrozenToggle && (
          <label className="toggle pantry-frozen-toggle">
            <input
              type="checkbox"
              checked={frozen}
              onChange={(e) => setFrozen(e.target.checked)}
            />
            <span>Frozen</span>
          </label>
        )}
      </form>

      {(mediaError || uploadError) && (
        <aside className="expiry-banner" role="alert">
          <p className="expiry-banner__expired">{mediaError || uploadError}</p>
        </aside>
      )}

      <section className="add-form">
        <h3>Scan shelves</h3>
        <p className="add-form__hint">
          Bulk-upload shelf photos. AI looks at every feature of each item (shape, brand marks,
          color, produce, frozen bags) and picks the best pantry name.
        </p>
        {!visionReady && !usesGlobalVision() && (
          <VisionKeyField onReady={() => setVisionReady(true)} />
        )}
        <BulkUploadZone
          accept="image/*,video/*"
          disabled={busy}
          busyLabel={busyLabel}
          idleLabel="Drop many shelf photos or a folder — or click to choose"
          hint="Multi-select and folder upload supported for bulk pantry scans."
          onFiles={handleFiles}
        />

        {media.length > 0 && (
          <ul className="bar-media-grid">
            {media.map((item) => (
              <li key={item.id} className="bar-media-card">
                {item.kind === 'image' ? (
                  <button
                    type="button"
                    className="bar-media-card__preview"
                    onClick={() => setLightbox(item.src)}
                  >
                    <img src={item.src} alt={item.name} />
                  </button>
                ) : (
                  <video className="bar-media-card__preview" src={item.src} controls playsInline />
                )}
                <div className="bar-media-card__meta">
                  <span>{item.kind === 'image' ? 'Photo' : 'Video'}</span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onRemoveMedia(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {foundItems.length > 0 && (
          <div className="scan-matches">
            <h4>Found on your shelves</h4>
            <p className="add-form__hint">
              Review the matches, mark frozen when it applies, then add them to the pantry.
            </p>
            <ul className="item-list">
              {foundItems.map((item) => (
                <li key={item.name} className="item-row">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={foundSelected[item.name] ?? false}
                      onChange={(e) =>
                        setFoundSelected((prev) => ({ ...prev, [item.name]: e.target.checked }))
                      }
                    />
                    <span className="item-row__name">{item.name}</span>
                  </label>
                  <span className="item-row__meta">
                    {item.quantity}
                    {item.catalogName && <span className="tag">Catalog</span>}
                    {item.cues && <span>{item.cues}</span>}
                  </span>
                  {canBeFrozen(item.section, item.name) && (
                    <label className="toggle toggle--compact">
                      <input
                        type="checkbox"
                        checked={foundFrozen[item.name] ?? item.frozen}
                        onChange={(e) =>
                          setFoundFrozen((prev) => ({ ...prev, [item.name]: e.target.checked }))
                        }
                      />
                      <span>Frozen</span>
                    </label>
                  )}
                </li>
              ))}
            </ul>
            <div className="clip-card__actions">
              <button type="button" className="btn btn--primary" onClick={() => addFoundItems()}>
                Add selected to pantry
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setFoundItems([])}>
                Discard matches
              </button>
            </div>
          </div>
        )}
      </section>

      <RecommendedIngredients
        items={recommended}
        dismissedCount={dismissedCount}
        onUpdate={onUpdateRecommended}
        onRemove={onRemoveRecommended}
        onRestoreAutos={onRestoreRecommended}
        onAddToPantry={onAddRecommendedToPantry}
      />

      {lightbox && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="lightbox__close"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            ×
          </button>
          <img src={lightbox} alt="Pantry shelf" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function PantryRow({
  item,
  onRemove,
  onUpdate,
}: {
  item: PantryItem;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PantryItem>) => void;
}) {
  const status = getExpirationStatus(item.expiresAt);
  const frozen = isFrozenItem(item);

  function toggleFrozen() {
    if (frozen) {
      onUpdate(item.id, {
        frozen: false,
        section: item.section === 'frozen' ? 'refrigerated' : item.section,
      });
      return;
    }
    onUpdate(item.id, { frozen: true, section: 'frozen' });
  }

  return (
    <li className={`item-row item-row--${status}`}>
      <div className="item-row__main">
        <div className="item-row__title">
          <span className="item-row__name">{item.name}</span>
          <span className="item-row__meta">
            {item.quantity}
            {frozen && <span className="tag tag--frozen">Frozen</span>}
            {item.isStaple && <span className="tag tag--staple">Spice</span>}
            {item.fromPurchaseHistory && <span className="tag">Imported</span>}
            {item.fromMediaScan && <span className="tag">From photo</span>}
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
      <div className="clip-card__actions">
        {canToggleFrozen(item) && (
          <button type="button" className="btn btn--ghost" onClick={toggleFrozen}>
            {frozen ? 'Unfreeze' : 'Freeze'}
          </button>
        )}
        <button
          type="button"
          className={status === 'expired' ? 'btn btn--danger' : 'btn btn--ghost'}
          onClick={() => onRemove(item.id)}
        >
          {status === 'expired' ? 'Dispose & delete' : 'Remove'}
        </button>
      </div>
    </li>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
