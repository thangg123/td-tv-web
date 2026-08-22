import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { formatRating, formatVotes, humanizeLang } from '@/lib/format';

export type BadgeTone = 'neutral' | 'accent' | 'gold' | 'mint';

const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

/*
 * Deliberately square-ish rather than pill: badges are read-only labels and
 * must not be mistaken for the tappable chips used by the filter bar. The
 * blurred plate keeps them legible over an arbitrary frame of poster art.
 */
const BASE =
  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ' +
  'leading-4 tracking-widest backdrop-blur-md ring-1';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink/70 text-text-high ring-outline/70',
  accent: 'bg-accent/90 text-white ring-accent/50',
  gold: 'bg-ink/75 text-gold ring-gold/30',
  mint: 'bg-ink/75 text-mint ring-mint/30',
};

export default function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return <span className={cx(BASE, TONES[tone], className)}>{children}</span>;
}

export function RatingBadge({
  rating,
  votes,
  className,
}: {
  rating: number;
  votes?: number | null;
  className?: string;
}) {
  return (
    <Badge tone="gold" className={className}>
      <Icon name="star" size={11} />
      <span className="tabular-nums">{formatRating(rating)}</span>
      {votes != null && votes > 0 ? (
        <span className="font-normal normal-case tracking-normal text-text-low">
          {formatVotes(votes)}
        </span>
      ) : null}
    </Badge>
  );
}

export function MetaBadges({
  quality,
  lang,
  episodeCurrent,
  className,
}: {
  quality?: string | null;
  lang?: string | null;
  episodeCurrent?: string | null;
  className?: string;
}) {
  const qualityLabel = quality?.trim();
  const langLabel = lang?.trim();
  const episodeLabel = episodeCurrent?.trim();

  if (!qualityLabel && !langLabel && !episodeLabel) return null;

  return (
    <div className={cx('flex flex-wrap items-center gap-1', className)}>
      {qualityLabel ? <Badge>{qualityLabel}</Badge> : null}
      {/* Opacity rather than a second text colour: two `text-*` utilities on
          one element resolve by stylesheet order, not by attribute order. */}
      {langLabel ? (
        <Badge className="opacity-80">{humanizeLang(langLabel)}</Badge>
      ) : null}
      {episodeLabel ? <Badge tone="mint">{episodeLabel}</Badge> : null}
    </div>
  );
}
