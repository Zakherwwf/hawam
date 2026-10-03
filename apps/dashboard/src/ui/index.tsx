import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronLeft, ChevronsUpDown, X } from 'lucide-react';

/**
 * Hawem research portal UI kit. Porcelain style from the reference boards:
 * white pill controls with an inner highlight, a near-black pill for the
 * selected item, 24 px cards on a cool grey shell. Apple HIG rules hold:
 * 44 px targets for primary controls, 8 pt rhythm, no emoji, SF type scale.
 */
export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type ButtonKind = 'primary' | 'dark' | 'pill' | 'secondary' | 'ghost' | 'danger';
const buttonClass = (kind: ButtonKind, size: 'sm' | 'md', className?: string) =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none',
    'transition-[background-color,color,transform,opacity,box-shadow] duration-150 active:scale-[0.98]',
    'disabled:opacity-45 disabled:pointer-events-none',
    size === 'sm' ? 'h-9 px-3.5 text-[13px]' : 'h-11 px-5 text-[15px]',
    kind === 'primary' && 'bg-accent text-on-accent hover:opacity-90',
    kind === 'dark' && 'bg-pill text-on-pill hover:opacity-90',
    kind === 'pill' && 'bg-surface text-ink shadow-pill hover:bg-raised dark:hover:bg-fill',
    kind === 'secondary' && 'bg-lime text-on-lime hover:brightness-95',
    kind === 'ghost' && 'text-accent hover:bg-lime-soft',
    kind === 'danger' && 'bg-danger-soft text-danger hover:brightness-95',
    className
  );

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
    <button type="button" {...rest} className={buttonClass(kind, size, className)}>
      {icon ? (
        <span aria-hidden className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

/** A link that looks like a button: navigation stays an <a> (cmd-click works). */
export function LinkButton({
  kind = 'pill',
  size = 'sm',
  icon,
  className,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  kind?: ButtonKind;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}) {
  return (
    <a {...rest} className={buttonClass(kind, size, className)}>
      {icon ? (
        <span aria-hidden className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">
          {icon}
        </span>
      ) : null}
      {children}
    </a>
  );
}

export function IconButton({
  label,
  className,
  children,
  active,
  size = 40,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  size?: 36 | 40 | 44;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'relative grid place-items-center rounded-full shrink-0 transition-[background-color,color,transform] duration-150 active:scale-95',
        'disabled:opacity-45 disabled:pointer-events-none [&>svg]:w-[18px] [&>svg]:h-[18px]',
        size === 36 ? 'w-9 h-9' : size === 40 ? 'w-10 h-10' : 'w-11 h-11',
        active ? 'bg-pill text-on-pill' : 'bg-surface text-ink2 shadow-pill hover:text-ink',
        className
      )}
    >
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
  as: As = 'section',
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' | 'aside' }) {
  return (
    <As {...rest} className={cx('min-w-0 bg-surface rounded-card shadow-card', className)}>
      {children}
    </As>
  );
}

/** "View all" pill with the up-right arrow (reference board 2). */
export function ViewAll({ href, label = 'View All' }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-surface shadow-pill text-[13px] font-semibold text-ink hover:bg-raised whitespace-nowrap"
    >
      <ArrowUpRight aria-hidden className="w-4 h-4" />
      {label}
    </a>
  );
}

export function CardHeader({
  title,
  description,
  action,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-start gap-4 px-6 pt-5 pb-3">
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">
          {title}
        </h2>
        {description ? <p className="text-[13px] text-ink2 mt-1">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2 shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  eyebrow?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-5">
      {back ? (
        <a
          href={back.href}
          className="inline-flex items-center gap-1 text-[14px] font-medium text-ink2 hover:text-ink mb-3 -ms-1"
        >
          <ChevronLeft aria-hidden className="w-4 h-4 rtl:rotate-180" />
          {back.label}
        </a>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
          <h1 className="text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">{title}</h1>
          {description ? (
            <p className="text-[15px] text-ink2 mt-1.5 max-w-[70ch]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** Pill tabs as links (each tab is a URL). Selected tab is the black pill. */
export function Tabs({
  items,
  label,
}: {
  items: { href: string; label: string; active: boolean; count?: number }[];
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 py-1">
      {items.map((t) => (
        <a
          key={t.href}
          href={t.href}
          aria-current={t.active ? 'page' : undefined}
          className={cx(
            'inline-flex items-center gap-2 h-10 px-4 rounded-full text-[14px] font-semibold whitespace-nowrap transition-colors',
            t.active ? 'bg-pill text-on-pill' : 'bg-surface text-ink shadow-pill hover:bg-raised'
          )}
        >
          {t.label}
          {t.count != null ? (
            <span
              className={cx(
                'min-w-6 h-6 px-1.5 rounded-full text-[12px] grid place-items-center tabular',
                t.active ? 'bg-white/20' : 'bg-fill text-ink2'
              )}
            >
              {t.count}
            </span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-full bg-fill p-1 max-w-full overflow-x-auto scrollbar-none"
    >
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
              'rounded-full font-semibold transition-[background-color,color] whitespace-nowrap',
              size === 'sm' ? 'h-7 px-3 text-[12px]' : 'h-8 px-3.5 text-[13px]',
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
          'text-[26px] font-semibold leading-tight mt-1',
          tone === 'warn' && 'text-warm-ink'
        )}
      >
        {value}
      </p>
      {detail ? <p className="text-[12px] text-ink3 mt-0.5">{detail}</p> : null}
    </div>
  );
}

/**
 * Stat tile (dataviz contract): label, value, signed delta against a named
 * period coloured by direction x whether up is good, optional sparkline.
 */
export function KpiTile({
  label,
  value,
  unit,
  delta,
  deltaLabel = 'vs previous period',
  upIsGood = true,
  spark,
  href,
  loading,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  deltaLabel?: string;
  upIsGood?: boolean;
  spark?: React.ReactNode;
  href?: string;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const good = delta != null && delta > 0 === upIsGood && delta !== 0;
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        {icon ? (
          <span
            aria-hidden
            className="w-8 h-8 rounded-full bg-canvas grid place-items-center text-ink2 [&>svg]:w-4 [&>svg]:h-4"
          >
            {icon}
          </span>
        ) : null}
        <p className="text-[13px] font-medium text-ink2 flex-1 min-w-0 truncate">{label}</p>
        {href ? (
          <ArrowUpRight aria-hidden className="w-4 h-4 text-ink3 group-hover:text-ink" />
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3 mt-3">
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-9 w-24" />
          ) : (
            <p className="text-[32px] leading-none font-semibold tracking-[-0.02em]">
              {value}
              {unit ? <span className="text-[15px] font-medium text-ink2 ms-1">{unit}</span> : null}
            </p>
          )}
          <p className="text-[12px] mt-2 h-4 whitespace-nowrap">
            {delta != null && Number.isFinite(delta) ? (
              <>
                <span
                  className={cx(
                    'inline-flex items-center gap-0.5 font-semibold',
                    delta === 0 ? 'text-ink2' : good ? 'text-accent dark:text-lime' : 'text-danger'
                  )}
                >
                  {delta > 0 ? (
                    <ArrowUp aria-hidden className="w-3 h-3" />
                  ) : delta < 0 ? (
                    <ArrowDown aria-hidden className="w-3 h-3" />
                  ) : null}
                  {new Intl.NumberFormat(undefined, {
                    style: 'percent',
                    maximumFractionDigits: 0,
                    signDisplay: 'exceptZero',
                  }).format(delta)}
                </span>{' '}
                <span className="text-ink3">{deltaLabel}</span>
              </>
            ) : (
              <span className="text-ink3">
                {deltaLabel === 'vs previous period' ? 'No earlier period to compare' : deltaLabel}
              </span>
            )}
          </p>
        </div>
        {spark ? <div className="w-[112px] shrink-0">{spark}</div> : null}
      </div>
    </>
  );
  const cls = 'group block min-w-0 bg-surface rounded-card shadow-card p-5';
  return href ? (
    <a href={href} className={cx(cls, 'hover:-translate-y-0.5 transition-transform duration-200')}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

type BadgeTone = 'accent' | 'warn' | 'danger' | 'cat' | 'dog' | 'neutral' | 'dark';
export function Badge({
  tone = 'neutral',
  children,
  dot,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  /** Status dot: only for real state (approved, pending, flagged) */
  dot?: boolean;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-[12px] font-semibold whitespace-nowrap',
        tone === 'accent' && 'bg-lime-soft text-accent',
        tone === 'warn' && 'bg-warm-soft text-warm-ink',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'cat' && 'bg-cat-soft text-cat',
        tone === 'dog' && 'bg-dog-soft text-dog',
        tone === 'neutral' && 'bg-fill text-ink2',
        tone === 'dark' && 'bg-pill text-on-pill'
      )}
    >
      {dot ? <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

const AVATAR_TINTS = [
  ['#E6EEFB', '#2B4E9E'],
  ['#FDF1EA', '#9A3412'],
  ['#E9FAD6', '#144513'],
  ['#FBF1DD', '#7A4E00'],
  ['#F3E8FD', '#6B21A8'],
  ['#E0F5F2', '#0F5F55'],
  ['#FDE8EF', '#9D174D'],
  ['#ECEEF1', '#3A3F47'],
];
export function initials(name: string | null | undefined) {
  const parts = (name || '?').trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Initials avatar. People's photos are never collected (minimal personal
 * data), so identity is a stable tint per account plus the initials.
 */
export function Avatar({
  id,
  name,
  size = 40,
  ring,
}: {
  id: string;
  name: string | null | undefined;
  size?: number;
  ring?: boolean;
}) {
  const [bg, fg] = AVATAR_TINTS[hash(id) % AVATAR_TINTS.length];
  return (
    <span
      aria-hidden
      className={cx(
        'inline-grid place-items-center rounded-full font-semibold shrink-0 select-none',
        ring && 'ring-2 ring-surface'
      )}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = 36,
  href,
}: {
  people: { id: string; name: string | null }[];
  max?: number;
  size?: number;
  href?: (id: string) => string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2 rtl:space-x-reverse">
      {shown.map((p) =>
        href ? (
          <a
            key={p.id}
            href={href(p.id)}
            title={p.name ?? undefined}
            aria-label={p.name ?? 'Volunteer'}
            className="rounded-full hover:z-10 focus-visible:z-10"
          >
            <Avatar id={p.id} name={p.name} size={size} ring />
          </a>
        ) : (
          <Avatar key={p.id} id={p.id} name={p.name} size={size} ring />
        )
      )}
      {rest > 0 ? (
        <span
          className="inline-grid place-items-center rounded-full bg-surface shadow-pill text-[12px] font-semibold text-ink2 ring-2 ring-surface tabular"
          style={{ width: size, height: size }}
        >
          {rest}+
        </span>
      ) : null}
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
  compact,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center text-center px-6 gap-3',
        compact ? 'py-8' : 'py-14'
      )}
    >
      <div
        aria-hidden
        className="w-12 h-12 rounded-full bg-canvas text-ink2 flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6"
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
      className="flex items-center gap-3 rounded-tile bg-danger-soft text-danger px-4 py-3 text-[14px] mb-4"
    >
      <span className="flex-1">
        Could not load this data: {message}. Check the connection, then try again.
      </span>
      {onRetry ? (
        <Button kind="ghost" size="sm" onClick={onRetry} className="text-danger">
          Try Again
        </Button>
      ) : null}
    </div>
  );
}

export function Notice({
  tone = 'accent',
  children,
  onClose,
}: {
  tone?: 'accent' | 'warn' | 'danger';
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'flex items-start gap-3 rounded-tile px-4 py-3 text-[14px] mb-4',
        tone === 'accent' && 'bg-lime-soft text-accent',
        tone === 'warn' && 'bg-warm-soft text-warm-ink',
        tone === 'danger' && 'bg-danger-soft text-danger'
      )}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {onClose ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="shrink-0 -m-1 p-1 rounded-full hover:bg-black/5"
        >
          <X aria-hidden className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-ink3">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'h-11 rounded-control bg-canvas px-3.5 text-[15px] text-ink placeholder:text-ink3 border border-line focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';
/** Pill-shaped select for filter rows */
export const selectPill =
  'h-10 rounded-full bg-surface shadow-pill ps-4 pe-9 text-[14px] font-medium text-ink border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 appearance-none bg-no-repeat cursor-pointer';
export const selectChevron = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2352565E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundPosition: 'right 12px center',
} as const;

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex w-[46px] h-7 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-45',
        checked ? 'bg-accent' : 'bg-fill'
      )}
    >
      <span
        aria-hidden
        className={cx(
          'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200',
          checked
            ? 'translate-x-[20px] rtl:-translate-x-[20px]'
            : 'translate-x-0.5 rtl:-translate-x-0.5',
          'start-0'
        )}
      />
    </button>
  );
}

function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  return ref;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="Close panel" className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute end-2 top-2 bottom-2 w-[calc(100%-16px)] max-w-[560px] bg-canvas rounded-card shadow-float flex flex-col outline-none overscroll-contain overflow-hidden rise"
      >
        <div className="flex items-center gap-3 px-5 h-16 shrink-0">
          <h2 className="text-[19px] font-semibold flex-1 truncate">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer ? <div className="px-5 py-4 border-t border-line bg-surface">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Confirmation dialog for destructive actions (web guidelines: never immediate). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const ref = useFocusTrap(open, onClose);
  const id = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={id}
        className="relative w-full max-w-[440px] bg-surface rounded-card shadow-float p-6 outline-none rise"
      >
        <h2 id={id} className="text-[20px] font-semibold">
          {title}
        </h2>
        <div className="text-[14px] text-ink2 mt-2">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 mt-6">{actions}</div>
      </div>
    </div>
  );
}

/** Click-outside popover anchored under its trigger. */
export function Popover({
  trigger,
  children,
  align = 'start',
  label,
  width = 280,
}: {
  trigger: (p: { open: boolean; toggle: () => void; id: string }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'start' | 'end';
  label: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open ? (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          style={{ width }}
          className={cx(
            'absolute z-40 mt-2 bg-surface rounded-tile shadow-float p-2 rise max-w-[calc(100vw-32px)]',
            align === 'start' ? 'start-0' : 'end-0'
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

/** Table shell: sticky header, row dividers only, numbers right-aligned by the caller. */
export function Table({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full text-[14px]" aria-label={label}>
        {children}
      </table>
    </div>
  );
}
export const th = 'text-start font-semibold text-[12px] text-ink3 px-6 py-2.5 whitespace-nowrap';
export const td = 'px-6 py-3 border-t border-line align-middle';
/** Numeric cell: right-aligned, tabular, never wrapped */
export const tdNum =
  'px-6 py-3 border-t border-line align-middle text-end tabular whitespace-nowrap';

export type Sort<K extends string> = { key: K; dir: 'asc' | 'desc' };
export function SortTh<K extends string>({
  k,
  sort,
  onSort,
  children,
  num,
}: {
  k: K;
  sort: Sort<K>;
  onSort: (s: Sort<K>) => void;
  children: React.ReactNode;
  num?: boolean;
}) {
  const on = sort.key === k;
  return (
    <th
      className={cx(th, num && 'text-end')}
      aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort({ key: k, dir: on && sort.dir === 'desc' ? 'asc' : 'desc' })}
        className={cx('inline-flex items-center gap-1 hover:text-ink', on && 'text-ink')}
      >
        {children}
        {on ? (
          sort.dir === 'desc' ? (
            <ArrowDown aria-hidden className="w-3 h-3" />
          ) : (
            <ArrowUp aria-hidden className="w-3 h-3" />
          )
        ) : (
          <ChevronsUpDown aria-hidden className="w-3 h-3 opacity-50" />
        )}
      </button>
    </th>
  );
}
export function sortBy<T, K extends string>(
  rows: T[],
  sort: Sort<K>,
  get: (r: T, k: K) => number | string | null | undefined
) {
  const m = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a, sort.key);
    const y = get(b, sort.key);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x < y ? -1 : x > y ? 1 : 0) * m;
  });
}

/** Label/value grid for profile facts. */
export function Facts({
  items,
  cols = 2,
}: {
  items: [string, React.ReactNode][];
  cols?: 2 | 3 | 4;
}) {
  return (
    <dl
      className={cx(
        'grid gap-x-6 gap-y-4',
        cols === 2 && 'grid-cols-2',
        cols === 3 && 'grid-cols-2 sm:grid-cols-3',
        cols === 4 && 'grid-cols-2 sm:grid-cols-4'
      )}
    >
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[12px] text-ink3">{k}</dt>
          <dd className="text-[15px] mt-0.5 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Meter: fill carries severity, the track is a lighter step of the same hue. */
export function Meter({
  value,
  tone = 'accent',
  label,
}: {
  value: number;
  tone?: 'accent' | 'warn' | 'danger';
  label: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cx(
        'h-2 rounded-full overflow-hidden',
        tone === 'accent' && 'bg-lime-soft dark:bg-accent-soft',
        tone === 'warn' && 'bg-warm-soft',
        tone === 'danger' && 'bg-danger-soft'
      )}
    >
      <div
        className={cx(
          'h-full rounded-full',
          tone === 'accent' && 'bg-accent dark:bg-lime',
          tone === 'warn' && 'bg-warm',
          tone === 'danger' && 'bg-danger'
        )}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h3 className="text-[15px] font-semibold flex-1">{children}</h3>
      {action}
    </div>
  );
}
