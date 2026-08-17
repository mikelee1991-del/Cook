import { useRef, useState, type InputHTMLAttributes } from 'react';

interface BulkUploadZoneProps {
  accept?: string;
  /** Allow selecting a whole folder of photos */
  allowFolder?: boolean;
  disabled?: boolean;
  busyLabel?: string;
  idleLabel?: string;
  hint?: string;
  onFiles: (files: File[]) => void | Promise<void>;
}

function collectFiles(list: FileList | File[]): File[] {
  return Array.from(list).filter(
    (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
  );
}

/** Recursively read files dropped from a folder (Chrome/Edge). */
async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = dt.items;
  if (!items?.length) return collectFiles(dt.files);

  const out: File[] = [];

  async function walkEntry(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File | null>((resolve) => {
        (entry as FileSystemFileEntry).file(resolve, () => resolve(null));
      });
      if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
        out.push(file);
      }
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const readBatch = (): Promise<FileSystemEntry[]> =>
        new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      let batch = await readBatch();
      while (batch.length) {
        for (const child of batch) await walkEntry(child);
        batch = await readBatch();
      }
    }
  }

  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (!entries.length) return collectFiles(dt.files);
  for (const entry of entries) await walkEntry(entry);
  return out;
}

export function BulkUploadZone({
  accept = 'image/*',
  allowFolder = true,
  disabled = false,
  busyLabel = 'Processing…',
  idleLabel = 'Drop photos here or click to choose many',
  hint = 'Bulk select, drag a folder, or use “Choose folder”.',
  onFiles,
}: BulkUploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);

  async function emit(files: File[]) {
    if (!files.length || disabled) return;
    setLocalBusy(true);
    try {
      await onFiles(files);
    } finally {
      setLocalBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (folderRef.current) folderRef.current.value = '';
    }
  }

  const busy = disabled || localBusy;

  return (
    <div className="bulk-upload">
      <div
        className={
          dragging
            ? 'upload-drop upload-drop--tall upload-drop--active'
            : 'upload-drop upload-drop--tall'
        }
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setDragging(false);
          const files = await filesFromDataTransfer(e.dataTransfer);
          await emit(files);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          multiple
          disabled={busy}
          onChange={(e) => emit(collectFiles(e.target.files ?? []))}
        />
        <p>{busy ? busyLabel : idleLabel}</p>
      </div>
      <p className="bulk-upload__hint">{hint}</p>
      <div className="bulk-upload__actions">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Choose photos
        </button>
        {allowFolder && (
          <>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => folderRef.current?.click()}
            >
              Choose folder
            </button>
            <input
              ref={folderRef}
              type="file"
              accept={accept}
              multiple
              className="visually-hidden"
              disabled={busy}
              onChange={(e) => emit(collectFiles(e.target.files ?? []))}
              {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)}
            />
          </>
        )}
      </div>
    </div>
  );
}
