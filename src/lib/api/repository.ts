/**
 * Source dispatch — port of `com.tdtv.data.MovieRepository`.
 *
 * The Android original also owned four LRU caches with per-kind TTLs. On the
 * web that job belongs to React Query, which already dedupes in-flight requests
 * and expires by `staleTime`; see `lib/queries/`. What is left here is the part
 * React Query cannot do: knowing which endpoint a `CatalogSource` means.
 */

import {
  fetchAll,
  fetchByCategory,
  fetchByCountry,
  fetchByType,
  fetchByYear,
  fetchCategories,
  fetchCountries,
  fetchDetail,
  fetchImages,
  fetchNewest,
  fetchPeoples,
  fetchSearch,
  fetchYears,
  type ListQuery,
} from '@/lib/api/endpoints';
import {
  detailToDomain,
  imagesToBackdropUrl,
  listToPaged,
  newestToPaged,
  peoplesToCast,
} from '@/lib/api/mappers';
import type { CatalogFilters, CatalogSource } from '@/lib/domain/catalog';
import { DEFAULT_FILTERS } from '@/lib/domain/catalog';
import type { CastMember, MovieDetail, PagedMovies, Taxonomy } from '@/lib/domain/models';
import { EMPTY_PAGE } from '@/lib/domain/models';

export const DEFAULT_PAGE_SIZE = 24;
export const ROW_SIZE = 24;
export const MIN_SEARCH_LENGTH = 2;

const toQuery = (page: number, limit: number, filters: CatalogFilters): ListQuery => ({
  page,
  limit,
  category: filters.category,
  country: filters.country,
  year: filters.year,
  sort_field: filters.sortField,
  sort_type: filters.sortType,
  sort_lang: filters.sortLang,
});

/** One page of any catalog surface. */
export async function loadPage(
  source: CatalogSource,
  page: number,
  filters: CatalogFilters = DEFAULT_FILTERS,
  limit: number = DEFAULT_PAGE_SIZE,
  signal?: AbortSignal,
): Promise<PagedMovies> {
  const query = toQuery(page, limit, filters);

  switch (source.kind) {
    case 'newest':
      return newestToPaged(await fetchNewest(page, signal), page);

    case 'list':
      return listToPaged(await fetchByType(source.slug, query, signal), page);

    case 'category':
      return listToPaged(await fetchByCategory(source.slug, query, signal), page);

    case 'country':
      return listToPaged(await fetchByCountry(source.slug, query, signal), page);

    /*
     * The screen *is* the language cut, so `sort_lang` comes from the source
     * and not from the filter chip — the chip for that axis is hidden here,
     * exactly as the year chip is on a year catalog.
     */
    case 'language':
      return listToPaged(
        await fetchAll({ ...query, sort_lang: source.lang }, signal),
        page,
      );

    case 'year': {
      const { year: _ignored, ...rest } = query;
      return listToPaged(await fetchByYear(source.year, rest, signal), page);
    }

    case 'search': {
      const keyword = source.keyword.trim();
      if (keyword.length < MIN_SEARCH_LENGTH) return EMPTY_PAGE;
      return listToPaged(await fetchSearch(keyword, query, signal), page);
    }
  }
}

export async function loadDetail(slug: string, signal?: AbortSignal): Promise<MovieDetail> {
  const detail = detailToDomain(await fetchDetail(slug, signal));
  if (!detail) throw new Error(`Không tìm thấy phim "${slug}".`);
  return detail;
}

export async function loadCast(slug: string, signal?: AbortSignal): Promise<CastMember[]> {
  return peoplesToCast(await fetchPeoples(slug, signal));
}

export async function loadBackdrop(slug: string, signal?: AbortSignal): Promise<string> {
  return imagesToBackdropUrl(await fetchImages(slug, signal));
}

const toTaxonomyList = (items: { name?: string; slug?: string }[] | null | undefined) =>
  (items ?? [])
    .filter((item) => (item.slug ?? '').trim().length > 0)
    .map<Taxonomy>((item) => ({
      name: (item.name ?? '').trim(),
      slug: (item.slug ?? '').trim(),
    }));

export async function loadCategories(signal?: AbortSignal): Promise<Taxonomy[]> {
  return toTaxonomyList((await fetchCategories(signal)).data?.items);
}

export async function loadCountries(signal?: AbortSignal): Promise<Taxonomy[]> {
  return toTaxonomyList((await fetchCountries(signal)).data?.items);
}

export async function loadYears(signal?: AbortSignal): Promise<number[]> {
  return ((await fetchYears(signal)).data?.items ?? [])
    .map((item) => Number(item.year ?? 0))
    .filter((year) => Number.isFinite(year) && year > 1900);
}
