import { useRef, useState } from 'react';
import type { PhotoScan } from '../hooks/usePhotoScans';
import type { SortedClip } from '../lib/recipeSort';
import type { SavedRecipe } from '../types';
import { compressImageBatch } from '../lib/imageCompress';
import { isLikelyImageFile } from '../lib/imageFiles';
import { BulkUploadZone } from './BulkUploadZone';

interface SavesTabProps {
  recipes: SavedRecipe[];
  scans: PhotoScan[];
  storageError: string | null;
  onAddPhotos: (input: { title: string; notes: string; images: string[] }) => void;
  onAddLink: (input: { title: string; url: string; notes: string }) => void;
  onRemove: (id: string) => void;
  onAddImages: (id: string, images: string[]) => void;
  onRunScan: (images: string[], ocrSources?: Array<string | Blob>) => Promise<string | null>;
  onRemoveScan: (id: string) => void;
  onRescan: (id: string) => Promise<string | null>;
  onRemoveClip: (scanId: string, clipId: string) => void;
  onSetClipKind: (scanId: string, clipId: string, kind: SortedClip['kind']) => void;
}

export function SavesTab({
  recipes,
  scans,
  storageError,
  onAddPhotos,
  onAddLink,
  onRemove,
  onAddImages,
  onRunScan,
  onRemoveScan,
  onRescan,
  onRemoveClip,
  onSetClipKind,
}: SavesTabProps) {
  const [mode, setMode] = useState<'photos' | 'link'>('photos');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Working…');
  const [formError, setFormError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(
    null,
  );
  const moreFilesRef = useRef<HTMLInputElement>(null);
  const [appendTargetId, setAppendTargetId] = useState<string | null>(null);

  async function ingestFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setFormError(null);
    setBusyLabel(`Preparing ${files.length} photo${files.length === 1 ? '' : 's'}…`);
    try {
      const imageFiles = files.filter(isLikelyImageFile);
      if (!imageFiles.length) {
        setFormError('Choose image files (JPG, PNG, WebP, HEIC in Safari).');
        return;
      }
      const { items, failed } = await compressImageBatch(imageFiles, (done, total) => {
        setBusyLabel(`Compressing ${done} of ${total}…`);
      });
      if (items.length) {
        setPendingFiles((prev) => [...prev, ...items.map((item) => item.file)]);
        setPendingImages((prev) => [...prev, ...items.map((item) => item.dataUrl)]);
      }
      if (failed.length && !items.length) {
        setFormError(failed[0].reason);
      } else if (failed.length) {
        setFormError(
          `${failed.length} photo${failed.length === 1 ? '' : 's'} skipped. ${failed[0].reason}`,
        );
      } else if (!items.length) {
        setFormError('Choose image files (JPG, PNG, WebP, HEIC in Safari).');
      }
    } catch {
      setFormError('Could not read one or more images. Try JPG or PNG.');
    } finally {
      setBusy(false);
      setBusyLabel('Working…');
    }
  }

  async function handleAppendFiles(files: FileList | null) {
    if (!files?.length || !appendTargetId) return;
    setBusy(true);
    try {
      const { items } = await compressImageBatch(Array.from(files));
      const compressed = items.map((item) => item.dataUrl);
      if (compressed.length) onAddImages(appendTargetId, compressed);
    } finally {
      setBusy(false);
      setAppendTargetId(null);
      if (moreFilesRef.current) moreFilesRef.current.value = '';
    }
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingImages.length) {
      setFormError('Add at least one photo to scan.');
      return;
    }
    const images = [...pendingImages];
    const files = [...pendingFiles];
    setPendingImages([]);
    setPendingFiles([]);
    setFormError(null);
    setBusy(true);
    setBusyLabel(`Scanning ${images.length} photo${images.length === 1 ? '' : 's'}…`);
    try {
      await onRunScan(images, files);
    } finally {
      setBusy(false);
      setBusyLabel('Working…');
    }
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
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function keepRecipeClip(scan: PhotoScan, clip: SortedClip) {
    const pageNote =
      scan.images.length > 1 ? `From page ${clip.sourceImageIndex + 1}` : 'From scanned photo';
    onAddPhotos({
      title: clip.title,
      notes: `${pageNote}\n\n${clip.body}`.trim(),
      images: [scan.images[clip.sourceImageIndex]].filter(Boolean),
    });
    onRemoveClip(scan.id, clip.id);
  }

  const photoCount = recipes.filter((r) => r.kind === 'photos').length;
  const linkCount = recipes.filter((r) => r.kind === 'link').length;
  const recipeClips = scans.reduce(
    (n, s) => n + s.clips.filter((c) => c.kind === 'recipe').length,
    0,
  );
  const otherClips = scans.reduce(
    (n, s) => n + s.clips.filter((c) => c.kind === 'other').length,
    0,
  );

  return (
    <div className="tab-panel saves-panel">
      <header className="panel-intro">
        <h2>Recipe saves</h2>
        <p>
          Upload cookbook pages, cards, screenshots, or handwritten notes. Mixed layouts and
          several recipes on one page are sorted automatically. Block letters read better than
          loopy cursive.
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
          Scan photos
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
        <form className="add-form" onSubmit={handleScanSubmit}>
          <h3>Scan pages in bulk</h3>
          <p className="add-form__hint">
            Drop cookbook scans, phone photos, cards, or handwritten lists. Crooked pages are
            deskewed; two-column print is split; faint pencil gets a high-contrast pass. Original
            files are read (not the small preview).
          </p>
          <BulkUploadZone
            accept="image/*"
            disabled={busy}
            busyLabel={busyLabel}
            idleLabel="Drop many photos or a folder — or click to choose"
            hint="JPG, PNG, and WebP work everywhere. iPhone HEIC works in Safari. You can add more batches before scanning."
            onFiles={ingestFiles}
          />

          {pendingImages.length > 0 && (
            <>
              <p className="result-count">
                {pendingImages.length} photo{pendingImages.length === 1 ? '' : 's'} ready to scan
              </p>
              <ul className="pending-thumbs">
                {pendingImages.map((src, i) => (
                  <li key={`${i}-${src.slice(-12)}`}>
                    <img src={src} alt={`Pending scan photo ${i + 1}`} />
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
              <div className="clip-card__actions">
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  Scan & sort {pendingImages.length} photo
                  {pendingImages.length === 1 ? '' : 's'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={busy}
                  onClick={() => {
                    setPendingImages([]);
                    setPendingFiles([]);
                  }}
                >
                  Clear queue
                </button>
              </div>
            </>
          )}
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

      {scans.length > 0 && (
        <section className="scan-results">
          <h3 className="scan-results__heading">Sorted from photos</h3>
          <p className="result-count">
            {recipeClips} recipe{recipeClips === 1 ? '' : 's'} · {otherClips} other text block
            {otherClips === 1 ? '' : 's'}
          </p>

          <ul className="saves-list">
            {scans.map((scan) => (
              <li key={scan.id} className="save-card scan-card">
                <div className="save-card__top">
                  <div>
                    <p className="recipe__source">
                      {scan.status === 'scanning'
                        ? 'Scanning…'
                        : scan.status === 'error'
                          ? 'Scan failed'
                          : 'Scan complete'}
                    </p>
                    <h3 className="recipe__title">
                      {scan.images.length} photo{scan.images.length === 1 ? '' : 's'}
                    </h3>
                    {scan.status === 'scanning' && (
                      <p className="recipe__desc">{scan.progress}</p>
                    )}
                    {scan.error && <p className="expiry-banner__expired">{scan.error}</p>}
                    {scan.status === 'done' &&
                      scan.warnings &&
                      scan.warnings.length > 0 &&
                      scan.clips.length > 0 && (
                        <p className="recipe__desc">
                          {scan.warnings.length} page{scan.warnings.length === 1 ? '' : 's'} needed
                          a second look — {scan.warnings[0]}
                        </p>
                      )}
                  </div>
                  <div className="clip-card__actions">
                    {scan.status !== 'scanning' && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setBusyLabel('Scanning again…');
                          try {
                            await onRescan(scan.id);
                          } finally {
                            setBusy(false);
                            setBusyLabel('Working…');
                          }
                        }}
                      >
                        Scan again
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => onRemoveScan(scan.id)}
                      disabled={scan.status === 'scanning'}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                <ul className="save-gallery">
                  {scan.images.map((src, i) => (
                    <li key={`${scan.id}-img-${i}`}>
                      <button
                        type="button"
                        className="save-gallery__btn"
                        onClick={() => setLightbox({ images: scan.images, index: i })}
                      >
                        <img src={src} alt={`Scan source ${i + 1}`} />
                      </button>
                    </li>
                  ))}
                </ul>

                {scan.status === 'done' && scan.clips.length === 0 && (
                  <p className="empty-state">No readable text found on these photos.</p>
                )}

                {scan.clips.length > 0 && (
                  <ul className="clip-list">
                    {scan.clips.map((clip) => (
                      <li
                        key={clip.id}
                        className={
                          clip.kind === 'recipe' ? 'clip-card clip-card--recipe' : 'clip-card'
                        }
                      >
                        <div className="clip-card__top">
                          <span className="tag">
                            {clip.kind === 'recipe' ? 'Recipe' : 'Other text'}
                          </span>
                          <span className="clip-card__meta">
                            Page {clip.sourceImageIndex + 1} ·{' '}
                            {Math.round(clip.confidence * 100)}% match
                          </span>
                        </div>
                        <h4 className="clip-card__title">{clip.title}</h4>
                        <pre className="clip-card__body">{clip.body}</pre>
                        <div className="clip-card__actions">
                          {clip.kind === 'recipe' ? (
                            <>
                              <button
                                type="button"
                                className="btn btn--primary"
                                onClick={() => keepRecipeClip(scan, clip)}
                              >
                                Keep as saved recipe
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost"
                                onClick={() => onSetClipKind(scan.id, clip.id, 'other')}
                              >
                                Mark as other
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--ghost"
                              onClick={() => onSetClipKind(scan.id, clip.id, 'recipe')}
                            >
                              Mark as recipe
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => onRemoveClip(scan.id, clip.id)}
                          >
                            Discard
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="saves-summary">
        <p className="result-count">
          {recipes.length} kept save{recipes.length === 1 ? '' : 's'}
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
                {recipe.notes && (
                  <pre className="recipe__notes recipe__notes--clamp">{recipe.notes}</pre>
                )}
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

      {recipes.length === 0 && scans.length === 0 && (
        <p className="empty-state">No saves yet — scan a page or paste a favorite link above.</p>
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
