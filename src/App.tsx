import { Suspense, lazy } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import RouteFallback from '@/components/layout/RouteFallback';
import HomePage from '@/pages/HomePage';

/*
 * Home ships in the entry chunk — it is what a cold visit lands on, so making
 * it wait for a second round-trip would cost the one page load that matters.
 * Every other route is split: the watch page in particular drags hls.js behind
 * it, which is larger than the rest of the app put together.
 */
const CatalogPage = lazy(() => import('@/pages/CatalogPage'));
const DetailPage = lazy(() => import('@/pages/DetailPage'));
const WatchPage = lazy(() => import('@/pages/WatchPage'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const TaxonomyIndexPage = lazy(() => import('@/pages/TaxonomyIndexPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/** One boundary for every lazy page, rather than one per route. */
function LazyRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      {/*
        The player sits outside the shell on purpose: a header and a footer
        wrapped around a video is exactly the furniture a full-bleed player
        should not have.
      */}
      <Route
        path="/xem/:slug"
        element={
          <Suspense fallback={<RouteFallback />}>
            <WatchPage />
          </Suspense>
        }
      />

      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />

        <Route element={<LazyRoutes />}>
          <Route path="/moi-cap-nhat" element={<CatalogPage kind="newest" />} />
          <Route path="/danh-sach/:slug" element={<CatalogPage kind="list" />} />
          <Route path="/the-loai" element={<TaxonomyIndexPage kind="category" />} />
          <Route path="/the-loai/:slug" element={<CatalogPage kind="category" />} />
          <Route path="/quoc-gia" element={<TaxonomyIndexPage kind="country" />} />
          <Route path="/quoc-gia/:slug" element={<CatalogPage kind="country" />} />
          <Route path="/nam/:year" element={<CatalogPage kind="year" />} />
          <Route path="/ngon-ngu/:slug" element={<CatalogPage kind="language" />} />
          <Route path="/tim-kiem" element={<SearchPage />} />
          <Route path="/phim/:slug" element={<DetailPage />} />
          <Route path="/thu-vien" element={<LibraryPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
