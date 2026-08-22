import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';

const MAIN_ID = 'noi-dung';

export default function AppShell() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const lastPathname = useRef<string | null>(null);

  useEffect(() => {
    // Filters, sort and paging live in the query string. Only a real change of
    // page resets the scroll — otherwise every chip tap would yank the grid up.
    if (lastPathname.current === pathname) return;
    const isFirstRender = lastPathname.current === null;
    lastPathname.current = pathname;
    // Back/forward already restores an offset; jumping to the top would undo it.
    if (isFirstRender || navigationType === 'POP') return;
    // `html { scroll-behavior: smooth }` would otherwise animate the whole page
    // of travel while the next route is already painting.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, navigationType]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-pill focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Bỏ qua điều hướng
      </a>

      <Header />

      <main
        id={MAIN_ID}
        tabIndex={-1}
        className="min-h-[70vh] flex-1 scroll-mt-16 outline-none lg:scroll-mt-[4.5rem]"
      >
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
