import type { ReactNode } from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { toUserMessage } from '@/lib/api/client';

const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

const PANEL =
  'flex min-h-[45vh] flex-col items-center justify-center gap-4 px-gutter py-16 text-center';

function Plate({ icon }: { icon: IconName }) {
  return (
    <span className="grid h-16 w-16 place-items-center rounded-full bg-surface-1 text-text-mid ring-1 ring-outline/70">
      <Icon name={icon} size={30} />
    </span>
  );
}

export function LoadingState({
  label = 'Đang tải…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cx(PANEL, className)}>
      <span
        className="h-9 w-9 animate-spin rounded-full border-2 border-outline border-t-accent"
        aria-hidden="true"
      />
      <p className="text-sm text-text-mid">{label}</p>
    </div>
  );
}

export function ErrorState({
  error,
  message,
  onRetry,
  className,
}: {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cx(PANEL, className)}>
      <Plate icon="info" />
      <div className="max-w-md space-y-1.5">
        <h2 className="text-section font-semibold text-text-high">
          Không tải được nội dung
        </h2>
        <p className="text-sm text-text-mid">{message ?? toUserMessage(error)}</p>
      </div>
      {onRetry ? (
        <Button variant="primary" icon="refresh" onClick={onRetry}>
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  icon = 'film',
  action,
  className,
}: {
  title: string;
  message?: string;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(PANEL, className)}>
      <Plate icon={icon} />
      <div className="max-w-md space-y-1.5">
        <h2 className="text-section font-semibold text-text-high">{title}</h2>
        {message ? <p className="text-sm text-text-mid">{message}</p> : null}
      </div>
      {action}
    </div>
  );
}
