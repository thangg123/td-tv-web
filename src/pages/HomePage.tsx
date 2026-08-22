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
import { Link } from 'react-router-dom';
import ContinueRail from '@/components/movie/ContinueRail';
import HeroSpotlight from '@/components/movie/HeroSpotlight';
import MovieRail from '@/components/movie/MovieRail';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/StateViews';
import type { CatalogSource } from '@/lib/domain/catalog';
import { MovieLists, languageOptions } from '@/lib/domain/catalog';
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

const HOME_ROWS: readonly HomeRow[] = [
  {
    source: NEWEST_SOURCE,
    title: 'Phim mới cập nhật',
    eyebrow: 'Vừa lên sóng',
    href: routes.newest,
  },
  {
    source: { kind: 'list', slug: MovieLists.SERIES },
    title: 'Phim bộ mới',
    eyebrow: 'Dài tập, xem cả tuần',
    href: routes.list(MovieLists.SERIES),
  },
  {
    source: { kind: 'list', slug: MovieLists.SINGLE },
    title: 'Phim lẻ mới',
    eyebrow: 'Trọn vẹn một buổi tối',
    href: routes.list(MovieLists.SINGLE),
  },
  {
    source: { kind: 'list', slug: MovieLists.CINEMA },
    title: 'Phim chiếu rạp',
    eyebrow: 'Mới ra rạp',
    href: routes.list(MovieLists.CINEMA),
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
];

/** The language band breaks the run of rails after the third one. */
const BAND_AFTER = 3;

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

/* ── language band ───────────────────────────────────────────────────────── */

interface LanguageTile {
  readonly icon: IconName;
  readonly blurb: string;
  /** Per-tile box, so the three read as a bento rather than a row of clones. */
  readonly box: string;
}

const LANGUAGE_TILES: Record<string, LanguageTile> = {
  vietsub: {
    icon: 'globe',
    blurb: 'Giữ nguyên tiếng gốc, phụ đề tiếng Việt.',
    box: 'sm:col-span-2 lg:col-span-1 lg:min-h-[13.5rem]',
  },
  'thuyet-minh': {
    icon: 'volume',
    blurb: 'Một giọng đọc dẫn chuyện trên nền tiếng gốc.',
    box: 'lg:min-h-[11.5rem]',
  },
  'long-tieng': {
    icon: 'film',
    blurb: 'Thoại tiếng Việt trọn vẹn, không phải đọc.',
    box: 'lg:min-h-[12.5rem]',
  },
};

function LanguageBand() {
  return (
    <section aria-labelledby="duyet-ngon-ngu" className="gutter">
      <header>
        <p className="eyebrow mb-1.5">Nghe theo cách của bạn</p>
        <h2 id="duyet-ngon-ngu" className="text-section font-semibold text-text-high">
          Duyệt theo ngôn ngữ
        </h2>
      </header>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
        {languageOptions.map((option, index) => {
          const tile = LANGUAGE_TILES[option.slug];
          return (
            <li key={option.slug} className={tile?.box ?? ''}>
              <Link
                to={routes.language(option.slug)}
                className="group relative flex h-full min-h-[7.5rem] flex-col justify-end overflow-hidden rounded-card bg-surface-1 p-5 ring-1 ring-outline/60 transition duration-300 ease-out-expo hover:-translate-y-1 hover:bg-surface-2 hover:shadow-lift hover:ring-accent focus-visible:-translate-y-1 focus-visible:ring-accent"
              >
                {/* Editorial ordinal, not decoration for its own sake: it gives
                    the band a reading order the three equal tiles otherwise lack. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-3 right-1 select-none text-display font-black leading-none text-outline/60 transition-colors duration-300 ease-out-expo group-hover:text-accent/25"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-linear-to-br from-surface-3/50 via-transparent to-transparent"
                />

                <span className="relative grid size-9 place-items-center rounded-full bg-surface-3/80 text-text-mid ring-1 ring-outline transition-colors duration-300 group-hover:bg-accent group-hover:text-white group-hover:ring-accent">
                  <Icon name={tile?.icon ?? 'globe'} size={16} />
                </span>

                {/* A tier below the page <h1>. At `text-screen font-black` these
                    three mid-page cards tied the heading of every other screen,
                    which flattens exactly the hierarchy the scale is built for. */}
                <h3 className="relative mt-4 text-section font-semibold text-text-high transition-colors duration-300 group-hover:text-accent-soft">
                  {option.label}
                </h3>

                {tile ? (
                  <p className="clamp-2 relative mt-1 text-sm text-text-mid">{tile.blurb}</p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
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

      <div className="mt-10 space-y-row-gap sm:mt-12">
        {HOME_ROWS.slice(0, BAND_AFTER).map((row, index) => renderRow(row, rowQueries[index]))}
      </div>

      <div className="mt-row-gap">
        <LanguageBand />
      </div>

      <div className="mt-row-gap space-y-row-gap">
        {HOME_ROWS.slice(BAND_AFTER).map((row, index) =>
          renderRow(row, rowQueries[BAND_AFTER + index]),
        )}
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
