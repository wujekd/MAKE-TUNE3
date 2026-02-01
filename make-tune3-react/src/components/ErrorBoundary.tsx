import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    padding: '40px',
                    margin: '20px',
                    background: 'var(--background-card, #1a1a1a)',
                    color: 'var(--white, #ffffff)',
                    borderRadius: '12px',
                    border: '1px solid var(--error, #ff4444)',
                    textAlign: 'center',
                    fontFamily: 'sans-serif'
                }}>
                    <h2 style={{ color: 'var(--error, #ff4444)' }}>Unexpected Application Error!</h2>
                    <p style={{ margin: '20px 0', opacity: 0.8 }}>
                        Something went wrong. This might be due to a repeating update loop or an unexpected data state.
                    </p>
                    <div style={{
                        background: 'rgba(0,0,0,0.3)',
                        padding: '16px',
                        borderRadius: '8px',
                        textAlign: 'left',
                        fontSize: '13px',
                        overflow: 'auto',
                        maxHeight: '200px',
                        marginBottom: '20px',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {this.state.error?.message}
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: 'var(--contrast-500, #ffcc00)',
                            color: '#000',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
