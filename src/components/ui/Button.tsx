import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  className?: string;
  children?: ReactNode;
}

const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

/*
 * Only compositor-friendly properties are listed here — a button that
 * transitions its padding janks the whole row it sits in.
 *
 * `min-h-11` is the WCAG 44px touch floor and it is unconditional below `md`,
 * where every visitor is holding the thing. From `md` up the `h-*` in SIZES
 * takes back over, so a mouse still gets the compact `sm` and `md` buttons.
 * A width breakpoint rather than `pointer-coarse` because the floor has to hold
 * under a plain narrow-window audit too, not only under touch emulation.
 */
const BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-pill font-medium whitespace-nowrap ' +
  'min-h-11 md:min-h-0 ' +
  'transition-[transform,color,background-color,border-color,box-shadow,filter] duration-200 ease-out-expo ' +
  'disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white shadow-md shadow-accent/25 ' +
    'hover:-translate-y-px hover:brightness-110 hover:shadow-lg hover:shadow-accent/40 ' +
    'focus-visible:-translate-y-px active:translate-y-0 active:brightness-95 active:shadow-md',
  secondary:
    'border border-outline bg-surface-3/80 text-text-high ' +
    'hover:-translate-y-px hover:border-accent/50 hover:bg-surface-3 hover:shadow-lift ' +
    'active:translate-y-0 active:bg-surface-2',
  ghost:
    'border border-transparent text-text-mid ' +
    'hover:bg-surface-2 hover:text-text-high active:bg-surface-3 active:text-text-high',
  danger:
    'border border-accent/40 text-accent ' +
    'hover:border-accent hover:bg-accent-ink hover:text-accent-soft active:brightness-95',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 gap-2.5 px-6 text-base',
};

const SQUARE_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const ICON_PX: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  className,
  children,
  type = 'button',
  ...rest
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cx(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {icon ? <Icon name={icon} size={ICON_PX[size]} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={ICON_PX[size]} /> : null}
    </button>
  );
}

export function LinkButton({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  className,
  children,
  to,
  ...rest
}: BaseProps & { to: string } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'href'
  >) {
  return (
    <Link
      to={to}
      className={cx(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {icon ? <Icon name={icon} size={ICON_PX[size]} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={ICON_PX[size]} /> : null}
    </Link>
  );
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: {
  icon: IconName;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        BASE,
        VARIANTS[variant],
        SQUARE_SIZES[size],
        'p-0 min-w-11 md:min-w-0',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={ICON_PX[size]} />
    </button>
  );
}
