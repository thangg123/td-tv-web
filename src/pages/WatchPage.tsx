/**
 * The player route — a port of the Android `PlayerViewModel` plus its screen.
 *
 * It owns the whole viewport: no header, no footer, no page furniture around a
 * video. Three things make it different from every other page here:
 *
 *  1. The selection (server + episode) is mirrored into the query string with
 *     `replace`, so a refresh resumes the same episode without building a
 *     back-button trail one episode deep per click.
 *  2. The resume position is read from storage exactly once per title. Reading
 *     it reactively would fight the player, which writes to the same record
 *     every five seconds.
 *  3. The embed fallback is never entered automatically — same as the Android
 *     app, where the WebView is only ever reached deliberately.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import EmbedPlayer from '@/components/player/EmbedPlayer';
import EpisodePicker from '@/components/player/EpisodePicker';
import VideoPlayer from '@/components/player/VideoPlayer';
import { MetaBadges, RatingBadge } from '@/components/ui/Badge';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Skeleton from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import { detailToCard, isFinished, landscapeOf } from '@/lib/domain/models';
import { formatCount, metaLine } from '@/lib/format';
import { useMovieDetail } from '@/lib/queries/queries';
import { routes } from '@/lib/routes';
import { MIN_SAVE_POSITION_MS, getProgressFor, saveProgress } from '@/lib/storage/userData';

const CHROME_IDLE_MS = 3_000;

const PANEL_ID = 'danh-sach-tap';

/** Matches the `lg:` breakpoint the episode panel is pinned open at. */
const DESKTOP_QUERY = '(min-width: 64rem)';

/** Two columns once there is room for the episode list beside the picture. */
const SPLIT_LAYOUT =
  'flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-6 ' +
  'xl:grid-cols-[minmax(0,1fr)_23rem]';

/** Chrome sits on moving picture, so it borrows the player's own language. */
const CHROME_BUTTON =
  'inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-ink/70 ' +
  'text-text-high backdrop-blur-md transition hover:border-accent/60 hover:bg-accent hover:text-white ' +
  'active:scale-95';

interface Selection {
  serverIndex: number;
  episodeSlug: string;
}

/** A saved position is only ever applied to the exact episode it was left in. */
interface ResumeSeed {
  serverIndex: number;
  episodeSlug: string;
  positionMs: number;
}

const readSelection = (params: URLSearchParams): Selection => {
  const server = Number.parseInt(params.get('sv') ?? '', 10);
  return {
    serverIndex: Number.isFinite(server) && server > 0 ? server : 0,
    episodeSlug: params.get('tap') ?? '',
  };
};

const readSeed = (slug: string | undefined): ResumeSeed | null => {
  if (!slug) return null;
  const saved = getProgressFor(slug);
  if (!saved || isFinished(saved) || saved.positionMs < MIN_SAVE_POSITION_MS) return null;
  return {
    serverIndex: saved.serverIndex,
    episodeSlug: saved.episodeSlug,
    positionMs: saved.positionMs,
  };
};

export default function WatchPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const detail = useMovieDetail(slug);
  const movie = detail.data;

  const [selection, setSelection] = useState<Selection>(() => readSelection(searchParams));
  const [seed, setSeed] = useState<ResumeSeed | null>(() => readSeed(slug));
  const [fatal, setFatal] = useState<string | null>(null);
  const [useEmbed, setUseEmbed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  /*
   * Back/forward between two watch URLs re-renders this component rather than
   * remounting it, so per-title state is reset here instead of relying on a
   * fresh mount. Adjusting state during render is the supported escape hatch:
   * React discards this pass and re-renders before committing anything.
   */
  const [trackedSlug, setTrackedSlug] = useState(slug);
  if (slug !== trackedSlug) {
    setTrackedSlug(slug);
    setSelection(readSelection(searchParams));
    setSeed(readSeed(slug));
    setFatal(null);
    setUseEmbed(false);
  }

  const servers = movie?.servers ?? [];
  const serverIndex = servers[selection.serverIndex] ? selection.serverIndex : 0;
  const episodes = servers[serverIndex]?.episodes ?? [];
  /* The slug is the identity that survives a refetch; the index is derived. */
  const foundIndex = episodes.findIndex((item) => item.slug === selection.episodeSlug);
  const episodeIndex = foundIndex >= 0 ? foundIndex : 0;
  const episode = episodes[episodeIndex];

  const chrome = useIdleChrome();
  const isDesktop = useIsDesktop();

  const stillImage = useMemo(() => (movie ? landscapeOf(detailToCard(movie)) : ''), [movie]);

  /* Mirror the resolved selection back into the URL so a refresh resumes it. */
  useEffect(() => {
    if (!episode) return;
    const wantServer = serverIndex > 0 ? String(serverIndex) : null;
    const wantEpisode = episode.slug || null;
    if (
      (searchParams.get('sv') ?? null) === wantServer &&
      (searchParams.get('tap') ?? null) === wantEpisode
    ) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    if (wantServer) next.set('sv', wantServer);
    else next.delete('sv');
    if (wantEpisode) next.set('tap', wantEpisode);
    else next.delete('tap');
    // `replace`: twelve episodes should not be twelve presses of the back button.
    setSearchParams(next, { replace: true });
  }, [episode, serverIndex, searchParams, setSearchParams]);

  /* A new episode starts at zero and forgets whatever went wrong on the last one. */
  const resetPlayback = useCallback(() => {
    setSeed(null);
    setFatal(null);
    setUseEmbed(false);
  }, []);

  const selectEpisode = useCallback(
    (index: number) => {
      const next = episodes[index];
      if (!next) return;
      setSelection({ serverIndex, episodeSlug: next.slug });
      resetPlayback();
    },
    [episodes, serverIndex, resetPlayback],
  );

  const selectServer = useCallback(
    (index: number) => {
      const nextEpisodes = servers[index]?.episodes ?? [];
      if (nextEpisodes.length === 0) return;
      /*
       * Stay on the same episode across a server switch: by slug when the other
       * server names it the same way, otherwise by position in the list.
       */
      const sameSlug = nextEpisodes.some((item) => item.slug === selection.episodeSlug);
      const fallback = nextEpisodes[episodeIndex] ?? nextEpisodes[0];
      setSelection({
        serverIndex: index,
        episodeSlug: sameSlug ? selection.episodeSlug : (fallback?.slug ?? ''),
      });
      resetPlayback();
    },
    [servers, selection.episodeSlug, episodeIndex, resetPlayback],
  );

  const handleProgress = useCallback(
    (positionMs: number, durationMs: number) => {
      // Below the threshold the viewer has not really started; saving it would
      // only clutter "Xem tiếp".
      if (!movie || !episode || positionMs < MIN_SAVE_POSITION_MS) return;
      saveProgress({
        slug: movie.slug,
        name: movie.name,
        image: stillImage,
        serverIndex,
        episodeSlug: episode.slug,
        episodeName: episode.name,
        positionMs,
        durationMs,
      });
    },
    [movie, episode, stillImage, serverIndex],
  );

  const handleEnded = useCallback(() => {
    if (episodeIndex + 1 < episodes.length) selectEpisode(episodeIndex + 1);
  }, [episodeIndex, episodes.length, selectEpisode]);

  const handleFatal = useCallback((message: string) => {
    setFatal(message);
    // Whatever the fix is — another server, another episode — it lives in the
    // picker, which is collapsed on small screens.
    setSheetOpen(true);
  }, []);

  const handleRetry = useCallback(() => {
    setFatal(null);
    setUseEmbed(false);
    // Re-read rather than reuse the mount-time seed: the player may have written
    // a much later position before it failed.
    setSeed(readSeed(slug));
  }, [slug]);

  const backToMain = useCallback(() => {
    setUseEmbed(false);
    setFatal(null);
  }, []);

  /* The error panel wins over every other stage, so it has to be cleared for
   * the embed to be reached at all. */
  const switchToEmbed = useCallback(() => {
    setFatal(null);
    setUseEmbed(true);
  }, []);

  const toggleSheet = useCallback(() => setSheetOpen((open) => !open), []);

  /* ── states ────────────────────────────────────────────────────────────── */

  if (!slug) {
    return (
      <WatchShell>
        <EmptyState
          title="Không tìm thấy phim nào."
          message="Liên kết này không trỏ tới phim nào cả."
          icon="film"
          action={
            <LinkButton to={routes.home} variant="primary" icon="arrow-left">
              Về trang chủ
            </LinkButton>
          }
        />
      </WatchShell>
    );
  }

  if (detail.isPending) {
    return (
      <WatchShell>
        <BackRow to={routes.detail(slug)} />
        <Skeleton className="aspect-video w-full rounded-none lg:rounded-card" />
        <div className="mt-6 space-y-3 px-gutter lg:px-0">
          <Skeleton className="h-7 w-2/3 rounded-md" />
          <Skeleton className="h-4 w-2/5 rounded-md" />
        </div>
      </WatchShell>
    );
  }

  if (detail.isError || !movie) {
    return (
      <WatchShell>
        <BackRow to={routes.detail(slug)} />
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </WatchShell>
    );
  }

  if (servers.length === 0 || !episode) {
    return (
      <WatchShell>
        <BackRow to={routes.detail(slug)} />
        <EmptyState
          title="Phim này hiện chưa có nguồn phát."
          message="Nguồn phát thường được thêm sau vài giờ. Bạn có thể xem thông tin phim trong lúc chờ."
          icon="tv"
          action={
            <LinkButton to={routes.detail(slug)} variant="primary" icon="info">
              Chi tiết phim
            </LinkButton>
          }
        />
      </WatchShell>
    );
  }

  /* ── playing ───────────────────────────────────────────────────────────── */

  const showPicker = episodes.length > 1 || servers.length > 1;
  const canEmbed = episode.embed.length > 0;
  const hasStream = episode.m3u8.length > 0;
  // Nothing for hls.js to chew on: go straight to the fallback frame.
  const showEmbed = useEmbed || (!hasStream && canEmbed);
  const serverName = servers[serverIndex]?.name ?? '';

  const startPositionMs =
    seed && seed.serverIndex === serverIndex && seed.episodeSlug === episode.slug
      ? seed.positionMs
      : 0;

  const caption = metaLine(servers.length > 1 ? serverName : null, episode.name);
  const factLine = metaLine(
    episodes.length > 1 ? episode.name : null,
    servers.length > 1 ? `Máy chủ ${serverName}` : null,
    movie.year,
    movie.time,
  );

  let stage: ReactNode;
  if (fatal) {
    stage = (
      <StagePanel title="Không phát được tập này" message={fatal} tone="accent">
        {servers.length > 1 && (
          <p className="mt-2 text-xs text-text-low">
            Bạn có thể đổi máy chủ trong danh sách tập rồi thử lại.
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Button variant="primary" icon="refresh" onClick={handleRetry}>
            Thử lại
          </Button>
          {canEmbed && (
            <Button variant="secondary" icon="external" onClick={switchToEmbed}>
              Dùng trình phát dự phòng
            </Button>
          )}
        </div>
      </StagePanel>
    );
  } else if (!hasStream && !canEmbed) {
    stage = (
      <StagePanel
        title="Tập này chưa có nguồn phát."
        message={
          servers.length > 1
            ? 'Hãy thử một máy chủ khác trong danh sách tập.'
            : 'Nguồn phát có thể được cập nhật sau.'
        }
        tone="muted"
      />
    );
  } else if (showEmbed) {
    stage = (
      <EmbedPlayer
        url={episode.embed}
        title={`${movie.name} — ${episode.name}`}
        onExit={backToMain}
      />
    );
  } else {
    stage = (
      <VideoPlayer
        src={episode.m3u8}
        poster={stillImage}
        startPositionMs={startPositionMs}
        autoPlay
        onProgress={handleProgress}
        onEnded={handleEnded}
        onFatalError={handleFatal}
      />
    );
  }

  return (
    <WatchShell>
      <div className={showPicker ? SPLIT_LAYOUT : 'flex flex-col'}>
        <div
          className="relative isolate bg-black lg:col-start-1 lg:row-start-1 lg:overflow-hidden lg:rounded-card lg:shadow-lift lg:ring-1 lg:ring-outline/60"
          onPointerMove={chrome.reveal}
          onPointerDown={chrome.reveal}
          onPointerLeave={chrome.hold}
          onFocus={chrome.hold}
        >
          {stage}

          <div
            className={`absolute inset-x-0 top-0 z-10 transition-opacity duration-300 ease-out-expo ${
              chrome.visible ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/90 via-ink/45 to-transparent"
            />
            <div className="relative flex items-start gap-3 px-3 pb-12 pt-3 sm:px-4 sm:pt-4">
              <Link
                to={routes.detail(movie.slug)}
                aria-label={`Quay lại trang chi tiết phim ${movie.name}`}
                title="Quay lại"
                className={`${CHROME_BUTTON} w-10`}
              >
                <Icon name="arrow-left" />
              </Link>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-sm font-semibold text-text-high sm:text-base">
                  {movie.name}
                </p>
                {caption.length > 0 && (
                  <p className="truncate text-xs text-text-mid">{caption}</p>
                )}
              </div>

              {showPicker && (
                <button
                  type="button"
                  onClick={toggleSheet}
                  aria-expanded={sheetOpen}
                  aria-controls={PANEL_ID}
                  className={`${CHROME_BUTTON} gap-1.5 px-3 text-xs font-medium lg:hidden`}
                >
                  <Icon name="menu" size={16} />
                  <span className="hidden sm:inline">Danh sách tập</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {showPicker && (
          <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
            <div className="mt-4 border-y border-outline/60 bg-surface-1/60 lg:mt-0 lg:rounded-card lg:border lg:bg-surface-1/70">
              <button
                type="button"
                onClick={toggleSheet}
                aria-expanded={sheetOpen}
                aria-controls={PANEL_ID}
                className="flex w-full items-center justify-between gap-3 px-gutter py-4 text-left transition-colors hover:text-text-high lg:hidden"
              >
                <span className="text-section font-semibold text-text-high">
                  Danh sách tập
                  <span className="ml-2 text-sm font-normal text-text-mid tabular-nums">
                    {formatCount(episodes.length)}
                  </span>
                </span>
                <Icon
                  name="chevron-down"
                  className={`shrink-0 text-text-mid transition-transform duration-200 ease-out-expo ${
                    sheetOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div
                id={PANEL_ID}
                className={`px-gutter pb-5 lg:block lg:px-4 lg:pb-4 lg:pt-4 ${
                  sheetOpen ? 'block' : 'hidden'
                }`}
              >
                <EpisodePicker
                  servers={servers}
                  serverIndex={serverIndex}
                  episodeIndex={episodeIndex}
                  onSelectServer={selectServer}
                  onSelectEpisode={selectEpisode}
                  variant="panel"
                  active={sheetOpen || isDesktop}
                />
              </div>
            </div>
          </aside>
        )}

        <section className="mt-6 px-gutter pb-20 lg:col-start-1 lg:row-start-2 lg:mt-7 lg:px-0">
          <p className="eyebrow">Đang xem</p>
          <h1 className="mt-2.5 text-screen font-black text-text-high">{movie.name}</h1>
          {movie.originName && movie.originName !== movie.name && (
            <p className="mt-1.5 text-sm text-text-mid">{movie.originName}</p>
          )}

          {(movie.rating != null || movie.quality || movie.lang || movie.episodeCurrent) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {movie.rating != null && (
                <RatingBadge rating={movie.rating} votes={movie.voteCount} />
              )}
              <MetaBadges
                quality={movie.quality}
                lang={movie.lang}
                episodeCurrent={movie.episodeCurrent}
              />
            </div>
          )}

          {factLine.length > 0 && <p className="mt-3.5 text-sm text-text-mid">{factLine}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <LinkButton to={routes.detail(movie.slug)} variant="secondary" icon="info">
              Chi tiết phim
            </LinkButton>
            {useEmbed && hasStream && (
              <Button variant="ghost" icon="refresh" onClick={backToMain}>
                Dùng trình phát chính
              </Button>
            )}
          </div>
        </section>
      </div>
    </WatchShell>
  );
}

/* ── chrome ──────────────────────────────────────────────────────────────── */

/**
 * The episode panel is collapsed below `lg` and pinned open above it, so
 * whether it is on screen is half CSS and half state. The picker needs the
 * answer in JS to know when it may measure itself.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

/**
 * Visibility for the bar over the picture, matched to the player's own controls:
 * it fades out three seconds after the pointer goes still over the stage, and
 * comes straight back on any movement, on a tap, or when anything inside takes
 * focus. Leaving the stage holds it visible — the player's controls are out of
 * reach there anyway, and the back button should not be.
 */
function useIdleChrome() {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const reveal = useCallback(() => {
    setVisible(true);
    clear();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setVisible(false);
    }, CHROME_IDLE_MS);
  }, [clear]);

  const hold = useCallback(() => {
    clear();
    setVisible(true);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { visible, reveal, hold };
}

/* ── pieces ──────────────────────────────────────────────────────────────── */

function WatchShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-deep">
      <main className="mx-auto w-full max-w-[112rem] lg:px-gutter lg:py-6">{children}</main>
    </div>
  );
}

/** The way out, for every state that has no player to overlay it on. */
function BackRow({ to }: { to: string }) {
  return (
    <div className="px-gutter py-4 lg:px-0 lg:pt-0">
      <LinkButton to={to} variant="ghost" size="sm" icon="arrow-left">
        Quay lại
      </LinkButton>
    </div>
  );
}

/**
 * Holds the exact box the player would have filled, so a failure does not
 * collapse the page around the episode list.
 */
function StagePanel({
  title,
  message,
  tone,
  children,
}: {
  title: string;
  message: string;
  tone: 'accent' | 'muted';
  children?: ReactNode;
}) {
  return (
    // Below sm the 16:9 box is shorter than this copy, so the panel is allowed
    // to grow instead — there is no picture behind it to letterbox anyway.
    <div className="relative grid w-full place-items-center bg-black px-5 py-12 text-center sm:aspect-video">
      <div className="max-w-md">
        <span
          className={`mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-2 ${
            tone === 'accent' ? 'text-accent' : 'text-text-mid'
          }`}
        >
          <Icon name="info" size={26} />
        </span>
        <p className="mt-5 text-section font-semibold text-text-high">{title}</p>
        <p className="mt-2 text-sm text-text-mid">{message}</p>
        {children}
      </div>
    </div>
  );
}
