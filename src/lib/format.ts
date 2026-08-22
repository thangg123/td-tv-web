/** Small display helpers. `formatDuration` is a port of `ui.util.Format`. */

/** Renders a millisecond position as `h:mm:ss`, or `m:ss` under an hour. */
export function formatDuration(millis: number): string {
  if (!Number.isFinite(millis) || millis <= 0) return '0:00';

  const totalSeconds = Math.floor(millis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** One decimal place, the way a rating badge wants it: `7.5`, not `7.532`. */
export const formatRating = (rating: number): string => rating.toFixed(1);

export const formatVotes = (votes: number): string =>
  votes >= 1000 ? `${(votes / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(votes);

export const formatCount = (count: number): string => new Intl.NumberFormat('vi-VN').format(count);

/** `vietsub` → `Vietsub`, `Long tieng` → `Long tieng`. Leaves real labels alone. */
export const humanizeLang = (lang: string): string =>
  lang
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Joins the bits of metadata a card shows, skipping whatever is missing. */
export const metaLine = (...parts: (string | number | null | undefined)[]): string =>
  parts
    .filter((part) => part !== null && part !== undefined && String(part).trim().length > 0)
    .join(' • ');
