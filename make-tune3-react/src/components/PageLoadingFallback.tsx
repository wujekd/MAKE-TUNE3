import { LoadingSpinner } from './LoadingSpinner';
import './PageLoadingFallback.css';

interface PageLoadingFallbackProps {
  size?: number;
}

export function PageLoadingFallback({ size = 32 }: PageLoadingFallbackProps) {
  return (
    <div className="page-loading-fallback" role="status" aria-label="Loading">
      <LoadingSpinner size={size} />
    </div>
  );
}
