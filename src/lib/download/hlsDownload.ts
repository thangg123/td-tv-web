/**
 * Tải một tập HLS thẳng trong trình duyệt, không cần server và không thêm
 * dependency nào.
 *
 * Trình duyệt không phát được `.m3u8` thành file: playlist chỉ là danh sách vài
 * trăm segment `.ts` rời. Nhưng segment MPEG-TS nối byte-với-byte lại chính là
 * một file MPEG-TS hợp lệ — đúng thứ `cat *.ts > out.ts` làm — nên việc "tải
 * phim" ở đây rút gọn thành: lấy danh sách, tải song song, ghi ĐÚNG THỨ TỰ.
 *
 * Đổi lại file ra là `.ts` chứ không phải `.mp4`. Muốn `.mp4` thì phải remux,
 * mà remux trong trình duyệt nghĩa là kéo cả một muxer (mux.js ~35 KB gzip,
 * hoặc ffmpeg.wasm ~25 MB) vào một trang mà toàn bộ entry chunk chỉ có 100 KB.
 * `scripts/tai-phim.sh` làm việc đó tốt hơn và nhanh hơn — nút này là đường tắt
 * cho lúc đang xem dở, không phải bản thay thế.
 *
 * CDN trả `access-control-allow-origin: *` trên cả playlist lẫn segment nên
 * `fetch` đi thẳng, không cần proxy.
 */

/** 8 kết nối lấy gần hết phần băng thông đo được; hơn nữa gần như không thêm. */
const CONCURRENCY = 8;

export interface DownloadProgress {
  /** Số segment đã ghi xong. */
  readonly done: number;
  readonly total: number;
  /** Byte đã ghi — con số duy nhất người xem thấy có nghĩa. */
  readonly bytes: number;
}

/**
 * Người dùng bấm Huỷ, hoặc đóng hộp thoại chọn file. Không phải lỗi, và không
 * được hiện như lỗi.
 */
export class DownloadCancelled extends Error {
  constructor() {
    super('Đã huỷ tải.');
    this.name = 'DownloadCancelled';
  }
}

/*
 * File System Access API — Chrome/Edge có, Safari/Firefox không. Khai báo thay
 * vì ép kiểu: `window` gán được thẳng vào interface mở rộng có thuộc tính
 * optional, nên không chỗ nào cần cast.
 */
interface WritableFileStream {
  write(data: BufferSource): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

interface SaveFileHandle {
  createWritable(): Promise<WritableFileStream>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: ReadonlyArray<{
    description: string;
    accept: Record<string, readonly string[]>;
  }>;
}

interface SaveCapableWindow extends Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFileHandle>;
}

/** Nơi nhận byte: ổ đĩa nếu trình duyệt cho, còn không thì bộ nhớ. */
interface Sink {
  write(chunk: ArrayBuffer): Promise<void>;
  finish(): Promise<void>;
  discard(): Promise<void>;
}

const MIME = 'video/mp2t';

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

const resolve = (base: string, ref: string): string => new URL(ref, base).toString();

const fetchText = async (url: string, signal: AbortSignal): Promise<string> => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Không tải được playlist (HTTP ${response.status}).`);
  }
  return response.text();
};

const linesOf = (playlist: string): string[] =>
  playlist.split('\n').map((line) => line.trim());

/**
 * Master playlist trỏ tới nhiều variant; lấy BANDWIDTH cao nhất để không vô
 * tình tải nhầm bản thấp hơn. Nguồn hiện tại chỉ có một variant, nhưng đây là
 * chỗ duy nhất quyết định chất lượng nên nó phải đúng kể cả khi nguồn đổi.
 */
const pickBestVariant = (playlist: string, playlistUrl: string): string | null => {
  const lines = linesOf(playlist);
  let bestBandwidth = -1;
  let bestUrl: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined || !line.startsWith('#EXT-X-STREAM-INF')) continue;

    const next = lines[i + 1];
    if (next === undefined || next.length === 0 || next.startsWith('#')) continue;

    const parsed = Number.parseInt(/BANDWIDTH=(\d+)/.exec(line)?.[1] ?? '', 10);
    const bandwidth = Number.isFinite(parsed) ? parsed : 0;
    if (bandwidth > bestBandwidth) {
      bestBandwidth = bandwidth;
      bestUrl = resolve(playlistUrl, next);
    }
  }

  return bestUrl;
};

const segmentUrlsOf = (playlist: string, playlistUrl: string): string[] =>
  linesOf(playlist)
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => resolve(playlistUrl, line));

/**
 * Segment mã hoá AES-128 mà nối thẳng thì ra file rác *vẫn tải về được* — im
 * lặng ở đây là tệ nhất, nên chặn từ đầu.
 */
const assertNotEncrypted = (playlist: string): void => {
  const key = linesOf(playlist).find((line) => line.startsWith('#EXT-X-KEY'));
  if (key && !key.includes('METHOD=NONE')) {
    throw new Error('Tập này mã hoá, trình duyệt không ghép được. Hãy dùng scripts/tai-phim.sh.');
  }
};

const saveBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

/**
 * Phải gọi TRƯỚC mọi `await` mạng: `showSaveFilePicker` đòi user activation,
 * mà activation hết hạn sau vài giây — fetch playlist xong mới hỏi là hộp thoại
 * bị trình duyệt từ chối.
 */
const openSink = async (fileName: string): Promise<Sink> => {
  const saveCapable: SaveCapableWindow = window;
  const picker = saveCapable.showSaveFilePicker;

  if (picker) {
    const handle = await picker.call(window, {
      suggestedName: fileName,
      types: [{ description: 'Video MPEG-TS', accept: { [MIME]: ['.ts'] } }],
    });
    const stream = await handle.createWritable();
    return {
      write: (chunk) => stream.write(chunk),
      finish: () => stream.close(),
      discard: () => stream.abort(),
    };
  }

  /*
   * Không có File System Access: giữ trong bộ nhớ rồi thả ra một Blob. Một tập
   * 24 phút là ~275 MB, tab chịu được, nhưng đây là lý do đường ổ đĩa được ưu
   * tiên. Mảng này là bộ đệm byte cục bộ — chỗ duy nhất trong repo cố tình
   * dùng push, vì bản sao bất biến của 275 MB là vô nghĩa.
   */
  const parts: ArrayBuffer[] = [];
  return {
    write: async (chunk) => {
      parts.push(chunk);
    },
    finish: async () => {
      saveBlob(new Blob(parts, { type: MIME }), fileName);
      parts.length = 0;
    },
    discard: async () => {
      parts.length = 0;
    },
  };
};

const fetchSegment = async (url: string, signal: AbortSignal): Promise<ArrayBuffer> => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Không tải được một phần của tập (HTTP ${response.status}).`);
  }
  return response.arrayBuffer();
};

/**
 * Tải `m3u8Url` về máy dưới dạng một file `.ts`.
 *
 * Tải theo lô song song rồi ghi tuần tự: thứ tự segment là thứ tự thời gian của
 * phim, ghi sai thứ tự là phim nhảy lung tung. Lô cũng chặn luôn bộ nhớ ở mức
 * CONCURRENCY segment (~6 MB) thay vì cả tập.
 */
export const downloadEpisode = async (
  m3u8Url: string,
  fileName: string,
  onProgress: (progress: DownloadProgress) => void,
  signal: AbortSignal,
): Promise<void> => {
  let sink: Sink;
  try {
    sink = await openSink(fileName);
  } catch (error: unknown) {
    if (isAbort(error)) throw new DownloadCancelled();
    throw error;
  }

  try {
    const first = await fetchText(m3u8Url, signal);
    const variantUrl = pickBestVariant(first, m3u8Url);

    const mediaUrl = variantUrl ?? m3u8Url;
    const media = variantUrl ? await fetchText(variantUrl, signal) : first;

    assertNotEncrypted(media);

    const urls = segmentUrlsOf(media, mediaUrl);
    if (urls.length === 0) throw new Error('Playlist rỗng, không có gì để tải.');

    let bytes = 0;
    onProgress({ done: 0, total: urls.length, bytes });

    for (let start = 0; start < urls.length; start += CONCURRENCY) {
      const batch = urls.slice(start, start + CONCURRENCY);
      const chunks = await Promise.all(batch.map((url) => fetchSegment(url, signal)));

      for (const chunk of chunks) {
        await sink.write(chunk);
        bytes += chunk.byteLength;
      }

      onProgress({ done: Math.min(start + CONCURRENCY, urls.length), total: urls.length, bytes });
    }

    await sink.finish();
  } catch (error: unknown) {
    await sink.discard().catch(() => undefined);
    if (isAbort(error)) throw new DownloadCancelled();
    throw error;
  }
};
