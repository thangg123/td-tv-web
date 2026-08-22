import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import FilterBar from '@/components/movie/FilterBar';
import MovieGrid from '@/components/movie/MovieGrid';
import Button, { IconButton, LinkButton } from '@/components/ui/Button';
import { ChipLink } from '@/components/ui/Chip';
import Icon from '@/components/ui/Icon';
import { GridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import { toUserMessage } from '@/lib/api/client';
import { MIN_SEARCH_LENGTH } from '@/lib/api/repository';
import type { CatalogFilters, CatalogSource } from '@/lib/domain/catalog';
import {
  DEFAULT_FILTERS,
  MovieLists,
  activeFilterCount,
  listTitle,
  sortKeyOf,
  sortOptions,
} from '@/lib/domain/catalog';
import { formatCount } from '@/lib/format';
import { useCatalog, useYears } from '@/lib/queries/queries';
import { routes } from '@/lib/routes';

/**
 * Query-string vocabulary, shared verbatim with the catalog screens so a link
 * copied from one grid means the same thing when pasted at the other.
 */
const PARAM = {
  keyword: 'q',
  category: 'the-loai',
  country: 'quoc-gia',
  year: 'nam',
  language: 'ngon-ngu',
  sort: 'sap-xep',
} as const;

/** Long enough that a fast typist writes a whole word before we ask upstream. */
const KEYWORD_DEBOUNCE_MS = 350;

/** How far ahead of the fold the next page starts loading. */
const PREFETCH_MARGIN = '800px 0px';

const SKELETON_COUNT = 18;

const DEFAULT_SORT_KEY = sortKeyOf(DEFAULT_FILTERS);

interface Suggestion {
  readonly label: string;
  readonly to: string;
}

/** The doors people actually walk through when they arrive with nothing typed. */
const SUGGESTIONS: readonly Suggestion[] = [
  { label: listTitle(MovieLists.SERIES), to: routes.list(MovieLists.SERIES) },
  { label: listTitle(MovieLists.SINGLE), to: routes.list(MovieLists.SINGLE) },
  { label: listTitle(MovieLists.ANIME), to: routes.list(MovieLists.ANIME) },
  { label: 'Chiếu rạp', to: routes.list(MovieLists.CINEMA) },
  { label: 'Vietsub', to: routes.language('vietsub') },
];

const readParam = (params: URLSearchParams, key: string): string | null => {
  const value = params.get(key)?.trim();
  return value ? value : null;
};

/** Mutates the *copy* the caller just made; the live params are never touched. */
const writeParam = (params: URLSearchParams, key: string, value: string | null): void => {
  if (value) params.set(key, value);
  else params.delete(key);
};

export default function SearchPage() {
  const [params, setParams] = useSearchParams();

  const urlKeyword = readParam(params, PARAM.keyword) ?? '';
  const [draft, setDraft] = useState(urlKeyword);
  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * The last value *this page* pushed into the URL. It is what tells an
   * incoming `?q=` change apart: if it matches, the change is the echo of our
   * own debounced write and the input must not be disturbed mid-keystroke; if
   * it does not, the change came from outside — back/forward, the header search
   * box, a pasted link — and the input has to follow it.
   */
  const lastCommitted = useRef(urlKeyword);

  const commit = useCallback(
    (value: string) => {
      if (value === lastCommitted.current) return;
      lastCommitted.current = value;
      // Rebuilt from the previous params rather than replaced wholesale, so a
      // keystroke never silently drops the filters sitting alongside it.
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          writeParam(next, PARAM.keyword, value || null);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // `setParams` is re-created on every URL change, so `commit` is read through a
  // ref: otherwise applying a filter mid-word would restart the debounce timer.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  useEffect(() => {
    const next = draft.trim();
    if (next === lastCommitted.current) return;
    const timer = window.setTimeout(() => commitRef.current(next), KEYWORD_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (urlKeyword === lastCommitted.current) return;
    lastCommitted.current = urlKeyword;
    setDraft(urlKeyword);
  }, [urlKeyword]);

  /*
   * Autofocus is a pointer-only affordance. On a phone it throws the keyboard
   * over half the screen and scrolls the page before the visitor has decided
   * they want to type at all — so a coarse pointer gets the field, not the
   * keyboard, and taps into it when ready.
   */
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    inputRef.current?.focus();
  }, []);

  const filters = useMemo<CatalogFilters>(() => {
    const sort = sortOptions.find((option) => option.key === readParam(params, PARAM.sort));
    return {
      category: readParam(params, PARAM.category),
      country: readParam(params, PARAM.country),
      year: readParam(params, PARAM.year),
      sortLang: readParam(params, PARAM.language),
      sortField: sort?.field ?? DEFAULT_FILTERS.sortField,
      sortType: sort?.type ?? DEFAULT_FILTERS.sortType,
    };
  }, [params]);

  const onFiltersChange = useCallback(
    (next: CatalogFilters) => {
      // Replaced rather than pushed, matching CatalogPage: a session of chip
      // twiddling collapses into one entry, so Back leaves the search instead of
      // walking backwards through every intermediate combination.
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          writeParam(updated, PARAM.category, next.category);
          writeParam(updated, PARAM.country, next.country);
          writeParam(updated, PARAM.year, next.year);
          writeParam(updated, PARAM.language, next.sortLang);
          const sortKey = sortKeyOf(next);
          writeParam(updated, PARAM.sort, sortKey === DEFAULT_SORT_KEY ? null : sortKey);
          return updated;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const source = useMemo<CatalogSource>(
    () => ({ kind: 'search', keyword: urlKeyword }),
    [urlKeyword],
  );

  const {
    items,
    totalItems,
    enabled,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useCatalog(source, filters);

  const years = useYears();
  const recentYears = useMemo(
    // The endpoint's order is not guaranteed, and "three most recent" has to be
    // true rather than "first three".
    () => [...(years.data ?? [])].sort((a, b) => b - a).slice(0, 3),
    [years.data],
  );

  const filterCount = activeFilterCount(filters);
  const clearFilters = () =>
    onFiltersChange({ ...filters, category: null, country: null, year: null, sortLang: null });

  // The search endpoint occasionally reports a zero total alongside real rows.
  const resultCount = totalItems > 0 ? totalItems : items.length;
  const hasResults = items.length > 0;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    /*
     * `isError` stops the observer as well as the fetch. A failed page leaves
     * the sentinel sitting in view, so the moment `isFetchingNextPage` cleared
     * it would be re-requested forever; the "Xem thêm" button is the way out.
     * Re-running on `isFetchingNextPage` is what keeps the chain going in the
     * ordinary case — an observer already intersecting fires no second event.
     */
    if (!node || !hasNextPage || isFetchingNextPage || isError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  /*
   * A filter change is a new query key, so the loaded pages collapse back to a
   * skeleton and someone six rows deep would be left staring past the end of a
   * much shorter document. Pull them back — but only when the results had
   * actually scrolled off the top, so typing in the still-visible search field
   * never yanks the page.
   */
  const lastFilters = useRef(filters);
  useEffect(() => {
    if (lastFilters.current === filters) return;
    lastFilters.current = filters;

    const node = resultsRef.current;
    if (!node || node.getBoundingClientRect().top >= 0) return;
    // `html { scroll-behavior: smooth }` would otherwise animate the whole trip.
    node.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [filters]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commit(draft.trim());
    // A phone keyboard covers the grid it just produced. A pointer-driven
    // browser has no such problem, so only touch gives up focus here.
    if (window.matchMedia('(pointer: coarse)').matches) inputRef.current?.blur();
  };

  const onClearKeyword = () => {
    setDraft('');
    commit('');
    inputRef.current?.focus();
  };

  return (
    // FilterBar docks against `--header-h`; the shell's bar is 4rem, 4.5rem at lg.
    <div className="[--header-h:4rem] lg:[--header-h:4.5rem]">
      <section className="grain relative isolate overflow-hidden border-b border-outline/50">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-24 h-80 w-80 rounded-full bg-accent/12 blur-[110px]"
        />

        <div className="gutter relative pt-10 pb-8 lg:pt-16 lg:pb-11">
          <p className="eyebrow">Tìm kiếm</p>
          <h1 className="mt-3 text-screen font-black tracking-tight text-text-high">
            Bạn muốn xem gì?
          </h1>

          <form
            role="search"
            onSubmit={onSubmit}
            className="group mt-6 flex items-center gap-3 border-b-2 border-outline pb-3 transition-colors duration-200 ease-out-expo focus-within:border-accent lg:gap-4"
          >
            <Icon
              name="search"
              size={28}
              className="shrink-0 text-text-low transition-colors duration-200 group-focus-within:text-accent"
            />

            <label htmlFor="tu-khoa" className="sr-only">
              Từ khóa tìm phim
            </label>
            {/* `min-h-11`: `text-hero` bottoms out at 28px, but its 1.05
                line-height leaves the hit box only one line tall. */}
            <input
              id="tu-khoa"
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Tên phim…"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="tu-khoa-mo-ta"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-hero font-bold tracking-tight text-text-high caret-accent outline-none placeholder:font-normal placeholder:text-text-low/70"
            />

            {draft.length > 0 && (
              <IconButton
                icon="close"
                label="Xóa từ khóa"
                size="lg"
                onClick={onClearKeyword}
                className="shrink-0"
              />
            )}

            {/* Guarantees implicit submission and the mobile "Go" key without
                putting a redundant control next to a live-updating grid. */}
            <button type="submit" className="sr-only">
              Tìm
            </button>
          </form>

          <p id="tu-khoa-mo-ta" className="mt-3 text-xs text-text-low">
            Tìm theo tên phim hoặc tên gốc. Kết quả tự cập nhật khi bạn gõ.
          </p>
        </div>
      </section>

      {!enabled ? (
        <SuggestionPanel years={recentYears} />
      ) : (
        <>
          <FilterBar
            filters={filters}
            fixedAxis={null}
            onChange={onFiltersChange}
            totalItems={!isPending && !isError && hasResults ? resultCount : undefined}
          />

          <section
            ref={resultsRef}
            aria-label="Kết quả tìm kiếm"
            aria-busy={isFetching}
            // scroll-mt clears the header plus the sticky filter toolbar. The
            // bar wraps to three 44px rows below 392px (161px) and settles at
            // ~110px above it; the header is 64px, 72px from lg.
            className="scroll-mt-56 pt-8 pb-20 min-[24.5rem]:scroll-mt-44 lg:scroll-mt-[11.5rem] lg:pt-10"
          >
            {isPending ? (
              <div className="gutter">
                <GridSkeleton count={SKELETON_COUNT} />
              </div>
            ) : isError && !hasResults ? (
              <ErrorState error={error} onRetry={() => void refetch()} />
            ) : !hasResults ? (
              <EmptyState
                icon="search"
                title={`Không tìm thấy phim nào cho «${urlKeyword}».`}
                message={
                  filterCount > 0
                    ? 'Thử một từ khóa ngắn hơn, hoặc bỏ bớt bộ lọc đang áp dụng.'
                    : 'Thử một từ khóa ngắn hơn — chỉ vài chữ trong tên phim thường cho kết quả tốt hơn cả câu.'
                }
                action={
                  filterCount > 0 ? (
                    // The primary belongs to the way forward, not to the reset.
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <LinkButton to={routes.home} variant="primary" size="lg" icon="arrow-left">
                        Về trang chủ
                      </LinkButton>
                      <Button variant="secondary" size="lg" icon="close" onClick={clearFilters}>
                        Xóa lọc ({filterCount})
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="gutter flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="text-section font-semibold tracking-tight text-text-high">
                    <span className="tabular-nums text-text-high">{formatCount(resultCount)}</span>{' '}
                    <span className="font-normal text-text-mid">kết quả cho</span>{' '}
                    <span className="italic">«{urlKeyword}»</span>
                  </h2>

                  {isFetching && !isFetchingNextPage && (
                    <span className="text-xs text-text-low">Đang cập nhật…</span>
                  )}
                </div>

                <MovieGrid items={items} className="gutter mt-7 animate-fade-up lg:mt-9" />

                {/* Kept in the tree unconditionally so the observer always has a target. */}
                <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

                <div className="flex flex-col items-center gap-3 pt-10">
                  {isFetchingNextPage && (
                    <p
                      role="status"
                      aria-live="polite"
                      className="flex items-center gap-3 py-2 text-sm text-text-mid"
                    >
                      <span
                        aria-hidden="true"
                        className="h-5 w-5 animate-spin rounded-full border-2 border-outline border-t-accent"
                      />
                      Đang tải thêm…
                    </p>
                  )}

                  {/* A sentinel that never scrolls into view would strand the page here. */}
                  {hasNextPage && !isFetchingNextPage && (
                    <Button
                      variant="secondary"
                      size="lg"
                      iconRight="chevron-down"
                      onClick={() => void fetchNextPage()}
                    >
                      Xem thêm
                    </Button>
                  )}

                  {/* A next-page failure keeps the rows already on screen. */}
                  {isError && (
                    <p role="alert" className="max-w-md text-center text-sm text-accent-soft">
                      {toUserMessage(error)}
                    </p>
                  )}

                  {!hasNextPage && !isError && (
                    <p className="text-sm text-text-low">
                      Đã hiển thị toàn bộ {formatCount(items.length)} kết quả
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SuggestionPanel({ years }: { years: readonly number[] }) {
  return (
    <section aria-labelledby="goi-y" className="gutter pt-8 pb-24 lg:pt-10">
      {/* At 320 the page gutter already costs 32px; a 24px inner pad on top of
          it left the chips a 240px lane, so the phone step is trimmed. */}
      <div className="grain relative overflow-hidden rounded-card border border-outline/70 bg-surface-1/70 px-5 py-8 shadow-lift sm:px-10 sm:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-violet/10 blur-[90px]"
        />

        <div className="relative max-w-xl">
          <p className="eyebrow eyebrow-muted">Gợi ý</p>
          <h2
            id="goi-y"
            className="mt-3 text-section font-semibold tracking-tight text-text-high"
          >
            Nhập ít nhất {MIN_SEARCH_LENGTH} ký tự để tìm phim.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-text-mid">
            Chưa nghĩ ra tên nào? Bắt đầu từ một lối vào quen thuộc bên dưới.
          </p>
        </div>

        <ul className="relative mt-7 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion.to}>
              <ChipLink label={suggestion.label} to={suggestion.to} />
            </li>
          ))}
          {years.map((year) => (
            <li key={year}>
              <ChipLink label={`Năm ${year}`} to={routes.year(year)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
