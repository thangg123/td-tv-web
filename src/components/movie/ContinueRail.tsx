import { Link } from 'react-router-dom';
import { IconButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import SmartImage from '@/components/ui/SmartImage';
import type { WatchProgress } from '@/lib/domain/models';
import { progressPercent } from '@/lib/domain/models';
import { formatDuration, metaLine } from '@/lib/format';
import { routes } from '@/lib/routes';

interface ContinueRailProps {
  items: readonly WatchProgress[];
  onRemove?: (slug: string) => void;
  title?: string;
}

/**
 * 74vw left only a 40px sliver of the second card on a 320px screen, which
 * reads as a one-item row rather than a scrollable one. The fixed step lands at
 * 392px, where 68vw is already 15rem.
 */
const CARD_WIDTH = 'w-[68vw] min-[24.5rem]:w-[15rem] sm:w-[17rem] lg:w-[19rem]';

const RAISED =
  'group-hover:-translate-y-1 group-hover:shadow-lift group-hover:ring-2 group-hover:ring-accent ' +
  'group-focus-within:-translate-y-1 group-focus-within:shadow-lift group-focus-within:ring-2 group-focus-within:ring-accent';

export default function ContinueRail({
  items,
  onRemove,
  title = 'Xem tiếp',
}: ContinueRailProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label={title}>
      <header className="gutter">
        <h2 className="text-section font-semibold text-text-high">{title}</h2>
      </header>

      <ul className="rail">
        {items.map((entry) => {
          const remainingMs = entry.durationMs - entry.positionMs;
          const remaining =
            remainingMs > 0 ? `${formatDuration(remainingMs)} còn lại` : null;
          const percent = Math.round(progressPercent(entry) * 100);
          const caption = metaLine(entry.episodeName, remaining);

          return (
            <li key={entry.slug} className={CARD_WIDTH}>
              <article className="group relative">
                <Link
                  to={routes.watch(entry.slug, entry.serverIndex, entry.episodeSlug)}
                  className="block rounded-card"
                >
                  <div
                    className={`relative overflow-hidden rounded-card bg-surface-2 ring-1 ring-outline/60 transition duration-300 ease-out-expo ${RAISED}`}
                  >
                    <SmartImage
                      src={entry.landscapeImage}
                      alt={entry.name}
                      aspect="wide"
                      sizes="(min-width: 1024px) 304px, (min-width: 640px) 272px, (min-width: 392px) 240px, 68vw"
                    />

                    <div className="pointer-events-none absolute inset-0 scrim-bottom" />

                    <span className="pointer-events-none absolute inset-0 grid place-items-center">
                      <span className="reveal-on-hover grid size-12 scale-90 place-items-center rounded-full bg-accent pl-0.5 text-white shadow-lift transition duration-300 ease-out-back group-hover:scale-100 group-focus-within:scale-100">
                        <Icon name="play" size={20} />
                      </span>
                    </span>

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pb-4">
                      <p className="truncate text-sm font-semibold text-text-high">
                        {entry.name}
                      </p>
                      {caption.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-text-mid">{caption}</p>
                      )}
                    </div>

                    <div
                      className="absolute inset-x-0 bottom-0 h-[3px] bg-surface-3/90"
                      role="progressbar"
                      aria-label={`Đã xem ${percent}%`}
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </Link>

                {onRemove && (
                  <IconButton
                    icon="close"
                    label={`Xóa "${entry.name}" khỏi ${title}`}
                    variant="secondary"
                    size="sm"
                    onClick={() => onRemove(entry.slug)}
                    className="reveal-on-hover absolute right-2 top-2 z-20 min-h-11 min-w-11 backdrop-blur-md transition-opacity duration-200 sm:min-h-0 sm:min-w-0"
                  />
                )}
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
