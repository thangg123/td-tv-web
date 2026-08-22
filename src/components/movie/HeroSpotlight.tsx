import { useEffect, useState } from 'react';
import { MetaBadges, RatingBadge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import type { MovieCard } from '@/lib/domain/models';
import { landscapeOf } from '@/lib/domain/models';
import { routes } from '@/lib/routes';

interface HeroSpotlightProps {
  items: readonly MovieCard[];
  isLoading?: boolean;
}

const SLIDE_COUNT = 5;
const ROTATE_MS = 9000;

/** One box for the hero and for its skeleton, so nothing shifts as art arrives. */
const HERO_BOX = 'relative isolate h-[62vh] min-h-[420px] max-h-[760px] w-full overflow-visible';

/*
 * The art starts above the section so it runs under the translucent header
 * instead of butting against it. The section itself must not clip, so the bleed
 * gets its own overflow container.
 */
const ART_BOX = 'absolute inset-x-0 -top-20 bottom-0 overflow-hidden bg-ink-deep';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export default function HeroSpotlight({ items, isLoading = false }: HeroSpotlightProps) {
  const slides = items.slice(0, SLIDE_COUNT);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  // `items` can shrink between renders (a refetch, a shorter row); never index past it.
  const safeIndex = index < slides.length ? index : 0;

  /*
   * Only slides that have been shown — plus the one coming next — are in the DOM.
   * Mounting all five would fetch five 16:9 stills for a hero that shows one, and
   * mounting the next one early is what gives the incoming layer something to
   * fade in from: a layer mounted in the same commit that activates it would pop.
   */
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([0]));

  useEffect(() => {
    if (slides.length === 0) return;
    const next = (safeIndex + 1) % slides.length;
    setMounted((prev) =>
      prev.has(safeIndex) && prev.has(next) ? prev : new Set([...prev, safeIndex, next]),
    );
  }, [safeIndex, slides.length]);

  useEffect(() => {
    if (paused || reducedMotion || slides.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % slides.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
    // `safeIndex` restarts the clock after a manual jump, so a click on a dash
    // gets a full interval rather than whatever was left of the current one.
  }, [paused, reducedMotion, slides.length, safeIndex]);

  if (slides.length === 0) {
    if (!isLoading) return null;
    return (
      <div className={HERO_BOX} aria-hidden="true">
        <div className={ART_BOX}>
          <div className="absolute inset-0 bg-surface-1" />
          <div className="absolute inset-0 scrim-bottom" />
        </div>
        <div className="gutter relative flex h-full max-w-3xl flex-col justify-end gap-4 pb-10 sm:pb-14">
          <div className="skeleton h-3 w-32 rounded-pill" />
          <div className="skeleton h-12 w-3/4 rounded-card sm:h-16" />
          <div className="skeleton h-4 w-1/2 rounded-pill" />
          <div className="flex gap-3">
            <div className="skeleton h-11 w-36 rounded-pill" />
            <div className="skeleton h-11 w-28 rounded-pill" />
          </div>
        </div>
      </div>
    );
  }

  const movie = slides[safeIndex] ?? slides[0];
  if (!movie) return null;

  const hasOriginName = movie.originName.length > 0 && movie.originName !== movie.name;

  return (
    <section
      aria-label="Phim nổi bật"
      className={HERO_BOX}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={ART_BOX} aria-hidden="true">
        {slides.map((slide, position) =>
          mounted.has(position) ? (
            <img
              key={slide.slug}
              src={landscapeOf(slide)}
              alt=""
              className={`absolute inset-0 size-full object-cover object-[center_28%] transition-opacity duration-1000 ease-out-expo ${
                position === safeIndex ? 'opacity-100' : 'opacity-0'
              }`}
              loading={position === 0 ? 'eager' : 'lazy'}
              fetchPriority={position === 0 ? 'high' : 'auto'}
              decoding="async"
            />
          ) : null,
        )}
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-0 scrim-left" />
        <div className="grain absolute inset-0" />
      </div>

      <div className="gutter relative flex h-full flex-col justify-end pb-10 sm:pb-14">
        {/* Re-keying replays the entrance animation on every rotation. */}
        <div key={movie.slug} className="max-w-2xl animate-fade-up">
          <p className="eyebrow">Phim mới cập nhật</p>

          <h1 className="clamp-2 mt-3 text-display font-black text-text-high">{movie.name}</h1>

          {hasOriginName && (
            <p className="mt-2 truncate text-base text-text-mid sm:text-lg">{movie.originName}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {movie.rating !== null && <RatingBadge rating={movie.rating} />}
            {movie.year !== null && (
              <span className="text-sm font-medium text-text-mid">{movie.year}</span>
            )}
            <MetaBadges
              quality={movie.quality}
              lang={movie.lang}
              episodeCurrent={movie.episodeCurrent}
            />
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <LinkButton to={routes.watch(movie.slug)} variant="primary" size="lg" icon="play">
              Xem ngay
            </LinkButton>
            <LinkButton to={routes.detail(movie.slug)} variant="secondary" size="lg" icon="info">
              Chi tiết
            </LinkButton>
          </div>
        </div>

        {slides.length > 1 && (
          <div className="absolute bottom-10 right-gutter hidden items-center gap-1.5 sm:bottom-14 sm:flex">
            {slides.map((slide, position) => (
              <button
                key={slide.slug}
                type="button"
                aria-label={`Phim ${position + 1}`}
                aria-current={position === safeIndex}
                onClick={() => setIndex(position)}
                className="group/dash px-1 py-3"
              >
                <span className="block h-[3px] w-9 overflow-hidden rounded-pill bg-text-low/40 transition-colors duration-200 group-hover/dash:bg-text-mid/60">
                  <span
                    className={`block h-full origin-left rounded-pill bg-accent transition-transform duration-500 ease-out-expo ${
                      position === safeIndex ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
