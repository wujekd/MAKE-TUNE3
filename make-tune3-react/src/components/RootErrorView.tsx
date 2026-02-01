import { useRouteError, useNavigate } from 'react-router-dom';

export function RootErrorView() {
    const error: any = useRouteError();
    const navigate = useNavigate();

    console.error('[RootErrorView]', error);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: 'var(--background, #0a0a0a)',
            color: 'var(--white, #ffffff)',
            padding: '20px',
            textAlign: 'center',
            fontFamily: 'sans-serif'
        }}>
            <h1 style={{ fontSize: '48px', margin: '0 0 20px 0', color: 'var(--contrast-500, #ffcc00)' }}>Oops!</h1>
            <h2 style={{ fontSize: '24px', margin: '0 0 10px 0' }}>Something went sideways.</h2>
            <p style={{ opacity: 0.7, maxWidth: '500px', marginBottom: '30px' }}>
                We encountered an error while navigating. You can try reloading the page or going back to the dashboard.
            </p>

            <div style={{
                background: 'rgba(255, 68, 68, 0.1)',
                border: '1px solid rgba(255, 68, 68, 0.3)',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'left',
                fontSize: '14px',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                marginBottom: '30px',
                maxWidth: '800px',
                width: '100%'
            }}>
                {error?.message || error?.statusText || 'Unknown Error'}
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        background: 'var(--contrast-500, #ffcc00)',
                        color: '#000',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Reload Page
                </button>
                <button
                    onClick={() => navigate('/collabs')}
                    style={{
                        background: 'transparent',
                        color: 'var(--white, #ffffff)',
                        border: '1px solid var(--white, #ffffff)',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
}
