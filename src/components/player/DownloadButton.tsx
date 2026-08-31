/**
 * Nút tải tập đang xem về máy.
 *
 * Tải chạy trong chính tab này, nên nút phải nói được ba thứ mà một nút thường
 * không cần: đang tới đâu, huỷ bằng cách nào, và hỏng thì hỏng vì sao. Vì vậy
 * nó nằm trong luồng trang chứ không nằm trên khung hình — chrome của player tự
 * ẩn sau 3 giây, mà một tiến trình 30 giây thì không được phép biến mất.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { DownloadCancelled, downloadEpisode } from '@/lib/download/hlsDownload';
import type { DownloadProgress } from '@/lib/download/hlsDownload';

interface DownloadButtonProps {
  /** Link `.m3u8` của đúng tập đang xem. */
  url: string;
  /** Tên file gợi ý, đã kèm đuôi `.ts`. */
  fileName: string;
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly progress: DownloadProgress }
  | { readonly kind: 'done' }
  | { readonly kind: 'error'; readonly message: string };

const IDLE: Status = { kind: 'idle' };

const formatSize = (bytes: number): string => `${(bytes / 1_048_576).toFixed(0)} MB`;

const percentOf = ({ done, total }: DownloadProgress): number =>
  total === 0 ? 0 : Math.round((done / total) * 100);

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'Không tải được tập này.';

export default function DownloadButton({ url, fileName }: DownloadButtonProps) {
  const [status, setStatus] = useState<Status>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  /* Rời trang giữa chừng thì huỷ luôn — không để fetch chạy mồ côi. */
  useEffect(() => () => abortRef.current?.abort(), []);

  const start = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: 'running', progress: { done: 0, total: 0, bytes: 0 } });

    try {
      await downloadEpisode(
        url,
        fileName,
        (progress) => setStatus({ kind: 'running', progress }),
        controller.signal,
      );
      setStatus({ kind: 'done' });
    } catch (error: unknown) {
      setStatus(error instanceof DownloadCancelled ? IDLE : { kind: 'error', message: messageOf(error) });
    } finally {
      abortRef.current = null;
    }
  }, [fileName, url]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  if (status.kind === 'running') {
    const { progress } = status;
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" icon="close" onClick={cancel}>
          Huỷ tải
        </Button>
        <p className="text-sm text-text-mid tabular-nums">
          {progress.total === 0
            ? 'Đang đọc danh sách…'
            : `${percentOf(progress)}% · ${formatSize(progress.bytes)}`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" icon="download" onClick={start}>
        Download
      </Button>
      {status.kind === 'done' && <p className="text-sm text-mint">Đã tải xong.</p>}
      {status.kind === 'error' && <p className="text-sm text-accent">{status.message}</p>}
    </div>
  );
}
