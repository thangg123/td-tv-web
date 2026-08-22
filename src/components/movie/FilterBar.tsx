import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { toUserMessage } from '@/lib/api/client';
import type { CatalogFilters, FilterAxis } from '@/lib/domain/catalog';
import {
  activeFilterCount,
  languageOptions,
  languageTitle,
  sortKeyOf,
  sortOptions,
} from '@/lib/domain/catalog';
import { formatCount } from '@/lib/format';
import { useCategories, useCountries, useYears } from '@/lib/queries/queries';

interface FilterBarProps {
  filters: CatalogFilters;
  fixedAxis: FilterAxis | null;
  onChange: (next: CatalogFilters) => void;
  totalItems?: number;
}

interface FilterOption {
  readonly value: string;
  readonly label: string;
}

type OptionStatus = 'pending' | 'error' | 'ready';

/** Panel box in px, measured against the viewport each time it opens. */
interface PanelPlacement {
  /** Horizontal offset from the trigger's own left edge, already clamped. */
  readonly left: number;
  readonly width: number;
  readonly maxHeight: number;
}

/** Keep the panel and the placement maths agreeing on one set of numbers. */
const PANEL_WIDTH_PX = 240;
const EDGE_GAP_PX = 16;
/** Matches the `top-[calc(100%+0.5rem)]` the panel is offset by. */
const PANEL_GAP_PX = 8;
/** Below this the panel is uselessly short; better to overhang than to clip. */
const PANEL_MIN_HEIGHT_PX = 200;
const PANEL_MAX_HEIGHT_PX = 320;

/*
 * 44px tall on a phone, back to the compact desktop pill from `md`. The label
 * truncates harder on narrow screens so a long selected value cannot stretch a
 * trigger across the whole row and push the rest of the axes down another line.
 */
const TRIGGER_BASE =
  'inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3 py-2 text-sm font-medium ' +
  'md:min-h-0 md:py-1.5 md:text-xs ' +
  'transition duration-200 active:scale-[0.97]';

export default function FilterBar({
  filters,
  fixedAxis,
  onChange,
  totalItems,
}: FilterBarProps) {
  const categories = useCategories();
  const countries = useCountries();
  const years = useYears();

  const categoryOptions = useMemo<readonly FilterOption[]>(
    () => (categories.data ?? []).map((item) => ({ value: item.slug, label: item.name })),
    [categories.data],
  );
  const countryOptions = useMemo<readonly FilterOption[]>(
    () => (countries.data ?? []).map((item) => ({ value: item.slug, label: item.name })),
    [countries.data],
  );
  const yearOptions = useMemo<readonly FilterOption[]>(
    () => (years.data ?? []).map((year) => ({ value: String(year), label: String(year) })),
    [years.data],
  );
  const langOptions = useMemo<readonly FilterOption[]>(
    () => languageOptions.map((option) => ({ value: option.slug, label: option.label })),
    [],
  );
  const sortChoices = useMemo<readonly FilterOption[]>(
    () => sortOptions.map((option) => ({ value: option.key, label: option.label })),
    [],
  );

  const clearedCount = activeFilterCount(filters);
  const sortKey = sortKeyOf(filters);
  const currentSort = sortOptions.find((option) => option.key === sortKey);

  const labelFor = (options: readonly FilterOption[], value: string | null, fallback: string) =>
    (value === null ? undefined : options.find((option) => option.value === value)?.label) ??
    (value ?? fallback);

  const onSelectSort = (key: string | null) => {
    const option = sortOptions.find((entry) => entry.key === key);
    if (!option) return;
    onChange({ ...filters, sortField: option.field, sortType: option.type });
  };

  /*
   * "Xóa lọc" clears exactly what `activeFilterCount` counts — the sort is a
   * presentation choice, not a filter, so it survives the reset.
   */
  const onClear = () =>
    onChange({ ...filters, category: null, country: null, year: null, sortLang: null });

  return (
    <section
      aria-label="Bộ lọc"
      className="sticky top-[var(--header-h,4rem)] z-30 border-b border-outline/60 bg-ink/85 backdrop-blur-xl"
    >
      {/*
        Wrapped, never a sideways-scrolling row: the panels are absolutely
        positioned against their trigger, and an `overflow-x` ancestor would
        clip them on both axes. Five axes cost three lines at 320 and two from
        390 up — tall, but every trigger stays reachable without a swipe.
      */}
      <div className="gutter flex flex-wrap items-center gap-1.5 py-2 sm:gap-2 sm:py-3">
        {fixedAxis !== 'category' && (
          <FilterDropdown
            axisLabel="Thể loại"
            icon="tag"
            options={categoryOptions}
            value={filters.category}
            triggerLabel={labelFor(categoryOptions, filters.category, 'Thể loại')}
            status={statusOf(categories)}
            errorMessage={categories.isError ? toUserMessage(categories.error) : undefined}
            onSelect={(value) => onChange({ ...filters, category: value })}
          />
        )}

        {fixedAxis !== 'country' && (
          <FilterDropdown
            axisLabel="Quốc gia"
            icon="globe"
            options={countryOptions}
            value={filters.country}
            triggerLabel={labelFor(countryOptions, filters.country, 'Quốc gia')}
            status={statusOf(countries)}
            errorMessage={countries.isError ? toUserMessage(countries.error) : undefined}
            onSelect={(value) => onChange({ ...filters, country: value })}
          />
        )}

        {fixedAxis !== 'year' && (
          <FilterDropdown
            axisLabel="Năm"
            icon="calendar"
            options={yearOptions}
            value={filters.year}
            triggerLabel={filters.year ?? 'Năm'}
            status={statusOf(years)}
            errorMessage={years.isError ? toUserMessage(years.error) : undefined}
            onSelect={(value) => onChange({ ...filters, year: value })}
          />
        )}

        {fixedAxis !== 'language' && (
          <FilterDropdown
            axisLabel="Ngôn ngữ"
            icon="volume"
            options={langOptions}
            value={filters.sortLang}
            triggerLabel={filters.sortLang ? languageTitle(filters.sortLang) : 'Ngôn ngữ'}
            status="ready"
            onSelect={(value) => onChange({ ...filters, sortLang: value })}
          />
        )}

        {fixedAxis !== 'sort' && (
          <FilterDropdown
            axisLabel="Sắp xếp"
            icon="settings"
            options={sortChoices}
            value={sortKey}
            // The sort always has a value; only a non-default one earns the accent.
            isActive={sortKey !== 'recent'}
            resettable={false}
            triggerLabel={currentSort?.label ?? 'Sắp xếp'}
            status="ready"
            onSelect={onSelectSort}
          />
        )}

        {clearedCount > 0 && (
          <Button variant="secondary" size="sm" icon="close" onClick={onClear}>
            Xóa lọc ({clearedCount})
          </Button>
        )}

        {totalItems !== undefined && (
          <p className="ml-auto shrink-0 text-xs text-text-low">
            <span className="font-semibold text-text-mid">{formatCount(totalItems)}</span> phim
          </p>
        )}
      </div>
    </section>
  );
}

function statusOf(query: { isPending: boolean; isError: boolean }): OptionStatus {
  if (query.isPending) return 'pending';
  if (query.isError) return 'error';
  return 'ready';
}

interface FilterDropdownProps {
  axisLabel: string;
  icon: IconName;
  options: readonly FilterOption[];
  value: string | null;
  triggerLabel: string;
  status: OptionStatus;
  errorMessage?: string;
  onSelect: (value: string | null) => void;
  /** The sort axis has no "off" position. */
  resettable?: boolean;
  /** Overrides "active means a value is set" for axes that always carry one. */
  isActive?: boolean;
}

function FilterDropdown({
  axisLabel,
  icon,
  options,
  value,
  triggerLabel,
  status,
  errorMessage,
  onSelect,
  resettable = true,
  isActive,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<PanelPlacement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const active = isActive ?? value !== null;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /*
   * A trigger near either edge of a 320px screen would strand its panel: the
   * page cannot scroll sideways to reach it, and `body` clips the overflow, so
   * the options would simply be gone. Left/right alignment classes cannot
   * express "neither edge fits" — the panel is instead pinned to a viewport x
   * clamped into the safe band, expressed as an offset from the trigger's own
   * box. The height is clamped the same way against the space below.
   */
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const root = rootRef.current;
      const trigger = triggerRef.current;
      if (!root || !trigger) return;

      const rootLeft = root.getBoundingClientRect().left;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(PANEL_WIDTH_PX, window.innerWidth - EDGE_GAP_PX * 2);
      const rightMost = Math.max(EDGE_GAP_PX, window.innerWidth - EDGE_GAP_PX - width);
      const viewportLeft = Math.min(Math.max(rect.left, EDGE_GAP_PX), rightMost);
      const room = window.innerHeight - rect.bottom - PANEL_GAP_PX - EDGE_GAP_PX;

      setPlacement({
        left: Math.round(viewportLeft - rootLeft),
        width,
        maxHeight: Math.max(
          PANEL_MIN_HEIGHT_PX,
          Math.min(PANEL_MAX_HEIGHT_PX, Math.round(room)),
        ),
      });
    };

    place();
    window.addEventListener('resize', place);

    // A hundred-entry year list opens on the wrong end without this.
    panelRef.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest' });

    return () => window.removeEventListener('resize', place);
  }, [open]);

  const choose = (next: string | null) => {
    onSelect(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${axisLabel}: ${triggerLabel}`}
        onClick={() => setOpen((previous) => !previous)}
        className={`${TRIGGER_BASE} ${
          active
            ? 'border-accent bg-accent text-white shadow-lift'
            : open
              ? 'border-accent/60 bg-surface-3 text-text-high'
              : 'border-outline bg-surface-2 text-text-mid hover:bg-surface-3 hover:text-text-high'
        }`}
      >
        <Icon name={icon} size={16} className="shrink-0" />
        <span className="max-w-[6rem] truncate sm:max-w-[9rem]">{triggerLabel}</span>
        <Icon
          name="chevron-down"
          size={16}
          className={`shrink-0 transition-transform duration-200 ease-out-expo ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={axisLabel}
          /* The classes are the pre-measurement fallback; `placement` refines
             them in the same commit, before paint. */
          className="absolute top-[calc(100%+0.5rem)] left-0 z-40 max-h-80 w-60 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-card border border-outline bg-surface-1/95 p-1.5 shadow-lift backdrop-blur-xl"
          style={
            placement
              ? {
                  left: `${placement.left}px`,
                  width: `${placement.width}px`,
                  maxHeight: `${placement.maxHeight}px`,
                }
              : undefined
          }
        >
          {resettable && (
            <OptionRow
              label="Tất cả"
              selected={value === null}
              onClick={() => choose(null)}
            />
          )}

          {status === 'pending' && (
            <p className="px-2.5 py-3 text-sm text-text-mid">Đang tải…</p>
          )}

          {status === 'error' && (
            <p className="px-2.5 py-3 text-sm text-accent-soft">
              {errorMessage ?? 'Không tải được danh sách.'}
            </p>
          )}

          {status === 'ready' && options.length === 0 && (
            <p className="px-2.5 py-3 text-sm text-text-mid">Không có lựa chọn nào.</p>
          )}

          {options.map((option) => (
            <OptionRow
              key={option.value}
              label={option.label}
              selected={option.value === value}
              onClick={() => choose(option.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      /* A menu item is a tap target like any other: 44px, not 36. */
      className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-cell px-2.5 py-2 text-left text-sm transition-colors duration-150 md:min-h-0 ${
        selected
          ? 'bg-accent-ink text-accent-soft'
          : 'text-text-mid hover:bg-surface-3 hover:text-text-high'
      }`}
    >
      <span className="truncate">{label}</span>
      {selected && <Icon name="check" size={16} className="shrink-0 text-accent" />}
    </button>
  );
}
