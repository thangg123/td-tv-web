# Bàn giao — sẵn sàng phát hành

> File tạm. Xoá đi khi đã deploy xong và không cần nữa.

## Deploy

```bash
npm install
npm run build          # tsc --noEmit && vite build → dist/
npx vercel --prod      # cần: npm i -g vercel, rồi vercel login
```

`vercel.json` đã cấu hình sẵn: framework `vite`, output `dist`, SPA rewrite về
`index.html`, cache 1 năm cho `/assets/*` (file có hash nên an toàn), và
`X-Robots-Tag: noindex` vì đây là trang cá nhân.

Không có biến môi trường. Không có backend. Không có khoá API.

## Đã kiểm chứng trên bản production build

Không chỉ dev server — các số dưới đây đo trên `dist/` chạy qua `vite preview`.

| Hạng mục | Kết quả |
|---|---|
| Tràn ngang | **0/40** tổ hợp (5 khổ máy × 8 route) |
| Vùng chạm < 44px | **0** thật sự (vài cái bị đếm nhầm đều là `sr-only`) |
| Cỡ chữ nhỏ nhất | **12px** mọi route, mọi khổ |
| Lỗi / cảnh báo console | **0** |
| Phát HLS | `readyState 4` · 1920×1080 · qua MSE · `hls.js` chỉ tải khi vào `/xem` |
| Banner trang chi tiết | 288px (35% màn hình), nút "Xem ngay" trên nếp gấp kể cả máy 375×667 |
| Dung sai tai thỏ | Bơm 44px inset mỗi bên → gutter nở 60px, **không tràn**, thẻ phim còn 255px |
| Desktop 1440 | Không regression: 12 mục menu, lưới thể loại đều, hero tự chuyển |

### Bundle

Tải lần đầu ≈ **100 KB gzip JS + 13 KB CSS**. `dist/index.html` chỉ tham chiếu
5 chunk — `hls.js` (179 KB gzip) **không** nằm trong đó, đã kiểm bằng
`performance.getEntriesByType('resource')` chứ không tin comment trong code.

## Chưa kiểm được — hãy thử sau khi deploy

1. **Safari / iOS.** Đây là nhánh HLS native duy nhất chưa chạy thật; Playwright
   ở máy này là Chromium nên luôn đi nhánh MSE. Mở `/xem/:slug` trên iPhone và
   kiểm: video phát được, nút toàn màn hình có tác dụng (iOS chỉ hỗ trợ
   `video.webkitEnterFullscreen()`, đã xử lý riêng), lưu tiến độ khi thoát app.
2. **Tai thỏ thật.** Chrome desktop luôn trả `env(safe-area-inset-*)` = 0. Đã
   chứng minh layout chịu được inset 44px giả lập, nhưng hành vi thật cần máy thật.

## Bẫy đã gặp — đừng lặp lại

**`canPlayType('application/vnd.apple.mpegurl')` trả `"maybe"` trên Chromium**
dù nó **không** phát được HLS trên desktop. Tin câu trả lời đó là Chrome/Edge/
Firefox chết trắng trang xem. Thứ tự đúng, đã áp dụng: dùng MSE/hls.js ở mọi nơi
có `MediaSource`, chỉ rơi về decoder của thẻ `<video>` khi hls.js không chạy được
— thực tế là Safari/iOS.

**`episode_total` API trả về number** dù tài liệu ghi string. Bản Kotlin không
dính vì `isLenient = true`; `JSON.parse` thì không. Đã sửa tận gốc: `str()` trong
`lib/api/mappers.ts` nhận `unknown` và ép kiểu an toàn.

**Vite 8 dùng Rolldown, không phải Rollup.** `output.manualChunks` dạng object đã
bị bỏ; dùng `output.codeSplitting.groups`.

## Quy ước thiết kế — đừng đảo ngược khi sửa tiếp

| | |
|---|---|
| **D1** | Nhãn eyebrow dùng class `.eyebrow` / `.eyebrow-muted`, không viết tay |
| **D2** | Một weight một tier: display/hero/screen → `font-black`; section → `font-semibold` |
| **D3** | Trạng thái "đã lưu" luôn `text-mint` |
| **D4** | Nút xoá lọc luôn `variant="secondary"`, nhãn `Xóa lọc ({n})` |
| **D5** | Ba bán kính: `rounded-cell` · `rounded-card` · `rounded-pill` |
| **D6** | `text-text-low` chỉ trên `bg-ink`; trên `bg-surface-*` phải là `text-text-mid` |
| **D7** | Control hiện-khi-hover phải dùng `.reveal-on-hover` — `opacity-0` thuần vẫn ăn click, trên điện thoại sẽ nuốt cú chạm |
| **Mobile** | Vùng chạm 44px tới `xl`, mật độ desktop từ `xl` lên (`size-11 xl:size-9`) |
| **Safe-area** | Dùng `.gutter` (đã cộng inset), `.safe-top`, `.safe-bottom`, `.safe-end`. Utility `px-gutter` **không** có inset |

Accent `#FF3B5C` chỉ cho focus và hành động chính; gold `#FFC64B` chỉ cho điểm
đánh giá. Sức mạnh của bảng màu nằm ở sự khan hiếm đó.

## Ràng buộc kỹ thuật

TS strict + `verbatimModuleSyntax` (phải `import type`) + `noUncheckedIndexedAccess`
+ `noUnusedLocals`/`noUnusedParameters`. Không `any`, không cast, không `@ts-ignore`.
Import qua alias `@/`. Chỉ transition `transform`/`opacity`/`box-shadow`/màu/`filter`.
Dependency đúng 5: react, react-dom, react-router-dom, @tanstack/react-query, hls.js.
