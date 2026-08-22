/**
 * URL vocabulary — the web counterpart of `com.tdtv.ui.navigation.Routes`.
 *
 * Paths are Vietnamese and mirror the API's own slugs, so a URL is readable and
 * a pasted link is self-describing. Filters, sort and page live in the query
 * string rather than in component state: the back button, a refresh and a
 * shared link then all reproduce the same grid.
 */

import type { CatalogSource } from '@/lib/domain/catalog';

export const routes = {
  home: '/',
  search: (keyword?: string) =>
    keyword ? `/tim-kiem?q=${encodeURIComponent(keyword)}` : '/tim-kiem',
  library: '/thu-vien',
  genres: '/the-loai',
  countries: '/quoc-gia',

  list: (slug: string) => `/danh-sach/${encodeURIComponent(slug)}`,
  category: (slug: string) => `/the-loai/${encodeURIComponent(slug)}`,
  country: (slug: string) => `/quoc-gia/${encodeURIComponent(slug)}`,
  year: (year: number | string) => `/nam/${year}`,
  language: (slug: string) => `/ngon-ngu/${encodeURIComponent(slug)}`,
  newest: '/moi-cap-nhat',

  detail: (slug: string) => `/phim/${encodeURIComponent(slug)}`,

  watch: (slug: string, serverIndex = 0, episodeSlug = '') => {
    const params = new URLSearchParams();
    if (serverIndex > 0) params.set('sv', String(serverIndex));
    if (episodeSlug) params.set('tap', episodeSlug);
    const query = params.toString();
    return `/xem/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`;
  },
} as const;

/** The catalog URL a `CatalogSource` lives at. */
export const catalogHref = (source: CatalogSource): string => {
  switch (source.kind) {
    case 'newest':
      return routes.newest;
    case 'list':
      return routes.list(source.slug);
    case 'category':
      return routes.category(source.slug);
    case 'country':
      return routes.country(source.slug);
    case 'year':
      return routes.year(source.year);
    case 'language':
      return routes.language(source.lang);
    case 'search':
      return routes.search(source.keyword);
  }
};
