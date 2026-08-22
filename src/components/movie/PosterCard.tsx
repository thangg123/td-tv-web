import { memo } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { MetaBadges, RatingBadge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import SmartImage from '@/components/ui/SmartImage';
import type { MovieCard } from '@/lib/domain/models';
import { portraitOf } from '@/lib/domain/models';
import { metaLine } from '@/lib/format';
import { routes } from '@/lib/routes';
import { useFavorite } from '@/lib/storage/useUserData';

interface PosterCardProps {
  movie: MovieCard;
  priority?: boolean;
  className?: string;
}

/*
 * Rails give a card ~150px, grids up to ~230px. Telling the browser roughly what
 * it will get keeps it from picking the widest candidate for a thumbnail.
 */
const SIZES = '(min-width: 1280px) 200px, (min-width: 640px) 24vw, 42vw';

/** Lift + accent ring, shared by the art box on hover and on keyboard focus. */
const RAISED =
  'group-hover:-translate-y-1 group-hover:scale-[1.04] group-hover:shadow-lift group-hover:ring-2 group-hover:ring-accent ' +
  'group-focus-within:-translate-y-1 group-focus-within:scale-[1.04] group-focus-within:shadow-lift group-focus-within:ring-2 group-focus-within:ring-accent';

const REVEAL =
  'opacity-0 translate-y-1 group-hover:translate-y-0 group-hover:opacity-100 ' +
  'group-focus-within:translate-y-0 group-focus-within:opacity-100';

function PosterCard({ movie, priority = false, className = '' }: PosterCardProps) {
  const [isFavorite, toggleFavorite] = useFavorite(movie);

  const meta = metaLine(movie.year, movie.episodeCurrent);
  const hasOriginName = movie.originName.length > 0 && movie.originName !== movie.name;

  /*
   * The bookmark is a sibling of the link rather than a descendant — a button
   * inside an anchor is invalid — but a stray click still gets stopped so the
   * card never navigates from a mis-hit near the edge of the control.
   */
  const onToggleFavorite = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite();
  };

  return (
    <article className={`group relative ${className}`}>
      <Link to={routes.detail(movie.slug)} className="block rounded-card">
        <div
          className={`relative overflow-hidden rounded-card bg-surface-2 ring-1 ring-outline/60 transition duration-300 ease-out-expo ${RAISED}`}
        >
          <SmartImage
            src={portraitOf(movie)}
            alt={movie.name}
            aspect="poster"
            priority={priority}
            sizes={SIZES}
          />

          {movie.rating !== null && (
            <RatingBadge rating={movie.rating} className="absolute right-2 top-2 z-10" />
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 scrim-bottom opacity-75 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-1.5 p-2.5">
            {meta.length > 0 && (
              <span
                className={`text-xs leading-tight text-text-mid transition duration-300 ease-out-expo ${REVEAL}`}
              >
                {meta}
              </span>
            )}

            <MetaBadges
              quality={movie.quality}
              lang={movie.lang}
              className="opacity-80 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
            />
          </div>
        </div>

        <h3 className="clamp-2 mt-2.5 text-sm font-medium leading-snug text-text-high transition-colors duration-200 group-hover:text-accent-soft">
          {movie.name}
        </h3>
        {hasOriginName && (
          <p className="mt-0.5 truncate text-xs text-text-low">{movie.originName}</p>
        )}
      </Link>

      <IconButton
        icon={isFavorite ? 'bookmark-filled' : 'bookmark'}
        label={
          isFavorite ? `Bỏ "${movie.name}" khỏi thư viện` : `Lưu "${movie.name}" vào thư viện`
        }
        variant="secondary"
        size="sm"
        onClick={onToggleFavorite}
        aria-pressed={isFavorite}
        /*
         * `min-*` rather than `size-*`: it raises the 32px square to the 44px
         * touch floor without having to out-order the `h-8 w-8` the size prop
         * already emitted. A fine pointer gets the compact square back.
         */
        className={`absolute left-2 top-2 z-20 min-h-11 min-w-11 backdrop-blur-md transition-opacity duration-200 sm:min-h-0 sm:min-w-0 ${
          isFavorite ? 'text-mint opacity-100' : 'reveal-on-hover'
        }`}
      />
    </article>
  );
}

/*
 * A rail re-renders on every favourite write and on every scroll-edge update;
 * the cards themselves almost never change.
 */
export default memo(PosterCard);
