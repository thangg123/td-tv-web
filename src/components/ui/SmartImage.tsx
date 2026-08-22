import { useState } from 'react';
import Icon from '@/components/ui/Icon';

export type ImageAspect = 'poster' | 'wide' | 'square' | 'none';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  aspect?: ImageAspect;
  /** Hero art only — everything else stays lazy. */
  priority?: boolean;
  sizes?: string;
}

const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

const ASPECTS: Record<ImageAspect, string> = {
  poster: 'aspect-[2/3]',
  wide: 'aspect-video',
  square: 'aspect-square',
  none: '',
};

export default function SmartImage({
  src,
  alt,
  className,
  aspect = 'poster',
  priority = false,
  sizes,
}: SmartImageProps) {
  /*
   * Both states key off the URL rather than a boolean, so a `src` swap (a
   * rotating hero, a recycled rail card) resets to the loading state during
   * render — no effect, no flash of the previous poster under the new alt.
   */
  const [loadedSrc, setLoadedSrc] = useState('');
  const [failedSrc, setFailedSrc] = useState('');

  const isFailed = src.length === 0 || failedSrc === src;
  const isLoaded = !isFailed && loadedSrc === src;

  return (
    <div
      className={cx(
        'relative overflow-hidden bg-surface-2',
        ASPECTS[aspect],
        className,
      )}
    >
      {isFailed ? (
        <span className="absolute inset-0 grid place-items-center bg-surface-2 text-text-mid/60">
          <Icon name="film" size={30} />
          <span className="sr-only">{alt}</span>
        </span>
      ) : (
        <>
          {!isLoaded ? (
            <span className="skeleton absolute inset-0" aria-hidden="true" />
          ) : null}
          <img
            src={src}
            alt={alt}
            sizes={sizes}
            draggable={false}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            onLoad={() => setLoadedSrc(src)}
            onError={() => setFailedSrc(src)}
            className={cx(
              'relative h-full w-full object-cover transition-opacity duration-500 ease-out-expo',
              isLoaded ? 'opacity-100' : 'opacity-0',
            )}
          />
        </>
      )}
    </div>
  );
}
