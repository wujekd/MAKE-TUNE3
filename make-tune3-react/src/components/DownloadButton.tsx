import { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import './DownloadButton.css';

interface DownloadButtonProps {
  onDownload: () => Promise<void>;
  disabled?: boolean;
  label?: string;
  variant?: 'compact' | 'full';
  className?: string;
}

export function DownloadButton({ 
  onDownload, 
  disabled = false,
  label,
  variant = 'compact',
  className = ''
}: DownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled || isLoading) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await onDownload();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err?.message || 'Download failed');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    if (isLoading) {
      return <LoadingSpinner size={variant === 'full' ? 16 : 14} />;
    }
    
    if (success) {
      return '✓';
    }

    if (error) {
      return '✕';
    }
    
    return '⬇';
  };

  const getButtonText = () => {
    if (isLoading) return variant === 'full' ? 'downloading...' : '';
    if (success) return variant === 'full' ? 'downloaded!' : '';
    if (error) return variant === 'full' ? 'failed' : '';
    return variant === 'full' ? 'download' : '';
  };

  const buttonText = getButtonText();

  return (
    <div className={`download-button-wrapper ${variant}`}>
      <button
        type="button"
        className={`download-button download-button--${variant} ${success ? 'success' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''} ${label ? 'with-label' : ''} ${className}`}
        onClick={handleClick}
        disabled={disabled || isLoading}
        aria-label={isLoading ? 'downloading' : success ? 'downloaded' : error ? 'download failed' : 'download'}
      >
        {label && <span className="download-button__label">{label}</span>}
        <span className="download-button__icon">{getIcon()}</span>
        {buttonText && <span className="download-button__text">{buttonText}</span>}
      </button>
      {variant === 'full' && error && (
        <div className="download-button__error-message">{error}</div>
      )}
    </div>
  );
}

