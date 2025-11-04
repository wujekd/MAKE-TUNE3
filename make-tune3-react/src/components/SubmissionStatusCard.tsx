import type { ReactNode } from 'react';

type SubmissionStatusCardProps = {
  title: string;
  children: ReactNode;
};

export function SubmissionStatusCard({ title, children }: SubmissionStatusCardProps) {
  return (
    <div className="submission-pane">
      <h4 className="card__title">{title}</h4>
      <div className="card__body">{children}</div>
    </div>
  );
}
