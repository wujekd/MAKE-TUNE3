import './CollabStatusLabel.css';

interface CollabStatusLabelProps {
  status: string;
  className?: string;
}

const normalizeKey = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, '-');

const formatDisplay = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '—';
  const parts = trimmed.replace(/[-_]+/g, ' ').split(/\s+/);
  return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

export function CollabStatusLabel({ status, className }: CollabStatusLabelProps) {
  const statusKey = normalizeKey(status || '');
  const displayText = formatDisplay(status || statusKey);
  return (
    <span className={`collab-status-label collab-status-label--${statusKey} ${className || ''}`}>
      {displayText || '—'}
    </span>
  );
}
