/**
 * Catalog vocabulary — port of the `CatalogSource` / `CatalogFilters` half of
 * `com.tdtv.domain.Models`, plus `com.tdtv.data.MovieLists`.
 */

/** Slugs accepted by `/v1/api/danh-sach/{type}`. */
export const MovieLists = {
  SINGLE: 'phim-le',
  SERIES: 'phim-bo',
  ANIME: 'hoat-hinh',
  TV_SHOWS: 'tv-shows',
  CINEMA: 'phim-chieu-rap',
} as const;

export type MovieListSlug = (typeof MovieLists)[keyof typeof MovieLists];

const LIST_TITLES: Record<string, string> = {
  [MovieLists.SINGLE]: 'Phim lẻ',
  [MovieLists.SERIES]: 'Phim bộ',
  [MovieLists.ANIME]: 'Hoạt hình',
  [MovieLists.TV_SHOWS]: 'TV Shows',
  [MovieLists.CINEMA]: 'Phim chiếu rạp',
};

export const listTitle = (slug: string): string => LIST_TITLES[slug] ?? slug;

export const isKnownListSlug = (slug: string): slug is MovieListSlug =>
  Object.values(MovieLists).includes(slug as MovieListSlug);

/** Where a catalog surface pulls its data from. */
export type CatalogSource =
  | { readonly kind: 'newest' }
  | { readonly kind: 'list'; readonly slug: string }
  | { readonly kind: 'category'; readonly slug: string }
  | { readonly kind: 'country'; readonly slug: string }
  | { readonly kind: 'year'; readonly year: number }
  /**
   * Every title carrying a given audio track, across all content types.
   *
   * Backed by the type-less `/v1/api/danh-sach`, the only list endpoint that
   * spans the whole catalogue: a per-type one would make "Lồng tiếng" mean
   * "lồng tiếng, but only series".
   */
  | { readonly kind: 'language'; readonly lang: string }
  | { readonly kind: 'search'; readonly keyword: string };

export interface CatalogFilters {
  readonly category: string | null;
  readonly country: string | null;
  readonly year: string | null;
  readonly sortLang: string | null;
  readonly sortField: string;
  readonly sortType: string;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  category: null,
  country: null,
  year: null,
  sortLang: null,
  sortField: 'modified.time',
  sortType: 'desc',
};

export const activeFilterCount = (filters: CatalogFilters): number =>
  [filters.category, filters.country, filters.year, filters.sortLang].filter(Boolean).length;

export interface SortOption {
  readonly key: string;
  readonly label: string;
  readonly field: string;
  readonly type: string;
}

export const sortOptions: readonly SortOption[] = [
  { key: 'recent', label: 'Mới cập nhật', field: 'modified.time', type: 'desc' },
  { key: 'newest', label: 'Năm mới nhất', field: 'year', type: 'desc' },
  { key: 'oldest', label: 'Năm cũ nhất', field: 'year', type: 'asc' },
];

export const sortKeyOf = (filters: CatalogFilters): string =>
  sortOptions.find((o) => o.field === filters.sortField && o.type === filters.sortType)?.key ??
  'recent';

export const languageOptions: readonly { readonly slug: string; readonly label: string }[] = [
  { slug: 'vietsub', label: 'Vietsub' },
  { slug: 'thuyet-minh', label: 'Thuyết minh' },
  { slug: 'long-tieng', label: 'Lồng tiếng' },
];

export const languageTitle = (slug: string): string =>
  languageOptions.find((o) => o.slug === slug)?.label ?? slug;

/** The filter axes offered by the catalog toolbar. */
export type FilterAxis = 'category' | 'country' | 'year' | 'language' | 'sort';

/** The v3 "newest" endpoint takes only a page number. */
export const supportsFilters = (source: CatalogSource): boolean => source.kind !== 'newest';

/**
 * The axis a source pins and cannot usefully narrow.
 *
 * Category and country stack — the API intersects the path with the query, so
 * those chips still do real work on a category or country page. A title has
 * exactly one release year though, so `nam/2024?year=2023` returns nothing at
 * all; offering that chip could only ever empty the grid.
 */
export const fixedAxisOf = (source: CatalogSource): FilterAxis | null => {
  switch (source.kind) {
    case 'year':
      return 'year';
    case 'language':
      return 'language';
    default:
      return null;
  }
};

export const sourceTitle = (source: CatalogSource): string => {
  switch (source.kind) {
    case 'newest':
      return 'Phim mới cập nhật';
    case 'list':
      return listTitle(source.slug);
    case 'language':
      return languageTitle(source.lang);
    case 'year':
      return `Phim năm ${source.year}`;
    case 'search':
      return `Kết quả cho "${source.keyword}"`;
    case 'category':
    case 'country':
      // The human name lives in the taxonomy list, which the page resolves and
      // passes down; the slug is only ever the fallback while it loads.
      return source.slug;
  }
};
