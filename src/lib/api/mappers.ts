/**
 * Wire → domain conversion — port of `com.tdtv.data.Mappers`.
 *
 * Every field the API can quote, null or omit is coerced here, so nothing past
 * this file has to think about it again.
 */

import type {
  CastMember,
  Episode,
  MovieCard,
  MovieDetail,
  PagedMovies,
  ServerGroup,
  Taxonomy,
} from '@/lib/domain/models';
import { EMPTY_PAGE } from '@/lib/domain/models';
import type {
  DetailResponse,
  ImagesResponse,
  ImdbDto,
  ListResponse,
  MovieDetailDto,
  MovieItemDto,
  NewestResponse,
  PaginationDto,
  PeoplesResponse,
  TaxonomyDto,
  TmdbDto,
} from '@/lib/api/dtos';

/* ── primitive coercion ──────────────────────────────────────────────────── */

/**
 * Deliberately takes `unknown`.
 *
 * The Kotlin client got away with declaring these fields `String` because
 * kotlinx-serialization ran with `isLenient = true` and coerced a bare number
 * into one. JSON.parse does no such thing, so a field the docs call a string
 * and the server sends as a number would reach `.trim()` and throw — which is
 * exactly what `episode_total` does: it is documented as a string and arrives
 * as `104`. Coercing here makes every such drift a cosmetic non-event instead
 * of a white screen on the detail and watch pages.
 */
const str = (raw: unknown): string =>
  raw === null || raw === undefined ? '' : String(raw).trim();

/** `""` and `null` both mean "the API had nothing here". */
const strOrNull = (raw: unknown): string | null => str(raw) || null;

const num = (raw: number | string | null | undefined): number => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

/* ── images ──────────────────────────────────────────────────────────────── */

/**
 * Image paths come back in three shapes depending on the endpoint: absolute
 * URLs, CDN-relative paths (`upload/vod/...`), or a bare filename.
 */
const FALLBACK_CDN = 'https://phimimg.com';
const LEGACY_FOLDER = 'uploads/movies';

export const resolveImageUrl = (raw: string | null | undefined, cdn = ''): string => {
  const path = str(raw);
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;

  const base = (str(cdn) || FALLBACK_CDN).replace(/\/+$/, '');
  const clean = path.replace(/^\/+/, '');
  return clean.includes('/') ? `${base}/${clean}` : `${base}/${LEGACY_FOLDER}/${clean}`;
};

/* ── text ────────────────────────────────────────────────────────────────── */

const HTML_TAG = /<[^>]*>/g;
const WHITESPACE = /\s+/g;

/**
 * `content` is an HTML blob. It is never injected as markup — it is flattened
 * to text here and rendered as a plain string, which is what keeps the synopsis
 * from being an XSS surface.
 */
export const stripHtml = (raw: string): string =>
  raw
    .replace(HTML_TAG, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(WHITESPACE, ' ')
    .trim();

/* ── taxonomy & ratings ──────────────────────────────────────────────────── */

const toTaxonomies = (raw: TaxonomyDto[] | null | undefined): Taxonomy[] =>
  (raw ?? [])
    .filter((item) => str(item.name).length > 0)
    .map((item) => ({ name: str(item.name), slug: str(item.slug) }));

/** TMDB is the richer source; fall back to IMDB when TMDB has no votes. */
const pickRating = (tmdb: TmdbDto | null | undefined, imdb: ImdbDto | null | undefined) => {
  const tmdbAvg = num(tmdb?.vote_average);
  if (tmdb && tmdbAvg > 0) return tmdbAvg;
  const imdbAvg = num(imdb?.vote_average);
  if (imdb && imdbAvg > 0) return imdbAvg;
  return null;
};

const pickVotes = (tmdb: TmdbDto | null | undefined, imdb: ImdbDto | null | undefined) => {
  if (tmdb && num(tmdb.vote_average) > 0) return num(tmdb.vote_count) || null;
  if (imdb && num(imdb.vote_average) > 0) return num(imdb.vote_count) || null;
  return null;
};

/* ── cards ───────────────────────────────────────────────────────────────── */

export const itemToCard = (dto: MovieItemDto, cdn = ''): MovieCard => ({
  id: str(dto._id),
  slug: str(dto.slug),
  name: str(dto.name),
  originName: str(dto.origin_name),
  posterUrl: resolveImageUrl(dto.poster_url, cdn),
  thumbUrl: resolveImageUrl(dto.thumb_url, cdn),
  year: num(dto.year) > 0 ? num(dto.year) : null,
  quality: strOrNull(dto.quality),
  lang: strOrNull(dto.lang),
  episodeCurrent: strOrNull(dto.episode_current),
  time: strOrNull(dto.time),
  type: strOrNull(dto.type),
  rating: pickRating(dto.tmdb, dto.imdb),
  categories: toTaxonomies(dto.category),
  countries: toTaxonomies(dto.country),
});

/* ── paging ──────────────────────────────────────────────────────────────── */

const readPagination = (p: PaginationDto | null | undefined) => ({
  currentPage: num(p?.currentPage),
  totalPages: num(p?.totalPages),
  totalItems: num(p?.totalItems),
  perPage: num(p?.totalItemsPerPage),
});

export const newestToPaged = (
  response: NewestResponse,
  requestedPage: number,
): PagedMovies => {
  // This endpoint returns absolute image URLs, so no CDN prefix is needed.
  const items = (response.items ?? [])
    .filter((item) => str(item.slug).length > 0)
    .map((item) => itemToCard(item));
  const p = readPagination(response.pagination);

  return {
    items,
    page: p.currentPage > 0 ? p.currentPage : requestedPage,
    totalPages: p.totalPages > 0 ? p.totalPages : 1,
    totalItems: p.totalItems > 0 ? p.totalItems : items.length,
  };
};

export const listToPaged = (response: ListResponse, requestedPage: number): PagedMovies => {
  const payload = response.data;
  if (!payload) return EMPTY_PAGE;

  const cdn = str(payload.APP_DOMAIN_CDN_IMAGE);
  const items = (payload.items ?? [])
    .filter((item) => str(item.slug).length > 0)
    .map((item) => itemToCard(item, cdn));

  const p = readPagination(payload.params?.pagination);
  const perPage = p.perPage > 0 ? p.perPage : Math.max(items.length, 1);
  const total = p.totalItems > 0 ? p.totalItems : items.length;
  const totalPages =
    p.totalPages > 0 ? p.totalPages : Math.max(Math.ceil(total / perPage), 1);

  return {
    items,
    page: p.currentPage > 0 ? p.currentPage : requestedPage,
    totalPages,
    totalItems: total,
  };
};

/* ── detail ──────────────────────────────────────────────────────────────── */

const toEpisodes = (dtos: DetailResponse['episodes']): ServerGroup[] =>
  (dtos ?? [])
    .map((server) => {
      const episodes: Episode[] = (server.server_data ?? [])
        .filter((ep) => str(ep.link_m3u8).length > 0 || str(ep.link_embed).length > 0)
        .map((ep) => ({
          name: strOrNull(ep.name) ?? 'Tập',
          slug: strOrNull(ep.slug) ?? str(ep.name),
          filename: str(ep.filename),
          m3u8: str(ep.link_m3u8),
          embed: str(ep.link_embed),
        }));
      return { name: strOrNull(server.server_name) ?? 'Server', episodes };
    })
    .filter((server) => server.episodes.length > 0);

export const detailToDomain = (response: DetailResponse): MovieDetail | null => {
  const m: MovieDetailDto | null | undefined = response.movie;
  if (!m) return null;

  return {
    id: str(m._id),
    slug: str(m.slug),
    name: str(m.name),
    originName: str(m.origin_name),
    description: stripHtml(str(m.content)),
    posterUrl: resolveImageUrl(m.poster_url),
    thumbUrl: resolveImageUrl(m.thumb_url),
    year: num(m.year) > 0 ? num(m.year) : null,
    quality: strOrNull(m.quality),
    lang: strOrNull(m.lang),
    time: strOrNull(m.time),
    episodeCurrent: strOrNull(m.episode_current),
    episodeTotal: strOrNull(m.episode_total),
    status: strOrNull(m.status),
    type: strOrNull(m.type),
    trailerUrl: strOrNull(m.trailer_url),
    actors: (m.actor ?? []).map(strOrNull).filter((v): v is string => v !== null),
    directors: (m.director ?? []).map(strOrNull).filter((v): v is string => v !== null),
    categories: toTaxonomies(m.category),
    countries: toTaxonomies(m.country),
    rating: pickRating(m.tmdb, m.imdb),
    voteCount: pickVotes(m.tmdb, m.imdb),
    servers: toEpisodes(response.episodes),
  };
};

/* ── TMDB enrichments ────────────────────────────────────────────────────── */

/*
 * `resolveImageUrl` cannot be reused for these: it falls back to the phimimg
 * CDN, which would happily build a URL that 404s.
 */

const ACTING = 'acting';
const BACKDROP = 'backdrop';

const tmdbUrl = (prefix: string, path: string): string => {
  const clean = str(path).replace(/^\/+/, '');
  if (!prefix || !clean) return '';
  return `${prefix.replace(/\/+$/, '')}/${clean}`;
};

export const peoplesToCast = (response: PeoplesResponse): CastMember[] => {
  const payload = response.data;
  if (!payload) return [];

  // w185 is the smallest size that still looks sharp on a headshot card.
  const prefix = payload.profile_sizes?.['w185'] ?? '';

  // One person can be listed twice — once from the crew block and once from
  // the cast block — with the character name filled in on only one of them.
  // Keeping both shows the same face twice and hands React two identical keys.
  const byId = new Map<number, CastMember>();
  for (const person of payload.peoples ?? []) {
    const name = str(person.name);
    if (!name) continue;

    const id = num(person.tmdb_people_id);
    const candidate: CastMember = {
      id,
      name,
      character: str(person.character),
      department: str(person.known_for_department),
      profileUrl: tmdbUrl(prefix, str(person.profile_path)),
    };
    const existing = byId.get(id);
    if (!existing || candidate.character.length > existing.character.length) {
      byId.set(id, candidate);
    }
  }

  // Crew is mixed into the same list; a cast row is scanned for actors, so
  // everyone else is kept but pushed to the end.
  return [...byId.values()].sort((a, b) => {
    const rank = (m: CastMember) => (m.department.toLowerCase() === ACTING ? 0 : 1);
    return rank(a) - rank(b);
  });
};

/**
 * One backdrop at a size a browser can afford: `original` is routinely 3840px
 * wide, which is several megabytes of decode for a band a few hundred px tall.
 */
export const imagesToBackdropUrl = (response: ImagesResponse): string => {
  const payload = response.data;
  if (!payload) return '';

  const prefix = payload.image_sizes?.[BACKDROP]?.['w1280'] ?? '';
  const backdrops = (payload.images ?? []).filter(
    (img) => str(img.type).toLowerCase() === BACKDROP && str(img.file_path).length > 0,
  );
  if (backdrops.length === 0) return '';

  // A backdrop tagged with a language usually has the title burned into it in
  // that language, so untagged art wins; widest source breaks the tie.
  const untagged = backdrops.filter((img) => str(img.iso_639_1).length === 0);
  const pool = untagged.length > 0 ? untagged : backdrops;
  const best = pool.reduce((widest, img) =>
    num(img.width) > num(widest.width) ? img : widest,
  );

  return tmdbUrl(prefix, str(best.file_path));
};
