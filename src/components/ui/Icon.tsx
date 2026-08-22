/**
 * The whole icon set, hand-drawn on a 24x24 grid so the family shares one
 * optical weight. Everything is a single `d` string — multi-part glyphs use
 * subpaths rather than several elements, which keeps the payload down and lets
 * one set of stroke attributes cover the lot.
 */

export type IconName =
  | 'play'
  | 'pause'
  | 'plus'
  | 'check'
  | 'search'
  | 'close'
  | 'menu'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-left'
  | 'bookmark'
  | 'bookmark-filled'
  | 'trash'
  | 'info'
  | 'star'
  | 'film'
  | 'tv'
  | 'globe'
  | 'tag'
  | 'calendar'
  | 'sparkle'
  | 'volume'
  | 'volume-off'
  | 'expand'
  | 'shrink'
  | 'settings'
  | 'refresh'
  | 'skip-back'
  | 'skip-forward'
  | 'external';

export interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
}

/** Outline and filled bookmarks are the same silhouette, drawn once. */
const BOOKMARK =
  'M6.75 3.75h10.5A1.75 1.75 0 0 1 19 5.5v14.1a.9.9 0 0 1-1.38.76L12 16.85l-5.62 3.51A.9.9 0 0 1 5 19.6V5.5a1.75 1.75 0 0 1 1.75-1.75Z';

/** Speaker cone shared by both volume states. */
const SPEAKER =
  'M11.6 4.9 6.85 8.75H4a1.25 1.25 0 0 0-1.25 1.25v4A1.25 1.25 0 0 0 4 15.25h2.85l4.75 3.85a.6.6 0 0 0 .98-.47V5.37a.6.6 0 0 0-.98-.47Z';

const GLYPHS: Record<IconName, string> = {
  play: 'M7.4 5.1 18.6 12 7.4 18.9Z',
  pause: 'M9.2 5.5v13M14.8 5.5v13',
  plus: 'M12 5.25v13.5M5.25 12h13.5',
  check: 'M4.75 12.5 9.5 17.25 19.25 7.5',
  search:
    'M17 10.75a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 1 1 12.5 0m-1.7 4.55 4.2 4.2',
  close: 'M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6',
  menu: 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h10.5',
  'chevron-left': 'm14.75 5.5-6.5 6.5 6.5 6.5',
  'chevron-right': 'm9.25 5.5 6.5 6.5-6.5 6.5',
  'chevron-down': 'm5.5 9.25 6.5 6.5 6.5-6.5',
  'arrow-left': 'M19.25 12H4.75m6.5-6.5L4.75 12l6.5 6.5',
  bookmark: BOOKMARK,
  'bookmark-filled': BOOKMARK,
  trash:
    'M4.25 6.9h15.5M9.75 6.9V5.4a1.4 1.4 0 0 1 1.4-1.4h1.7a1.4 1.4 0 0 1 1.4 1.4v1.5M6.6 6.9l.83 11.9a1.5 1.5 0 0 0 1.5 1.4h6.14a1.5 1.5 0 0 0 1.5-1.4l.83-11.9M10.4 10.6v5.9M13.6 10.6v5.9',
  info: 'M20.25 12a8.25 8.25 0 1 1-16.5 0 8.25 8.25 0 1 1 16.5 0M12 11.1v5.4M12 7.65h.01',
  star: 'M12 3.4 14.58 8.64l5.78.84-4.18 4.08.99 5.75L12 16.6l-5.17 2.71.99-5.75-4.18-4.08 5.78-.84Z',
  film: 'M3.75 6.75a2.5 2.5 0 0 1 2.5-2.5h11.5a2.5 2.5 0 0 1 2.5 2.5v10.5a2.5 2.5 0 0 1-2.5 2.5H6.25a2.5 2.5 0 0 1-2.5-2.5ZM8.25 4.25v15.5M15.75 4.25v15.5M3.75 9.5h4.5M3.75 14.5h4.5M15.75 9.5h4.5M15.75 14.5h4.5',
  tv: 'M4.75 6.5h14.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H4.75a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Zm3.25-3.75 4 3.5 4-3.5M8.5 21.25h7',
  globe:
    'M20.25 12a8.25 8.25 0 1 1-16.5 0 8.25 8.25 0 1 1 16.5 0M3.9 12h16.2M12 3.75c2.15 2.3 3.35 5.2 3.35 8.25S14.15 17.95 12 20.25c-2.15-2.3-3.35-5.2-3.35-8.25S9.85 6.05 12 3.75Z',
  tag: 'M12.05 3.75H5.55A1.8 1.8 0 0 0 3.75 5.55v6.5a1.8 1.8 0 0 0 .53 1.27l6.9 6.9a1.8 1.8 0 0 0 2.54 0l6.5-6.5a1.8 1.8 0 0 0 0-2.54l-6.9-6.9a1.8 1.8 0 0 0-1.27-.53ZM8.1 8.1h.01',
  calendar:
    'M5.5 5.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2ZM3.5 10h17M8.25 3.25v4.5M15.75 3.25v4.5',
  sparkle:
    'M12 3.25 13.9 8.6l5.35 1.9-5.35 1.9L12 17.75l-1.9-5.35-5.35-1.9 5.35-1.9ZM18.5 15l.85 2.15 2.15.85-2.15.85L18.5 21l-.85-2.15-2.15-.85 2.15-.85Z',
  volume: `${SPEAKER}M15.9 9.4a3.7 3.7 0 0 1 0 5.2M18.55 6.9a7.4 7.4 0 0 1 0 10.2`,
  'volume-off': `${SPEAKER}m16.5 9.75 4.75 4.5M21.25 9.75l-4.75 4.5`,
  expand:
    'M9.25 3.75H5.5a1.75 1.75 0 0 0-1.75 1.75v3.75M14.75 3.75h3.75a1.75 1.75 0 0 1 1.75 1.75v3.75M20.25 14.75v3.75a1.75 1.75 0 0 1-1.75 1.75h-3.75M9.25 20.25H5.5a1.75 1.75 0 0 1-1.75-1.75v-3.75',
  shrink:
    'M3.75 9.25H7.5a1.75 1.75 0 0 0 1.75-1.75V3.75M20.25 9.25H16.5a1.75 1.75 0 0 1-1.75-1.75V3.75M14.75 20.25V16.5a1.75 1.75 0 0 1 1.75-1.75h3.75M9.25 20.25V16.5a1.75 1.75 0 0 0-1.75-1.75H3.75',
  settings:
    'M3.75 7h9.25M18 7h2.25M3.75 12h3.5M12.5 12h7.75M3.75 17h9.25M18 17h2.25M17.5 7a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 1 1 4.5 0M12 12a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 1 1 4.5 0M17.5 17a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 1 1 4.5 0',
  refresh:
    'M20.5 12a8.5 8.5 0 1 1-8.5-8.5c2.4 0 4.7 1 6.35 2.75L20.5 8.5M20.5 4v4.5H16',
  'skip-back': 'M11.5 6.5 3.5 12l8 5.5V6.5ZM20.5 6.5 12.5 12l8 5.5V6.5Z',
  'skip-forward': 'M12.5 6.5 20.5 12l-8 5.5V6.5ZM3.5 6.5 11.5 12l-8 5.5V6.5Z',
  external:
    'M14.25 4.75h5v5m0-5-7.75 7.75M18 13.75v4.5a1.75 1.75 0 0 1-1.75 1.75H5.75A1.75 1.75 0 0 1 4 18.25V7.75A1.75 1.75 0 0 1 5.75 6h4.5',
};

const SOLID_ICONS: ReadonlySet<IconName> = new Set<IconName>([
  'play',
  'star',
  'bookmark-filled',
]);

export default function Icon({ name, className, size = 20 }: IconProps) {
  const isSolid = SOLID_ICONS.has(name);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={isSolid ? 'currentColor' : 'none'}
      stroke={isSolid ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      /* The accessible name always lives on the control that owns the icon. */
      aria-hidden="true"
      focusable="false"
    >
      <path d={GLYPHS[name]} />
    </svg>
  );
}
