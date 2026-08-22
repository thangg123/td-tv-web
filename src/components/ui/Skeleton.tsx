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
      <Skeleton className="mt-2.5 h-3.5 w-4/5 rounded-pill" />
      <Skeleton className="mt-1.5 h-3 w-1/2 rounded-pill" />
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

        {/*
          Same geometry as DetailPage's band, and it has to stay that way or the
          page jumps when the request resolves: below md the poster sits BESIDE
          a text column and the badge row takes its own full-width line, so this
          is a grid, not a centred column. From md it is a row again.
        */}
        <div className="gutter relative grid grid-cols-[auto_1fr] items-end gap-x-4 gap-y-4 pt-6 pb-6 md:flex md:justify-end md:gap-8 md:pt-12 md:pb-8">
          <Skeleton className="aspect-[2/3] w-24 flex-none sm:w-32 md:w-56" />

          {/* `contents` hands both blocks to the grid, exactly as DetailPage does. */}
          <div className="contents md:block md:min-w-0 md:flex-1 md:pb-3">
            <div className="min-w-0">
              {/* eyebrow — a 44px tap target pulled back to ~20px by `-my-3`. */}
              <Skeleton className="h-5 w-24 rounded-pill" />
              {/* Title: text-hero is ~29px a line and clamps to 3 on a phone. */}
              <Skeleton className="mt-3 h-7 w-full rounded-pill" />
              <Skeleton className="mt-0.5 h-7 w-11/12 rounded-pill" />
              <Skeleton className="mt-0.5 h-7 w-2/3 rounded-pill" />
              {/* Origin name, one line. */}
              <Skeleton className="mt-2 h-5 w-1/2 rounded-pill" />
            </div>

            <div className="col-span-2 min-w-0 md:mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-16 rounded-pill" />
                <Skeleton className="h-6 w-14 rounded-pill" />
                <Skeleton className="h-6 w-20 rounded-pill" />
              </div>
              <Skeleton className="mt-3 h-5 w-2/3 rounded-pill" />
            </div>
          </div>
        </div>
      </div>

      {/* The CTA row lives BELOW the band on the real page, at `size="lg"` (48px). */}
      <div className="gutter mt-8 flex flex-wrap gap-3">
        <Skeleton className="h-12 w-40 rounded-pill" />
        <Skeleton className="h-12 w-28 rounded-pill" />
      </div>

      <div className="gutter mt-10 space-y-2.5">
        <Skeleton className="h-3.5 w-full rounded-pill" />
        <Skeleton className="h-3.5 w-11/12 rounded-pill" />
        <Skeleton className="h-3.5 w-4/5 rounded-pill" />
      </div>

      <div className="mt-row-gap">
        <RailSkeleton count={6} />
      </div>
    </div>
  );
}
