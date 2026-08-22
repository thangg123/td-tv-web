import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/Icon';
import { MovieLists, languageOptions } from '@/lib/domain/catalog';
import { useCategories, useCountries, useYears } from '@/lib/queries/queries';
import { routes } from '@/lib/routes';

/** Which taxonomy a submenu lists, when the item opens one instead of navigating. */
type TaxonomyKind = 'category' | 'country' | 'year';

interface NavItem {
  readonly to: string;
  readonly label: string;
  /** Exact matching, so "Trang chủ" is not lit up on every page. */
  readonly end?: boolean;
  /**
   * Renders a hover submenu of this taxonomy rather than a plain link. The
   * index page stays reachable from the bottom of the panel — it is a useful
   * destination, just not what a top-level menu entry should fire on click.
   */
  readonly menu?: TaxonomyKind;
}

interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

/**
 * The TV app's vertical rail, regrouped for a horizontal bar: content types in
 * one cluster, audio tracks in the next, ways of slicing the catalogue in the
 * last. The grouping is what keeps eleven destinations from reading as one
 * undifferentiated row — the same job the rail's group gaps do on the TV.
 *
 * The language cuts come from `languageOptions` rather than being retyped, so
 * the bar, the drawer, the home band and every filter dropdown always offer the
 * same three.
 */
const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Duyệt',
    items: [
      { to: routes.home, label: 'Trang chủ', end: true },
      { to: routes.list(MovieLists.SINGLE), label: 'Phim lẻ' },
      { to: routes.list(MovieLists.SERIES), label: 'Phim bộ' },
      { to: routes.list(MovieLists.ANIME), label: 'Hoạt hình' },
      { to: routes.list(MovieLists.TV_SHOWS), label: 'TV Shows' },
      { to: routes.list(MovieLists.CINEMA), label: 'Chiếu rạp' },
    ],
  },
  {
    label: 'Ngôn ngữ',
    items: languageOptions.map((option) => ({
      to: routes.language(option.slug),
      label: option.label,
    })),
  },
  {
    label: 'Khám phá',
    items: [
      { to: routes.genres, label: 'Thể loại', menu: 'category' },
      { to: routes.countries, label: 'Quốc gia', menu: 'country' },
      /*
       * There is no "all years" index to fall back to, so `to` points at the
       * genre page — the one screen that also lists years — for the drawer,
       * and the panel itself skips the "Xem tất cả" row because it is already
       * showing every year there is.
       */
      { to: routes.genres, label: 'Năm', menu: 'year' },
    ],
  },
];

/**
 * One shape for every square control in the bar, link or button alike.
 *
 * 44px up to `xl`, which is exactly where the icon buttons stop being the only
 * way in and the full nav takes over: below that the bar is being tapped, and a
 * 36px target is under the WCAG floor. Past `xl` there is a pointer, and the
 * denser 36 sits better beside the nav's own type.
 */
const ICON_CONTROL =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-pill border border-outline/70 bg-surface-2/60 text-text-mid transition-[color,background-color,border-color,transform] duration-200 ease-out-expo hover:-translate-y-px hover:border-accent/40 hover:bg-surface-3 hover:text-text-high active:translate-y-0 xl:size-9';

/** Tailwind's `xl`, mirrored so the drawer can dismiss itself on a rotation. */
const DESKTOP_QUERY = '(min-width: 80rem)';

/** Breathing room kept between a submenu and the edge of the window. */
const EDGE_MARGIN_PX = 12;

/** Past this many pixels the glass bar commits to a solid plate. */
const OPAQUE_AFTER_PX = 24;

/**
 * The lockup: a photo of CiCi herself, the Android launcher's play triangle,
 * then the wordmark.
 *
 * The avatar is a 96px crop of the cat, not the full 1920px photo — it renders
 * at 32/36px on every page in the app, so shipping the original would have cost
 * 185KB on first paint for something the size of a favicon. The play glyph
 * overlaps its lower-right corner rather than sitting beside it: two separate
 * marks in a row read as two logos, one overlapping pair reads as one.
 */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative shrink-0">
        <img
          src="/logo-cat.jpg"
          alt="CiCi"
          width={36}
          height={36}
          decoding="async"
          className="size-9 rounded-pill object-cover ring-1 ring-outline/80 transition-[transform,box-shadow] duration-300 ease-out-back group-hover:-translate-y-0.5 group-hover:ring-accent/60"
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-pill bg-accent ring-2 ring-ink transition-transform duration-300 ease-out-back group-hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" width="9" height="9" focusable="false" className="translate-x-px text-white">
            <path
              d="M7 4.8 19.6 12 7 19.2Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
      {/*
        Below `2xl` the wordmark is dropped and the portrait carries the brand
        on its own. Eleven destinations plus a search field and the library link
        do not fit beside it until 1536 — measured, not guessed: at 1280 the nav
        overflowed its box by 45px and "Quốc gia" ran under the search button.
        The mark is recognisable without the text; the text is not recognisable
        without the mark.
      */}
      <span className="hidden items-baseline gap-1.5 2xl:flex">
        <span className="text-xl font-black tracking-[-0.045em] text-text-high">CiCi</span>
        <span className="text-eyebrow font-semibold uppercase text-text-low">TV</span>
      </span>
    </span>
  );
}

/**
 * The panel body. Split out so the taxonomy request only fires once the viewer
 * has actually opened the menu — mounting the hook with the header would cost
 * every cold page load two requests for a list most visits never look at.
 */
function TaxonomyPanel({ kind, indexHref }: { kind: TaxonomyKind; indexHref?: string }) {
  const categories = useCategories();
  const countries = useCountries();
  const years = useYears();

  const query = kind === 'category' ? categories : kind === 'country' ? countries : years;
  /* Years arrive as numbers; everything else as {name, slug}. One shape from here on. */
  const items =
    kind === 'year'
      ? (years.data ?? []).map((year) => ({ key: String(year), label: String(year), href: routes.year(year) }))
      : ((kind === 'category' ? categories.data : countries.data) ?? []).map((item) => ({
          key: item.slug,
          label: item.name,
          href: kind === 'category' ? routes.category(item.slug) : routes.country(item.slug),
        }));

  if (query.isPending) {
    return <p className="px-3 py-6 text-center text-sm text-text-mid">Đang tải…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-text-mid">
        Không tải được danh sách.
      </p>
    );
  }

  return (
    <>
      <ul
        className={`grid max-h-[60vh] gap-x-1 gap-y-0.5 overflow-y-auto p-2 ${
          kind === 'year' ? 'grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 xl:grid-cols-3'
        }`}
      >
        {items.map((item) => (
          <li key={item.key}>
            <NavLink
              to={item.href}
              className={({ isActive }) =>
                `block truncate rounded-cell px-3 py-2 text-sm transition-colors duration-150 ${
                  isActive
                    ? 'bg-accent-ink text-accent'
                    : 'text-text-mid hover:bg-surface-2 hover:text-text-high'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      {indexHref ? (
      <div className="border-t border-outline/60 p-2">
        <Link
          to={indexHref}
          className="block rounded-cell px-3 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-surface-2 hover:text-accent-soft"
        >
          Xem tất cả
        </Link>
      </div>
      ) : null}
    </>
  );
}

/**
 * A top-level entry that opens a submenu instead of navigating.
 *
 * Click to open, click again — or Escape, or a press anywhere outside — to
 * close. Deliberately NOT hover: a menu that opens on hover fires on every
 * pointer that merely crosses it on the way somewhere else, and it has no
 * equivalent on a touch screen at all. A real button also means Enter and Space
 * already work with no key handling of our own.
 */
function NavDropdown({ label, kind, indexHref }: { label: string; kind: TaxonomyKind; indexHref?: string }) {
  const [open, setOpen] = useState(false);
  // The panel's data hook is mounted only from here, on first open.
  const [everOpened, setEverOpened] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /*
   * Anchored to the trigger's left edge by default, flipped to its right edge
   * when that would push the panel off screen — which it does for the last
   * entry in the bar, where a 38rem panel opening rightwards runs straight off
   * the viewport. Measured rather than hard-coded per item, so it keeps working
   * if the menu order changes.
   */
  const [alignRight, setAlignRight] = useState(false);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (!wasOpen) setEverOpened(true);
      return !wasOpen;
    });
  }, []);

  // Picking an entry is the menu's whole purpose; leaving it hanging over the
  // page the viewer just navigated to serves nothing.
  const routeKey = useLocation().key;
  useEffect(() => setOpen(false), [routeKey]);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const wrap = wrapRef.current;
      const panel = panelRef.current;
      if (!wrap || !panel) return;
      // Measure from the trigger, not the panel: the panel may already be
      // flipped, and reading its own position would oscillate.
      const wouldOverflow = wrap.getBoundingClientRect().left + panel.offsetWidth > window.innerWidth - EDGE_MARGIN_PX;
      setAlignRight(wouldOverflow);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Dismissing with the keyboard has to leave focus somewhere sensible.
      triggerRef.current?.focus();
    };
    // Pointerdown, not click: the menu must be gone before whatever sits under
    // it starts navigating — including the other dropdown's trigger.
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full shrink-0 items-center"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
        className="group relative flex h-full shrink-0 items-center gap-1 whitespace-nowrap px-1.5 text-sm font-medium xl:px-1.5 2xl:px-2.5"
      >
        <span
          className={`transition-colors duration-200 ${
            open ? 'text-text-high' : 'text-text-mid group-hover:text-text-high'
          }`}
        >
          {label}
        </span>
        <Icon
          name="chevron-down"
          size={14}
          className={`text-text-low transition-transform duration-200 ease-out-expo ${
            open ? 'rotate-180' : ''
          }`}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-2 bottom-0 h-0.5 origin-left rounded-full transition-transform duration-300 ease-out-expo ${
            open ? 'scale-x-100 bg-accent' : 'scale-x-0 bg-accent/50 group-hover:scale-x-100'
          }`}
        />
      </button>

      {open && (
        <div
          role="group"
          aria-label={label}
          ref={panelRef}
          className={`absolute top-full z-50 w-[min(38rem,90vw)] overflow-hidden rounded-card border border-outline/70 bg-ink/95 shadow-lift backdrop-blur-xl ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          {everOpened ? <TaxonomyPanel kind={kind} indexHref={indexHref} /> : null}
        </div>
      )}
    </div>
  );
}

function DesktopNavItem({ to, label, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className="group relative flex h-full shrink-0 items-center whitespace-nowrap px-1.5 text-sm font-medium xl:px-1.5 2xl:px-2.5"
    >
      {({ isActive }) => (
        <>
          <span
            className={`transition-colors duration-200 ${
              isActive ? 'text-text-high' : 'text-text-mid group-hover:text-text-high'
            }`}
          >
            {label}
          </span>
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-2 bottom-0 h-0.5 origin-left rounded-full transition-transform duration-300 ease-out-expo ${
              isActive ? 'scale-x-100 bg-accent' : 'scale-x-0 bg-accent/50 group-hover:scale-x-100'
            }`}
          />
        </>
      )}
    </NavLink>
  );
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasMenuOpen = useRef(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > OPAQUE_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Any navigation dismisses the drawer, including one started from inside it.
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.key]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onBreakpoint = (event: MediaQueryListEvent) => {
      // The panel is `xl:hidden`; without this it would vanish on rotation and
      // leave the body scroll locked behind it.
      if (event.matches) setMenuOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onBreakpoint);
    menuCloseRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onBreakpoint);
    };
  }, [menuOpen]);

  // Focus is never left on a node that just unmounted.
  useEffect(() => {
    if (wasMenuOpen.current && !menuOpen) menuButtonRef.current?.focus();
    wasMenuOpen.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    searchToggleRef.current?.focus();
  };

  /*
   * The body behind the drawer is scroll-locked but still tabbable, so without
   * this Tab walks straight off the panel and onto links hidden under the scrim.
   * Wrapping at the two ends is enough — the panel itself is never re-ordered.
   */
  const trapMenuTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const panel = menuPanelRef.current;
    if (!panel) return;

    const focusable = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(routes.search(query.trim()));
    setSearchOpen(false);
  };

  return (
    <>
      <header
        className={`safe-top sticky top-0 z-50 border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ease-out-expo ${
          scrolled
            ? 'border-outline/70 bg-ink shadow-[0_18px_40px_-30px_rgb(0_0_0/0.95)]'
            : 'border-transparent bg-ink/60'
        }`}
      >
        <div className="gutter flex h-16 items-center gap-2 lg:h-[4.5rem] lg:gap-4">
          <Link
            to={routes.home}
            aria-label="CiCi TV — trang chủ"
            // The 36px lockup is left as it is; the link around it is padded out
            // to a 44px target instead, so the tap area grows and nothing moves.
            className="group flex min-h-11 min-w-11 shrink-0 items-center xl:min-h-0 xl:min-w-0"
          >
            <BrandMark />
          </Link>

          <nav
            aria-label="Điều hướng chính"
            className="hidden min-w-0 shrink self-stretch xl:ml-4 xl:flex xl:items-center"
          >
            {NAV_GROUPS.map((group, index) => (
              <Fragment key={group.label}>
                {index > 0 && (
                  <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-outline xl:mx-2 2xl:mx-3" />
                )}
                {group.items.map((item) =>
                  item.menu ? (
                    <NavDropdown
                      key={item.label}
                      label={item.label}
                      kind={item.menu}
                      indexHref={item.menu === 'year' ? undefined : item.to}
                    />
                  ) : (
                    <DesktopNavItem key={item.label} to={item.to} label={item.label} end={item.end} />
                  ),
                )}
              </Fragment>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="relative hidden items-center xl:flex">
              <button
                ref={searchToggleRef}
                type="button"
                aria-label="Tìm kiếm"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen(true)}
                className={`${ICON_CONTROL} ${searchOpen ? 'invisible' : ''}`}
              >
                <Icon name="search" size={18} />
              </button>

              {searchOpen && (
                <form
                  role="search"
                  onSubmit={submitSearch}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
                  }}
                  className="absolute right-0 top-1/2 z-10 flex w-72 -translate-y-1/2 items-center gap-2 rounded-pill border border-outline bg-surface-2/95 py-1.5 pl-3.5 pr-1.5 shadow-lift backdrop-blur-xl transition-[border-color,box-shadow] duration-200 focus-within:border-accent/70 focus-within:shadow-glow"
                >
                  <Icon name="search" size={16} className="shrink-0 text-text-low" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') closeSearch();
                    }}
                    placeholder="Tìm phim, diễn viên…"
                    aria-label="Từ khóa tìm kiếm"
                    className="min-w-0 flex-1 bg-transparent text-sm text-text-high outline-none placeholder:text-text-low"
                  />
                  <button
                    type="submit"
                    aria-label="Tìm phim"
                    // Safari does not focus a button on mousedown, so without this
                    // the form's blur handler would unmount it before the click.
                    onMouseDown={(event) => event.preventDefault()}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill bg-accent text-white transition-[transform,filter] duration-200 hover:-translate-y-px hover:brightness-110 active:translate-y-0"
                  >
                    <Icon name="chevron-right" size={16} />
                  </button>
                </form>
              )}
            </div>

            <Link to={routes.search()} aria-label="Tìm kiếm" className={`${ICON_CONTROL} xl:hidden`}>
              <Icon name="search" size={18} />
            </Link>

            <NavLink
              to={routes.library}
              aria-label="Thư viện"
              className={({ isActive }) =>
                `hidden items-center gap-2 rounded-pill border px-3 py-3 text-sm font-medium transition-[color,background-color,border-color,transform] duration-200 ease-out-expo md:inline-flex lg:px-2.5 xl:px-3.5 xl:py-2 ${
                  isActive
                    ? 'border-accent/60 bg-accent-ink text-accent-soft'
                    : 'border-outline/70 bg-surface-2/60 text-text-mid hover:-translate-y-px hover:border-accent/40 hover:bg-surface-3 hover:text-text-high'
                }`
              }
            >
              <Icon name="bookmark" size={16} />
              {/* Eight nav items and a label do not both fit at exactly 1024px. */}
              <span className="xl:hidden xl:inline">Thư viện</span>
            </NavLink>

            <button
              ref={menuButtonRef}
              type="button"
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={menuOpen}
              aria-controls="menu-dieu-huong"
              onClick={() => setMenuOpen((open) => !open)}
              className={`${ICON_CONTROL} xl:hidden`}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
            </button>
          </div>
        </div>
      </header>

      {/*
        Outside <header> on purpose: `backdrop-blur` sets backdrop-filter, which
        makes the bar a containing block for fixed children — the drawer would
        be pinned to the 4rem-tall bar instead of the viewport.
      */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] xl:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 size-full cursor-default bg-ink-deep/80 backdrop-blur-sm"
          />

          <div
            ref={menuPanelRef}
            id="menu-dieu-huong"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onKeyDown={trapMenuTab}
            className="safe-end safe-top absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] animate-fade-up flex-col border-l border-outline bg-surface-1 shadow-lift"
          >
            <div className="flex items-center justify-between gap-3 border-b border-outline/60 px-5 py-4">
              <Link
                to={routes.home}
                aria-label="CiCi TV — trang chủ"
                className="group flex min-h-11 min-w-11 items-center"
              >
                <BrandMark />
              </Link>
              <button
                ref={menuCloseRef}
                type="button"
                aria-label="Đóng menu"
                onClick={() => setMenuOpen(false)}
                className={ICON_CONTROL}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-5">
              <Link
                to={routes.search()}
                className="mb-7 flex min-h-11 items-center gap-3 rounded-pill border border-outline bg-surface-2 px-4 py-3 text-sm text-text-mid transition-colors duration-200 hover:border-accent/40 hover:text-text-high"
              >
                <Icon name="search" size={18} />
                Tìm phim, diễn viên…
              </Link>

              <nav aria-label="Menu điều hướng">
                {NAV_GROUPS.map((group, index) => (
                  <div key={group.label} className="mb-7 last:mb-0">
                    {/* A label for the list below it, not a heading: the drawer
                        sits before the page <h1> in DOM order. */}
                    <p id={`menu-nhom-${index}`} className="eyebrow px-3 pb-2">
                      {group.label}
                    </p>
                    <ul aria-labelledby={`menu-nhom-${index}`}>
                      {group.items.map((item) => (
                        <li key={item.label}>
                          <NavLink
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                              `flex min-h-11 items-center justify-between gap-3 rounded-card px-3 py-2.5 transition-colors duration-200 ${
                                isActive
                                  ? 'bg-accent-ink font-semibold text-accent-soft'
                                  : 'text-text-mid hover:bg-surface-2 hover:text-text-high'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span>{item.label}</span>
                                <Icon
                                  name="chevron-right"
                                  size={16}
                                  className={isActive ? 'text-accent' : 'text-text-low'}
                                />
                              </>
                            )}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>

            <div className="safe-bottom border-t border-outline/60 p-3">
              <Link
                to={routes.library}
                className="flex min-h-11 items-center justify-center gap-2 rounded-pill bg-accent px-4 py-3 text-sm font-semibold text-white transition-[transform,filter] duration-200 ease-out-expo hover:-translate-y-px hover:brightness-110 active:translate-y-0"
              >
                <Icon name="bookmark" size={16} />
                Thư viện
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
