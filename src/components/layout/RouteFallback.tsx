/**
 * The gap between two lazy route chunks.
 *
 * The bar is absolutely placed at the top of the fallback box rather than at a
 * fixed viewport offset, because this renders in two very different places: in
 * the shell it lands directly under the sticky header, and on the player route
 * — which has no header at all — it lands at the top of the page.
 */
export default function RouteFallback() {
  return (
    <div className="relative min-h-[70vh]" aria-busy="true">
      <div
        role="progressbar"
        aria-label="Đang tải trang"
        className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-accent/20"
      >
        <div className="h-full w-full animate-shimmer bg-[linear-gradient(90deg,transparent_12%,var(--color-accent)_50%,transparent_88%)] bg-[length:220%_100%]" />
      </div>
    </div>
  );
}
