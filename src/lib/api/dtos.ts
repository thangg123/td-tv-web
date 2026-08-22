/**
 * Wire models for phimapi.com — port of `com.tdtv.data.remote.Dtos`.
 *
 * Two things about this API drive the shapes below:
 *  1. The top-level `status` field is sometimes a boolean and sometimes the
 *     string "success", so it is deliberately never declared.
 *  2. Numeric fields occasionally arrive quoted, and several fields arrive as
 *     `null` where a string is documented. Every field is therefore optional
 *     here and normalised in `mappers.ts` — never read a DTO field directly.
 */

export interface TaxonomyDto {
  name?: string;
  slug?: string;
}

export interface TmdbDto {
  id?: string | null;
  type?: string | null;
  vote_average?: number | string | null;
  vote_count?: number | string | null;
}

export interface ImdbDto {
  id?: string | null;
  vote_average?: number | string | null;
  vote_count?: number | string | null;
}

export interface MovieItemDto {
  _id?: string;
  name?: string;
  slug?: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number | string | null;
  quality?: string | null;
  lang?: string | null;
  time?: string | null;
  episode_current?: string | null;
  type?: string | null;
  tmdb?: TmdbDto | null;
  imdb?: ImdbDto | null;
  category?: TaxonomyDto[] | null;
  country?: TaxonomyDto[] | null;
}

export interface MovieDetailDto {
  _id?: string;
  name?: string;
  slug?: string;
  origin_name?: string;
  content?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number | string | null;
  quality?: string | null;
  lang?: string | null;
  time?: string | null;
  episode_current?: string | null;
  /** Documented as a string; the server sends a number (`104`). Verified live. */
  episode_total?: string | number | null;
  status?: string | null;
  type?: string | null;
  trailer_url?: string | null;
  /** Element-level nulls do show up in these arrays. */
  actor?: (string | null)[] | null;
  director?: (string | null)[] | null;
  tmdb?: TmdbDto | null;
  imdb?: ImdbDto | null;
  category?: TaxonomyDto[] | null;
  country?: TaxonomyDto[] | null;
}

export interface PaginationDto {
  totalItems?: number | string | null;
  totalItemsPerPage?: number | string | null;
  currentPage?: number | string | null;
  totalPages?: number | string | null;
}

/** `/danh-sach/phim-moi-cap-nhat-v3` — items sit at the top level. */
export interface NewestResponse {
  items?: MovieItemDto[] | null;
  pagination?: PaginationDto | null;
}

export interface ListDataDto {
  titlePage?: string;
  items?: MovieItemDto[] | null;
  params?: { pagination?: PaginationDto | null } | null;
  /** Prefix for the relative image paths returned by the v1 endpoints. */
  APP_DOMAIN_CDN_IMAGE?: string;
}

/** Every `/v1/api/...` list endpoint wraps its payload in `data`. */
export interface ListResponse {
  data?: ListDataDto | null;
}

export interface EpisodeDto {
  name?: string;
  slug?: string;
  filename?: string;
  link_embed?: string;
  link_m3u8?: string;
}

export interface ServerDto {
  server_name?: string;
  server_data?: EpisodeDto[] | null;
}

/** `/phim/{slug}` — episodes are a sibling of `movie`, not nested inside it. */
export interface DetailResponse {
  movie?: MovieDetailDto | null;
  episodes?: ServerDto[] | null;
}

export interface TaxonomyResponse {
  data?: { items?: TaxonomyDto[] | null } | null;
}

export interface YearResponse {
  data?: { items?: { year?: number | string | null }[] | null } | null;
}

/*
 * `/v1/api/phim/{slug}/peoples` and `/v1/api/phim/{slug}/images`.
 *
 * Both are TMDB pass-throughs and both hand back relative paths next to the
 * size prefixes that turn them into URLs, so a path is only usable when the
 * matching prefix arrived in the same payload.
 */

export interface PeopleDto {
  tmdb_people_id?: number | string | null;
  name?: string;
  original_name?: string;
  character?: string | null;
  known_for_department?: string | null;
  profile_path?: string | null;
}

export interface PeoplesResponse {
  data?: {
    profile_sizes?: Record<string, string> | null;
    peoples?: PeopleDto[] | null;
  } | null;
}

/** `type` is one of backdrop / poster / logo. */
export interface ImageEntryDto {
  type?: string;
  file_path?: string;
  width?: number | string | null;
  height?: number | string | null;
  iso_639_1?: string | null;
}

export interface ImagesResponse {
  data?: {
    /** Keyed by image kind, then by size name: `backdrop` -> `w1280` -> prefix. */
    image_sizes?: Record<string, Record<string, string>> | null;
    images?: ImageEntryDto[] | null;
  } | null;
}
