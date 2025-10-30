import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: number;
}

export function LoadingSpinner({ size = 16 }: LoadingSpinnerProps) {
  return (
    <div 
      className="loading-spinner" 
      style={{ 
        width: size, 
        height: size,
        borderWidth: Math.max(2, size / 8)
      }} 
    />
  );
}

