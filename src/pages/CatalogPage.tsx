import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import FilterBar from '@/components/movie/FilterBar';
import MovieGrid from '@/components/movie/MovieGrid';
import Button, { LinkButton } from '@/components/ui/Button';
import { GridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import { toUserMessage } from '@/lib/api/client';
import type { CatalogFilters, CatalogSource } from '@/lib/domain/catalog';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  fixedAxisOf,
  sortKeyOf,
  sortOptions,
  sourceTitle,
  supportsFilters,
} from '@/lib/domain/catalog';
import { formatCount } from '@/lib/format';
import { useCatalog, useCategories, useCountries } from '@/lib/queries/queries';
import { routes } from '@/lib/routes';

type CatalogKind = 'newest' | 'list' | 'category' | 'country' | 'year' | 'language';

interface CatalogPageProps {
  kind: CatalogKind;
}

/**
 * Query-string vocabulary. Vietnamese like the paths, so a shared link reads as
 * a sentence: `/the-loai/hanh-dong?quoc-gia=han-quoc&sap-xep=newest`.
 */
const PARAM = {
  category: 'the-loai',
  country: 'quoc-gia',
  year: 'nam',
  language: 'ngon-ngu',
  sort: 'sap-xep',
} as const;

/** The catalogue's own year list starts well after this; anything lower is junk. */
const MIN_YEAR = 1900;

/** Start paging a screenful early so the grid never visibly runs dry. */
const SENTINEL_MARGIN = '600px 0px';

const EYEBROWS: Record<CatalogSource['kind'], string> = {
  newest: 'DANH MỤC',
  list: 'DANH MỤC',
  category: 'THỂ LOẠI',
  country: 'QUỐC GIA',
  year: 'NĂM',
  language: 'NGÔN NGỮ',
  search: 'TÌM KIẾM',
};

function buildSource(
  kind: CatalogKind,
  slug: string | undefined,
  year: string | undefined,
): CatalogSource | null {
  const trimmed = slug?.trim() ?? '';

  switch (kind) {
    case 'newest':
      return { kind: 'newest' };
    case 'list':
      return trimmed ? { kind: 'list', slug: trimmed } : null;
    case 'category':
      return trimmed ? { kind: 'category', slug: trimmed } : null;
    case 'country':
      return trimmed ? { kind: 'country', slug: trimmed } : null;
    case 'language':
      return trimmed ? { kind: 'language', lang: trimmed } : null;
    case 'year': {
      const parsed = Number(year);
      return Number.isFinite(parsed) && parsed >= MIN_YEAR ? { kind: 'year', year: parsed } : null;
    }
  }
}

function readFilters(search: string): CatalogFilters {
  const params = new URLSearchParams(search);
  const sort = sortOptions.find((option) => option.key === params.get(PARAM.sort));

  return {
    category: params.get(PARAM.category) || null,
    country: params.get(PARAM.country) || null,
    year: params.get(PARAM.year) || null,
    sortLang: params.get(PARAM.language) || null,
    sortField: sort?.field ?? DEFAULT_FILTERS.sortField,
    sortType: sort?.type ?? DEFAULT_FILTERS.sortType,
  };
}

/**
 * Owns the URL half of the screen: it validates the route params and turns the
 * query string into `CatalogFilters` and back. Data lives one level down, so the
 * `/404` bail-out below can happen before any request is set up.
 */
export default function CatalogPage({ kind }: CatalogPageProps) {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const slugParam = params.slug;
  const yearParam = params.year;

  // The source is a React Query key; a fresh object per render would thrash it.
  const source = useMemo(
    () => buildSource(kind, slugParam, yearParam),
    [kind, slugParam, yearParam],
  );

  // Keyed off the serialised string rather than the params object, so this
  // cannot depend on react-router's internal memoisation holding.
  const search = searchParams.toString();
  const filters = useMemo(() => readFilters(search), [search]);

  const onFiltersChange = useCallback(
    (next: CatalogFilters) => {
      const written = new URLSearchParams();
      if (next.category) written.set(PARAM.category, next.category);
      if (next.country) written.set(PARAM.country, next.country);
      if (next.year) written.set(PARAM.year, next.year);
      if (next.sortLang) written.set(PARAM.language, next.sortLang);

      // The default sort is implied — leaving it out keeps shared URLs short.
      const sortKey = sortKeyOf(next);
      if (sortKey !== 'recent') written.set(PARAM.sort, sortKey);

      // `replace` so twenty chip taps do not bury the previous page under twenty
      // history entries.
      setSearchParams(written, { replace: true });
    },
    [setSearchParams],
  );

  if (!source) return <Navigate to="/404" replace />;

  return <CatalogView source={source} filters={filters} onFiltersChange={onFiltersChange} />;
}

interface CatalogViewProps {
  source: CatalogSource;
  filters: CatalogFilters;
  onFiltersChange: (next: CatalogFilters) => void;
}

function CatalogView({ source, filters, onFiltersChange }: CatalogViewProps) {
  const {
    items,
    totalItems,
    isPending,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useCatalog(source, filters);

  const filtered = supportsFilters(source);
  const activeCount = activeFilterCount(filters);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const lastFilters = useRef(filters);

  useEffect(() => {
    const node = sentinelRef.current;
    /*
     * `isError` stops the observer as well as the fetch: without it a page that
     * failed would be re-requested the instant `isFetchingNextPage` cleared,
     * because the sentinel is still sitting in view — an endless retry loop.
     * The "Xem thêm" button below is the deliberate way back out.
     */
    if (!node || !hasNextPage || isFetchingNextPage || isError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
      },
      { rootMargin: SENTINEL_MARGIN },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  /*
   * A filter change is a new query key, so the loaded pages collapse back to a
   * skeleton. Someone who was six rows deep would be left scrolled past the end
   * of a much shorter document, staring at the footer — so pull them back to the
   * top of the results, but only when the results had already scrolled away.
   * `filters` is memoised off the query string, so this fires on real changes only.
   */
  useEffect(() => {
    if (lastFilters.current === filters) return;
    lastFilters.current = filters;

    const node = resultsRef.current;
    if (!node || node.getBoundingClientRect().top >= 0) return;
    // `html { scroll-behavior: smooth }` would otherwise animate the whole trip.
    node.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [filters]);

  const clearFilters = () =>
    onFiltersChange({ ...filters, category: null, country: null, year: null, sortLang: null });

  return (
    // FilterBar docks against `--header-h`; the header is 4rem, 4.5rem from lg up.
    <div className="pb-20 [--header-h:4rem] lg:[--header-h:4.5rem]">
      <header className="gutter relative isolate pb-6 pt-9 sm:pt-14">
        {/* A single soft bloom so the page does not open on flat black. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 -top-24 -z-10 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        />

        <div className="min-w-0">
          <p className="eyebrow">{EYEBROWS[source.kind]}</p>
          <h1 className="mt-2.5 text-screen font-black text-text-high">
            <SourceHeading source={source} />
          </h1>
          {/*
            The count sits under the title rather than opposite it: the filter
            toolbar keeps its own live count at the right edge, and two of the
            same number in one column would read as a bug. Height is reserved so
            the number arriving cannot push the grid down.
          */}
          <p className="mt-2 min-h-5 text-sm text-text-low">
            {totalItems > 0 && (
              <>
                <span className="font-semibold text-text-mid">{formatCount(totalItems)}</span> phim
              </>
            )}
          </p>
        </div>

        <div className="mt-6 h-px w-full bg-linear-to-r from-outline via-outline/40 to-transparent" />
      </header>

      {filtered && (
        <FilterBar
          filters={filters}
          fixedAxis={fixedAxisOf(source)}
          onChange={onFiltersChange}
          totalItems={totalItems}
        />
      )}

      {/*
        scroll-mt clears the header plus the sticky filter toolbar, and the bar
        is not one height: it wraps to three 44px rows below 392px (161px), then
        settles at ~110px. 64px header + 161px = 225 below the step, 64 + 110 =
        174 above it, 72 + 110 = 182 once the header grows at lg. The step reuses
        the shell's `min-[24.5rem]` hand-off rather than inventing a breakpoint.
      */}
      <section
        ref={resultsRef}
        aria-label="Kết quả"
        className="gutter scroll-mt-56 pt-7 min-[24.5rem]:scroll-mt-44 lg:scroll-mt-[11.5rem]"
      >
        {isPending ? (
          <GridSkeleton count={18} />
        ) : isError && items.length === 0 ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Không tìm thấy phim nào."
            message={
              activeCount > 0
                ? 'Bộ lọc hiện tại không khớp với phim nào. Thử bỏ bớt một vài điều kiện.'
                : 'Danh mục này đang trống. Vui lòng quay lại sau.'
            }
            action={
              activeCount > 0 ? (
                // The primary belongs to the way forward, not to the reset.
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <LinkButton to={routes.home} variant="primary" size="lg" icon="arrow-left">
                    Về trang chủ
                  </LinkButton>
                  <Button variant="secondary" size="lg" icon="close" onClick={clearFilters}>
                    Xóa lọc ({activeCount})
                  </Button>
                </div>
              ) : undefined
            }
          />
        ) : (
          <>
            <MovieGrid items={items} className="animate-fade-up" />

            {/* Kept in the tree unconditionally so the observer always has a target. */}
            <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

            <div className="flex flex-col items-center gap-3 pt-10">
              {isFetchingNextPage && (
                <p
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-3 py-2 text-sm text-text-mid"
                >
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 animate-spin rounded-full border-2 border-outline border-t-accent"
                  />
                  Đang tải thêm…
                </p>
              )}

              {/* A sentinel that never scrolls into view would strand the page here. */}
              {hasNextPage && !isFetchingNextPage && (
                <Button
                  variant="secondary"
                  size="lg"
                  iconRight="chevron-down"
                  onClick={() => void fetchNextPage()}
                >
                  Xem thêm
                </Button>
              )}

              {isError && (
                <p role="alert" className="max-w-md text-center text-sm text-accent-soft">
                  {toUserMessage(error)}
                </p>
              )}

              {!hasNextPage && !isError && (
                <p className="text-sm text-text-low">
                  Đã hiển thị toàn bộ {formatCount(items.length)} phim
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Category and country titles live in the taxonomy lists, so each resolves in
 * its own leaf — a `/moi-cap-nhat` visit has no filter bar and must not pay for
 * two taxonomy requests just to print a heading.
 */
function SourceHeading({ source }: { source: CatalogSource }) {
  if (source.kind === 'category') return <CategoryName slug={source.slug} />;
  if (source.kind === 'country') return <CountryName slug={source.slug} />;
  return <>{sourceTitle(source)}</>;
}

// `||` rather than `??`: the mapper trims names, so a blank one is '' — which
// would otherwise print an empty heading instead of falling back to the slug.
function CategoryName({ slug }: { slug: string }) {
  const { data } = useCategories();
  return <>{data?.find((item) => item.slug === slug)?.name || slug}</>;
}

function CountryName({ slug }: { slug: string }) {
  const { data } = useCountries();
  return <>{data?.find((item) => item.slug === slug)?.name || slug}</>;
}
