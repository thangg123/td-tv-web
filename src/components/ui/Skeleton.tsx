/**
 * Placeholders that hold the exact box the real content lands in, so nothing
 * on the page shifts when the request resolves. They are decorative: the
 * announcement for a pending region belongs to `LoadingState`.
 */

import { GRID_CLASS, RAIL_CARD_WIDTH } from '@/components/movie/layout';

const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

export default function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded-card', className)} aria-hidden="true" />;
}

export function PosterSkeleton() {
  return (
    <div className="w-full">
      <Skeleton className="aspect-[2/3] w-full" />
      <Skeleton className="mt-2.5 h-3.5 w-4/5 rounded-md" />
      <Skeleton className="mt-1.5 h-3 w-1/2 rounded-md" />
    </div>
  );
}

export function RailSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="rail" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={RAIL_CARD_WIDTH}>
          <PosterSkeleton />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className={GRID_CLASS} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <PosterSkeleton key={index} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="pb-16" aria-hidden="true">
      {/* Mirrors DetailPage: the block sits INSIDE the band, bottom-aligned. */}
      <div className="relative">
        <Skeleton className="absolute inset-0 rounded-none" />

        <div className="gutter relative flex flex-col justify-end gap-6 pt-8 pb-6 md:flex-row md:items-end md:pt-12 md:pb-8">
        <Skeleton className="aspect-[2/3] w-44 flex-none md:w-56" />
        <div className="flex-1 space-y-3 pb-2">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-9 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-10 w-32 rounded-pill" />
            <Skeleton className="h-10 w-28 rounded-pill" />
            </div>
          </div>
        </div>
      </div>

      <div className="gutter mt-10 space-y-2.5">
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3.5 w-11/12 rounded-md" />
        <Skeleton className="h-3.5 w-4/5 rounded-md" />
      </div>

      <div className="mt-row-gap">
        <RailSkeleton count={6} />
      </div>
    </div>
  );
}
