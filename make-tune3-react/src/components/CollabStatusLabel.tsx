import './CollabStatusLabel.css';

interface CollabStatusLabelProps {
  status: string;
  className?: string;
}

const capitalizeStatus = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export function CollabStatusLabel({ status, className }: CollabStatusLabelProps) {
  const displayText = capitalizeStatus(status);
  const statusKey = status.toLowerCase().replace(/\s+/g, '-');
  
  return (
    <span className={`collab-status-label collab-status-label--${statusKey} ${className || ''}`}>
      {displayText || '—'}
    </span>
  );
}

