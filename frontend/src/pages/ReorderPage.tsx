/**
 * ReorderPage — drag-and-drop page reorder with 5-column grid.
 *
 * UX flow:
 *  1. Upload a single PDF
 *  2. See 5-per-row thumbnail grid
 *  3. Drag any thumbnail — a ghost clone follows the pointer
 *  4. Hover a gap → pages to the left shift left, pages to the right shift right
 *  5. Drop → Save button becomes active
 *  6. Click Save → backend job runs → download button appears
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api, Job } from "@/services/api";
import { useJobPoll } from "@/hooks/useJobPoll";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PageState {
  id: string;       // stable sortable id
  pageNumber: number; // 1-based original page number
  thumbnail: string;  // base64 data URL
}

// ── SortableThumbnail ───────────────────────────────────────────────────────────

function SortableThumbnail({ page }: { page: PageState }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 1,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle — covers the whole thumbnail */}
      <div
        {...listeners}
        {...attributes}
        className="relative cursor-grab active:cursor-grabbing select-none"
      >
        <img
          src={page.thumbnail}
          alt={`Page ${page.pageNumber}`}
          className="w-36 h-52 object-cover border-2 border-gray-200 rounded
                     hover:border-blue-400 transition-colors duration-150 block"
        />
        {/* Page number badge */}
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2
                         text-xs bg-black/60 text-white px-1.5 py-0.5 rounded pointer-events-none">
          {page.pageNumber}
        </span>
        {/* Drag grip icon (top-right) */}
        <span className="absolute top-1.5 right-1.5 bg-white/80 rounded px-1 py-0.5
                         text-gray-400 pointer-events-none">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </span>
      </div>
    </div>
  );
}

// ── DragOverlay ghost ──────────────────────────────────────────────────────────

function GhostOverlay({ page }: { page: PageState }) {
  return (
    <div className="relative cursor-grabbing opacity-80">
      <img
        src={page.thumbnail}
        alt={`Page ${page.pageNumber}`}
        className="w-36 h-52 object-cover border-2 border-blue-400 rounded shadow-xl"
      />
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2
                       text-xs bg-black/60 text-white px-1.5 py-0.5 rounded pointer-events-none">
        {page.pageNumber}
      </span>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildInitialPages(
  docId: number,
  thumbs: { page_number: number; image_base64: string }[]
): PageState[] {
  return thumbs.map((t, i) => ({
    id: `p-${docId}-${i}`,
    pageNumber: t.page_number,
    thumbnail: t.image_base64,
  }));
}

// ── Page content block (shown after upload) ────────────────────────────────────

function ReorderContent({
  pages,
  docName,
  outputFilename,
  onOutputChange,
  onSave,
  onCancel,
  isDirty,
  activeId,
  overIndex,
}: {
  pages: PageState[];
  docName: string;
  outputFilename: string;
  onOutputChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isDirty: boolean;
  activeId: string | null;
  overIndex: number | null;
}) {
  // Chunk into rows of 5 — recomputed on every render
  const rows: PageState[][] = [];
  for (let i = 0; i < pages.length; i += ROW) {
    rows.push(pages.slice(i, i + ROW));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: doc name + page count */}
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-gray-700 truncate max-w-xs" title={docName}>
              {docName}
            </p>
            <span className="text-sm text-gray-500">{pages.length} pages</span>
          </div>
          {/* Right: reorder hint */}
          <span className="text-xs text-gray-400">
            {isDirty ? "Drag to reorder — click Save to apply" : "Drag pages to reorder"}
          </span>
        </div>
      </CardHeader>

      <CardBody>
        {/* Grid rows — 5 columns, SortableContext wraps ALL items at once */}
        <div className="space-y-8">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex flex-wrap items-start gap-8">
              {row.map((page, colIdx) => (
                <div key={page.id} className="relative flex flex-col items-center">
                  <SortableThumbnail page={page} />
                  {/* Drop zone after every item except the last in the row */}
                  {colIdx < row.length - 1 && (
                    <DroppableGap
                      gapId={`row-${rowIdx}-after-${colIdx}`}
                      isActive={
                        activeId !== null &&
                        overIndex !== null &&
                        overIndex > rowIdx * ROW + colIdx &&
                        overIndex <= rowIdx * ROW + colIdx + 1
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardBody>

      <CardFooter className="flex-col items-stretch gap-4">
        <div className="flex gap-3 items-end">
          <Input
            label="Output filename"
            value={outputFilename}
            onChange={(e) => onOutputChange(e.target.value)}
            placeholder="reordered.pdf"
          />
          <Button onClick={onSave} disabled={!isDirty}>
            Save Order
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// ── DroppableGap ───────────────────────────────────────────────────────────────

import { useDroppable } from "@dnd-kit/core";

function DroppableGap({
  gapId,
  isActive,
}: {
  gapId: string;
  isActive: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: gapId });

  return (
    <div
      ref={setNodeRef}
      className={`
        relative flex items-center justify-center
        transition-all duration-150
        h-52 w-8 flex-shrink-0
        ${isActive ? "bg-blue-100" : ""}
      `}
      style={{ width: "2rem", minWidth: "2rem" }}
    >
      {isActive && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-1 h-10 bg-blue-400 rounded-full" />
        </span>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────

const ROW = 5;

export default function ReorderPage() {
  const navigate = useNavigate();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [primaryDocId, setPrimaryDocId] = useState<number | null>(null);
  const [primaryDocName, setPrimaryDocName] = useState("");
  const [pages, setPages] = useState<PageState[]>([]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [outputFilename, setOutputFilename] = useState("reordered.pdf");
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const [uploading, setUploading] = useState(false);

  // dnd-kit state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const { job: polledJob } = useJobPoll(createdJob?.id ?? 0);

  // Derived
  const activePage = activeId ? pages.find((p) => p.id === activeId) ?? null : null;
  const isDirty = JSON.stringify(pages.map((p) => p.id)) !== JSON.stringify(originalIds);
  const isProcessing = createdJob?.status === "pending" || createdJob?.status === "processing";
  const isDone = polledJob?.status === "done" || createdJob?.status === "done";
  const isFailed = polledJob?.status === "failed" || createdJob?.status === "failed";
  const jobToShow = polledJob ?? createdJob;

  // ── DnD sensors ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // require 5px movement before drag starts
    })
  );

  // ── Upload ────────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      setPrimaryDocId(doc.id);
      setPrimaryDocName(doc.original_filename);
      setCreatedJob(null);
      setOutputFilename(doc.original_filename.replace(/\.pdf$/i, "") + "_reordered.pdf");

      const thumbs = await api.getDocumentThumbnails(doc.id);
      const newPages = buildInitialPages(doc.id, thumbs);
      setPages(newPages);
      setOriginalIds(newPages.map((p) => p.id));
      setActiveId(null);
      setOverIndex(null);
      toast.success(`Uploaded: ${doc.original_filename}`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploading || pages.length > 0,
  });

  // ── DnD event handlers ────────────────────────────────────────────────────
  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setOverIndex(null);
  }, []);

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !active) return;

    const currentPages = pages;
    const activeIdStr = String(active.id);

    const activeIdx = currentPages.findIndex((p) => p.id === activeIdStr);
    if (activeIdx === -1) return;

    // Check if over a droppable gap
    const overId = String(over.id);
    if (overId.startsWith("row-") || overId.startsWith("last-row-after")) {
      // Parse gap position from ID
      // Format: "row-{rowIdx}-after-{colIdx}" or "last-row-after-{colIdx}"
      let gapIdx = -1;
      if (overId.startsWith("row-")) {
        const parts = overId.split("-");
        const rowIdx = parseInt(parts[1], 10);
        const colIdx = parseInt(parts[3], 10);
        gapIdx = rowIdx * ROW + colIdx + 1;
      } else {
        const colIdx = parseInt(overId.split("-").pop()!, 10);
        gapIdx = (rows().length - 1) * ROW + colIdx + 1;
      }

      if (gapIdx >= 0 && gapIdx <= currentPages.length) {
        setOverIndex(gapIdx);
        // Reorder: move active item to gapIdx
        const newPages = [...currentPages];
        const [moved] = newPages.splice(activeIdx, 1);
        newPages.splice(gapIdx, 0, moved);
        setPages(newPages);
      }
      return;
    }

    // Normal item-to-item collision
    const overIdx = currentPages.findIndex((p) => p.id === overId);
    if (overIdx === -1) return;

    if (activeIdx === overIdx) {
      setOverIndex(null);
      return;
    }

    const newPages = [...currentPages];
    const [moved] = newPages.splice(activeIdx, 1);
    newPages.splice(overIdx, 0, moved);
    setPages(newPages);
    setOverIndex(overIdx);
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragEnd = useCallback((_event: DragEndEvent) => {
    setActiveId(null);
    setOverIndex(null);
  }, []);

  const onDragCancel = useCallback(() => {
    setActiveId(null);
    setOverIndex(null);
  }, []);

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setPrimaryDocId(null);
    setPrimaryDocName("");
    setPages([]);
    setOriginalIds([]);
    setCreatedJob(null);
    setOutputFilename("reordered.pdf");
    setActiveId(null);
    setOverIndex(null);
  };

  // ── Revert to original ───────────────────────────────────────────────────
  const handleRevert = () => {
    const reordered = originalIds.map((id) => pages.find((p) => p.id === id)!);
    setPages(reordered);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!primaryDocId || !isDirty) return;

    const newOrder = pages.map((p) => p.pageNumber - 1); // 0-based indices
    try {
      const j = await api.createReorderJob(primaryDocId, newOrder, outputFilename);
      setCreatedJob(j);
      // Update original so isDirty resets
      setOriginalIds(pages.map((p) => p.id));
      toast.success("Reordering PDF…");
    } catch {
      toast.error("Failed to start reorder job");
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!createdJob) return;
    try {
      const blob = await api.downloadJobResult(createdJob.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outputFilename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  // ── Chunk helper (must be stable) ────────────────────────────────────────
  const rows = () => {
    const result: PageState[][] = [];
    for (let i = 0; i < pages.length; i += ROW) {
      result.push(pages.slice(i, i + ROW));
    }
    return result;
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reorder Pages</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload a PDF, drag pages to a new order, then save
        </p>
      </div>

      {/* ── Processing / Done / Failed ── */}
      {jobToShow && isProcessing && (
        <Card>
          <CardHeader><h2 className="font-semibold text-gray-900">Reordering pages…</h2></CardHeader>
          <CardBody className="space-y-2">
            <ProgressBar value={jobToShow.progress} />
            <p className="text-xs text-gray-400 text-right">{jobToShow.progress}%</p>
          </CardBody>
        </Card>
      )}

      {jobToShow && isDone && (
        <Card>
          <CardHeader><h2 className="font-semibold text-green-700">PDF reordered!</h2></CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">Your reordered PDF is ready.</p>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button onClick={handleDownload}>Download {outputFilename}</Button>
              <Button variant="ghost" onClick={handleReset}>Reorder Another</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {jobToShow && isFailed && (
        <Card>
          <CardHeader><h2 className="font-semibold text-red-700">Operation failed</h2></CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">{jobToShow.error_message || "An error occurred."}</p>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleReset}>Try Again</Button>
              <Button variant="ghost" onClick={() => navigate("/")}>Dashboard</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* ── Upload drop zone (shown when no PDF loaded) ── */}
      {!jobToShow || (!isProcessing && !isDone && !isFailed) ? (
        <>
          {pages.length === 0 && (
            <Card>
              <CardBody>
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
                    transition-colors text-sm
                    ${isDragActive
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 hover:border-gray-400 text-gray-600"
                    }
                    ${uploading ? "opacity-50 cursor-wait" : ""}
                  `}
                >
                  <input {...getInputProps()} />
                  {uploading ? (
                    <><Spinner size="sm" className="mx-auto mb-2" /><p>Uploading…</p></>
                  ) : isDragActive ? (
                    <p className="font-medium">Drop PDF here</p>
                  ) : (
                    <p>
                      Drop a PDF here, or{" "}
                      <span className="text-blue-600 font-medium">click</span> to select
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── DnD grid (shown when PDF loaded) ── */}
          {pages.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
            >
              <SortableContext
                items={pages.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <ReorderContent
                  pages={pages}
                  docName={primaryDocName}
                  outputFilename={outputFilename}
                  onOutputChange={setOutputFilename}
                  onSave={handleSave}
                  onCancel={handleRevert}
                  isDirty={isDirty}
                  activeId={activeId}
                  overIndex={overIndex}
                />
              </SortableContext>

              <DragOverlay>
                {activePage ? <GhostOverlay page={activePage} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </>
      ) : null}
    </div>
  );
}