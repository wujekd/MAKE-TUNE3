import React, { useMemo } from 'react';
import type { Collaboration } from '../types/collaboration';

type Props = { collab?: Collaboration | null };

export function CollabData({ collab }: Props) {
  const { submissionsCount, votesCount } = useMemo(() => {
    const submissionsArr: any = (collab as any)?.submissions;
    const legacyArr: any = (collab as any)?.submissionPaths;
    const submissionsCount = Array.isArray(submissionsArr)
      ? submissionsArr.length
      : (Array.isArray(legacyArr) ? legacyArr.length : 0);
    const results: any = (collab as any)?.results;
    const votesCount = Array.isArray(results)
      ? results.reduce((acc: number, r: any) => acc + (r?.votes || 0), 0)
      : 0;
    return { submissionsCount, votesCount };
  }, [collab]);

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h4 className="card__title">Collaboration data</h4>
      <div className="card__body">
        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--white)' }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', opacity: 0.8 }}>submissions</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{submissionsCount}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', opacity: 0.8 }}>listens</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>—</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', opacity: 0.8 }}>votes</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{votesCount}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

