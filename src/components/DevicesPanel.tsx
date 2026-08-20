import type { SyncStatus } from '../hooks/useDinnerSync';
import { VisionKeyField } from './VisionKeyField';

interface DevicesPanelProps {
  status: SyncStatus;
  error: string | null;
  shareUrl: string;
  lastSyncedAt: number | null;
  onSyncNow: () => void;
}

function statusLabel(status: SyncStatus, lastSyncedAt: number | null): string {
  if (status === 'syncing') return 'Syncing across your devices…';
  if (status === 'error') return 'Could not reach sync just now — this device still has your data.';
  if (status === 'synced' && lastSyncedAt) {
    return `Shared across devices · updated ${new Date(lastSyncedAt).toLocaleTimeString()}`;
  }
  if (status === 'synced') return 'Shared across devices';
  return 'Preparing device sync…';
}

export function DevicesPanel({
  status,
  error,
  shareUrl,
  lastSyncedAt,
  onSyncNow,
}: DevicesPanelProps) {
  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      window.prompt('Copy this Dinner link and open it on your other device:', shareUrl);
    }
  }

  return (
    <section className="devices-panel">
      <p className="devices-panel__status">{statusLabel(status, lastSyncedAt)}</p>
      {error && <p className="devices-panel__error">{error}</p>}
      <p className="devices-panel__hint">
        Copy the device link and open it once on your phone or laptop. Pantry, recommended
        ingredients, saved recipes, and scans then follow you automatically — each device keeps a
        local copy and merges changes when Dinner is open.
      </p>
      <p className="footer__tools">
        <button type="button" className="btn btn--ghost" onClick={() => void copyLink()} disabled={!shareUrl}>
          Copy device link
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => onSyncNow()} disabled={status === 'syncing'}>
          Sync now
        </button>
      </p>
      <VisionKeyField />
    </section>
  );
}
