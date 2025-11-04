import { storage } from '../services/firebase';
import { ref, getBlob } from 'firebase/storage';
import { UserService } from '../services';
import { DownloadButton } from './DownloadButton';

export function DownloadBacking({ userId, collaborationId, backingPath, onDownloaded }: { userId: string; collaborationId: string; backingPath: string; onDownloaded?: () => void }) {
  return (
    <div className="submission-pane">
      <h4 className="card__title">Download backing track</h4>
      <div className="card__body">
        <DownloadButton
          variant="full"
          onDownload={async () => {
            let filename = backingPath.split('/').pop() || 'backing';
            let blob: Blob;
            if (backingPath.startsWith('collabs/')) {
              blob = await getBlob(ref(storage, backingPath));
            } else {
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
          }}
        />
      </div>
    </div>
  );
}
