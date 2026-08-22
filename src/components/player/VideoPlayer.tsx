/**
 * The HLS player.
 *
 * Safari plays `.m3u8` natively; everything else needs hls.js, which is larger
 * than the rest of the app put together and is therefore only ever reached
 * through a dynamic `import()` inside an effect — never from the entry chunk.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { formatDuration } from '@/lib/format';

const NATIVE_HLS_MIME = 'application/vnd.apple.mpegurl';
const PROGRESS_INTERVAL_MS = 5_000;
const CONTROLS_HIDE_MS = 3_000;
const SKIP_SECONDS = 10;
const VOLUME_STEP = 0.05;
/** Per source, per error class. Beyond this a fatal error is really fatal. */
const MAX_RECOVERY_ATTEMPTS = 2;

const MESSAGES = {
  unsupported: 'Trình duyệt này không phát được video HLS.',
  loaderFailed: 'Không tải được trình phát video. Vui lòng thử lại.',
  network: 'Mất kết nối tới máy chủ video.',
  media: 'Luồng video bị lỗi và không thể khôi phục.',
  unknown: 'Không phát được video này.',
} as const;

/** Keys typed into a real control belong to that control, not to the player. */
const INTERACTIVE_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);

const swallow = () => undefined;

/*
 * Vendor-prefixed fullscreen, declared rather than cast.
 *
 * iPhone Safari implements no element fullscreen at all — only the video
 * element's own `webkitEnterFullscreen`, which hands playback to the system
 * player. iPadOS and older WebViews still expose the prefixed element API.
 * A plain `HTMLVideoElement` is assignable to these, so nothing needs casting.
 */
interface FullscreenCapableVideo extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
}

interface FullscreenCapableElement extends HTMLElement {
  webkitRequestFullscreen?: () => void;
}

interface FullscreenCapableDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}

const detectFullscreenSupport = (): boolean => {
  if (typeof document === 'undefined') return false;
  const doc: FullscreenCapableDocument = document;
  const elementProto: FullscreenCapableElement = HTMLElement.prototype;
  const videoProto: FullscreenCapableVideo = HTMLVideoElement.prototype;
  if (doc.fullscreenEnabled && typeof elementProto.requestFullscreen === 'function') return true;
  if (typeof elementProto.webkitRequestFullscreen === 'function') return true;
  return typeof videoProto.webkitEnterFullscreen === 'function';
};

/*
 * iOS refuses to set `video.volume` from script and a 3px slider is a poor
 * thumb target, so a coarse pointer gets the mute toggle and nothing else.
 */
const detectFinePointer = (): boolean =>
  typeof window === 'undefined' || window.matchMedia('(pointer: fine)').matches;

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  startPositionMs?: number;
  autoPlay?: boolean;
  onProgress?: (positionMs: number, durationMs: number) => void;
  onEnded?: () => void;
  onFatalError?: (message: string) => void;
  className?: string;
}

export default function VideoPlayer({
  src,
  poster,
  startPositionMs = 0,
  autoPlay = false,
  onProgress,
  onEnded,
  onFatalError,
  className,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const usingNativeRef = useRef(false);
  /** Whether the last press on the video surface came from a finger. */
  const tapOnSurfaceRef = useRef(false);
  /** Controls state sampled at press time, before any reveal has run. */
  const controlsWereVisibleRef = useRef(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTo, setBufferedTo] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [canFullscreen] = useState(detectFullscreenSupport);
  const [hasFinePointer] = useState(detectFinePointer);

  /*
   * Volatile props live in a ref so that a parent re-render — which recreates
   * `onProgress` on every pass — cannot tear down and rebuild the hls.js
   * instance. This effect is declared first so it commits before the effects
   * below read from it.
   */
  const propsRef = useRef({ startPositionMs, autoPlay, onProgress, onEnded, onFatalError });
  useEffect(() => {
    propsRef.current = { startPositionMs, autoPlay, onProgress, onEnded, onFatalError };
  });

  const writeProgress = useCallback((video: HTMLVideoElement) => {
    const report = propsRef.current.onProgress;
    if (!report) return;
    const durationMs = video.duration * 1000;
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    report(Math.round(video.currentTime * 1000), Math.round(durationMs));
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current === null) return;
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      const video = videoRef.current;
      if (video && !video.paused && !video.ended) setControlsVisible(false);
    }, CONTROLS_HIDE_MS);
  }, [clearHideTimer]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  /* ── playback commands ─────────────────────────────────────────────────── */

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) void video.play().catch(swallow);
    else video.pause();
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const limit = Number.isFinite(video.duration) ? video.duration : seconds;
    const next = Math.min(Math.max(0, seconds), limit);
    video.currentTime = next;
    setCurrentTime(Math.floor(next));
  }, []);

  const skip = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (video) seekTo(video.currentTime + seconds);
    },
    [seekTo],
  );

  const applyVolume = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(1, Math.max(0, Number(value.toFixed(2))));
    video.volume = next;
    video.muted = next === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    // Unmuting a slider that was dragged to zero would still be silent.
    if (!video.muted && video.volume === 0) video.volume = 0.5;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container: FullscreenCapableElement | null = containerRef.current;
    const video: FullscreenCapableVideo | null = videoRef.current;
    const doc: FullscreenCapableDocument = document;

    if (doc.fullscreenElement) {
      void doc.exitFullscreen().catch(swallow);
      return;
    }
    if (doc.webkitFullscreenElement) {
      doc.webkitExitFullscreen?.();
      return;
    }
    if (!container) return;

    if (doc.fullscreenEnabled && typeof container.requestFullscreen === 'function') {
      void container.requestFullscreen().catch(() => {
        // Some WebKit builds expose the method and then reject it; the video's
        // own fullscreen is the only thing left that works there.
        video?.webkitEnterFullscreen?.();
      });
      return;
    }
    if (typeof container.webkitRequestFullscreen === 'function') {
      container.webkitRequestFullscreen();
      return;
    }
    video?.webkitEnterFullscreen?.();
  }, []);

  /* ── media element wiring ──────────────────────────────────────────────── */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const bufferedAhead = () => {
      const ranges = video.buffered;
      for (let i = 0; i < ranges.length; i += 1) {
        if (ranges.start(i) <= video.currentTime && video.currentTime <= ranges.end(i)) {
          return ranges.end(i);
        }
      }
      return 0;
    };

    /*
     * Whole seconds only. `timeupdate` fires roughly four times a second; React
     * bails out when the state value is unchanged, so rounding turns that into
     * one render per second at no cost to the readout or the seek bar.
     */
    const syncTime = () => {
      setCurrentTime(Math.floor(video.currentTime));
      setBufferedTo(bufferedAhead());
    };

    const syncDuration = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };

    const handlers: Record<string, () => void> = {
      timeupdate: syncTime,
      seeked: syncTime,
      progress: () => setBufferedTo(bufferedAhead()),
      durationchange: syncDuration,

      loadedmetadata: () => {
        syncDuration();
        const seekTarget = pendingSeekRef.current;
        pendingSeekRef.current = null;
        const total = video.duration;
        if (seekTarget !== null && seekTarget > 0 && Number.isFinite(total)) {
          // Never resume onto the closing seconds — that is a finished title.
          if (seekTarget < total * 1000 - 5_000) {
            video.currentTime = seekTarget / 1000;
            setCurrentTime(Math.floor(seekTarget / 1000));
          }
        }
        if (propsRef.current.autoPlay) void video.play().catch(swallow);
      },

      play: () => {
        setIsPlaying(true);
        scheduleHide();
      },
      playing: () => {
        setIsPlaying(true);
        setIsBuffering(false);
      },
      canplay: () => setIsBuffering(false),
      waiting: () => setIsBuffering(true),
      stalled: () => setIsBuffering(true),

      pause: () => {
        setIsPlaying(false);
        setControlsVisible(true);
        clearHideTimer();
        writeProgress(video);
      },

      ended: () => {
        setIsPlaying(false);
        setIsBuffering(false);
        setControlsVisible(true);
        clearHideTimer();
        writeProgress(video);
        propsRef.current.onEnded?.();
      },

      volumechange: () => {
        setVolume(video.volume);
        setIsMuted(video.muted);
      },

      error: () => {
        // On the MSE path hls.js owns error handling; escalating here too would
        // report the same failure twice.
        if (!usingNativeRef.current) return;
        setIsBuffering(false);
        propsRef.current.onFatalError?.(MESSAGES.unknown);
      },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      video.addEventListener(event, handler);
    }

    const intervalId = window.setInterval(() => {
      if (video.paused || video.ended) return;
      writeProgress(video);
    }, PROGRESS_INTERVAL_MS);

    /*
     * Closing the tab or having a backgrounded page discarded runs no React
     * cleanup, so everything since the last tick would be lost. `beforeunload`
     * would be the obvious hook and is deliberately not used: it is unreliable
     * on mobile and it disqualifies the page from the bfcache.
     */
    const flush = () => writeProgress(video);
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') writeProgress(video);
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flushWhenHidden);

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        video.removeEventListener(event, handler);
      }
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.clearInterval(intervalId);
    };
  }, [clearHideTimer, scheduleHide, writeProgress]);

  /* ── source loading ────────────────────────────────────────────────────── */

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let cancelled = false;
    let hls: { destroy: () => void } | null = null;

    pendingSeekRef.current = propsRef.current.startPositionMs || null;
    setIsPlaying(false);
    setIsBuffering(true);
    setControlsVisible(true);
    setCurrentTime(0);
    setDuration(0);
    setBufferedTo(0);

    /*
     * MSE first, native HLS only as the fallback — NOT the other way round.
     *
     * Chromium answers `canPlayType('application/vnd.apple.mpegurl')` with
     * "maybe", which is truthy, while being completely unable to play HLS on
     * desktop. Trusting that answer sends Chrome, Edge and every Chromium
     * browser down the native path, where the load fails and the whole watch
     * page dies — verified in a real browser, where it broke playback outright.
     *
     * So the order is: use hls.js wherever MSE exists (every desktop browser),
     * and fall back to the element's own decoder only where hls.js cannot run,
     * which in practice means Safari and iOS — the platforms whose native HLS
     * genuinely works and is hardware-accelerated anyway.
     */
    const attachNative = () => {
      usingNativeRef.current = true;
      video.src = src;
      video.load();
    };

    if (typeof MediaSource === 'undefined') {
      if (video.canPlayType(NATIVE_HLS_MIME) === '') {
        propsRef.current.onFatalError?.(MESSAGES.unsupported);
        return;
      }
      attachNative();
    } else {
      usingNativeRef.current = false;
      void (async () => {
        try {
          const { default: Hls } = await import('hls.js');
          /*
           * The chunk can land after this effect was torn down — a fast episode
           * switch does exactly that. Building an instance now would leak one
           * past its cleanup, so bail before anything is constructed. Every
           * statement below this point is synchronous, which is what makes the
           * `hls` assignment race-free.
           */
          if (cancelled) return;

          // MSE exists but hls.js still refuses it (an exotic or locked-down
          // build). The element's own decoder is the only thing left to try.
          if (!Hls.isSupported()) {
            if (video.canPlayType(NATIVE_HLS_MIME) === '') {
              propsRef.current.onFatalError?.(MESSAGES.unsupported);
              return;
            }
            attachNative();
            return;
          }

          const instance = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
          });
          hls = instance;

          let networkRetries = 0;
          let mediaRetries = 0;

          instance.on(Hls.Events.ERROR, (_event, data) => {
            // Non-fatal errors are hls.js's own business; it retries internally.
            if (!data.fatal) return;

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < MAX_RECOVERY_ATTEMPTS) {
              networkRetries += 1;
              setIsBuffering(true);
              instance.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < MAX_RECOVERY_ATTEMPTS) {
              mediaRetries += 1;
              setIsBuffering(true);
              instance.recoverMediaError();
              return;
            }

            instance.destroy();
            if (hls === instance) hls = null;
            if (cancelled) return;

            setIsBuffering(false);
            setIsPlaying(false);
            propsRef.current.onFatalError?.(
              data.type === Hls.ErrorTypes.NETWORK_ERROR
                ? MESSAGES.network
                : data.type === Hls.ErrorTypes.MEDIA_ERROR
                  ? MESSAGES.media
                  : MESSAGES.unknown,
            );
          });

          instance.attachMedia(video);
          instance.loadSource(src);
        } catch {
          if (!cancelled) propsRef.current.onFatalError?.(MESSAGES.loaderFailed);
        }
      })();
    }

    return () => {
      cancelled = true;
      /*
       * The final write has to happen before the element is emptied: after
       * `load()` the position reads 0 and would clobber real progress with it.
       * This cleanup covers both an episode switch and an unmount, so it is the
       * only place the last position is persisted.
       */
      writeProgress(video);
      if (hls) {
        hls.destroy();
        hls = null;
      }
      video.removeAttribute('src');
      video.load();
    };
  }, [src, writeProgress]);

  /* ── fullscreen + timer teardown ───────────────────────────────────────── */

  useEffect(() => {
    const video = videoRef.current;
    const doc: FullscreenCapableDocument = document;

    const sync = () => {
      const active = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsFullscreen(active === containerRef.current);
    };
    // iOS hands the video to the system player, which fires only these two.
    const enterNative = () => setIsFullscreen(true);
    const exitNative = () => setIsFullscreen(false);

    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    video?.addEventListener('webkitbeginfullscreen', enterNative);
    video?.addEventListener('webkitendfullscreen', exitNative);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      video?.removeEventListener('webkitbeginfullscreen', enterNative);
      video?.removeEventListener('webkitendfullscreen', exitNative);
    };
  }, []);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  /* ── keyboard ──────────────────────────────────────────────────────────── */

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target !== event.currentTarget && INTERACTIVE_TAGS.has(target.tagName)) return;

    switch (event.key) {
      case ' ':
      case 'k':
      case 'K':
        togglePlay();
        break;
      case 'ArrowLeft':
        skip(-SKIP_SECONDS);
        break;
      case 'ArrowRight':
        skip(SKIP_SECONDS);
        break;
      case 'ArrowUp':
        applyVolume((videoRef.current?.volume ?? 0) + VOLUME_STEP);
        break;
      case 'ArrowDown':
        applyVolume((videoRef.current?.volume ?? 0) - VOLUME_STEP);
        break;
      case 'm':
      case 'M':
        toggleMute();
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      default:
        return;
    }
    // Space would scroll the page and the arrows would move the scroll position.
    event.preventDefault();
    revealControls();
  };

  /* ── pointer ───────────────────────────────────────────────────────────── */

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A finger sliding over the picture is not hover. Treating it as such would
    // keep the bar permanently open and leave the tap below nothing to close.
    if (event.pointerType === 'touch') return;
    revealControls();
  };

  const handleSurfacePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const byTouch = event.pointerType !== 'mouse';
    tapOnSurfaceRef.current = byTouch;
    if (!byTouch) return;
    /*
     * Sampled here because the container's own reveal runs on the way up the
     * tree, before the click: without this the bar would already be "visible"
     * by the time the tap is resolved and could never be toggled shut.
     */
    controlsWereVisibleRef.current = controlsVisible;
    event.stopPropagation();
  };

  const handleSurfaceClick = () => {
    if (!tapOnSurfaceRef.current) {
      togglePlay();
      return;
    }
    // A tap on hidden controls only brings them back — it must not also reach
    // whatever sat under the finger.
    if (!controlsWereVisibleRef.current) {
      revealControls();
      return;
    }
    clearHideTimer();
    setControlsVisible(false);
  };

  const shownVolume = isMuted ? 0 : volume;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="group"
      aria-label="Trình phát video"
      onKeyDown={handleKeyDown}
      onPointerMove={handlePointerMove}
      onPointerDown={revealControls}
      onFocus={revealControls}
      className={`group/player relative isolate aspect-video w-full select-none overflow-hidden bg-black ${
        controlsVisible ? '' : 'cursor-none'
      } ${className ?? ''}`}
    >
      <video
        ref={videoRef}
        poster={poster || undefined}
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full bg-black object-contain"
      />

      {/*
        Pointer-only surface; keyboard users have Space and the toolbar. A mouse
        click plays, a tap toggles the control bar — see `handleSurfaceClick`.
      */}
      <button
        type="button"
        tabIndex={-1}
        onPointerDown={handleSurfacePointerDown}
        onClick={handleSurfaceClick}
        onDoubleClick={toggleFullscreen}
        aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
        className="absolute inset-0 z-10"
      />

      {/*
        The badge is its own target so that a tap on it starts playback instead
        of being eaten by the surface's show/hide toggle.
      */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        className={`absolute left-1/2 top-1/2 z-10 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-ink/70 text-text-high shadow-lift backdrop-blur-sm transition duration-300 ease-out-back sm:h-20 sm:w-20 ${
          isPlaying || isBuffering ? 'pointer-events-none scale-75 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <Icon name="play" size={30} className="translate-x-0.5" />
      </button>

      {isBuffering && (
        <span
          role="status"
          aria-label="Đang tải"
          className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
        >
          <span className="h-11 w-11 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
        </span>
      )}

      <div
        /*
         * Inline because it has to beat the padding utilities below, and only
         * while fullscreen: in page flow the bar is nowhere near a screen edge.
         */
        style={
          isFullscreen
            ? {
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
                paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
                paddingRight: 'max(1.25rem, env(safe-area-inset-right))',
              }
            : undefined
        }
        className={`scrim-bottom absolute inset-x-0 bottom-0 z-20 px-3 pb-3 pt-12 transition duration-300 ease-out-expo sm:px-5 sm:pb-4 sm:pt-16 ${
          controlsVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <SeekBar
          value={Math.min(currentTime, duration)}
          max={duration}
          buffered={bufferedTo}
          onSeek={seekTo}
        />

        {/*
          The readout moves out of the button row on a phone: five 44px targets
          plus a clock do not fit across 320px, and the targets win.
        */}
        <div className="flex items-center justify-between text-xs tabular-nums sm:hidden">
          <span className="text-text-high">{formatDuration(currentTime * 1000)}</span>
          <span className="text-text-mid">{formatDuration(duration * 1000)}</span>
        </div>

        <div className="mt-1.5 flex items-center gap-1 sm:mt-2 sm:gap-1.5">
          <ControlButton
            icon={isPlaying ? 'pause' : 'play'}
            label={isPlaying ? 'Tạm dừng' : 'Phát'}
            size={22}
            onClick={togglePlay}
            className="bg-white/10 hover:bg-accent hover:text-white"
          />
          <ControlButton icon="skip-back" label="Lùi 10 giây" onClick={() => skip(-SKIP_SECONDS)} />
          <ControlButton
            icon="skip-forward"
            label="Tiến 10 giây"
            onClick={() => skip(SKIP_SECONDS)}
          />

          <div className="flex items-center gap-1.5 sm:ml-1">
            <ControlButton
              icon={isMuted || volume === 0 ? 'volume-off' : 'volume'}
              label={isMuted || volume === 0 ? 'Bật tiếng' : 'Tắt tiếng'}
              onClick={toggleMute}
            />
            {hasFinePointer && <VolumeBar value={shownVolume} onChange={applyVolume} />}
          </div>

          <p className="ml-auto hidden pl-2 text-sm tabular-nums sm:block">
            <span className="text-text-high">{formatDuration(currentTime * 1000)}</span>
            <span className="text-text-low"> / {formatDuration(duration * 1000)}</span>
          </p>

          {canFullscreen && (
            <ControlButton
              icon={isFullscreen ? 'shrink' : 'expand'}
              label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              onClick={toggleFullscreen}
              className="ml-auto sm:ml-1"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── controls ────────────────────────────────────────────────────────────── */

/*
 * Player controls sit on top of moving picture, not on a surface, so they get
 * their own translucent-white language instead of the shared `IconButton`.
 */
function ControlButton({
  icon,
  label,
  onClick,
  size = 19,
  className,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  size?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-high/90 transition hover:bg-white/15 hover:text-white active:scale-90 ${
        className ?? ''
      }`}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/*
 * A transparent native range stacked over the painted track: the browser keeps
 * dragging, click-to-jump and arrow-key stepping, and the visuals stay ours.
 *
 * The row is a 44px hit box on a phone while the painted track stays 3px — a
 * thumb cannot reliably grab a 3px line, and fattening the line to match would
 * turn the seek bar into the loudest thing on the picture.
 */
function SeekBar({
  value,
  max,
  buffered,
  onSeek,
}: {
  value: number;
  max: number;
  buffered: number;
  onSeek: (seconds: number) => void;
}) {
  const ready = max > 0;
  const playedPercent = ready ? Math.min(100, (value / max) * 100) : 0;
  const bufferedPercent = ready ? Math.min(100, (buffered / max) * 100) : 0;

  return (
    <div className="group/seek relative flex h-11 items-center sm:h-6">
      <input
        type="range"
        min={0}
        max={ready ? Math.floor(max) : 1}
        step={1}
        value={ready ? Math.floor(value) : 0}
        disabled={!ready}
        onChange={(event) => onSeek(Number(event.currentTarget.value))}
        aria-label="Tua phim"
        aria-valuetext={`${formatDuration(value * 1000)} trên ${formatDuration(max * 1000)}`}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-default"
      />
      <div className="pointer-events-none relative h-[3px] w-full rounded-pill bg-white/20 transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-4 peer-focus-visible:ring-offset-black">
        <span
          className="absolute inset-y-0 left-0 rounded-pill bg-white/25"
          style={{ width: `${bufferedPercent}%` }}
        />
        <span
          className="absolute inset-y-0 left-0 rounded-pill bg-accent"
          style={{ width: `${playedPercent}%` }}
        />
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-glow transition group-hover/seek:scale-150 peer-focus-visible:scale-150 sm:h-2.5 sm:w-2.5"
          style={{ left: `${playedPercent}%` }}
        />
      </div>
    </div>
  );
}

function VolumeBar({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="relative hidden h-5 w-16 items-center md:flex lg:w-20">
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        aria-label="Âm lượng"
        aria-valuetext={`${Math.round(value * 100)} phần trăm`}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      />
      <div className="pointer-events-none h-[3px] w-full overflow-hidden rounded-pill bg-white/20 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-4 peer-focus-visible:ring-offset-black">
        <span className="block h-full rounded-pill bg-text-high" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
