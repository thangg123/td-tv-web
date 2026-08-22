import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RAIL_CARD_WIDTH } from '@/components/movie/layout';
import PosterCard from '@/components/movie/PosterCard';
import Icon from '@/components/ui/Icon';
import { RailSkeleton } from '@/components/ui/Skeleton';
import type { MovieCard } from '@/lib/domain/models';

interface MovieRailProps {
  title: string;
  items: readonly MovieCard[];
  href?: string;
  eyebrow?: string;
  isLoading?: boolean;
  priority?: boolean;
}

/**
 * Card width lives in `movie/layout` so `RailSkeleton` reserves the identical
 * box and the two cannot drift apart.
 */

/** How much of the visible width one arrow press travels. */
const PAGE_FRACTION = 0.85;

/** Only the first few cards of a rail can plausibly be above the fold. */
const PRIORITY_COUNT = 4;

/*
 * The arrows sit above the first and last cards, so a hidden one must never be
 * hit-testable — `pointer-events-none` belongs to the hidden state itself, not
 * only to the at-edge branch.
 *
 * `.rail-arrow` then renders them ONLY for a fine pointer wide enough to have
 * room for them. A touch tablet is `md` but never fires hover, so without that
 * guard the arrows would sit there permanently invisible and permanently
 * inert — strictly worse than not drawing them, since a swipe already scrolls
 * the rail. `focus-visible` re-enables both opacity and hit-testing together,
 * or a keyboard user could see a focused arrow that only a mouse could press.
 */
const ARROW_BASE =
  'rail-arrow pointer-events-none absolute top-[38%] z-20 size-10 -translate-y-1/2 place-items-center rounded-full ' +
  'bg-ink/85 text-text-high ring-1 ring-outline backdrop-blur-md transition duration-200 opacity-0 ' +
  'hover:bg-accent hover:text-white hover:ring-accent active:scale-95 ' +
  'focus-visible:pointer-events-auto focus-visible:opacity-100';

export default function MovieRail({
  title,
  items,
  href,
  eyebrow,
  isLoading = false,
  priority = false,
}: MovieRailProps) {
  const railRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  const sync = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    const atStart = rail.scrollLeft <= 1;
    const atEnd = max <= 1 || rail.scrollLeft >= max - 1;
    // Scroll fires per frame; bail out unless an edge actually flipped.
    setEdges((prev) =>
      prev.atStart === atStart && prev.atEnd === atEnd ? prev : { atStart, atEnd },
    );
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    sync();
    rail.addEventListener('scroll', sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(rail);
    return () => {
      rail.removeEventListener('scroll', sync);
      observer.disconnect();
    };
    // `isLoading` swaps the rail for a skeleton, so the ref is a different node.
  }, [sync, isLoading]);

  /*
   * A ResizeObserver on the rail reports its box, not its contents — swapping in
   * a longer row changes scrollWidth without ever resizing the rail itself.
   */
  useEffect(sync, [sync, items]);

  const scrollByPage = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * rail.clientWidth * PAGE_FRACTION,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  };

  if (!isLoading && items.length === 0) return null;

  return (
    <section aria-label={title}>
      <header className="gutter flex items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="eyebrow mb-1.5">{eyebrow}</p>
          )}
          <h2 className="text-section font-semibold text-text-high">{title}</h2>
        </div>

        {href && (
          <Link
            to={href}
            /*
             * The padding is the hit box (20px of text + 24px = 44) and the
             * matching negative margin hands the layout back the box it had,
             * so the link still baselines against the heading beside it.
             */
            className="group/all -mx-2 -my-3 flex shrink-0 items-center gap-1 px-2 py-3 text-sm font-medium text-text-mid transition-colors duration-200 hover:text-accent"
          >
            Xem tất cả
            <Icon
              name="chevron-right"
              size={16}
              className="transition-transform duration-200 ease-out-expo group-hover/all:translate-x-0.5"
            />
          </Link>
        )}
      </header>

      {isLoading ? (
        <RailSkeleton />
      ) : (
        <div className="group/rail relative">
          <ul ref={railRef} className="rail">
            {items.map((movie, index) => (
              <li key={movie.slug} className={RAIL_CARD_WIDTH}>
                <PosterCard movie={movie} priority={priority && index < PRIORITY_COUNT} />
              </li>
            ))}
          </ul>

          <button
            type="button"
            aria-label={`Cuộn ${title} sang trái`}
            disabled={edges.atStart}
            onClick={() => scrollByPage(-1)}
            className={`${ARROW_BASE} left-2 ${
              edges.atStart
                ? ''
                : 'group-hover/rail:pointer-events-auto group-hover/rail:opacity-100'
            }`}
          >
            <Icon name="chevron-left" size={20} />
          </button>

          <button
            type="button"
            aria-label={`Cuộn ${title} sang phải`}
            disabled={edges.atEnd}
            onClick={() => scrollByPage(1)}
            className={`${ARROW_BASE} right-2 ${
              edges.atEnd
                ? ''
                : 'group-hover/rail:pointer-events-auto group-hover/rail:opacity-100'
            }`}
          >
            <Icon name="chevron-right" size={20} />
          </button>
        </div>
      )}
    </section>
  );
}
