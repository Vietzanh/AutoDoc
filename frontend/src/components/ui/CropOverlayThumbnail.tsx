/**
 * CropOverlayThumbnail — renders a page thumbnail with semi-transparent blue
 * overlays on the edges that will be trimmed.
 *
 * The overlay dimensions are computed as percentages of the actual PDF page
 * dimensions (in points), so they're accurate regardless of the thumbnail's
 * display size.
 */

interface CropOverlayThumbnailProps {
  /** Base64 data-URL of the thumbnail image. */
  thumbnail: string;
  /** 1-based page number shown in the badge. */
  pageNumber: number;
  /** Actual PDF page width in points (from backend). */
  widthPts: number;
  /** Actual PDF page height in points (from backend). */
  heightPts: number;
  /** Trim margins in **points**. */
  margins: { top: number; bottom: number; left: number; right: number };
  /** Whether to show the crop overlay on this thumbnail. */
  showOverlay: boolean;
}

export function CropOverlayThumbnail({
  thumbnail,
  pageNumber,
  widthPts,
  heightPts,
  margins,
  showOverlay,
}: CropOverlayThumbnailProps) {
  // Compute overlay sizes as percentages of the page dimensions.
  const topPct = widthPts > 0 ? Math.min((margins.top / heightPts) * 100, 100) : 0;
  const bottomPct = heightPts > 0 ? Math.min((margins.bottom / heightPts) * 100, 100) : 0;
  const leftPct = widthPts > 0 ? Math.min((margins.left / widthPts) * 100, 100) : 0;
  const rightPct = widthPts > 0 ? Math.min((margins.right / widthPts) * 100, 100) : 0;

  const hasOverlay =
    showOverlay && (margins.top > 0 || margins.bottom > 0 || margins.left > 0 || margins.right > 0);

  return (
    <div className="relative flex flex-col items-center select-none">
      <div className="relative overflow-hidden rounded-lg shadow-sm border-2 border-gray-200">
        {/* Thumbnail image */}
        <img
          src={thumbnail}
          alt={`Page ${pageNumber}`}
          className="w-full h-auto block"
          draggable={false}
        />

        {hasOverlay && (
          <>
            {/* Top trim overlay */}
            {topPct > 0 && (
              <div
                className="absolute top-0 left-0 right-0 bg-blue-400/25 border-b border-dashed border-blue-500/60"
                style={{ height: `${topPct}%` }}
              />
            )}

            {/* Bottom trim overlay */}
            {bottomPct > 0 && (
              <div
                className="absolute bottom-0 left-0 right-0 bg-blue-400/25 border-t border-dashed border-blue-500/60"
                style={{ height: `${bottomPct}%` }}
              />
            )}

            {/* Left trim overlay — fills gap between top and bottom overlays */}
            {leftPct > 0 && (
              <div
                className="absolute left-0 bg-blue-400/25 border-r border-dashed border-blue-500/60"
                style={{
                  width: `${leftPct}%`,
                  top: `${topPct}%`,
                  bottom: `${bottomPct}%`,
                }}
              />
            )}

            {/* Right trim overlay — fills gap between top and bottom overlays */}
            {rightPct > 0 && (
              <div
                className="absolute right-0 bg-blue-400/25 border-l border-dashed border-blue-500/60"
                style={{
                  width: `${rightPct}%`,
                  top: `${topPct}%`,
                  bottom: `${bottomPct}%`,
                }}
              />
            )}
          </>
        )}

        {/* Page number badge */}
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-xs bg-black/60 text-white px-2 py-0.5 rounded z-10 pointer-events-none">
          {pageNumber}
        </span>
      </div>
    </div>
  );
}
