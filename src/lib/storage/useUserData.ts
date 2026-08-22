/**
 * React bindings for the local store.
 *
 * `useSyncExternalStore` is what keeps every mounted card, row and bookmark
 * button in step with a single write, across tabs, without pulling in a state
 * library for two arrays.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { MovieCard, WatchProgress } from '@/lib/domain/models';
import {
  getFavoriteSlugs,
  getFavorites,
  getWatchProgress,
  subscribe,
  toggleFavorite,
} from '@/lib/storage/userData';

/*
 * `useSyncExternalStore` compares snapshots by identity and every getter above
 * builds a fresh array, so an uncached getter would loop forever. Each snapshot
 * is therefore rebuilt once per notification and handed out unchanged until the
 * next one.
 */
function cachedSnapshot<T>(read: () => T): () => T {
  let value = read();
  let dirty = false;
  subscribe(() => {
    dirty = true;
  });
  return () => {
    if (dirty) {
      value = read();
      dirty = false;
    }
    return value;
  };
}

const progressSnapshot = cachedSnapshot(getWatchProgress);
const favoritesSnapshot = cachedSnapshot(getFavorites);
const favoriteSlugsSnapshot = cachedSnapshot(getFavoriteSlugs);

export const useWatchProgress = (): WatchProgress[] =>
  useSyncExternalStore(subscribe, progressSnapshot, progressSnapshot);

export const useFavorites = (): MovieCard[] =>
  useSyncExternalStore(subscribe, favoritesSnapshot, favoritesSnapshot);

export const useFavoriteSlugs = (): Set<string> =>
  useSyncExternalStore(subscribe, favoriteSlugsSnapshot, favoriteSlugsSnapshot);

/** `[isFavorite, toggle]` for one title. */
export function useFavorite(card: MovieCard | null): [boolean, () => void] {
  const slugs = useFavoriteSlugs();
  const toggle = useCallback(() => {
    if (card) toggleFavorite(card);
  }, [card]);
  return [card ? slugs.has(card.slug) : false, toggle];
}

/**
 * The saved position for one title, or `null`.
 *
 * Backed by the already-subscribed list rather than its own read, so it stays
 * in step with the player's writes without touching storage on every render.
 * That list drops finished titles, which is the wanted behaviour here too: a
 * "Xem tiếp" button on something watched to the end is noise.
 */
export function useProgressFor(slug: string | undefined): WatchProgress | null {
  const all = useWatchProgress();
  if (!slug) return null;
  return all.find((entry) => entry.slug === slug) ?? null;
}
