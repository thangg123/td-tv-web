/**
 * Home — the port of `HomeViewModel` + `HomeScreen`.
 *
 * The TV app fired six list requests in parallel and simply left out any shelf
 * that came back broken; the same rule holds here, because a home screen with
 * an empty row reads as a bug while a home screen with five rows reads as a
 * catalogue. Only when the newest row fails *and* nothing else arrived does the
 * page admit defeat.
 */

import { useCallback, useRef, useState } from 'react';
import ContinueRail from '@/components/movie/ContinueRail';
import HeroSpotlight from '@/components/movie/HeroSpotlight';
import MovieRail from '@/components/movie/MovieRail';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/StateViews';
import type { CatalogSource } from '@/lib/domain/catalog';
import { MovieLists } from '@/lib/domain/catalog';
import { useMovieRow, useMovieRows } from '@/lib/queries/queries';
import { routes } from '@/lib/routes';
import { removeProgress } from '@/lib/storage/userData';
import { useWatchProgress } from '@/lib/storage/useUserData';

const HERO_COUNT = 5;

const NEWEST_SOURCE: CatalogSource = { kind: 'newest' };

interface HomeRow {
  readonly source: CatalogSource;
  readonly title: string;
  /** Adds a fact the title does not — never a restatement of it. */
  readonly eyebrow: string;
  readonly href: string;
}

/*
 * Same order as the header, and for the same reason: someone who has learned
 * where "Hoạt hình" sits in the bar should find its shelf in the same place on
 * the page. Content types first, then the three audio cuts — which is also
 * roughly least-to-most specific, so the page narrows as it scrolls.
 */
const HOME_ROWS: readonly HomeRow[] = [
  {
    source: NEWEST_SOURCE,
    title: 'Phim mới cập nhật',
    eyebrow: 'Vừa lên sóng',
    href: routes.newest,
  },
  {
    source: { kind: 'list', slug: MovieLists.SINGLE },
    title: 'Phim lẻ',
    eyebrow: 'Trọn vẹn một buổi tối',
    href: routes.list(MovieLists.SINGLE),
  },
  {
    source: { kind: 'list', slug: MovieLists.SERIES },
    title: 'Phim bộ',
    eyebrow: 'Dài tập, xem cả tuần',
    href: routes.list(MovieLists.SERIES),
  },
  {
    source: { kind: 'list', slug: MovieLists.ANIME },
    title: 'Hoạt hình',
    eyebrow: 'Anime & hoạt hình',
    href: routes.list(MovieLists.ANIME),
  },
  {
    source: { kind: 'list', slug: MovieLists.TV_SHOWS },
    title: 'TV Shows',
    eyebrow: 'Giải trí & thực tế',
    href: routes.list(MovieLists.TV_SHOWS),
  },
  {
    source: { kind: 'list', slug: MovieLists.CINEMA },
    title: 'Phim chiếu rạp',
    eyebrow: 'Mới ra rạp',
    href: routes.list(MovieLists.CINEMA),
  },
  {
    source: { kind: 'language', lang: 'vietsub' },
    title: 'Vietsub',
    eyebrow: 'Tiếng gốc, phụ đề Việt',
    href: routes.language('vietsub'),
  },
  {
    source: { kind: 'language', lang: 'thuyet-minh' },
    title: 'Thuyết minh',
    eyebrow: 'Giọng đọc trên nền tiếng gốc',
    href: routes.language('thuyet-minh'),
  },
  {
    source: { kind: 'language', lang: 'long-tieng' },
    title: 'Lồng tiếng',
    eyebrow: 'Thoại tiếng Việt trọn vẹn',
    href: routes.language('long-tieng'),
  },
];

const ROW_SOURCES: readonly CatalogSource[] = HOME_ROWS.map((row) => row.source);

/** One element of the `useQueries` result, without hand-writing its generics. */
type RowQuery = ReturnType<typeof useMovieRows>[number] | undefined;

function renderRow(row: HomeRow, query: RowQuery) {
  // A shelf that failed is dropped outright: a half-filled home page reads
  // as broken, whereas one row fewer reads as a shorter catalogue.
  if (!query || query.isError) return null;

  return (
    <MovieRail
      key={row.href}
      title={row.title}
      eyebrow={row.eyebrow}
      href={row.href}
      items={query.data?.items ?? []}
      isLoading={query.isPending}
    />
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const newest = useMovieRow(NEWEST_SOURCE);
  const rowQueries = useMovieRows(ROW_SOURCES);
  const progress = useWatchProgress();

  /* Dropping a title from the history is irreversible, so it is confirmed here
     exactly as it is on the library page — one rail, one meaning. */
  const [pending, setPending] = useState<{ slug: string; name: string } | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const requestRemove = useCallback(
    (slug: string) => {
      const entry = progress.find((item) => item.slug === slug);
      setPending({ slug, name: entry?.name || 'Phim này' });
    },
    [progress],
  );

  const dismissRemoval = useCallback(() => setPending(null), []);

  const applyRemoval = useCallback(() => {
    if (pending) removeProgress(pending.slug);
    setPending(null);
  }, [pending]);

  const heroItems = (newest.data ?? []).slice(0, HERO_COUNT);
  // The hero renders its own same-height skeleton, so it holds the box either way.
  const heroVisible = heroItems.length > 0 || newest.isPending;

  const anyRowLoading = rowQueries.some((query) => query.isPending);
  const anyRowHasItems = rowQueries.some((query) => (query.data?.items.length ?? 0) > 0);

  const retryAll = () => {
    void newest.refetch();
    for (const query of rowQueries) void query.refetch();
  };

  // Nothing arrived and nothing is still on its way: one honest error beats six
  // empty shelves. A single surviving row is enough to keep the page up.
  if (newest.isError && !anyRowLoading && !anyRowHasItems) {
    return <ErrorState error={newest.error} onRetry={retryAll} />;
  }

  return (
    /*
     * The dialog's focus fallback lands here, on the page root, rather than on
     * the continue rail: confirming the removal of the LAST entry unmounts the
     * rail in the same commit as the button that opened the dialog, so a ref
     * pointing inside it would be null exactly when the fallback matters.
     */
    <div ref={pageRef} tabIndex={-1} className="pb-20 outline-none sm:pb-28">
      {/* The hero owns the page <h1>. When the newest row is the one thing that
          failed, the rails still render — so the document needs a heading. */}
      {!heroVisible && <h1 className="sr-only">CiCi TV — Phim mới cập nhật</h1>}

      <HeroSpotlight items={heroItems} isLoading={newest.isPending} />

      {/* The page's one deliberate grid-break: the continue rail climbs into the
          hero's lower band so the two layers overlap instead of stacking. The
          pull stays under the hero's own bottom padding at every breakpoint, so
          it never lands on the "Xem ngay" buttons. */}
      {progress.length > 0 && (
        <div className={heroVisible ? 'relative z-10 -mt-6 sm:-mt-10' : 'relative mt-10'}>
          <ContinueRail items={progress} onRemove={requestRemove} />
        </div>
      )}

      {/* One uninterrupted run of shelves — the bento band that used to split
          them in two is gone, and the language cuts are shelves of their own. */}
      <div className="mt-10 space-y-row-gap sm:mt-12">
        {HOME_ROWS.map((row, index) => renderRow(row, rowQueries[index]))}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Xóa khỏi Xem tiếp?"
        message={`«${pending?.name ?? ''}» sẽ không còn trong danh sách xem tiếp.`}
        confirmLabel="Xóa"
        cancelLabel="Giữ lại"
        tone="danger"
        onConfirm={applyRemoval}
        onDismiss={dismissRemoval}
        fallbackFocusRef={pageRef}
      />
    </div>
  );
}
