import { useRef, useState } from 'react';
import type { BarBottle, BarMedia } from '../types';
import { compressImageFiles } from '../lib/imageCompress';

const MAX_VIDEO_BYTES = 12 * 1024 * 1024; // keep localStorage usable

interface BarTabProps {
  media: BarMedia[];
  bottles: BarBottle[];
  storageError: string | null;
  onAddMedia: (items: Omit<BarMedia, 'id' | 'createdAt'>[]) => void;
  onRemoveMedia: (id: string) => void;
  onAddBottle: (input: { name: string; category?: string; notes?: string }) => void;
  onRemoveBottle: (id: string) => void;
  onClearAll: () => void;
}

export function BarTab({
  media,
  bottles,
  storageError,
  onAddMedia,
  onRemoveMedia,
  onAddBottle,
  onRemoveBottle,
  onClearAll,
}: BarTabProps) {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setFormError(null);
    try {
      const images: File[] = [];
      const videos: File[] = [];
      Array.from(files).forEach((f) => {
        if (f.type.startsWith('image/')) images.push(f);
        else if (f.type.startsWith('video/')) videos.push(f);
      });

      const added: Omit<BarMedia, 'id' | 'createdAt'>[] = [];

      if (images.length) {
        const compressed = await compressImageFiles(images);
        compressed.forEach((src, i) => {
          added.push({
            kind: 'image',
            src,
            name: images[i]?.name || `cabinet-${i + 1}.jpg`,
          });
        });
      }

      for (const video of videos) {
        if (video.size > MAX_VIDEO_BYTES) {
          setFormError(
            `"${video.name}" is over 12MB. Trim it or upload still photos of each shelf instead.`,
          );
          continue;
        }
        const src = await readFileAsDataUrl(video);
        added.push({ kind: 'video', src, name: video.name });
      }

      if (!added.length && !formError) {
        setFormError('Choose photos or videos of your bar cabinet.');
        return;
      }
      if (added.length) onAddMedia(added);
    } catch {
      setFormError('Could not read one or more files. Try JPG/PNG or a shorter MP4.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleAddBottle(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAddBottle({ name, category, notes });
    setName('');
    setCategory('');
    setNotes('');
  }

  return (
    <div className="tab-panel bar-panel">
      <header className="panel-intro">
        <h2>Bar cabinet</h2>
        <p>
          Upload photos or short videos of your cabinet. Attach the same files in this Cursor chat
          so bottles can be read from labels — only what’s clearly visible will be added. Nothing
          is guessed.
        </p>
      </header>

      {(storageError || formError) && (
        <aside className="expiry-banner" role="alert">
          <p className="expiry-banner__expired">{storageError || formError}</p>
        </aside>
      )}

      <section className="add-form">
        <h3>Cabinet media</h3>
        <p className="add-form__hint">
          Tip: photograph each shelf straight-on with labels readable. Multiple angles help.
        </p>
        <div className="upload-drop upload-drop--tall">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p>{busy ? 'Processing…' : 'Choose photos and/or videos'}</p>
        </div>

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
      </section>

      <section className="add-form">
        <h3>Bottles on hand</h3>
        <p className="add-form__hint">
          {bottles.length === 0
            ? 'Empty until you confirm bottles from cabinet media or add them manually.'
            : `${bottles.length} bottle${bottles.length === 1 ? '' : 's'} listed.`}
        </p>

        <form className="add-form__grid saves-form-grid" onSubmit={handleAddBottle}>
          <label className="field field--grow">
            <span className="field__label">Bottle name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Campari"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Category</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Amaro, gin…"
            />
          </label>
          <label className="field field--grow">
            <span className="field__label">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Shelf location, fill level…"
            />
          </label>
          <button type="submit" className="btn btn--primary add-form__submit">
            Add bottle
          </button>
        </form>

        <ul className="item-list bar-bottle-list">
          {bottles.map((bottle) => (
            <li key={bottle.id} className="item-row">
              <div className="item-row__main">
                <div className="item-row__title">
                  <span className="item-row__name">{bottle.name}</span>
                  <span className="item-row__meta">
                    {bottle.category || 'Uncategorized'}
                    <span className="tag">{bottle.source === 'vision' ? 'From media' : 'Manual'}</span>
                    {bottle.confidence === 'likely' && (
                      <span className="tag tag--staple">Likely</span>
                    )}
                    {bottle.confidence === 'unclear' && (
                      <span className="tag tag--staple">Unclear — confirm</span>
                    )}
                  </span>
                  {bottle.notes && <p className="recipe__desc">{bottle.notes}</p>}
                </div>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onRemoveBottle(bottle.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        {(media.length > 0 || bottles.length > 0) && (
          <button type="button" className="btn btn--ghost" onClick={onClearAll}>
            Clear cabinet media & bottles
          </button>
        )}
      </section>

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
          <img src={lightbox} alt="Cabinet photo" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
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
