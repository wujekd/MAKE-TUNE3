import type { ReactNode } from 'react';
import { AdminNav } from './AdminNav';

interface AdminLayoutProps {
    children: ReactNode;
    title?: ReactNode;
    actions?: ReactNode;
    /**
     * If true, the children container will not have flex: 1.
     * Useful if you want to handle scrolling internally in a specific child.
     * Default: false (children are laid out in a flex column that takes remaining height)
     */
    disableFlex?: boolean;
}

export function AdminLayout({ children, title, actions }: AdminLayoutProps) {
    return (
        <div style={{
            padding: 24,
            background: 'var(--primary1-800)',
            height: '100%',
            minHeight: 0,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{
                maxWidth: 960,
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                width: '100%',
                flex: 1,
                minHeight: 0
            }}>
                <AdminNav />

                {(title || actions) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {title && (typeof title === 'string' ? <h2 style={{ color: 'var(--white)', margin: 0 }}>{title}</h2> : title)}
                        {actions && <div>{actions}</div>}
                    </div>
                )}

                {children}
            </div>
        </div>
    );
}
