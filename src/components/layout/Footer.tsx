import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/layout/Header';
import Icon from '@/components/ui/Icon';
import { routes } from '@/lib/routes';

const QUICK_LINKS: readonly { readonly to: string; readonly label: string }[] = [
  { to: routes.genres, label: 'Thể loại' },
  { to: routes.countries, label: 'Quốc gia' },
  { to: routes.library, label: 'Thư viện' },
];

export default function Footer() {
  return (
    <footer className="mt-row-gap border-t border-outline/50">
      <div className="gutter flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <Link
            to={routes.home}
            aria-label="CiCi TV — trang chủ"
            className="group flex w-fit items-center"
          >
            <BrandMark />
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-text-low">
            Dữ liệu phim từ{' '}
            <a
              href="https://phimapi.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-baseline gap-1 text-text-mid underline decoration-outline underline-offset-4 transition-colors duration-200 hover:text-accent-soft hover:decoration-accent"
            >
              phimapi.com
              <Icon name="external" size={12} />
            </a>
            . CiCi TV không lưu trữ hay phát tán nội dung.
          </p>
        </div>

        <nav
          aria-label="Liên kết chân trang"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
        >
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-text-mid underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:text-accent-soft hover:decoration-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="gutter border-t border-outline/40 py-4">
        <p className="text-xs text-text-low">
          © {new Date().getFullYear()} CiCi TV — dự án cá nhân, không quảng cáo.
        </p>
      </div>
    </footer>
  );
}
