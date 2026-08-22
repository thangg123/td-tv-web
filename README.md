# CiCi TV — Web

Bản web của app Android TV [`td-tv`](https://github.com/thangg123/td-tv). Cùng nguồn dữ liệu
([phimapi.com](https://phimapi.com)), cùng ngôn ngữ thiết kế ("Midnight Cinema"), nhưng dựng lại
cho chuột và bàn phím thay vì remote.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build  →  dist/
npm run preview    # xem thử bản build
```

## Deploy lên Vercel

Repo đã có sẵn `vercel.json` (framework `vite`, output `dist`, SPA rewrite về `index.html`).

```bash
npx vercel          # preview
npx vercel --prod   # production
```

Hoặc import repo trong dashboard Vercel — không cần cấu hình gì thêm, không có biến môi trường.

## Vì sao là SPA tĩnh

Trang này chỉ một người dùng và không cần SEO, nên yêu cầu duy nhất là **nhẹ và nhanh**:

- Không server, không SSR — Vercel serve file tĩnh thẳng từ edge CDN.
- Không webfont. Type scale lấy độ tương phản từ `clamp()` và tracking, không từ file font tải về.
- `hls.js` chỉ được `import()` động trong trang xem phim, không bao giờ nằm trong entry chunk.
- Mọi route trừ trang chủ đều lazy-load.
- API phimapi.com trả `access-control-allow-origin: *` nên trình duyệt gọi thẳng, không cần proxy.

## Kiến trúc

```
src/
├── lib/                     ← tầng nền, port 1:1 từ Kotlin
│   ├── domain/              ← models.ts, catalog.ts        (com.tdtv.domain)
│   ├── api/                 ← dtos, mappers, client,       (com.tdtv.data.remote)
│   │                          endpoints, repository         (com.tdtv.data.MovieRepository)
│   ├── queries/             ← React Query bindings — thay cho 4 LruCache + TTL của bản Android
│   ├── storage/             ← localStorage, thay cho DataStore (com.tdtv.data.local)
│   ├── routes.ts            ← bảng URL (com.tdtv.ui.navigation.Routes)
│   └── format.ts
├── components/
│   ├── ui/                  ← Icon, Button, Chip, Badge, SmartImage, Skeleton, StateViews
│   ├── layout/              ← AppShell, Header, Footer, RouteFallback
│   ├── movie/               ← PosterCard, MovieRail, MovieGrid, ContinueRail,
│   │                          HeroSpotlight, FilterBar, CastRail
│   └── player/              ← VideoPlayer (hls.js), EmbedPlayer, EpisodePicker
├── pages/                   ← Home, Catalog, Detail, Watch, Search, Library, Taxonomy, 404
└── styles/theme.css         ← toàn bộ design token (@theme của Tailwind v4)
```

### Bản đồ URL

| URL | Màn hình | Tương ứng trong app TV |
|---|---|---|
| `/` | Trang chủ (hero + các hàng phim) | `HomeScreen` |
| `/moi-cap-nhat` | Phim mới cập nhật | `CatalogSource.Newest` |
| `/danh-sach/:slug` | Phim lẻ / bộ / hoạt hình / TV Shows / chiếu rạp | `CatalogSource.ByList` |
| `/the-loai` · `/the-loai/:slug` | Chỉ mục thể loại · catalog theo thể loại | `GENRES` · `ByCategory` |
| `/quoc-gia` · `/quoc-gia/:slug` | Chỉ mục quốc gia · catalog theo quốc gia | `COUNTRIES` · `ByCountry` |
| `/nam/:year` | Catalog theo năm | `ByYear` |
| `/ngon-ngu/:slug` | Vietsub / Thuyết minh / Lồng tiếng | `ByLanguage` |
| `/tim-kiem?q=` | Tìm kiếm | `SearchScreen` |
| `/phim/:slug` | Chi tiết phim | `DetailScreen` |
| `/xem/:slug?sv=&tap=` | Trình phát | `PlayerScreen` |
| `/thu-vien` | Yêu thích + xem tiếp | `LibraryScreen` |

Bộ lọc, sắp xếp và từ khoá đều nằm trong query string (`?the-loai=&quoc-gia=&nam=&ngon-ngu=&sap-xep=`),
nên nút Back, F5 và link chia sẻ đều dựng lại đúng lưới phim đang xem.

## Dữ liệu người dùng

Yêu thích và tiến độ xem lưu trong `localStorage` (`cici.favorites`, `cici.watch_progress`),
đồng bộ giữa các tab qua sự kiện `storage`. Không có tài khoản, không có backend — xoá dữ liệu
trình duyệt là mất.

## Ghi chú khi sửa tiếp

- **Đừng hardcode màu.** Mọi màu/kích thước/bo góc đều là token trong `src/styles/theme.css`.
  Accent `#FF3B5C` chỉ dùng cho focus và hành động chính; gold `#FFC64B` chỉ dùng cho điểm đánh giá.
- **Đừng render `movie.description` dưới dạng HTML.** API trả về HTML thô; `stripHtml()` trong
  `lib/api/mappers.ts` đã làm phẳng thành text — đó là thứ giữ phần tóm tắt khỏi thành lỗ hổng XSS.
- **TTL cache** nằm ở `staleTime` trong `lib/queries/queries.ts`, giữ đúng lý do của bản Android:
  danh sách 5 phút, chi tiết 3 phút (series đang chiếu còn thêm tập), cast/backdrop 1 giờ,
  thể loại/quốc gia/năm thì cả phiên.
- Muốn thêm webfont thì thêm ở `index.html` với `preconnect` + `font-display: swap`, và sửa
  `--font-sans` trong `theme.css` — nhưng đó là thứ nặng nhất trang này sẽ tải, cân nhắc kỹ.
