/**
 * React Query bindings.
 *
 * `staleTime` here replaces the per-kind TTLs the Android repository kept in
 * its own LRU caches, and carries the same reasoning:
 *  - catalog pages churn as titles are added → 5 minutes
 *  - episode lists grow while a series airs  → 3 minutes
 *  - credits and stills never change         → 1 hour
 *  - taxonomies are effectively static       → the whole session
 */

import {
  useInfiniteQuery,
  useQueries,
  useQuery,
  type UseQueryOptions,
} from '@tanstack/react-query';
import {
  DEFAULT_PAGE_SIZE,
  MIN_SEARCH_LENGTH,
  ROW_SIZE,
  loadBackdrop,
  loadCast,
  loadCategories,
  loadCountries,
  loadDetail,
  loadPage,
  loadYears,
} from '@/lib/api/repository';
import type { CatalogFilters, CatalogSource } from '@/lib/domain/catalog';
import { DEFAULT_FILTERS } from '@/lib/domain/catalog';
import type { CastMember, MovieCard, MovieDetail, PagedMovies, Taxonomy } from '@/lib/domain/models';

const MINUTE = 60_000;

export const PAGE_STALE_MS = 5 * MINUTE;
export const DETAIL_STALE_MS = 3 * MINUTE;
export const ENRICHMENT_STALE_MS = 60 * MINUTE;

/**
 * Query keys are built from the same tuple the Android cache key was built
 * from, so two surfaces asking for the same page share one request.
 */
export const queryKeys = {
  page: (source: CatalogSource, page: number, filters: CatalogFilters, limit: number) =>
    ['page', source, page, filters, limit] as const,
  infinite: (source: CatalogSource, filters: CatalogFilters, limit: number) =>
    ['infinite', source, filters, limit] as const,
  detail: (slug: string) => ['detail', slug] as const,
  cast: (slug: string) => ['cast', slug] as const,
  backdrop: (slug: string) => ['backdrop', slug] as const,
  categories: ['taxonomy', 'categories'] as const,
  countries: ['taxonomy', 'countries'] as const,
  years: ['taxonomy', 'years'] as const,
};

/* ── catalog ─────────────────────────────────────────────────────────────── */

/** One page. Used by rows, which never page. */
export function useMovieRow(source: CatalogSource, limit: number = ROW_SIZE) {
  return useQuery({
    queryKey: queryKeys.page(source, 1, DEFAULT_FILTERS, limit),
    queryFn: ({ signal }) => loadPage(source, 1, DEFAULT_FILTERS, limit, signal),
    staleTime: PAGE_STALE_MS,
    select: (paged: PagedMovies) => paged.items,
  });
}

/** Several rows at once, each cached and revalidated on its own. */
export function useMovieRows(sources: readonly CatalogSource[], limit: number = ROW_SIZE) {
  return useQueries({
    queries: sources.map((source) => ({
      queryKey: queryKeys.page(source, 1, DEFAULT_FILTERS, limit),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        loadPage(source, 1, DEFAULT_FILTERS, limit, signal),
      staleTime: PAGE_STALE_MS,
    })),
  });
}

/**
 * The paging grid.
 *
 * The API can repeat entries across pages when the catalogue is re-sorted
 * mid-browse, so pages are flattened through a slug set rather than
 * concatenated — a duplicate key is fatal to a React list.
 */
export function useCatalog(
  source: CatalogSource,
  filters: CatalogFilters = DEFAULT_FILTERS,
  limit: number = DEFAULT_PAGE_SIZE,
) {
  const enabled = source.kind !== 'search' || source.keyword.trim().length >= MIN_SEARCH_LENGTH;

  const query = useInfiniteQuery({
    queryKey: queryKeys.infinite(source, filters, limit),
    queryFn: ({ pageParam, signal }) => loadPage(source, pageParam, filters, limit, signal),
    initialPageParam: 1,
    getNextPageParam: (last: PagedMovies) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    staleTime: PAGE_STALE_MS,
    enabled,
  });

  const pages = query.data?.pages ?? [];
  const seen = new Set<string>();
  const items: MovieCard[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      items.push(item);
    }
  }

  return {
    ...query,
    items,
    totalItems: pages[0]?.totalItems ?? 0,
    totalPages: pages[0]?.totalPages ?? 0,
    enabled,
  };
}

/* ── detail ──────────────────────────────────────────────────────────────── */

export function useMovieDetail(slug: string | undefined) {
  return useQuery<MovieDetail>({
    queryKey: queryKeys.detail(slug ?? ''),
    queryFn: ({ signal }) => loadDetail(slug as string, signal),
    staleTime: DETAIL_STALE_MS,
    enabled: Boolean(slug),
  });
}

/*
 * Cast and backdrop enrich the detail page but are never part of it. Both 404
 * for titles the upstream never matched to TMDB, so neither may fail the page
 * and neither is retried: one cheap request on the next visit is better than
 * three doomed ones now.
 */

const enrichmentOptions = {
  staleTime: ENRICHMENT_STALE_MS,
  retry: false,
} satisfies Partial<UseQueryOptions>;

export function useMovieCast(slug: string | undefined) {
  return useQuery<CastMember[]>({
    queryKey: queryKeys.cast(slug ?? ''),
    queryFn: ({ signal }) => loadCast(slug as string, signal),
    enabled: Boolean(slug),
    ...enrichmentOptions,
  });
}

export function useMovieBackdrop(slug: string | undefined) {
  return useQuery<string>({
    queryKey: queryKeys.backdrop(slug ?? ''),
    queryFn: ({ signal }) => loadBackdrop(slug as string, signal),
    enabled: Boolean(slug),
    ...enrichmentOptions,
  });
}

/* ── taxonomies ──────────────────────────────────────────────────────────── */

/*
 * These back every filter dropdown and both index grids, and they do not change
 * within a session. `staleTime: Infinity` fetches each exactly once — but a
 * failed fetch is still retried, which is the part the Android memoization had
 * to special-case to avoid pinning empty dropdowns for the process lifetime.
 */

export function useCategories() {
  return useQuery<Taxonomy[]>({
    queryKey: queryKeys.categories,
    queryFn: ({ signal }) => loadCategories(signal),
    staleTime: Infinity,
  });
}

export function useCountries() {
  return useQuery<Taxonomy[]>({
    queryKey: queryKeys.countries,
    queryFn: ({ signal }) => loadCountries(signal),
    staleTime: Infinity,
  });
}

export function useYears() {
  return useQuery<number[]>({
    queryKey: queryKeys.years,
    queryFn: ({ signal }) => loadYears(signal),
    staleTime: Infinity,
  });
}
