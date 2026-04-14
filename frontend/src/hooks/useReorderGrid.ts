/**
 * useReorderGrid — encapsulates drag-and-drop state for the 5-column reorder grid.
 *
 * Usage:
 *   const {
 *     pages,              // PageState[] — reordered on every drag-over drop
 *     activeId,           // id of the item being dragged (null if idle)
 *     overIndex,          // gap index where the dragged item is hovering (null if idle)
 *     isDirty,            // true if current order differs from original
 *     handlers,           // { onDragStart, onDragOver, onDragEnd, onDragCancel }
 *   } = useReorderGrid(initialPages)
 */

import { useState, useCallback, useRef } from "react";
import type { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PageState {
  id: string;              // stable unique key
  pageNumber: number;      // 1-based original page number
  thumbnail: string;       // base64 data URL
}

interface UseReorderGridReturn {
  pages: PageState[];
  activeId: string | null;
  overIndex: number | null;
  isDirty: boolean;
  handlers: {
    onDragStart: (event: DragStartEvent) => void;
    onDragOver: (event: DragOverEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onDragCancel: () => void;
  };
  resetOrder: () => void;
  setPages: React.Dispatch<React.SetStateAction<PageState[]>>;
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useReorderGrid(initialPages: PageState[]): UseReorderGridReturn {
  const [pages, setPages] = useState<PageState[]>(initialPages);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Keep a mutable ref to the current pages during drag-over events
  // (so handlers always read the latest state without stale closures)
  const pagesRef = useRef<PageState[]>(initialPages);
  pagesRef.current = pages;

  // Stable original snapshot for isDirty and reset
  const originalIdsRef = useRef<string[]>(initialPages.map((p) => p.id));

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setOverIndex(null);
  }, []);

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !active) return;

    const currentPages = pagesRef.current;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) {
      setOverIndex(null);
      return;
    }

    const activeIdx = currentPages.findIndex((p) => p.id === activeId);
    const overIdx = currentPages.findIndex((p) => p.id === overId);

    if (activeIdx === -1) return;

    if (overIdx === -1) {
      // Hovering over a gap placeholder — over.id is the gap sentinel
      const gapIdx = parseInt(overId, 10);
      if (!isNaN(gapIdx) && gapIdx >= 0 && gapIdx <= currentPages.length) {
        setOverIndex(gapIdx);
      }
      return;
    }

    // Normal over another item — compute insert index
    const newPages = [...currentPages];
    const [moved] = newPages.splice(activeIdx, 1);

    let insertIdx = overIdx;
    if (activeIdx < overIdx) {
      insertIdx = overIdx; // item shifted left, overIdx already accounts for removal
    } else {
      insertIdx = overIdx; // item shifted right
    }

    newPages.splice(insertIdx, 0, moved);
    setPages(newPages);
    setOverIndex(insertIdx);
  }, []);

  const onDragEnd = useCallback((_event: DragEndEvent) => {
    // Dropped — keep last known order from onDragOver
    setActiveId(null);
    setOverIndex(null);
  }, []);

  const onDragCancel = useCallback(() => {
    setActiveId(null);
    setOverIndex(null);
  }, []);

  const resetOrder = useCallback(() => {
    const currentPages = pagesRef.current;
    const originalIds = originalIdsRef.current;
    const reordered = originalIds.map((id) => currentPages.find((p) => p.id === id)!);
    setPages(reordered);
  }, []);

  const isDirty = JSON.stringify(pages.map((p) => p.id)) !==
    JSON.stringify(originalIdsRef.current);

  return {
    pages,
    activeId,
    overIndex,
    isDirty,
    handlers: { onDragStart, onDragOver, onDragEnd, onDragCancel },
    resetOrder,
    setPages,
  };
}
