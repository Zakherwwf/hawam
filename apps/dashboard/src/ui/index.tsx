import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  kind = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: ButtonKind;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap',
        'transition-[background-color,color,transform,opacity] duration-150 active:scale-[0.98]',
        'disabled:opacity-45 disabled:pointer-events-none',
        size === 'sm' ? 'h-9 px-3.5 text-[13px]' : 'h-11 px-5 text-[15px]',
        kind === 'primary' && 'bg-accent text-on-accent hover:opacity-90',
        kind === 'secondary' &&
          'bg-lime text-on-lime hover:brightness-95 dark:bg-accent-soft dark:text-accent',
        kind === 'ghost' && 'text-accent hover:bg-lime-soft',
        kind === 'danger' && 'bg-danger-soft text-danger hover:brightness-95',
        className
      )}
    >
      {icon ? (
        <span aria-hidden className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
  as: As = 'section',
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' }) {
  return (
    <As
      {...rest}
      className={cx(
        'min-w-0 bg-surface rounded-card shadow-card dark:shadow-none dark:ring-1 dark:ring-line',
        className
      )}
    >
      {children}
    </As>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-5 pt-5 pb-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] font-semibold leading-snug">{title}</h2>
        {description ? <p className="text-[13px] text-ink2 mt-0.5">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        {description ? (
          <p className="text-[15px] text-ink2 mt-1 max-w-[65ch]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'warn';
}) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-ink2">{label}</p>
      <p
        className={cx(
          'text-[28px] font-semibold tabular leading-tight mt-1',
          tone === 'warn' && 'text-warm-ink'
        )}
      >
        {value}
      </p>
      {detail ? <p className="text-[12px] text-ink3 mt-0.5">{detail}</p> : null}
    </div>
  );
}

type BadgeTone = 'accent' | 'warn' | 'danger' | 'cat' | 'dog' | 'neutral';
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap',
        tone === 'accent' && 'bg-lime-soft text-accent',
        tone === 'warn' && 'bg-warm-soft text-warm-ink',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'cat' && 'bg-cat-soft text-cat',
        tone === 'dog' && 'bg-dog-soft text-dog',
        tone === 'neutral' && 'bg-fill text-ink2'
      )}
    >
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-fill p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'h-8 px-3.5 rounded-full text-[13px] font-semibold transition-colors',
              on ? 'bg-surface text-ink shadow-sm' : 'text-ink2 hover:text-ink'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('skeleton rounded-control', className)} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-12 gap-3">
      <div
        aria-hidden
        className="w-12 h-12 rounded-full bg-lime-soft text-accent flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6"
      >
        {icon}
      </div>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {body ? <p className="text-[14px] text-ink2 max-w-[48ch]">{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-control bg-danger-soft text-danger px-4 py-3 text-[14px]"
    >
      <span className="flex-1">Could not load this data: {message}</span>
      {onRetry ? (
        <Button kind="ghost" size="sm" onClick={onRetry} className="text-danger">
          Try Again
        </Button>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[12px] text-ink3">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  'h-11 rounded-control bg-canvas px-3.5 text-[15px] text-ink placeholder:text-ink3 border border-line focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="Close panel" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-canvas shadow-2xl flex flex-col outline-none overscroll-contain"
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-line bg-surface">
          <h2 className="text-[17px] font-semibold flex-1 truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full hover:bg-fill flex items-center justify-center"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** Table shell: sticky header, row dividers only, numbers right-aligned by the caller. */
export function Table({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[14px]" aria-label={label}>
        {children}
      </table>
    </div>
  );
}
export const th = 'text-left font-semibold text-[12px] text-ink2 px-5 py-2.5 whitespace-nowrap';
export const td = 'px-5 py-3 border-t border-line align-middle';
/** Numeric cell: right-aligned, tabular, never wrapped */
export const tdNum =
  'px-5 py-3 border-t border-line align-middle text-right tabular whitespace-nowrap';
