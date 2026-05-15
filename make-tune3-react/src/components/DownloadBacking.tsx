import { UserService } from '../services';
import { getStorageBlob } from '../services/storageService';
import { DownloadButton } from './DownloadButton';
import { SubmissionWaveformFrame } from './SubmissionWaveformFrame';
import type { WaveformRenderData } from '../types/waveform';

interface DownloadBackingProps {
  userId: string;
  collaborationId: string;
  backingPath: string;
  pdfPath?: string;
  resourcesZipPath?: string;
  collaborationName?: string;
  backingWaveformData?: WaveformRenderData | null;
  backingWaveformState?: 'loading' | 'ready' | 'placeholder';
  onDownloaded?: () => void;
}

async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const filename = path.split('/').pop() || fallbackName;
  let blob: Blob;
  if (path.startsWith('collabs/')) {
    blob = await getStorageBlob(path);
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
  collaborationName,
  backingWaveformData = null,
  backingWaveformState = 'placeholder',
  onDownloaded
}: DownloadBackingProps) {
  return (
    <SubmissionWaveformFrame
      backingWaveformData={backingWaveformData}
      backingWaveformState={backingWaveformState}
    >
      <section className="submission-upload__zone submission-upload__zone--collab">
        <div className="submission-upload__panel-head">
          <div>
            <div className="submission-upload__eyebrow">Backing</div>
            <h4 className="submission-upload__title">{collaborationName || 'Collaboration backing'}</h4>
          </div>
        </div>
      </section>

      <section className="submission-upload__zone submission-upload__zone--user">
        <div className="submission-upload__download-panel">
          <div>
            <div className="submission-upload__eyebrow">Download</div>
            <h4 className="submission-upload__download-title">Resources</h4>
          </div>
          <div className="submission-upload__download-grid">
            <div className="submission-upload__download-item">
              <div className="submission-upload__download-label">Backing track</div>
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
              <div className="submission-upload__download-item">
                <div className="submission-upload__download-label">Instructions</div>
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
              <div className="submission-upload__download-item">
                <div className="submission-upload__download-label">Resources ZIP</div>
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
      </section>
    </SubmissionWaveformFrame>
  );
}
