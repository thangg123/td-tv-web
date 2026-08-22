import { GRID_CLASS } from '@/components/movie/layout';
import PosterCard from '@/components/movie/PosterCard';
import type { MovieCard } from '@/lib/domain/models';

interface MovieGridProps {
  items: readonly MovieCard[];
  className?: string;
}

/** The most a first paint can reasonably need before the fold on a laptop. */
const PRIORITY_COUNT = 6;

/*
 * Columns are tight, rows are loose. Equal gaps read as a spreadsheet; giving the
 * row gap room lets each title sit with its poster instead of floating between two.
 * The track itself lives in `movie/layout` so `GridSkeleton` shares it.
 */

export default function MovieGrid({ items, className = '' }: MovieGridProps) {
  return (
    <ul className={`${GRID_CLASS} ${className}`}>
      {items.map((movie, index) => (
        <li key={movie.slug}>
          <PosterCard movie={movie} priority={index < PRIORITY_COUNT} />
        </li>
      ))}
    </ul>
  );
}
