/**
 * Server tabs plus the episode grid.
 *
 * A long-running series can carry several hundred episodes on three servers, so
 * the grid is dense by default and scrolls inside itself rather than turning the
 * page into a wall of buttons.
 */

import { useEffect, useMemo, useRef } from 'react';
import Chip from '@/components/ui/Chip';
import { isPlayable } from '@/lib/domain/models';
import type { ServerGroup } from '@/lib/domain/models';
import { formatCount } from '@/lib/format';

/** `Tập 12` → `12`; anything the pattern does not own keeps its own words. */
const EPISODE_NUMBER = /^(?:tập|tap|episode|ep|phần|phan)?[\s._-]*(\d{1,4})$/i;

const shortLabel = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return EPISODE_NUMBER.exec(trimmed)?.[1] ?? trimmed;
};

export interface EpisodePickerProps {
  servers: readonly ServerGroup[];
  serverIndex: number;
  episodeIndex: number;
  onSelectServer: (index: number) => void;
  onSelectEpisode: (index: number) => void;
  variant?: 'panel' | 'page';
  /**
   * False while the picker is inside a collapsed panel. A `display:none`
   * scroller measures zero and silently drops the scroll below, so the nudge
   * waits until the panel is actually on screen.
   */
  active?: boolean;
}

export default function EpisodePicker({
  servers,
  serverIndex,
  episodeIndex,
  onSelectServer,
  onSelectEpisode,
  variant = 'page',
  active = true,
}: EpisodePickerProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const isPanel = variant === 'panel';

  const safeServerIndex = servers[serverIndex] ? serverIndex : 0;
  const episodes = servers[safeServerIndex]?.episodes ?? [];

  /* Long names cannot live in a 3rem cell, so the whole grid widens for them. */
  const isDense = useMemo(
    () => episodes.every((episode) => shortLabel(episode.name).length <= 4),
    [episodes],
  );

  /*
   * `scrollIntoView` would drag the whole page whenever the picker sits below
   * the fold, so the scroller is nudged directly instead: the page never moves,
   * and a grid short enough not to scroll simply stays put.
   */
  useEffect(() => {
    if (!active) return;
    const button = activeRef.current;
    const scroller = gridRef.current;
    if (!button || !scroller) return;

    const top = button.offsetTop;
    const bottom = top + button.offsetHeight;
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;

    if (top < viewTop) scroller.scrollTop = Math.max(0, top - 8);
    else if (bottom > viewBottom) scroller.scrollTop = bottom - scroller.clientHeight + 8;
  }, [active, safeServerIndex, episodeIndex, episodes.length]);

  if (episodes.length === 0) return null;

  return (
    <section
      aria-label="Danh sách tập"
      className={isPanel ? 'flex min-h-0 flex-col gap-4' : 'flex flex-col gap-6'}
    >
      {servers.length > 1 && (
        <div>
          <p className="eyebrow">Máy chủ</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {servers.map((server, index) => (
              <Chip
                key={`${server.name}-${index}`}
                label={server.name}
                active={index === safeServerIndex}
                onClick={() => onSelectServer(index)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow">Tập</p>
          <p className="text-xs text-text-mid tabular-nums">{formatCount(episodes.length)} tập</p>
        </div>

        <div
          ref={gridRef}
          className={`relative mt-3 grid gap-2 overflow-y-auto pr-1 ${
            isDense
              ? 'grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))]'
              : 'grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]'
          } ${isPanel ? 'max-h-[min(52vh,24rem)]' : 'max-h-[32rem]'}`}
        >
          {episodes.map((episode, index) => {
            const isActive = index === episodeIndex;
            const playable = isPlayable(episode);

            return (
              <button
                key={`${episode.slug || episode.name}-${index}`}
                ref={isActive ? activeRef : null}
                type="button"
                title={episode.name}
                disabled={!playable}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onSelectEpisode(index)}
                className={`flex items-center justify-center rounded-cell border px-1.5 font-medium tabular-nums transition disabled:pointer-events-none disabled:opacity-35 ${
                  isPanel ? 'h-10 text-xs' : 'h-11 text-sm'
                } ${
                  isActive
                    ? 'border-accent bg-accent text-white shadow-glow'
                    : 'border-outline bg-surface-2 text-text-mid hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-3 hover:text-text-high active:translate-y-0 active:scale-95'
                }`}
              >
                <span className="truncate">{shortLabel(episode.name)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
