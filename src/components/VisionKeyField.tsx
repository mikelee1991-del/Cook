import { useState } from 'react';
import { hasVisionAccess, loadVisionKey, saveVisionKey, usesGlobalVision } from '../lib/visionConfig';

export function VisionKeyField({ onReady }: { onReady?: () => void }) {
  const [key, setKey] = useState(() => loadVisionKey());
  const [saved, setSaved] = useState(false);
  const globalVision = usesGlobalVision();
  const ready = hasVisionAccess();

  if (globalVision) {
    return (
      <p className="add-form__hint">
        Photo scans use a shared vision service — no API key needed in this browser.
      </p>
    );
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveVisionKey(key);
    setSaved(true);
    onReady?.();
  }

  return (
    <form className="vision-key" onSubmit={handleSave}>
      <p className="add-form__hint">
        {ready
          ? 'Vision is on — photos are identified by looking at packaging, produce, layout, and handwriting.'
          : 'Paste a free Gemini API key so shelf and recipe photos can be identified. The key stays in this browser.'}{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          Get a key
        </a>
      </p>
      <div className="add-form__grid">
        <label className="field field--grow">
          <span className="field__label">Gemini API key</span>
          <input
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setSaved(false);
            }}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="btn btn--ghost add-form__submit">
          {saved ? 'Saved' : 'Save key'}
        </button>
      </div>
    </form>
  );
}
