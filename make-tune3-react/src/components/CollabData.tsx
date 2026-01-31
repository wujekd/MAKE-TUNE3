import React, { useMemo } from 'react';
import type { Collaboration } from '../types/collaboration';

type Props = { collab?: Collaboration | null };

export function CollabData({ collab }: Props) {
  const { submissionsCount, votesCount, favoritesCount, participantsCount, results, winner } = useMemo(() => {
    const status = (collab as any)?.status || 'unknown';
    
    // Submissions: use counter if available, fallback to array length
    const submissionsArr: any = (collab as any)?.submissions;
    const legacyArr: any = (collab as any)?.submissionPaths;
    const submissionsCount = typeof (collab as any)?.submissionsCount === 'number'
      ? (collab as any).submissionsCount
      : (Array.isArray(submissionsArr) ? submissionsArr.length : 
         (Array.isArray(legacyArr) ? legacyArr.length : 0));
    
    // Favorites: use counter
    const favoritesCount = (collab as any)?.favoritesCount || 0;
    
    // Votes: for completed use results array, otherwise use counter
    const resultsRaw: any = (collab as any)?.results;
    const votesCount = status === 'completed' && Array.isArray(resultsRaw)
      ? resultsRaw.reduce((acc: number, r: any) => acc + (r?.votes || 0), 0)
      : ((collab as any)?.votesCount || 0);
    
    // Participants (users who submitted)
    const participantsCount = Array.isArray((collab as any)?.participantIds) 
      ? (collab as any).participantIds.length 
      : 0;
    
    const results = Array.isArray(resultsRaw) 
      ? resultsRaw.slice().sort((a: any, b: any) => (b?.votes || 0) - (a?.votes || 0))
      : [];
    
    const winner = results.length > 0 ? results[0] : null;
    
    return { submissionsCount, votesCount, favoritesCount, participantsCount, results, winner };
  }, [collab]);

  const status = (collab as any)?.status || 'unknown';

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="card__body">
        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--white)' }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', opacity: 0.8 }}>participants</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{participantsCount}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', opacity: 0.8 }}>submissions</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{submissionsCount}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', opacity: 0.8 }}>favorites</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{favoritesCount}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', opacity: 0.8 }}>votes cast</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{votesCount}</td>
            </tr>
            {winner && (
              <tr>
                <td style={{ padding: '6px 8px', opacity: 0.8 }}>winner votes</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{winner.votes} ({Math.round((winner.votes / votesCount) * 100)}%)</td>
              </tr>
            )}
          </tbody>
        </table>
        
        {status === 'completed' && results.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.9 }}>
              Voting Results
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--white)', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '4px 8px', textAlign: 'left', opacity: 0.7 }}>Rank</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right', opacity: 0.7 }}>Votes</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right', opacity: 0.7 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 10).map((r: any, i: number) => (
                  <tr key={r.path || i} style={{ opacity: i === 0 ? 1 : 0.8 }}>
                    <td style={{ padding: '4px 8px' }}>#{i + 1}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.votes || 0}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      {Math.round((r.votes / votesCount) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length > 10 && (
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.5rem', textAlign: 'center' }}>
                and {results.length - 10} more...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

