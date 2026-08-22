/**
 * "Duyệt theo" — the two taxonomy index pages, `/the-loai` and `/quoc-gia`.
 *
 * Both lists arrive whole and never change within a session, so the filter box
 * is pure client-side narrowing: no request, no debounce, no spinner.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button, { IconButton } from '@/components/ui/Button';
import { ChipLink } from '@/components/ui/Chip';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import Skeleton from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import type { Taxonomy } from '@/lib/domain/models';
import { formatCount } from '@/lib/format';
import { useCategories, useCountries, useYears } from '@/lib/queries/queries';
import { routes } from '@/lib/routes';

type TaxonomyKind = 'category' | 'country';

const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

/** Stable empty identity, so the filter memo does not re-run while pending. */
const NO_ITEMS: readonly Taxonomy[] = [];

/** Every 7th tile spans two columns — the whole reason this is not a spreadsheet. */
const FEATURED_EVERY = 7;
const YEAR_COUNT = 24;

const GRID =
  'grid grid-flow-row-dense grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5';

const TILE_HEIGHT = 'min-h-[5.5rem] sm:min-h-[6.75rem]';
const FEATURED_HEIGHT = 'min-h-[7rem] sm:min-h-[8.75rem]';

interface KindConfig {
  readonly title: string;
  readonly noun: string;
  readonly icon: IconName;
  readonly placeholder: string;
  readonly hrefOf: (slug: string) => string;
}

const CONFIG: Record<TaxonomyKind, KindConfig> = {
  category: {
    title: 'Thể loại',
    noun: 'thể loại',
    icon: 'tag',
    placeholder: 'Lọc thể loại…',
    hrefOf: routes.category,
  },
  country: {
    title: 'Quốc gia',
    noun: 'quốc gia',
    icon: 'globe',
    placeholder: 'Lọc quốc gia…',
    hrefOf: routes.country,
  },
};

/**
 * Diacritic-insensitive compare.
 *
 * NFD splits the tone marks off so they can be dropped, but `đ` is a letter in
 * its own right and never decomposes — fold it by hand or "dong" would never
 * find "Đông".
 */
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd');

export default function TaxonomyIndexPage({ kind }: { kind: TaxonomyKind }) {
  /*
   * Split per kind rather than calling both hooks and picking: a country page
   * has no business fetching the genre list, and the rules of hooks forbid the
   * conditional call inside one component.
   */
  return kind === 'category' ? <CategoryIndex /> : <CountryIndex />;
}

function CategoryIndex() {
  const query = useCategories();
  return (
    <>
      <TaxonomyIndex
        kind="category"
        items={query.data}
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
      <YearBand />
    </>
  );
}

function CountryIndex() {
  const query = useCountries();
  return (
    <TaxonomyIndex
      kind="country"
      items={query.data}
      isPending={query.isPending}
      isError={query.isError}
      error={query.error}
      onRetry={() => {
        void query.refetch();
      }}
    />
  );
}

interface TaxonomyIndexProps {
  kind: TaxonomyKind;
  items: readonly Taxonomy[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

function TaxonomyIndex({ kind, items, isPending, isError, error, onRetry }: TaxonomyIndexProps) {
  const config = CONFIG[kind];
  const [term, setTerm] = useState('');

  const all = items ?? NO_ITEMS;
  const needle = fold(term.trim());
  const filtered = useMemo(
    () =>
      needle
        ? all.filter((item) => fold(item.name).includes(needle) || item.slug.includes(needle))
        : all,
    [all, needle],
  );

  const inputId = `loc-${kind}`;
  const isNarrowed = filtered.length !== all.length;
  const countLabel = isNarrowed
    ? `${formatCount(filtered.length)} / ${formatCount(all.length)} ${config.noun}`
    : `${formatCount(all.length)} ${config.noun}`;

  return (
    <>
      <header className="grain relative overflow-hidden border-b border-outline/50 bg-linear-to-b from-surface-1 to-ink pt-10 pb-8 sm:pt-14 sm:pb-10">
        <div className="gutter relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Duyệt theo</p>
            <h1 className="mt-3 text-display font-black text-text-high">{config.title}</h1>
            <p aria-live="polite" className="mt-3 min-h-5 text-sm text-text-mid">
              {isPending || isError ? null : countLabel}
            </p>
          </div>

          <div role="search" className="relative w-full sm:w-64 lg:w-72">
            <label htmlFor={inputId} className="sr-only">
              {config.placeholder}
            </label>
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-low"
            />
            <input
              id={inputId}
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={config.placeholder}
              autoComplete="off"
              spellCheck={false}
              disabled={isPending || isError}
              className="h-11 w-full rounded-pill border border-outline bg-surface-1/90 pr-11 pl-10 text-sm text-text-high transition-[border-color,background-color] duration-200 ease-out-expo placeholder:text-text-mid hover:border-outline/80 hover:bg-surface-2 focus:border-accent/60 disabled:opacity-50"
            />
            {term ? (
              <IconButton
                icon="close"
                label="Xóa bộ lọc"
                size="sm"
                onClick={() => setTerm('')}
                className="absolute top-1/2 right-1.5 -translate-y-1/2"
              />
            ) : null}
          </div>
        </div>
      </header>

      <section className="gutter pt-8 pb-16 sm:pt-10 sm:pb-20">
        {isPending ? <TileGridSkeleton /> : null}

        {!isPending && isError ? <ErrorState error={error} onRetry={onRetry} /> : null}

        {!isPending && !isError && all.length === 0 ? (
          <EmptyState
            title="Chưa có dữ liệu."
            message="Danh sách này hiện đang trống. Hãy thử lại sau."
            icon={config.icon}
            action={
              <Button variant="primary" icon="refresh" onClick={onRetry}>
                Thử lại
              </Button>
            }
          />
        ) : null}

        {!isPending && !isError && all.length > 0 && filtered.length === 0 ? (
          <EmptyState
            title={`Không tìm thấy ${config.noun} nào.`}
            message={`Không có mục nào khớp với "${term.trim()}".`}
            icon="search"
            action={
              <Button variant="secondary" icon="close" onClick={() => setTerm('')}>
                Xóa lọc (1)
              </Button>
            }
          />
        ) : null}

        {!isPending && !isError && filtered.length > 0 ? (
          <ul className={GRID}>
            {filtered.map((item, index) => (
              <TaxonomyTile
                key={item.slug}
                item={item}
                href={config.hrefOf(item.slug)}
                icon={config.icon}
                featured={index % FEATURED_EVERY === FEATURED_EVERY - 1}
              />
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}

function TaxonomyTile({
  item,
  href,
  icon,
  featured,
}: {
  item: Taxonomy;
  href: string;
  icon: IconName;
  featured: boolean;
}) {
  return (
    <li className={featured ? 'col-span-2' : undefined}>
      <Link
        to={href}
        className={cx(
          'group relative isolate flex h-full flex-col justify-between overflow-hidden rounded-card border border-outline/70 p-3.5 sm:p-4',
          featured ? cx('bg-surface-2', FEATURED_HEIGHT) : cx('bg-surface-1', TILE_HEIGHT),
          'transition-[transform,border-color,box-shadow] duration-300 ease-out-expo',
          'hover:-translate-y-1 hover:border-accent/60 hover:shadow-lift',
          'focus-visible:-translate-y-1 focus-visible:border-accent/60',
          'active:translate-y-0',
        )}
      >
        {/* The sweep: one layer sliding in from the left, transform + opacity only. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-accent/0 via-accent/15 to-accent/40 opacity-0 transition-[transform,opacity] duration-500 ease-out-expo group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-accent transition-transform duration-500 ease-out-expo group-hover:scale-x-100 group-focus-visible:scale-x-100"
        />

        {featured ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-3 -right-3 text-outline transition-[transform,color] duration-500 ease-out-expo group-hover:rotate-6 group-hover:text-accent/50"
          >
            <Icon name={icon} size={84} />
          </span>
        ) : null}

        <span className="relative z-10 block truncate text-eyebrow text-text-mid uppercase">
          {item.slug}
        </span>

        <span className="relative z-10 mt-4 flex items-end gap-1.5">
          <span
            className={cx(
              featured ? 'text-screen' : 'text-section',
              'clamp-2 font-semibold text-text-high transition-colors duration-200 group-hover:text-accent-soft',
            )}
          >
            {item.name}
          </span>
          <Icon
            name="chevron-right"
            size={16}
            className="mb-1 shrink-0 text-text-low transition-[transform,color] duration-300 ease-out-expo group-hover:translate-x-1 group-hover:text-accent"
          />
        </span>
      </Link>
    </li>
  );
}

function TileGridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: count }, (_, index) =>
        index % FEATURED_EVERY === FEATURED_EVERY - 1 ? (
          <Skeleton key={index} className="col-span-2 h-[7rem] sm:h-[8.75rem]" />
        ) : (
          <Skeleton key={index} className="h-[5.5rem] sm:h-[6.75rem]" />
        ),
      )}
    </div>
  );
}

/**
 * Only the genre page carries this band: "browse by year" is a sibling axis to
 * genre, whereas a country page's natural second axis is genre itself.
 */
function YearBand() {
  const { data, isPending, isError } = useYears();

  const years = useMemo(
    () => [...(data ?? [])].sort((a, b) => b - a).slice(0, YEAR_COUNT),
    [data],
  );

  // Secondary content: a failed year list quietly disappears rather than
  // planting an error block under a perfectly good genre grid.
  if (isError) return null;
  if (!isPending && years.length === 0) return null;

  return (
    <section
      aria-labelledby="nam-phat-hanh"
      className="gutter border-t border-outline/50 pt-10 pb-24 sm:pt-12"
    >
      <p className="eyebrow eyebrow-muted">Mốc thời gian</p>
      <h2 id="nam-phat-hanh" className="mt-2.5 text-section font-semibold text-text-high">
        Năm phát hành
      </h2>

      {isPending ? (
        <div className="mt-6 flex flex-wrap gap-2" aria-hidden="true">
          {Array.from({ length: YEAR_COUNT }, (_, index) => (
            <Skeleton key={index} className="h-8 w-16 rounded-pill" />
          ))}
        </div>
      ) : (
        <ul className="mt-6 flex flex-wrap gap-2">
          {years.map((year) => (
            <li key={year}>
              <ChipLink label={String(year)} to={routes.year(year)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
