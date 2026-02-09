import React, { useMemo } from 'react';
import type { Collaboration } from '../types/collaboration';
import './CollabData.css';

type Props = { collab?: Collaboration | null };

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1
});
const standardFormatter = new Intl.NumberFormat('en');

const formatCount = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 10000) {
    return compactFormatter.format(value);
  }
  return standardFormatter.format(value);
};

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

  const maxScale = Math.max(participantsCount, submissionsCount, favoritesCount, votesCount, winner?.votes || 0, 1);
  const winnerPercent = votesCount > 0 && winner?.votes ? Math.round((winner.votes / votesCount) * 100) : 0;

  const stats = [
    { key: 'participants', label: 'participants', value: participantsCount, tone: 'cool', max: maxScale },
    { key: 'submissions', label: 'submissions', value: submissionsCount, tone: 'cool', max: maxScale },
    { key: 'favorites', label: 'favorites', value: favoritesCount, tone: 'warm', max: maxScale },
    { key: 'votes', label: 'votes cast', value: votesCount, tone: 'warm', max: maxScale },
    winner ? { key: 'winner', label: 'winner votes', value: winner.votes || 0, tone: 'neutral', max: votesCount || maxScale, suffix: `${winnerPercent}%` } : null
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    value: number;
    tone: 'cool' | 'warm' | 'neutral';
    max: number;
    suffix?: string;
  }>;

  return (
    <div className="collab-data">
      <div className="collab-data__stats" aria-label="Collaboration stats">
        {stats.map((stat) => {
          const ratio = clamp(stat.max > 0 ? stat.value / stat.max : 0);
          const percent = Math.round(ratio * 100);
          return (
            <div className={`collab-data__stat collab-data__stat--${stat.tone}`} key={stat.key}>
              <div className="collab-data__stat-head">
                <span className="collab-data__stat-label">{stat.label}</span>
                <span className="collab-data__stat-value">
                  {formatCount(stat.value)}
                  {stat.suffix && <span className="collab-data__stat-suffix">{stat.suffix}</span>}
                </span>
              </div>
              <div className="collab-data__stat-bar" aria-hidden="true">
                <div className="collab-data__stat-fill" style={{ width: `${percent}%` }} />
                <div className="collab-data__stat-handle" style={{ left: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Voting Results Section */}
      {status === 'completed' && results.length > 0 && (
        <div className="collab-data__results">
          <div className="collab-data__results-title">Voting Results</div>
          <table className="collab-data__results-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th className="collab-data__results-right">Votes</th>
                <th className="collab-data__results-right">%</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 10).map((r: any, i: number) => {
                const percent = votesCount > 0 ? Math.round(((r?.votes || 0) / votesCount) * 100) : 0;
                return (
                  <tr key={r.path || i} className={i === 0 ? 'collab-data__results-row--winner' : undefined}>
                    <td>#{i + 1}</td>
                    <td className="collab-data__results-right">{formatCount(r?.votes || 0)}</td>
                    <td className="collab-data__results-right">{percent}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {results.length > 10 && (
            <div className="collab-data__results-more">
              and {results.length - 10} more...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
