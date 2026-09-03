import type { ReactNode } from 'react';

export type ChipTone = 'default' | 'ghost' | 'primary' | 'success' | 'warning' | 'danger';

export function Chip({
  children,
  tone = 'default',
  title
}: {
  children: ReactNode;
  tone?: ChipTone;
  title?: string;
}) {
  return (
    <span className={`chip chip-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Callout({
  tone = 'warning',
  title,
  children
}: {
  tone?: 'warning' | 'danger' | 'info';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`callout callout-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {title ? <b>{title}</b> : null}
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <b>{title}</b>
      {children ? <p className="muted">{children}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  bodyClass
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodyClass?: string;
}) {
  return (
    <section className="panel">
      {title || actions ? (
        <header className="panel-head">
          <h2>{title}</h2>
          {actions ? <div className="row">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`panel-body${bodyClass ? ` ${bodyClass}` : ''}`}>{children}</div>
    </section>
  );
}
