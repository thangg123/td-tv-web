/**
 * Domain models — port of `com.tdtv.domain.Models`.
 *
 * These are the only shapes the UI ever sees. Wire shapes live in
 * `lib/api/dtos.ts` and never leak past `lib/api/mappers.ts`.
 */

/** A genre or a country. */
export interface Taxonomy {
  readonly name: string;
  readonly slug: string;
}

/**
 * A movie as it appears in a row or a grid.
 *
 * The API exposes two images with different aspect ratios:
 *  - `posterUrl` is portrait 2:3, used for cards.
 *  - `thumbUrl` is landscape 16:9, used for heroes and "continue watching".
 */
export interface MovieCard {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly originName: string;
  readonly posterUrl: string;
  readonly thumbUrl: string;
  readonly year: number | null;
  readonly quality: string | null;
  readonly lang: string | null;
  readonly episodeCurrent: string | null;
  readonly time: string | null;
  readonly type: string | null;
  readonly rating: number | null;
  readonly categories: readonly Taxonomy[];
  readonly countries: readonly Taxonomy[];
}

/** Either image can come back blank, so each orientation falls back to the other. */
export const portraitOf = (movie: MovieCard): string => movie.posterUrl || movie.thumbUrl;
export const landscapeOf = (movie: MovieCard): string => movie.thumbUrl || movie.posterUrl;

export interface Episode {
  readonly name: string;
  readonly slug: string;
  readonly filename: string;
  readonly m3u8: string;
  readonly embed: string;
}

export const isPlayable = (episode: Episode): boolean =>
  episode.m3u8.length > 0 || episode.embed.length > 0;

export interface ServerGroup {
  readonly name: string;
  readonly episodes: readonly Episode[];
}

/**
 * One credited person, with the headshot already resolved to a full URL.
 *
 * `department` is TMDB's English label ("Acting", "Directing", ...) because the
 * endpoint mixes crew into the same list; it is only ever shown when the person
 * has no `character` to show instead.
 */
export interface CastMember {
  readonly id: number;
  readonly name: string;
  readonly character: string;
  readonly department: string;
  readonly profileUrl: string;
}

export interface MovieDetail {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly originName: string;
  readonly description: string;
  readonly posterUrl: string;
  readonly thumbUrl: string;
  readonly year: number | null;
  readonly quality: string | null;
  readonly lang: string | null;
  readonly time: string | null;
  readonly episodeCurrent: string | null;
  readonly episodeTotal: string | null;
  readonly status: string | null;
  readonly type: string | null;
  readonly trailerUrl: string | null;
  readonly actors: readonly string[];
  readonly directors: readonly string[];
  readonly categories: readonly Taxonomy[];
  readonly countries: readonly Taxonomy[];
  readonly rating: number | null;
  readonly voteCount: number | null;
  readonly servers: readonly ServerGroup[];
}

export const isSeries = (movie: MovieDetail): boolean =>
  movie.servers.some((server) => server.episodes.length > 1) ||
  movie.type === 'series' ||
  movie.type === 'tvshows';

/** Favourites are stored in the card shape, so detail collapses down to it. */
export const detailToCard = (movie: MovieDetail): MovieCard => ({
  id: movie.id,
  slug: movie.slug,
  name: movie.name,
  originName: movie.originName,
  posterUrl: movie.posterUrl,
  thumbUrl: movie.thumbUrl,
  year: movie.year,
  quality: movie.quality,
  lang: movie.lang,
  episodeCurrent: movie.episodeCurrent,
  time: movie.time,
  type: movie.type,
  rating: movie.rating,
  categories: movie.categories,
  countries: movie.countries,
});

export interface PagedMovies {
  readonly items: readonly MovieCard[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalItems: number;
}

export const EMPTY_PAGE: PagedMovies = {
  items: [],
  page: 1,
  totalPages: 0,
  totalItems: 0,
};

export const hasMore = (paged: PagedMovies): boolean => paged.page < paged.totalPages;

/** A movie the viewer started, backing the "Xem tiếp" row. */
export interface WatchProgress {
  readonly slug: string;
  readonly name: string;
  readonly landscapeImage: string;
  readonly serverIndex: number;
  readonly episodeSlug: string;
  readonly episodeName: string;
  readonly positionMs: number;
  readonly durationMs: number;
  readonly updatedAt: number;
}

export const progressPercent = (progress: WatchProgress): number => {
  if (progress.durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, progress.positionMs / progress.durationMs));
};

/** Finished titles should not clutter the continue-watching row. */
export const isFinished = (progress: WatchProgress): boolean =>
  progress.durationMs > 0 && progress.positionMs >= progress.durationMs * 0.97;
