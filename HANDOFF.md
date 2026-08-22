# Bàn giao — trạng thái dự án tính tới 2026-08-21

> File tạm để nối lại công việc ở phiên sau. Xoá đi khi đã xong.

## Tóm tắt

Website xem phim `CiCi TV`, port từ app Android TV [`td-tv`](https://github.com/thangg123/td-tv).
Dựng từ repo trống trong một phiên. **Build xanh, chưa commit lần nào, chưa chạy thử trên
trình duyệt thật.**

```bash
npm install && npm run build   # tsc --noEmit && vite build  → cả hai exit 0
npm run dev                    # http://localhost:5173
```

## Đã xong

| Tầng | Trạng thái |
|---|---|
| Config — `vite.config.ts`, `tsconfig.json`, `vercel.json`, `index.html` | ✅ |
| `src/lib/**` — domain, api, mappers, repository, queries, storage, routes, format | ✅ port 1:1 từ Kotlin |
| `src/styles/theme.css` — design system Midnight Cinema | ✅ |
| `src/components/**` — 23 component (ui / layout / movie / player) | ✅ |
| `src/pages/**` — 8 trang | ✅ |
| `README.md` | ✅ |

Đã qua 1 vòng review (2 góc: correctness + design) → 16 findings → 1 vòng sửa (4 agent,
66 thay đổi) → build lại xanh.

### Số liệu build gần nhất

Tải lần đầu ≈ **104 KB gzip JS + 13 KB CSS**:

| Chunk | Raw | Gzip | Ghi chú |
|---|---|---|---|
| `index.js` (entry + HomePage) | 47 KB | 14.4 KB | |
| `vendor.js` | 267 KB | 84.2 KB | React + Router + Query |
| `index.css` | 79 KB | 13.1 KB | toàn bộ Tailwind đã tree-shake |
| `hls.js` | 574 KB | 178.9 KB | **ngoài entry** — chỉ tải khi vào `/xem/:slug` |
| trang lazy | 1–22 KB | 0.3–7.3 KB | mỗi route một chunk |

## Đã smoke test trên trình duyệt thật ✅

Chạy Playwright qua cả 8 trang ở 1440px và 320px. **0 lỗi, 0 cảnh báo console.**

| Kiểm | Kết quả |
|---|---|
| Trang chủ | 6 hàng + hero, 144 thẻ, **0 ảnh hỏng**, đúng 1 ảnh `fetchPriority=high`, thứ tự heading h1→h2→h3 đúng |
| Chi tiết | Render đủ; **"16 tập"** hiện đúng — xác nhận fix `episode_total` chạy thật |
| **Xem phim** | HLS phát được: `readyState 4`, 1920×1080, 21:24, buffer 150s, qua MSE |
| Lưu tiến độ | Ghi đúng slug/tập/server, vị trí 305s / tổng 1284s |
| Resume | Tải lại đúng tập → nhảy về vị trí cũ; sang **tập khác thì KHÔNG resume** (đúng như bản Kotlin) |
| Catalog + lọc URL | `?the-loai=hanh-dong&nam=2026&sap-xep=newest` → chip khớp, "Xóa lọc (2)", 66 phim |
| Tìm kiếm / Thư viện / Thể loại / 404 | Đều đúng; thư viện nhận được tiến độ vừa xem từ player |
| 320px | Không trang nào tràn ngang; nav thu về hamburger; mũi tên rail biến mất |
| Guard cảm ứng | `.reveal-on-hover` và `.rail-arrow` đã vào CSS production đúng cú pháp |

### Lỗi trình duyệt phát hiện được (và chỉ trình duyệt mới phát hiện được)

**Xem phim hỏng trên Chrome / Edge / Firefox** — tức gần như mọi trình duyệt. Chromium trả
`canPlayType('application/vnd.apple.mpegurl')` = `"maybe"` (truthy) nhưng **không hề phát được
HLS trên desktop**. Player tin câu trả lời đó, đi nhánh native, gán `video.src` rồi chết →
màn hình "Không phát được tập này".

Đây là lỗi do **spec tôi viết sai** ("native HLS first"), agent làm đúng theo. Đã đảo lại thứ
tự cho khớp khuyến nghị của chính hls.js: **dùng MSE/hls.js ở mọi nơi có `MediaSource`**, chỉ
rơi về decoder của thẻ `<video>` khi hls.js không chạy được — thực tế là Safari/iOS, nơi HLS
native hoạt động thật và còn được tăng tốc phần cứng.

`tsc` và `vite build` đều **không thể** bắt lỗi này.

## Kết quả audit đối kháng (đã xong)

Một agent đọc lại từng file để chứng minh 16 fix có thật sự vào code — **không tin báo cáo
"đã sửa"**. Kết quả: **13 landed, 3 partial, 5 regression** do chính vòng sửa tạo ra.

### Đã xử lý trong phiên này

| | Việc | Trạng thái |
|---|---|---|
| R1 | **Vòng lặp import** `MovieRail` ↔ `Skeleton` do F10 tạo ra. Chưa nổ chỉ vì cả hai binding đều đọc trong render; sẽ thành `Cannot access before initialization` ngay khi dùng ở top level hoặc route-split `MovieRail` | ✅ đã tách sang `src/components/movie/layout.ts` (leaf module, không import gì) |
| R4 | Mũi tên cuộn rail thành **vĩnh viễn không bấm được trên tablet cảm ứng** (md+ nhưng không có hover) | ✅ thêm class `.rail-arrow` chỉ render khi `(hover:hover) and (pointer:fine)`, và `focus-visible:pointer-events-auto` cho bàn phím |

Ngoài ra đã xử lý nốt: **F7** (chỉ còn 1 ảnh `fetchPriority=high` trên trang chi tiết),
**F16** (không còn `text-text-low` nào trên nền `bg-surface-*`), **R2** (`HomePage` hạ thẻ
ngôn ngữ xuống `text-section` để không đụng tier của `<h1>`), **R3** (`fallbackFocusRef` chuyển
sang node gốc của trang, luôn tồn tại kể cả khi xoá mục xem-tiếp cuối cùng), **R5**
(`ConfirmDialog` dùng `stopImmediatePropagation`).

## Còn phải làm

1. **Commit** — repo chưa có commit nào. `git add -A && git commit`.
2. **Deploy** — `npx vercel --prod` (cần `npm i -g vercel` và login).
3. **Quyết định còn treo (F11)** — 3 chỗ vẫn dùng utility `text-eyebrow` thô:
   `Header.tsx:83` ("TV" trong wordmark), `EmbedPlayer.tsx:77` (badge trình phát dự phòng),
   `TaxonomyIndexPage.tsx:288` (slug trong tile). Audit đòi đổi hết sang `.eyebrow`, nhưng
   **cả ba đều không phải nhãn section** — ép vào là sai trừu tượng. Đã cố ý để nguyên.
4. **Chưa test Safari/iOS** — đó là nhánh HLS native duy nhất còn lại chưa chạy thật.
   Playwright ở đây là Chromium, đi nhánh MSE.
5. **Xoá `HANDOFF.md`** khi không cần nữa.

## Bẫy đã gặp — đừng lặp lại

**`episode_total` là number, không phải string.** API trả `"episode_total": 104`. Bản Kotlin
không dính vì `kotlinx.serialization` chạy `isLenient = true` nên tự ép kiểu; `JSON.parse` thì
không. Lỗi này làm `.trim()` throw và **sập toàn bộ trang chi tiết + trang xem**. Đã sửa tận
gốc: `str()` trong `src/lib/api/mappers.ts` giờ nhận `unknown` và ép kiểu an toàn, nên mọi
lệch kiểu về sau chỉ là chuyện thẩm mỹ chứ không phải màn hình trắng.

Đã quét toàn bộ ~90 trường của 5 endpoint trên 117 phim thật để xác nhận đây là vi phạm duy
nhất. Các trường số (`year`, `vote_average`, `tmdb_people_id`, `pagination.*`) đều đã đi qua
`num()` từ đầu nên không sao.

**Vite 8 dùng Rolldown, không phải Rollup.** `output.manualChunks` dạng object đã bị bỏ; phải
dùng `output.codeSplitting.groups`. Và không có `@types/node` trong dự án nên `vite.config.ts`
không import được `node:url`.

## Quyết định thiết kế đã chốt (đừng đảo ngược khi sửa tiếp)

| | Quy ước |
|---|---|
| **D1** | Nhãn eyebrow dùng class `.eyebrow` / `.eyebrow-muted` trong `theme.css` — không viết tay `text-eyebrow uppercase ...` nữa |
| **D2** | Một weight cho một tier: `text-display`/`text-hero`/`text-screen` → `font-black`; `text-section` → `font-semibold`. `<h1>` và `<h2>` không bao giờ cùng tier trên một màn hình |
| **D3** | Trạng thái "đã lưu" luôn là `text-mint`, không bao giờ `text-accent` |
| **D4** | Nút xoá lọc luôn `variant="secondary"`, nhãn `Xóa lọc ({n})`. `variant="primary"` trong empty state dành cho hành động tiến tới, không phải reset |
| **D5** | Chỉ 3 bán kính: `rounded-cell` (control dày đặc) · `rounded-card` (mặt phẳng/ảnh/panel) · `rounded-pill` (nút/chip) |
| **D6** | `text-text-low` chỉ đọc được trên nền `bg-ink`. Nằm trên `bg-surface-*` thì phải đổi sang `text-text-mid` (WCAG AA) |
| **D7** | Control hiện-khi-hover phải dùng `.reveal-on-hover` — `opacity-0` thuần vẫn ăn click, trên điện thoại sẽ nuốt cú chạm dành cho thẻ phim bên dưới |

Nguyên tắc gốc: accent `#FF3B5C` **chỉ** dành cho focus và hành động chính; gold `#FFC64B`
**chỉ** dành cho điểm đánh giá. Sức mạnh của bảng màu nằm ở sự khan hiếm đó.

## Ràng buộc kỹ thuật

- TS strict + `verbatimModuleSyntax` (phải `import type`) + `noUncheckedIndexedAccess`
  (`arr[0]` là `T | undefined`) + `noUnusedLocals`/`noUnusedParameters`.
- Không `any`, không cast, không `@ts-ignore`, không nới `tsconfig`.
- Import qua alias `@/`, không dùng `../../`.
- Chỉ transition `transform`/`opacity`/`box-shadow`/màu/`filter`.
- Không thêm dependency mới. Hiện có đúng: react, react-dom, react-router-dom,
  @tanstack/react-query, hls.js.

## Workflow đã chạy (có thể resume)

Script nằm ở `~/.claude/projects/-Users-thangdang-Documents-GitHub-td-tv-web/08b4fc64-53ca-4f38-b457-46368d804232/workflows/scripts/`:

| Run ID | Việc | Kết quả |
|---|---|---|
| `wf_156d586e-661` | Dựng UI: 4 nhóm component → 7 trang → build + 2 review | 14/14 agent, build xanh, 16 findings |
| `wf_1c1fdd6d-2da` | Sửa 17 findings: 4 agent file rời nhau → build → audit | 4 agent sửa xong (66 fix), build xanh, audit chưa xong |

Journal đầy đủ (mỗi agent một dòng `{"type":"result",...}`):
`~/.claude/projects/-Users-thangdang-Documents-GitHub-td-tv/08b4fc64-53ca-4f38-b457-46368d804232/subagents/workflows/<run-id>/journal.jsonl`
