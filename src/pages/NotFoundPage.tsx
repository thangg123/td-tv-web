/**
 * `/404`, and where `*` lands.
 *
 * Left-aligned rather than the stock centred column, with the numeral pushed
 * off the right edge as atmosphere instead of as the message.
 */

import { LinkButton } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

export default function NotFoundPage() {
  return (
    <section className="grain relative isolate flex min-h-[70vh] items-center overflow-hidden">
      {/* Ghosted numeral: decoration, so it stays out of the accessibility tree. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-0 -z-10 -translate-y-1/2 translate-x-[10%] text-[clamp(9rem,32vw,20rem)] leading-none font-black tracking-[-0.07em] text-surface-2 select-none"
      >
        404
      </span>

      <div className="gutter relative w-full py-24 sm:py-28">
        <p className="eyebrow">Lỗi 404</p>

        <h1 className="mt-4 max-w-3xl text-display font-black text-text-high">
          Không tìm thấy trang này.
        </h1>

        <p className="mt-5 max-w-md text-base text-text-mid">
          Liên kết có thể đã hỏng, hoặc bộ phim bạn tìm đã bị gỡ khỏi thư viện.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <LinkButton to={routes.home} variant="primary" size="lg" icon="arrow-left">
            Về trang chủ
          </LinkButton>
          <LinkButton to={routes.search()} variant="secondary" size="lg" icon="search">
            Tìm phim
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
