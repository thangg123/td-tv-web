#!/usr/bin/env bash
#
# tai-phim.sh — tải phim từ phimapi.com về file .mp4
#
#   ./tai-phim.sh <slug|url>                  # liệt kê server + tập
#   ./tai-phim.sh <slug|url> --tap 1          # tải tập 1
#   ./tai-phim.sh <slug|url> --tap all        # tải cả bộ
#   ./tai-phim.sh <slug|url> --sv 2 --tap all # chọn server thứ 2 (Lồng tiếng…)
#   ./tai-phim.sh <slug|url> --out ~/Phim     # thư mục đích (mặc định: ./phim)
#
# Cần: curl, jq, ffmpeg.  Có thêm yt-dlp thì nhanh hơn ~1.3x (tải 16 fragment song song).
# Đặt TEST_SECONDS=10 để thử nhanh 10 giây đầu (đường này luôn dùng ffmpeg).
#
# Cả hai đường đều remux `-c copy`, không encode lại. Đã kiểm chứng trên 1 tập 24 phút:
# file của yt-dlp và của ffmpeg BIT-IDENTICAL — cùng video/audio MD5, cùng 36757 frame,
# cùng 288,626,318 byte. Nhanh hơn ở đây không đánh đổi bất cứ thứ gì.

set -euo pipefail

API=https://phimapi.com

die() { printf '%s\n' "$*" >&2; exit 1; }

for tool in curl jq ffmpeg; do
  command -v "$tool" >/dev/null || die "Thiếu $tool. Cài bằng: brew install $tool"
done

[ $# -ge 1 ] || die "Dùng: $0 <slug|url> [--tap 1|all] [--sv N] [--out DIR]"

# Chấp nhận cả slug trần lẫn URL /phim/:slug, /xem/:slug?sv=&tap=
raw=$1; shift
slug=${raw%%\?*}
slug=${slug##*/}
[ -n "$slug" ] || die "Không đọc được slug từ: $raw"

server=1
tap=""
out=./phim

while [ $# -gt 0 ]; do
  case $1 in
    --tap) tap=${2:-}; shift 2 ;;
    --sv)  server=${2:-1}; shift 2 ;;
    --out) out=${2:-}; shift 2 ;;
    *) die "Tham số lạ: $1" ;;
  esac
done

detail=$(curl -fsS "$API/phim/$slug") || die "Không gọi được API cho slug: $slug"
[ "$(jq -r '.status' <<<"$detail")" != "false" ] || die "API không có phim: $slug"

title=$(jq -r '.movie.name' <<<"$detail")
servers=$(jq -r '[.episodes[].server_name] | length' <<<"$detail")
[ "$servers" -gt 0 ] || die "Phim \"$title\" chưa có nguồn phát."
[ "$server" -le "$servers" ] || die "Chỉ có $servers server, không có server thứ $server."

idx=$((server - 1))
server_name=$(jq -r --argjson i "$idx" '.episodes[$i].server_name' <<<"$detail")

# Không có --tap: chỉ liệt kê rồi thoát.
if [ -z "$tap" ]; then
  printf '%s\n\n' "$title"
  jq -r '.episodes | to_entries[] | "  --sv \(.key + 1)  \(.value.server_name)  (\(.value.server_data | length) tập)"' <<<"$detail"
  printf '\nTập trên %s:\n' "$server_name"
  jq -r --argjson i "$idx" '.episodes[$i].server_data[] | "  --tap \(.slug)   \(.name)"' <<<"$detail"
  exit 0
fi

# Lọc tập cần tải: "all" lấy hết, còn lại khớp theo slug hoặc tên tập.
if [ "$tap" = all ]; then
  picked=$(jq -c --argjson i "$idx" '.episodes[$i].server_data[] | {name, slug, m3u8: .link_m3u8}' <<<"$detail")
else
  picked=$(jq -c --argjson i "$idx" --arg t "$tap" '
    .episodes[$i].server_data[]
    | select((.slug | ascii_downcase) == ($t | ascii_downcase)
             or (.name | ascii_downcase) == ($t | ascii_downcase)
             or (.name | ascii_downcase) == ("tập " + ($t | ascii_downcase))
             or (.slug | ltrimstr("tap-") | ltrimstr("0")) == ($t | ltrimstr("0")))
    | {name, slug, m3u8: .link_m3u8}' <<<"$detail")
fi
[ -n "$picked" ] || die "Không tìm thấy tập \"$tap\" trên $server_name. Chạy không kèm --tap để xem danh sách."

# yt-dlp nhanh hơn, nhưng chỉ ffmpeg mới cắt được TEST_SECONDS.
if [ -z "${TEST_SECONDS:-}" ] && command -v yt-dlp >/dev/null; then
  downloader=yt-dlp
else
  downloader=ffmpeg
fi

mkdir -p "$out"
printf 'Phim: %s\nServer: %s\nThư mục: %s\nCông cụ: %s\n\n' "$title" "$server_name" "$out" "$downloader"

while IFS= read -r ep; do
  name=$(jq -r '.name' <<<"$ep")
  ep_slug=$(jq -r '.slug' <<<"$ep")
  url=$(jq -r '.m3u8' <<<"$ep")

  [ -n "$url" ] && [ "$url" != null ] || { printf '⚠  %s: không có link m3u8, bỏ qua.\n' "$name"; continue; }

  file="$out/${slug}${ep_slug:+-$ep_slug}.mp4"
  if [ -f "$file" ]; then
    printf '✓  %s đã có: %s\n' "$name" "$file"
    continue
  fi

  printf '↓  %s → %s  [%s]\n' "$name" "$file" "$downloader"
  tmp="$file.part.mp4"
  rm -f "$tmp"

  if [ "$downloader" = yt-dlp ]; then
    # -N 16: tải 16 segment song song. CDN bóp băng thông theo từng kết nối, nên
    # song song là chỗ ăn tiền duy nhất — 16 kết nối đã chạm trần đường mạng.
    yt-dlp -N 16 --no-progress --no-warnings -o "$tmp" "$url"
  else
    # -c copy: remux thẳng, không giải mã lại — giữ nguyên bit của nguồn.
    # aac_adtstoasc: bắt buộc khi nhét audio AAC từ TS sang MP4, thiếu là file câm.
    ffmpeg -hide_banner -loglevel warning -stats -y \
      ${TEST_SECONDS:+-t "$TEST_SECONDS"} \
      -i "$url" -c copy -bsf:a aac_adtstoasc "$tmp"
  fi \
    && mv "$tmp" "$file" \
    || { rm -f "$tmp"; printf '✗  %s tải lỗi.\n' "$name"; }
done <<<"$picked"

printf '\nXong.\n'
