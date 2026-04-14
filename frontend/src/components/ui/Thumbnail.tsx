/**
 * Thumbnail — reusable page thumbnail card used across PDF tool pages.
 *
 * Props:
 *  thumbnail  — base64 data URL of the page image
 *  pageNumber — 1-based page number shown in the badge
 *  isSelected — whether the page is selected (adds blue border + ring)
 *  isDragging — whether this card is currently being dragged
 *  isGhost    — whether this card is the floating ghost clone (semi-transparent)
 *  dragHandleProps — spread onto the element that acts as the drag handle
 */
interface ThumbnailProps {
  thumbnail: string;
  pageNumber: number;
  isSelected?: boolean;
  isDragging?: boolean;
  isGhost?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onClick?: () => void;
  className?: string;
}

export function Thumbnail({
  thumbnail,
  pageNumber,
  isSelected = false,
  isDragging = false,
  isGhost = false,
  dragHandleProps = {},
  onClick,
  className = "",
}: ThumbnailProps) {
  return (
    <div
      className={`
        relative flex flex-col items-center select-none
        ${isGhost ? "opacity-60" : ""}
        ${className}
      `}
    >
      {/* Page tile */}
      <div
        onClick={onClick}
        {...dragHandleProps}
        className={`
          relative cursor-grab active:cursor-grabbing
          transition-all duration-150
          ${isDragging ? "opacity-40" : ""}
        `}
      >
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-1.5 left-1.5 z-10 w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
            <svg className="w-3 h-3" fill="none" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}
                    d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Thumbnail image */}
        <img
          src={thumbnail}
          alt={`Page ${pageNumber}`}
          className={`
            w-36 h-52 object-cover border-2 rounded
            transition-all duration-150
            ${isSelected
              ? "border-blue-500 ring-2 ring-blue-300 ring-offset-1"
              : "border-gray-200 hover:border-gray-400"
            }
            block
          `}
        />

        {/* Page number badge */}
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded pointer-events-none">
          {pageNumber}
        </span>
      </div>
    </div>
  );
}