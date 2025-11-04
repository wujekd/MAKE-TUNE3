import type { ReactNode } from 'react';

type CollabViewShellProps = {
  headerLeft: ReactNode;
  headerRight?: ReactNode;
  headerClassName?: string;
  mainClassName?: string;
  contentClassName?: string;
  className?: string;
  mixer?: ReactNode;
  children: ReactNode;
};

const mergeClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

export function CollabViewShell({
  headerLeft,
  headerRight,
  headerClassName,
  mainClassName,
  contentClassName,
  className,
  mixer,
  children
}: CollabViewShellProps) {
  return (
    <div className={mergeClasses('main-container', className)}>
      <div className={mergeClasses('info-top', headerClassName)}>
        <div className="mv-header-left">{headerLeft}</div>
        {headerRight && <div className="mv-header-right">{headerRight}</div>}
      </div>
      <section className={mergeClasses('submissions-section', mainClassName)}>
        <div className={mergeClasses('audio-player-section', contentClassName)}>
          {children}
        </div>
      </section>
      {mixer}
    </div>
  );
}
