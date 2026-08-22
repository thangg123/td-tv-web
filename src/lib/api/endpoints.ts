/**
 * phimapi.com endpoints — port of `com.tdtv.data.remote.PhimApi`.
 *
 * Every optional query is passed explicitly; `null` means "omit", which
 * `apiGet` honours.
 */

import { apiGet } from '@/lib/api/client';
import type {
  DetailResponse,
  ImagesResponse,
  ListResponse,
  NewestResponse,
  PeoplesResponse,
  TaxonomyResponse,
  YearResponse,
} from '@/lib/api/dtos';

/** The filter/sort block every `/v1/api` list endpoint accepts. */
export interface ListQuery {
  page: number;
  limit?: number | null;
  category?: string | null;
  country?: string | null;
  year?: string | null;
  sort_field?: string | null;
  sort_type?: string | null;
  sort_lang?: string | null;
}

export const fetchNewest = (page: number, signal?: AbortSignal) =>
  apiGet<NewestResponse>('danh-sach/phim-moi-cap-nhat-v3', { page }, signal);

/**
 * The type-less list: the whole catalogue, filterable. Used for the audio cuts,
 * where restricting to one content type would change what the destination means.
 */
export const fetchAll = (query: ListQuery, signal?: AbortSignal) =>
  apiGet<ListResponse>('v1/api/danh-sach', { ...query }, signal);

/** type: phim-le | phim-bo | hoat-hinh | tv-shows | phim-chieu-rap */
export const fetchByType = (type: string, query: ListQuery, signal?: AbortSignal) =>
  apiGet<ListResponse>(`v1/api/danh-sach/${encodeURIComponent(type)}`, { ...query }, signal);

/**
 * The path pins one category; `category` narrows *within* it — the API
 * intersects the two rather than ignoring the query.
 */
export const fetchByCategory = (slug: string, query: ListQuery, signal?: AbortSignal) =>
  apiGet<ListResponse>(`v1/api/the-loai/${encodeURIComponent(slug)}`, { ...query }, signal);

/** `country` stacks with the path the same way `category` does above. */
export const fetchByCountry = (slug: string, query: ListQuery, signal?: AbortSignal) =>
  apiGet<ListResponse>(`v1/api/quoc-gia/${encodeURIComponent(slug)}`, { ...query }, signal);

export const fetchByYear = (
  year: number,
  query: Omit<ListQuery, 'year'>,
  signal?: AbortSignal,
) => apiGet<ListResponse>(`v1/api/nam/${year}`, { ...query }, signal);

export const fetchSearch = (
  keyword: string,
  query: ListQuery,
  signal?: AbortSignal,
) => apiGet<ListResponse>('v1/api/tim-kiem', { keyword, ...query }, signal);

export const fetchDetail = (slug: string, signal?: AbortSignal) =>
  apiGet<DetailResponse>(`phim/${encodeURIComponent(slug)}`, undefined, signal);

/*
 * TMDB pass-throughs used to enrich the detail page. A title the upstream never
 * matched to TMDB answers 404 here, and a matched one frequently answers 200
 * with an empty list, so both outcomes are ordinary and neither belongs on the
 * critical path of the detail load.
 */

export const fetchPeoples = (slug: string, signal?: AbortSignal) =>
  apiGet<PeoplesResponse>(`v1/api/phim/${encodeURIComponent(slug)}/peoples`, undefined, signal);

export const fetchImages = (slug: string, signal?: AbortSignal) =>
  apiGet<ImagesResponse>(`v1/api/phim/${encodeURIComponent(slug)}/images`, undefined, signal);

export const fetchCategories = (signal?: AbortSignal) =>
  apiGet<TaxonomyResponse>('the-loai', undefined, signal);

export const fetchCountries = (signal?: AbortSignal) =>
  apiGet<TaxonomyResponse>('quoc-gia', undefined, signal);

export const fetchYears = (signal?: AbortSignal) =>
  apiGet<YearResponse>('nam-phat-hanh', undefined, signal);
