/**
 * Favourites and watch progress — port of `com.tdtv.data.local.UserDataStore`,
 * backed by `localStorage` instead of DataStore.
 *
 * Storage-facing shapes are kept separate from the domain models so a change in
 * the UI layer cannot silently invalidate data already on disk. Every read is
 * defensive: a corrupt or outdated payload must never take a screen down, and
 * a full quota must never crash playback — the player writes progress every
 * few seconds.
 */

import type { MovieCard, WatchProgress } from '@/lib/domain/models';
import { isFinished } from '@/lib/domain/models';

const KEY_PROGRESS = 'cici.watch_progress';
const KEY_FAVORITES = 'cici.favorites';

const MAX_PROGRESS = 40;
const MAX_FAVORITES = 300;

/** Below this the viewer has not really started; do not clutter "Xem tiếp". */
export const MIN_SAVE_POSITION_MS = 15_000;

interface StoredProgress {
  slug: string;
  name?: string;
  image?: string;
  serverIndex?: number;
  episodeSlug?: string;
  episodeName?: string;
  positionMs?: number;
  durationMs?: number;
  updatedAt?: number;
}

interface StoredFavorite {
  slug: string;
  name?: string;
  originName?: string;
  poster?: string;
  landscape?: string;
  year?: number;
  quality?: string;
  lang?: string;
  episodeCurrent?: string;
  addedAt?: number;
}

/* ── raw access ──────────────────────────────────────────────────────────── */

const readList = <T>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // Corrupt payload, or storage blocked entirely (private mode, embedded
    // webview). Behaving as if nothing were saved is the only safe answer.
    return [];
  }
};

const writeList = <T>(key: string, value: T[]): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // QuotaExceededError, or a blocked store. Callers are fire-and-forget.
    return false;
  }
};

/* ── change notification ─────────────────────────────────────────────────── */

type Listener = () => void;
const listeners = new Set<Listener>();

export const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const notify = () => {
  for (const listener of listeners) listener();
};

/**
 * Another tab writing to the same store fires `storage` here but never fires
 * the local `notify`, so both paths are wired to the same callback set.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY_PROGRESS || event.key === KEY_FAVORITES) notify();
  });
}

/* ── mapping ─────────────────────────────────────────────────────────────── */

const progressToDomain = (stored: StoredProgress): WatchProgress => ({
  slug: stored.slug,
  name: stored.name ?? '',
  landscapeImage: stored.image ?? '',
  serverIndex: stored.serverIndex ?? 0,
  episodeSlug: stored.episodeSlug ?? '',
  episodeName: stored.episodeName ?? '',
  positionMs: stored.positionMs ?? 0,
  durationMs: stored.durationMs ?? 0,
  updatedAt: stored.updatedAt ?? 0,
});

const favoriteToCard = (stored: StoredFavorite): MovieCard => ({
  id: stored.slug,
  slug: stored.slug,
  name: stored.name ?? '',
  originName: stored.originName ?? '',
  posterUrl: stored.poster ?? '',
  thumbUrl: stored.landscape ?? '',
  year: stored.year && stored.year > 0 ? stored.year : null,
  quality: stored.quality || null,
  lang: stored.lang || null,
  episodeCurrent: stored.episodeCurrent || null,
  time: null,
  type: null,
  rating: null,
  categories: [],
  countries: [],
});

const cardToFavorite = (card: MovieCard): StoredFavorite => ({
  slug: card.slug,
  name: card.name,
  originName: card.originName,
  poster: card.posterUrl,
  landscape: card.thumbUrl,
  year: card.year ?? 0,
  quality: card.quality ?? '',
  lang: card.lang ?? '',
  episodeCurrent: card.episodeCurrent ?? '',
  addedAt: Date.now(),
});

/* ── watch progress ──────────────────────────────────────────────────────── */

/** Newest first, with anything already watched to the end filtered out. */
export const getWatchProgress = (): WatchProgress[] =>
  readList<StoredProgress>(KEY_PROGRESS)
    .filter((entry) => typeof entry?.slug === 'string' && entry.slug.length > 0)
    .map(progressToDomain)
    .filter((entry) => !isFinished(entry))
    .sort((a, b) => b.updatedAt - a.updatedAt);

export const getProgressFor = (slug: string): WatchProgress | null => {
  const found = readList<StoredProgress>(KEY_PROGRESS).find((entry) => entry?.slug === slug);
  return found ? progressToDomain(found) : null;
};

export interface SaveProgressInput {
  slug: string;
  name: string;
  image: string;
  serverIndex: number;
  episodeSlug: string;
  episodeName: string;
  positionMs: number;
  durationMs: number;
}

export const saveProgress = (input: SaveProgressInput): void => {
  const entry: StoredProgress = { ...input, updatedAt: Date.now() };
  const rest = readList<StoredProgress>(KEY_PROGRESS).filter((e) => e?.slug !== input.slug);
  writeList(KEY_PROGRESS, [entry, ...rest].slice(0, MAX_PROGRESS));
  notify();
};

export const removeProgress = (slug: string): void => {
  const next = readList<StoredProgress>(KEY_PROGRESS).filter((e) => e?.slug !== slug);
  writeList(KEY_PROGRESS, next);
  notify();
};

export const clearProgress = (): void => {
  writeList<StoredProgress>(KEY_PROGRESS, []);
  notify();
};

/* ── favourites ──────────────────────────────────────────────────────────── */

/** Most recently added first. */
export const getFavorites = (): MovieCard[] =>
  readList<StoredFavorite>(KEY_FAVORITES)
    .filter((entry) => typeof entry?.slug === 'string' && entry.slug.length > 0)
    .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
    .map(favoriteToCard);

export const getFavoriteSlugs = (): Set<string> =>
  new Set(readList<StoredFavorite>(KEY_FAVORITES).map((entry) => entry?.slug).filter(Boolean));

export const isFavorite = (slug: string): boolean => getFavoriteSlugs().has(slug);

/**
 * Returns whether the movie is a favourite *after* the call. On a failed write
 * the previous state is returned, so the bookmark icon never lies.
 */
export const toggleFavorite = (card: MovieCard): boolean => {
  const current = readList<StoredFavorite>(KEY_FAVORITES);
  const existing = current.some((entry) => entry?.slug === card.slug);

  const next = existing
    ? current.filter((entry) => entry?.slug !== card.slug)
    : [cardToFavorite(card), ...current].slice(0, MAX_FAVORITES);

  const ok = writeList(KEY_FAVORITES, next);
  if (!ok) return existing;

  notify();
  return !existing;
};
