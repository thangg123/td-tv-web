import { Fragment, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/Icon';
import { MovieLists, languageOptions } from '@/lib/domain/catalog';
import { routes } from '@/lib/routes';

interface NavItem {
  readonly to: string;
  readonly label: string;
  /** Exact matching, so "Trang chủ" is not lit up on every page. */
  readonly end?: boolean;
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
      { to: routes.genres, label: 'Thể loại' },
      { to: routes.countries, label: 'Quốc gia' },
    ],
  },
];

/** One shape for every square control in the bar, link or button alike. */
const ICON_CONTROL =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-pill border border-outline/70 bg-surface-2/60 text-text-mid transition-[color,background-color,border-color,transform] duration-200 ease-out-expo hover:-translate-y-px hover:border-accent/40 hover:bg-surface-3 hover:text-text-high active:translate-y-0';

/** Tailwind's `lg`, mirrored so the drawer can dismiss itself on a rotation. */
const DESKTOP_QUERY = '(min-width: 64rem)';

/** Past this many pixels the glass bar commits to a solid plate. */
const OPAQUE_AFTER_PX = 24;

/**
 * The lockup: the Android launcher's play triangle plus the wordmark.
 * Exported because the footer signs off with the same mark.
 */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-card bg-accent-ink ring-1 ring-accent/40 transition-[transform,background-color,box-shadow] duration-300 ease-out-back group-hover:-translate-y-0.5 group-hover:bg-accent/20 group-hover:shadow-[0_0_0_1px_var(--color-accent)]">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
          focusable="false"
          className="translate-x-px text-accent"
        >
          <path
            d="M7 4.8 19.6 12 7 19.2Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-xl font-black tracking-[-0.045em] text-text-high">CiCi</span>
        <span className="text-eyebrow font-semibold uppercase text-text-low">TV</span>
      </span>
    </span>
  );
}

function DesktopNavItem({ to, label, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className="group relative flex h-full shrink-0 items-center whitespace-nowrap px-2 text-sm font-medium xl:px-2.5"
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
      // The panel is `lg:hidden`; without this it would vanish on rotation and
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
        className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ease-out-expo ${
          scrolled
            ? 'border-outline/70 bg-ink shadow-[0_18px_40px_-30px_rgb(0_0_0/0.95)]'
            : 'border-transparent bg-ink/60'
        }`}
      >
        <div className="gutter flex h-16 items-center gap-2 lg:h-[4.5rem] lg:gap-4">
          <Link
            to={routes.home}
            aria-label="CiCi TV — trang chủ"
            className="group flex shrink-0 items-center"
          >
            <BrandMark />
          </Link>

          <nav
            aria-label="Điều hướng chính"
            className="hidden self-stretch lg:ml-2 lg:flex lg:items-center xl:ml-4"
          >
            {NAV_GROUPS.map((group, index) => (
              <Fragment key={group.label}>
                {index > 0 && (
                  <span aria-hidden="true" className="mx-2 h-4 w-px bg-outline xl:mx-3" />
                )}
                {group.items.map((item) => (
                  <DesktopNavItem key={item.to} to={item.to} label={item.label} end={item.end} />
                ))}
              </Fragment>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="relative hidden items-center lg:flex">
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

            <Link to={routes.search()} aria-label="Tìm kiếm" className={`${ICON_CONTROL} lg:hidden`}>
              <Icon name="search" size={18} />
            </Link>

            <NavLink
              to={routes.library}
              aria-label="Thư viện"
              className={({ isActive }) =>
                `hidden items-center gap-2 rounded-pill border px-3 py-2 text-sm font-medium transition-[color,background-color,border-color,transform] duration-200 ease-out-expo md:inline-flex lg:px-2.5 xl:px-3.5 ${
                  isActive
                    ? 'border-accent/60 bg-accent-ink text-accent-soft'
                    : 'border-outline/70 bg-surface-2/60 text-text-mid hover:-translate-y-px hover:border-accent/40 hover:bg-surface-3 hover:text-text-high'
                }`
              }
            >
              <Icon name="bookmark" size={16} />
              {/* Eight nav items and a label do not both fit at exactly 1024px. */}
              <span className="lg:hidden xl:inline">Thư viện</span>
            </NavLink>

            <button
              ref={menuButtonRef}
              type="button"
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={menuOpen}
              aria-controls="menu-dieu-huong"
              onClick={() => setMenuOpen((open) => !open)}
              className={`${ICON_CONTROL} lg:hidden`}
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
        <div className="fixed inset-0 z-[60] lg:hidden">
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
            className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] animate-fade-up flex-col border-l border-outline bg-surface-1 shadow-lift"
          >
            <div className="flex items-center justify-between gap-3 border-b border-outline/60 px-5 py-4">
              <Link to={routes.home} aria-label="CiCi TV — trang chủ" className="group flex">
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
                className="mb-7 flex items-center gap-3 rounded-pill border border-outline bg-surface-2 px-4 py-3 text-sm text-text-mid transition-colors duration-200 hover:border-accent/40 hover:text-text-high"
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
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                              `flex items-center justify-between gap-3 rounded-card px-3 py-2.5 transition-colors duration-200 ${
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

            <div className="border-t border-outline/60 p-3">
              <Link
                to={routes.library}
                className="flex items-center justify-center gap-2 rounded-pill bg-accent px-4 py-3 text-sm font-semibold text-white transition-[transform,filter] duration-200 ease-out-expo hover:-translate-y-px hover:brightness-110 active:translate-y-0"
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
