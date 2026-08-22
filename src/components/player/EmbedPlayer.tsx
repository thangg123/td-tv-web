/**
 * Fallback player for titles whose CDN refuses a direct HLS pull.
 *
 * The embed URL arrives straight from the upstream API, so it is treated as
 * untrusted input: parsed and protocol-checked before it is ever handed to an
 * iframe, and then sandboxed down to the minimum a video page needs.
 */

import { useMemo } from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';

/*
 * No `allow-popups` and no `allow-top-navigation`: an embed host has no
 * business opening tabs or steering the page it is embedded in.
 */
const SANDBOX = 'allow-scripts allow-same-origin allow-presentation';

export interface EmbedPlayerProps {
  url: string;
  title: string;
  onExit?: () => void;
  className?: string;
}

export default function EmbedPlayer({ url, title, onExit, className }: EmbedPlayerProps) {
  const safeUrl = useMemo(() => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      if (!parsed.host) return null;
      return parsed.toString();
    } catch {
      // Relative, malformed or empty — `new URL` throws and that is the answer.
      return null;
    }
  }, [url]);

  if (!safeUrl) {
    return (
      <div
        /*
         * The message is taller than a 16:9 box at phone widths, so the panel
         * keeps a floor of its own and only follows the video ratio once the
         * ratio is the larger of the two.
         */
        className={`relative grid aspect-video min-h-72 w-full place-items-center bg-black px-5 py-8 text-center ${
          className ?? ''
        }`}
      >
        <div className="max-w-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-text-mid">
            <Icon name="external" size={24} />
          </span>
          <p className="mt-5 text-section font-semibold text-text-high">
            Liên kết dự phòng không hợp lệ.
          </p>
          <p className="mt-2 text-sm text-text-mid">
            Nguồn phát dự phòng của “{title}” không dùng được. Hãy thử một máy chủ khác.
          </p>
          {onExit && (
            <Button variant="secondary" icon="arrow-left" onClick={onExit} className="mt-6">
              Quay lại
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative aspect-video w-full overflow-hidden bg-black ${className ?? ''}`}>
      <iframe
        src={safeUrl}
        title={`Trình phát dự phòng — ${title}`}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer"
        sandbox={SANDBOX}
      />
      <p className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-outline/70 bg-ink/75 px-2.5 py-1.5 text-eyebrow uppercase text-text-mid backdrop-blur-md">
        <Icon name="external" size={12} />
        Trình phát dự phòng
      </p>
    </div>
  );
}
