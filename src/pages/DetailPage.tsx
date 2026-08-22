/**
 * One title: art, credits, and every way into the player.
 *
 * The detail query is the only one that may fail the page. Cast and backdrop
 * are enrichments that 404 for most of the catalogue, so they are read with
 * `?? fallback` and never gate a render.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useNavigationType, useParams } from 'react-router-dom';
import CastRail from '@/components/movie/CastRail';
import EpisodePicker from '@/components/player/EpisodePicker';
import Badge, { MetaBadges, RatingBadge } from '@/components/ui/Badge';
import Button, { LinkButton } from '@/components/ui/Button';
import { ChipLink } from '@/components/ui/Chip';
import Icon from '@/components/ui/Icon';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import SmartImage from '@/components/ui/SmartImage';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import { MovieLists, listTitle } from '@/lib/domain/catalog';
import { detailToCard, isPlayable, isSeries, progressPercent } from '@/lib/domain/models';
import type { WatchProgress } from '@/lib/domain/models';
import { formatDuration, metaLine } from '@/lib/format';
import { useMovieBackdrop, useMovieCast, useMovieDetail } from '@/lib/queries/queries';
import { routes } from '@/lib/routes';
import { useFavorite, useProgressFor } from '@/lib/storage/useUserData';

/** `movie.type` is the API's own vocabulary; these are the lists it maps onto. */
const TYPE_LIST_SLUG: Record<string, string> = {
  single: MovieLists.SINGLE,
  series: MovieLists.SERIES,
  hoathinh: MovieLists.ANIME,
  tvshows: MovieLists.TV_SHOWS,
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Hoàn tất',
  ongoing: 'Đang chiếu',
  trailer: 'Sắp chiếu',
  canceled: 'Đã hủy',
};

/** The API sends either a bare count ("12") or an already-worded one ("12 tập"). */
const episodeTotalLabel = (total: string | null): string | null => {
  const value = total?.trim();
  if (!value) return null;
  return /^\d+$/.test(value) ? `${value} tập` : value;
};

/**
 * Trailer URLs come straight off the wire and land in an `href`, so anything
 * that is not plain http(s) is dropped rather than handed to the browser.
 */
const safeHttpUrl = (raw: string | null): string | null => {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

/* ── pieces ──────────────────────────────────────────────────────────────── */

/**
 * The TMDB still resolves after the detail payload, so the thumb paints first
 * and the better art fades in over it on load — a plain `src` swap would pop a
 * half-decoded frame into the middle of the page.
 */
function BackdropArt({ base, enhanced }: { base: string; enhanced: string }) {
  const [loadedSrc, setLoadedSrc] = useState('');
  const hasEnhanced = enhanced.length > 0 && enhanced !== base;

  return (
    <>
      {base.length > 0 ? (
        <img
          src={base}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover object-[50%_22%]"
        />
      ) : null}
      {hasEnhanced ? (
        <img
          src={enhanced}
          alt=""
          // A progressive enhancement over art that is already painting: racing
          // it against the base image only pushes the LCP out.
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoadedSrc(enhanced)}
          className={`absolute inset-0 h-full w-full object-cover object-[50%_22%] transition-opacity duration-700 ease-out-expo ${
            loadedSrc === enhanced ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}
    </>
  );
}

function CreditRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      {/* text-mid, not the muted eyebrow: this one sits on a raised surface. */}
      <dt className="eyebrow text-text-mid">{label}</dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-text-mid">{value}</dd>
    </div>
  );
}

function ResumeBar({ progress }: { progress: WatchProgress }) {
  const percent = Math.round(progressPercent(progress) * 100);

  return (
    <div className="mt-6 w-full max-w-sm">
      <div
        role="progressbar"
        aria-label={`Đã xem ${percent}%`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 overflow-hidden rounded-pill bg-surface-3"
      >
        <div className="h-full rounded-pill bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs tabular-nums text-text-low">
        Đã xem {formatDuration(progress.positionMs)} / {formatDuration(progress.durationMs)}
      </p>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */

export default function DetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  const detailQuery = useMovieDetail(slug);
  const castQuery = useMovieCast(slug);
  const backdropQuery = useMovieBackdrop(slug);
  const progress = useProgressFor(slug);

  const movie = detailQuery.data;
  const card = useMemo(() => (movie ? detailToCard(movie) : null), [movie]);
  const [isFavorite, toggleFavorite] = useFavorite(card);

  /*
   * The chosen server is stored with the slug it was chosen for, so navigating
   * from one title to another falls back to that title's own default instead of
   * pointing at a server index the new one may not have.
   */
  const [picked, setPicked] = useState<{ slug: string; index: number } | null>(null);

  const description = movie?.description ?? '';
  const descriptionRef = useRef<HTMLParagraphElement | null>(null);
  const [isExpanded, setExpanded] = useState(false);
  const [isClamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const element = descriptionRef.current;
    // Expanded, the paragraph is exactly as tall as its content, so measuring it
    // would always report "fits" and hide the collapse control.
    if (!element || isExpanded) return;

    const measure = () => setClamped(element.scrollHeight - element.clientHeight > 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isExpanded, description]);

  const lastSlug = useRef<string | null>(null);
  useEffect(() => {
    const current = slug ?? '';
    if (lastSlug.current === current) return;
    const isFirstRender = lastSlug.current === null;
    lastSlug.current = current;
    // Back/forward restores its own offset; the first render is already at rest.
    if (isFirstRender || navigationType === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [slug, navigationType]);

  if (!slug) {
    return (
      <EmptyState
        title="Không tìm thấy phim nào."
        message="Liên kết này không trỏ tới một bộ phim hợp lệ."
        action={
          <LinkButton to={routes.home} variant="primary" icon="arrow-left">
            Về trang chủ
          </LinkButton>
        }
      />
    );
  }

  if (detailQuery.isPending) return <DetailSkeleton />;

  if (detailQuery.isError) {
    return <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />;
  }

  if (!movie || !card) {
    return (
      <EmptyState
        title="Không tìm thấy phim nào."
        message="Phim này có thể đã bị gỡ khỏi thư viện."
        action={
          <LinkButton to={routes.home} variant="primary" icon="arrow-left">
            Về trang chủ
          </LinkButton>
        }
      />
    );
  }

  const servers = movie.servers;
  const series = isSeries(movie);

  const defaultServerIndex = progress && servers[progress.serverIndex] ? progress.serverIndex : 0;
  const serverIndex = picked && picked.slug === slug && servers[picked.index] ? picked.index : defaultServerIndex;
  const episodes = servers[serverIndex]?.episodes ?? [];

  const resumeEpisodeIndex =
    progress && serverIndex === progress.serverIndex
      ? episodes.findIndex((episode) => episode.slug === progress.episodeSlug)
      : -1;

  const hasSource = servers.some((server) => server.episodes.some(isPlayable));
  /*
   * Built from the resolved server rather than from `progress` directly: the
   * upstream reorders servers, and after a chip is tapped the CTA has to open
   * the same source the grid below it is showing.
   */
  const resumeEpisode = resumeEpisodeIndex >= 0 ? episodes[resumeEpisodeIndex] : episodes[0];
  const watchHref = routes.watch(slug, serverIndex, resumeEpisode?.slug ?? '');
  const canResume = progress !== null && resumeEpisodeIndex >= 0;

  const backdropUrl = backdropQuery.data ?? '';
  const listSlug = movie.type ? TYPE_LIST_SLUG[movie.type] : undefined;
  const trailerHref = safeHttpUrl(movie.trailerUrl);
  const cast = castQuery.data ?? [];

  const statusLabel = movie.status ? (STATUS_LABELS[movie.status] ?? movie.status) : null;
  // "Hoàn tất (12/12)" already carries the status, so the badge would repeat it.
  const showStatus =
    statusLabel !== null &&
    !(movie.episodeCurrent ?? '').toLowerCase().includes(statusLabel.toLowerCase());

  const directors = movie.directors.map((name) => name.trim()).filter(Boolean);
  const actors = movie.actors.map((name) => name.trim()).filter(Boolean);
  const hasCredits = directors.length > 0 || actors.length > 0;

  const showPicker = servers.length > 1 || episodes.length > 1;

  const handleSelectEpisode = (index: number) => {
    const episode = episodes[index];
    if (!episode) return;
    navigate(routes.watch(slug, serverIndex, episode.slug));
  };

  return (
    <article className="pb-20">
      {/*
        The poster and title live INSIDE the backdrop band, bottom-aligned,
        rather than in a sibling pulled up by a negative margin.
        That margin was a fixed pixel count subtracted from a `vh` height, so
        the overlap only looked right at one window height — on a short laptop
        the poster tucked under the header, on a tall monitor it left a dead
        strip of scrimmed art below it. Anchoring to the bottom of the band
        makes the gap identical at every size, and `pt` is what guarantees the
        content always clears the translucent header.
      */}
      <section className="relative isolate">
        {/* The art starts above the section so it runs under the translucent
            header; the bleed needs its own clipping box to do that. */}
        <div
          aria-hidden="true"
          className="grain absolute inset-x-0 -top-20 bottom-0 overflow-hidden bg-ink-deep"
        >
          <BackdropArt base={movie.thumbUrl || movie.posterUrl} enhanced={backdropUrl} />
          <div className="hero-scrim absolute inset-0" />
        </div>

        {/*
          No `min-h`: the band is exactly as tall as its content plus `pt`, so
          the padding IS the gap under the header and nothing else can open one.
          A min-height would add slack above the block the moment the content
          came in shorter than it, which is the empty strip this replaced.

          `main` begins BELOW the sticky header — a sticky box still occupies
          its space — so this padding is measured from there and is the whole
          gap, not a gap minus the header. That is why it is 48px and not 96.
        */}
        <div className="gutter relative z-10 flex flex-col items-center justify-end gap-6 pt-8 pb-6 md:flex-row md:items-end md:gap-8 md:pt-12 md:pb-8">
        <SmartImage
          src={movie.posterUrl || movie.thumbUrl}
          alt={movie.name}
          aspect="poster"
          sizes="(min-width: 768px) 224px, 176px"
          className="w-44 flex-none rounded-card shadow-lift ring-1 ring-outline md:w-56"
        />

        <div className="min-w-0 flex-1 text-center md:pb-3 md:text-left">
          {listSlug ? (
            <Link
              to={routes.list(listSlug)}
              className="eyebrow transition-colors duration-200 hover:text-accent"
            >
              {listTitle(listSlug)}
            </Link>
          ) : null}

          <h1 className="mt-3 text-balance text-hero font-black text-text-high">{movie.name}</h1>

          {movie.originName && movie.originName !== movie.name ? (
            <p className="mt-2 text-base text-text-mid">{movie.originName}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            {movie.rating !== null ? (
              <RatingBadge rating={movie.rating} votes={movie.voteCount} />
            ) : null}
            <MetaBadges
              quality={movie.quality}
              lang={movie.lang}
              episodeCurrent={movie.episodeCurrent}
            />
            {showStatus ? (
              <Badge tone={movie.status === 'completed' ? 'mint' : 'neutral'}>{statusLabel}</Badge>
            ) : null}
          </div>

          {(() => {
            // "1 tập" on a feature film is noise; the count only informs a series.
            const total = series ? episodeTotalLabel(movie.episodeTotal) : null;
            const line = metaLine(movie.year, movie.time, total);
            return line ? <p className="mt-3 text-sm text-text-mid">{line}</p> : null;
          })()}
          </div>
        </div>
      </section>

      <div className="gutter mt-8 flex flex-col items-center md:items-start">
        <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
          {hasSource ? (
            <LinkButton to={watchHref} variant="primary" size="lg" icon="play">
              <span className="truncate">
                {canResume && progress ? `Xem tiếp · ${progress.episodeName}` : 'Xem ngay'}
              </span>
            </LinkButton>
          ) : (
            <Button variant="primary" size="lg" icon="play" disabled>
              Chưa có nguồn phát
            </Button>
          )}

          <Button
            variant="secondary"
            size="lg"
            onClick={toggleFavorite}
            aria-pressed={isFavorite}
            title={isFavorite ? 'Bỏ khỏi thư viện' : 'Lưu vào thư viện'}
          >
            <Icon
              name={isFavorite ? 'bookmark-filled' : 'bookmark'}
              size={20}
              className={isFavorite ? 'text-mint' : undefined}
            />
            {isFavorite ? 'Đã lưu' : 'Lưu'}
          </Button>

          {trailerHref ? (
            <LinkButton
              to={trailerHref}
              variant="secondary"
              size="lg"
              icon="external"
              target="_blank"
              rel="noreferrer noopener"
            >
              Trailer
            </LinkButton>
          ) : null}
        </div>

        {progress ? <ResumeBar progress={progress} /> : null}
      </div>

      {movie.categories.length > 0 || movie.countries.length > 0 || movie.year !== null ? (
        <nav
          aria-label="Thể loại và quốc gia"
          className="gutter mt-8 flex flex-wrap justify-center gap-2 md:justify-start"
        >
          {movie.categories.map((category) => (
            <ChipLink
              key={`the-loai-${category.slug}`}
              label={category.name}
              to={routes.category(category.slug)}
            />
          ))}
          {movie.countries.map((country) => (
            <ChipLink
              key={`quoc-gia-${country.slug}`}
              label={country.name}
              to={routes.country(country.slug)}
            />
          ))}
          {movie.year !== null ? (
            <ChipLink label={String(movie.year)} to={routes.year(movie.year)} />
          ) : null}
        </nav>
      ) : null}

      {/*
        Episodes come before the synopsis on purpose. Someone opening a title
        they already watch is here to press a number, not to read the plot
        again — burying the grid under three paragraphs and a cast rail made the
        one action they came for the last thing on the page.
      */}
      {showPicker ? (
        <section aria-labelledby="tap-phim" className="gutter mt-row-gap">
          <h2 id="tap-phim" className="text-section font-semibold text-text-high">
            {series ? 'Tập phim' : 'Nguồn phát'}
          </h2>
          <div className="mt-5 w-fit min-w-[min(100%,20rem)] max-w-full rounded-card border border-outline/60 bg-surface-1/60 p-4 sm:p-6">
            <EpisodePicker
              servers={servers}
              serverIndex={serverIndex}
              episodeIndex={resumeEpisodeIndex}
              onSelectServer={(index) => setPicked({ slug, index })}
              onSelectEpisode={handleSelectEpisode}
              variant="page"
            />
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="noi-dung-phim"
        className="gutter mt-row-gap lg:flex lg:items-start lg:gap-14"
      >
        <div className="max-w-3xl lg:flex-1">
          <h2 id="noi-dung-phim" className="eyebrow eyebrow-muted">
            Nội dung
          </h2>

          {description ? (
            <>
              <p
                ref={descriptionRef}
                id="mo-ta-phim"
                className={`mt-4 text-base leading-relaxed text-text-mid ${
                  isExpanded ? '' : 'clamp-3'
                }`}
              >
                {description}
              </p>
              {isClamped ? (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  aria-expanded={isExpanded}
                  aria-controls="mo-ta-phim"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent transition-colors duration-200 hover:text-accent-soft"
                >
                  {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                  <Icon
                    name="chevron-down"
                    size={16}
                    className={`transition-transform duration-300 ease-out-expo ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              ) : null}
            </>
          ) : (
            <p className="mt-4 text-base text-text-low">Chưa có mô tả cho phim này.</p>
          )}
        </div>

        {hasCredits ? (
          <aside className="mt-10 lg:mt-0 lg:w-72 lg:flex-none">
            <div className="rounded-card border border-outline/60 bg-surface-1/70 p-5">
              <dl className="space-y-5">
                <CreditRow label="Đạo diễn" value={directors.join(', ')} />
                <CreditRow label="Diễn viên" value={actors.join(', ')} />
              </dl>
            </div>
          </aside>
        ) : null}
      </section>

      {cast.length > 0 ? (
        <section aria-labelledby="dan-dien-vien" className="mt-row-gap">
          <h2 id="dan-dien-vien" className="gutter text-section font-semibold text-text-high">
            Dàn diễn viên
          </h2>
          <CastRail cast={cast} />
        </section>
      ) : null}

    </article>
  );
}
