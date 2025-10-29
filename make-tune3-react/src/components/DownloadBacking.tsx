import { useState } from 'react';
import { storage } from '../services/firebase';
import { ref, getBlob } from 'firebase/storage';
import { UserService } from '../services';

export function DownloadBacking({ userId, collaborationId, backingPath, onDownloaded }: { userId: string; collaborationId: string; backingPath: string; onDownloaded?: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="submission-pane">
      <h4 className="card__title">Download backing track</h4>
      <div className="card__body">
        <button className="submission-pane__button" disabled={downloading} onClick={async () => {
          setDownloading(true); setError(null);
          try {
            let filename = backingPath.split('/').pop() || 'backing';
            let blob: Blob;
            if (backingPath.startsWith('collabs/')) {
              blob = await getBlob(ref(storage, backingPath));
            } else {
              // for test-audio or absolute URLs, fallback to fetch
              const res = await fetch(backingPath);
              blob = await res.blob();
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            await UserService.markBackingDownloaded(userId, collaborationId, backingPath);
            onDownloaded?.();
          } catch (e: any) {
            setError(e?.message || 'download failed');
          } finally {
            setDownloading(false);
          }
        }}>{downloading ? 'downloading...' : 'download'}</button>
        {error && <div style={{ color: 'var(--white)' }}>{error}</div>}
      </div>
    </div>
  );
}
