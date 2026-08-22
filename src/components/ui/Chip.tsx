import { Link } from 'react-router-dom';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';

interface ChipProps {
  label: string;
  active?: boolean;
  count?: number;
  icon?: IconName;
  onClick?: () => void;
  className?: string;
}

const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

/* Same 44px touch floor as Button: `min-h` beats `h-8` up to the `md` breakpoint. */
const BASE =
  'inline-flex h-8 min-h-11 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium tracking-wide whitespace-nowrap md:min-h-0 ' +
  'transition-[transform,color,background-color,border-color,box-shadow] duration-200 ease-out-expo';

const REST = 'border-outline bg-surface-2 text-text-mid';
const REST_INTERACTIVE =
  'hover:border-outline hover:bg-surface-3 hover:text-text-high active:scale-[0.97]';

/* The glow is what tells you which axis is filtering, at a glance. */
const ACTIVE = 'border-accent bg-accent text-white shadow-md shadow-accent/30';
const ACTIVE_INTERACTIVE = 'hover:brightness-110 active:scale-[0.97]';

function chipClass(active: boolean, interactive: boolean, className?: string) {
  return cx(
    BASE,
    active ? ACTIVE : REST,
    interactive && (active ? ACTIVE_INTERACTIVE : REST_INTERACTIVE),
    className,
  );
}

export default function Chip({
  label,
  active = false,
  count,
  icon,
  onClick,
  className,
}: ChipProps) {
  const body = (
    <>
      {icon ? <Icon name={icon} size={14} /> : null}
      <span>{label}</span>
      {typeof count === 'number' && count > 0 ? (
        <span className="rounded-full bg-ink/40 px-1.5 py-px text-xs tabular-nums">
          {count}
        </span>
      ) : null}
    </>
  );

  /* A chip with nothing to do is a label, not a control — keep it out of the
     tab order rather than handing keyboard users a dead stop. */
  if (!onClick) {
    return <span className={chipClass(active, false, className)}>{body}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={chipClass(active, true, className)}
    >
      {body}
    </button>
  );
}

export function ChipLink({
  label,
  to,
  active = false,
  className,
}: {
  label: string;
  to: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={chipClass(active, true, className)}
    >
      {label}
    </Link>
  );
}
