/**
 * PositionGrid — 2×2 corner selector for page number placement.
 *
 * Displays a 2×2 grid of corner positions (TL, TR, BL, BR).
 * The selected cell shows a red circle marker.
 *
 * Props:
 *  value     — currently selected position string
 *  onChange   — called when user clicks a cell with the new position
 */

export type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface PositionGridProps {
  value: Position;
  onChange: (pos: Position) => void;
}

const POSITIONS: Position[][] = [
  ["top-left", "top-right"],
  ["bottom-left", "bottom-right"],
];

const POSITION_LABELS: Record<Position, string> = {
  "top-left": "Top Left",
  "top-right": "Top Right",
  "bottom-left": "Bottom Left",
  "bottom-right": "Bottom Right",
};

export function PositionGrid({ value, onChange }: PositionGridProps) {
  return (
    <div
      className="inline-grid grid-cols-2 gap-2 select-none"
      role="group"
      aria-label="Page number position selector"
    >
      {POSITIONS.map((row) =>
        row.map((pos) => {
          const isSelected = value === pos;
          return (
            <button
              key={pos}
              type="button"
              onClick={() => onChange(pos)}
              title={POSITION_LABELS[pos]}
              aria-pressed={isSelected}
              className={`
                relative flex items-center justify-center w-12 h-12
                rounded-md border-2 transition-all duration-150
                ${isSelected
                  ? "bg-red-50 border-red-500"
                  : "bg-white border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              <span className={`w-5 h-5 rounded-full shadow-sm ${isSelected ? "bg-red-500" : "bg-transparent"}`} />
            </button>
          );
        })
      )}
    </div>
  );
}