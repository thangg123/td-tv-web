import { useCallback, useRef, useState } from 'react';
import ContinueRail from '@/components/movie/ContinueRail';
import MovieGrid from '@/components/movie/MovieGrid';
import Button, { LinkButton } from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Icon from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/StateViews';
import { formatCount } from '@/lib/format';
import { routes } from '@/lib/routes';
import { useFavorites, useWatchProgress } from '@/lib/storage/useUserData';
import { clearProgress, removeProgress } from '@/lib/storage/userData';

/*
 * Everything on this page is read straight out of `localStorage` through
 * `useSyncExternalStore`, so there is no pending or failed state to render:
 * a blocked or corrupt store already reads back as an empty list.
 */

type Confirmation =
  | { readonly kind: 'entry'; readonly slug: string; readonly name: string }
  | { readonly kind: 'all' };

interface ConfirmationCopy {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
}

const confirmationCopy = (confirmation: Confirmation): ConfirmationCopy =>
  confirmation.kind === 'all'
    ? {
        title: 'Xóa toàn bộ lịch sử xem?',
        message:
          'Tất cả phim đang xem dở sẽ bị xóa khỏi danh sách. Phim đã lưu không bị ảnh hưởng.',
        confirmLabel: 'Xóa hết',
      }
    : {
        title: 'Xóa khỏi Xem tiếp?',
        message: `«${confirmation.name}» sẽ không còn trong danh sách xem tiếp.`,
        confirmLabel: 'Xóa',
      };

/** The dialog outlives each confirmation, so it needs copy to render while idle. */
const IDLE_COPY: ConfirmationCopy = { title: '', message: '', confirmLabel: '' };

export default function LibraryPage() {
  const progress = useWatchProgress();
  const favorites = useFavorites();

  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  /* Where focus lands when confirming unmounts the card that opened the dialog. */
  const headingRef = useRef<HTMLHeadingElement>(null);

  const requestRemove = useCallback(
    (slug: string) => {
      const entry = progress.find((item) => item.slug === slug);
      setConfirmation({ kind: 'entry', slug, name: entry?.name || 'Phim này' });
    },
    [progress],
  );

  const requestClear = useCallback(() => setConfirmation({ kind: 'all' }), []);

  const dismiss = useCallback(() => setConfirmation(null), []);

  const applyConfirmation = useCallback(() => {
    if (!confirmation) return;
    if (confirmation.kind === 'all') clearProgress();
    else removeProgress(confirmation.slug);
    setConfirmation(null);
  }, [confirmation]);

  const watching = progress.length;
  const saved = favorites.length;
  const isEmpty = watching === 0 && saved === 0;

  return (
    <>
      <div className="pb-20 lg:pb-28">
        <header className="gutter pt-9 lg:pt-14">
          <p className="eyebrow">Bộ sưu tập của bạn</p>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-screen font-black text-text-high"
            >
              Thư viện
            </h1>

            {!isEmpty && (
              <p className="pb-1 text-sm text-text-mid">
                <span className="font-semibold text-text-high">{formatCount(watching)}</span>{' '}
                đang xem
                <span aria-hidden="true" className="px-2 text-text-low">
                  ·
                </span>
                <span className="font-semibold text-text-high">{formatCount(saved)}</span> đã
                lưu
              </p>
            )}
          </div>

          <div className="mt-6 h-px bg-linear-to-r from-outline via-outline/40 to-transparent" />
        </header>

        {isEmpty ? (
          <EmptyState
            title="Thư viện đang trống"
            message="Phim bạn đang xem dở và phim đã lưu sẽ xuất hiện ở đây."
            icon="bookmark"
            action={
              <LinkButton to={routes.home} variant="primary" icon="sparkle">
                Khám phá phim
              </LinkButton>
            }
          />
        ) : (
          <>
            {/* The rail brings its own <section> and "Xem tiếp" heading. */}
            {watching > 0 && (
              <div className="mt-6 lg:mt-8">
                <ContinueRail items={progress} onRemove={requestRemove} />
                <div className="gutter mt-1">
                  <Button
                    variant="danger"
                    size="sm"
                    icon="trash"
                    onClick={requestClear}
                  >
                    Xóa toàn bộ lịch sử xem
                  </Button>
                </div>
              </div>
            )}

            <section className="mt-row-gap" aria-labelledby="thu-vien-da-luu">
              <header className="gutter flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2
                  id="thu-vien-da-luu"
                  className="text-section font-semibold text-text-high"
                >
                  Phim đã lưu
                </h2>
                {saved > 0 && (
                  <p className="text-sm text-text-low">{formatCount(saved)} phim</p>
                )}
              </header>

              <div className="gutter mt-5">
                {saved > 0 ? <MovieGrid items={favorites} /> : <SavedEmptyNote />}
              </div>
            </section>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmation !== null}
        {...(confirmation ? confirmationCopy(confirmation) : IDLE_COPY)}
        cancelLabel="Giữ lại"
        tone="danger"
        onConfirm={applyConfirmation}
        onDismiss={dismiss}
        fallbackFocusRef={headingRef}
      />
    </>
  );
}

/** Shown when there is watch history but nothing bookmarked yet. */
function SavedEmptyNote() {
  return (
    <p className="flex items-center gap-4 rounded-card border border-dashed border-outline bg-surface-1/60 px-5 py-8 text-sm text-text-mid">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-text-mid"
        aria-hidden="true"
      >
        <Icon name="bookmark" size={18} />
      </span>
      Chưa có phim nào được lưu. Nhấn biểu tượng dấu trang trên áp phích phim để cất vào đây.
    </p>
  );
}
