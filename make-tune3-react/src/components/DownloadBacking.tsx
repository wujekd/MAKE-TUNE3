import { storage } from '../services/firebase';
import { ref, getBlob } from 'firebase/storage';
import { UserService } from '../services';
import { DownloadButton } from './DownloadButton';

interface DownloadBackingProps {
  userId: string;
  collaborationId: string;
  backingPath: string;
  pdfPath?: string;
  resourcesZipPath?: string;
  onDownloaded?: () => void;
}

async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const filename = path.split('/').pop() || fallbackName;
  let blob: Blob;
  if (path.startsWith('collabs/')) {
    blob = await getBlob(ref(storage, path));
  } else {
    const res = await fetch(path);
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
}

export function DownloadBacking({
  userId,
  collaborationId,
  backingPath,
  pdfPath,
  resourcesZipPath,
  onDownloaded
}: DownloadBackingProps) {
  return (
    <div className="submission-pane">
      <h4 className="card__title" style={{ margin: 0 }}>Download resources</h4>
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, color: 'var(--white)' }}>Backing track</div>
          <DownloadButton
            variant="full"
            onDownload={async () => {
              await downloadFile(backingPath, 'backing');
              await UserService.markResourceDownloaded(userId, collaborationId, 'backing', backingPath);
              onDownloaded?.();
            }}
          />
        </div>
        {pdfPath && (
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, color: 'var(--white)' }}>Instructions (PDF)</div>
            <DownloadButton
              variant="full"
              label="Download PDF"
              onDownload={async () => {
                await downloadFile(pdfPath, 'instructions.pdf');
                await UserService.markResourceDownloaded(userId, collaborationId, 'pdf', pdfPath);
              }}
            />
          </div>
        )}
        {resourcesZipPath && (
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, color: 'var(--white)' }}>Resources (ZIP)</div>
            <DownloadButton
              variant="full"
              label="Download ZIP"
              onDownload={async () => {
                await downloadFile(resourcesZipPath, 'resources.zip');
                await UserService.markResourceDownloaded(userId, collaborationId, 'zip', resourcesZipPath);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
