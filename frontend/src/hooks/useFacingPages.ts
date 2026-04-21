/**
 * useFacingPages — computes the effective position for each page number
 * given a numbering mode and the user's chosen corner position.
 *
 * In "single" mode: every page gets the chosen position.
 * In "facing" mode: pages are paired (0,1), (2,3), …
 *   — even index (0,2,…) → chosen position
 *   — odd index  (1,3,…) → horizontally mirrored position
 *
 * Returns getPositionForPage(pageIndex: number) → Position
 */

export type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type Mode = "single" | "facing";

function mirror(position: Position): Position {
  const map: Record<Position, Position> = {
    "top-left": "top-right",
    "top-right": "top-left",
    "bottom-left": "bottom-right",
    "bottom-right": "bottom-left",
  };
  return map[position];
}

export function useFacingPages(mode: Mode, position: Position) {
  const getPositionForPage = (pageIndex: number): Position => {
    if (mode === "single") {
      return position;
    }
    // facing mode: even 0-based index → chosen position; odd → mirrored
    return pageIndex % 2 === 0 ? position : mirror(position);
  };

  return { getPositionForPage };
}