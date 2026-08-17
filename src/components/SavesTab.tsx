import { useRef, useState } from 'react';
import type { SavedRecipe } from '../types';
import { compressImageFiles } from '../lib/imageCompress';

interface SavesTabProps {
  recipes: SavedRecipe[];
  storageError: string | null;
  onAddPhotos: (input: { title: string; notes: string; images: string[] }) => void;
  onAddLink: (input: { title: string; url: string; notes: string }) => void;
  onRemove: (id: string) => void;
  onAddImages: (id: string, images: string[]) => void;
}

export function SavesTab({
  recipes,
  storageError,
  onAddPhotos,
  onAddLink,
  onRemove,
  onAddImages,
}: SavesTabProps) {
  const [mode, setMode] = useState<'photos' | 'link'>('photos');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const moreFilesRef = useRef<HTMLInputElement>(null);
  const [appendTargetId, setAppendTargetId] = useState<string | null>(null);

  async function handleFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setFormError(null);
    try {
      const compressed = await compressImageFiles(files);
      if (!compressed.length) {
        setFormError('Choose image files (JPG, PNG, HEIC converted by your browser, etc.).');
        return;
      }
      setPendingImages((prev) => [...prev, ...compressed]);
    } catch {
      setFormError('Could not read one or more images. Try a different format.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleAppendFiles(files: FileList | null) {
    if (!files?.length || !appendTargetId) return;
    setBusy(true);
    try {
      const compressed = await compressImageFiles(files);
      if (compressed.length) onAddImages(appendTargetId, compressed);
    } finally {
      setBusy(false);
      setAppendTargetId(null);
      if (moreFilesRef.current) moreFilesRef.current.value = '';
    }
  }

  function handlePhotoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingImages.length) {
      setFormError('Add at least one recipe photo.');
      return;
    }
    onAddPhotos({ title, notes, images: pendingImages });
    setTitle('');
    setNotes('');
    setPendingImages([]);
    setFormError(null);
  }

  function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setFormError('Paste a recipe URL.');
      return;
    }
    onAddLink({ title, url, notes });
    setTitle('');
    setNotes('');
    setUrl('');
    setFormError(null);
  }

  function removePending(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }

  const photoCount = recipes.filter((r) => r.kind === 'photos').length;
  const linkCount = recipes.filter((r) => r.kind === 'link').length;

  return (
    <div className="tab-panel saves-panel">
      <header className="panel-intro">
        <h2>Recipe saves</h2>
        <p>
          Upload one or more photos of a printed or handwritten recipe, or save a favorite link
          from anywhere on the internet.
        </p>
      </header>

      {(storageError || formError) && (
        <aside className="expiry-banner" role="alert">
          <p className="expiry-banner__expired">{storageError || formError}</p>
        </aside>
      )}

      <div className="saves-mode" role="tablist" aria-label="How to save">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'photos'}
          className={mode === 'photos' ? 'tabs__btn is-active' : 'tabs__btn'}
          onClick={() => {
            setMode('photos');
            setFormError(null);
          }}
        >
          Upload photos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'link'}
          className={mode === 'link' ? 'tabs__btn is-active' : 'tabs__btn'}
          onClick={() => {
            setMode('link');
            setFormError(null);
          }}
        >
          Save a link
        </button>
      </div>

      {mode === 'photos' ? (
        <form className="add-form" onSubmit={handlePhotoSubmit}>
          <h3>Photo recipe</h3>
          <p className="add-form__hint">
            Drop in a single page or a multi-page shoot — all images stay together as one recipe.
          </p>
          <div className="add-form__grid saves-form-grid">
            <label className="field field--grow">
              <span className="field__label">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Grandma’s lasagna"
              />
            </label>
            <label className="field field--grow">
              <span className="field__label">Notes (optional)</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Serves 6, oven 375…"
              />
            </label>
            <div className="field field--grow">
              <span className="field__label">Images</span>
              <div className="upload-drop">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <p>{busy ? 'Compressing…' : 'Choose one or more images'}</p>
              </div>
            </div>
          </div>

          {pendingImages.length > 0 && (
            <ul className="pending-thumbs">
              {pendingImages.map((src, i) => (
                <li key={`${i}-${src.slice(-12)}`}>
                  <img src={src} alt={`Pending recipe photo ${i + 1}`} />
                  <button
                    type="button"
                    className="thumb-remove"
                    onClick={() => removePending(i)}
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button type="submit" className="btn btn--primary" disabled={busy}>
            Save photo recipe
          </button>
        </form>
      ) : (
        <form className="add-form" onSubmit={handleLinkSubmit}>
          <h3>Internet favorite</h3>
          <p className="add-form__hint">
            Paste any recipe URL — NYT Cooking, blogs, Instagram posts, restaurant write-ups.
          </p>
          <div className="add-form__grid saves-form-grid">
            <label className="field field--grow">
              <span className="field__label">Recipe URL</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://cooking.nytimes.com/…"
                required
              />
            </label>
            <label className="field field--grow">
              <span className="field__label">Title (optional)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Auto-fills from the site name if blank"
              />
            </label>
            <label className="field field--grow">
              <span className="field__label">Notes (optional)</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Weeknight staple, make double sauce…"
              />
            </label>
          </div>
          <button type="submit" className="btn btn--primary">
            Save link
          </button>
        </form>
      )}

      <div className="saves-summary">
        <p className="result-count">
          {recipes.length} save{recipes.length === 1 ? '' : 's'}
          {recipes.length > 0 && (
            <>
              {' '}
              · {photoCount} photo · {linkCount} link
            </>
          )}
        </p>
      </div>

      <ul className="saves-list">
        {recipes.map((recipe) => (
          <li key={recipe.id} className="save-card">
            <div className="save-card__top">
              <div>
                <p className="recipe__source">
                  {recipe.kind === 'photos' ? 'Photo recipe' : 'Internet link'}
                </p>
                <h3 className="recipe__title">{recipe.title}</h3>
                {recipe.notes && <p className="recipe__desc">{recipe.notes}</p>}
                <p className="save-card__date">
                  Saved {new Date(recipe.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onRemove(recipe.id)}
              >
                Remove
              </button>
            </div>

            {recipe.kind === 'link' && recipe.url && (
              <a
                className="btn btn--primary"
                href={recipe.url}
                target="_blank"
                rel="noreferrer"
              >
                Open recipe
              </a>
            )}

            {recipe.kind === 'photos' && (
              <>
                <ul className="save-gallery">
                  {recipe.images.map((src, i) => (
                    <li key={`${recipe.id}-${i}`}>
                      <button
                        type="button"
                        className="save-gallery__btn"
                        onClick={() => setLightbox({ images: recipe.images, index: i })}
                      >
                        <img src={src} alt={`${recipe.title} page ${i + 1}`} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={busy}
                  onClick={() => {
                    setAppendTargetId(recipe.id);
                    moreFilesRef.current?.click();
                  }}
                >
                  Add more photos
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {recipes.length === 0 && (
        <p className="empty-state">No saves yet — upload photos or paste a favorite link above.</p>
      )}

      <input
        ref={moreFilesRef}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        onChange={(e) => handleAppendFiles(e.target.files)}
      />

      {lightbox && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Recipe photo"
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
          {lightbox.images.length > 1 && (
            <button
              type="button"
              className="lightbox__nav lightbox__nav--prev"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((lb) =>
                  lb
                    ? {
                        ...lb,
                        index: (lb.index - 1 + lb.images.length) % lb.images.length,
                      }
                    : lb,
                );
              }}
            >
              ‹
            </button>
          )}
          <img
            src={lightbox.images[lightbox.index]}
            alt={`Recipe photo ${lightbox.index + 1}`}
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.images.length > 1 && (
            <button
              type="button"
              className="lightbox__nav lightbox__nav--next"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((lb) =>
                  lb ? { ...lb, index: (lb.index + 1) % lb.images.length } : lb,
                );
              }}
            >
              ›
            </button>
          )}
          <p className="lightbox__count" onClick={(e) => e.stopPropagation()}>
            {lightbox.index + 1} / {lightbox.images.length}
          </p>
        </div>
      )}
    </div>
  );
}
