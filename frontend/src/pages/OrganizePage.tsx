/**
 * OrganizePage — Single-PDF page editor with Insert + Extract modes.
 *
 * Three modes:
 *  - "normal"  : Save button, no + insert points
 *  - "insert"  : Save button, blue + insert points between thumbnails
 *  - "extract" : Extract button, no + insert points
 *
 * Layout: up to 5 thumbnails per row, action icons centered at top,
 * Insert icon (paper+plus), Extract icon (paper+arrow),
 * RotateLeft, RotateRight, Delete.
 */

import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { api, Job } from "@/services/api";
import { useJobPoll } from "@/hooks/useJobPoll";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PageState {
  id: string;             // stable unique key
  sourceDocId: number;    // which uploaded doc this page comes from
  originalIndex: number;  // 0-based index in its source PDF (never changes)
  thumbnail: string;      // base64 data URL
  selected: boolean;
  rotation: number;       // 0 | 90 | 180 | 270
  deleted: boolean;
}

type AppMode = "normal" | "insert" | "extract";

// ── Helpers ────────────────────────────────────────────────────────────────────

// Cumulative rotation — NOT wrapped to 0-359 so CSS always animates the shortest path.
const ROTATE_CW  = (r: number) => r + 90;
const ROTATE_CCW = (r: number) => r - 90;

function buildInitialPages(
  docId: number,
  thumbs: { page_number: number; image_base64: string }[]
): PageState[] {
  return thumbs.map((t, i) => ({
    id: `p-${docId}-${i}`,
    sourceDocId: docId,
    originalIndex: t.page_number - 1,
    thumbnail: t.image_base64,
    selected: false,
    rotation: 0,
    deleted: false,
  }));
}

// ── Icon SVGs ──────────────────────────────────────────────────────────────────

function IconInsert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      {/* Paper body */}
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      {/* Folded corner */}
      <polyline points="14 2 14 8 20 8" />
      {/* Plus sign in bottom-right */}
      <line x1="15" y1="17" x2="15" y2="21" strokeWidth={1.5} />
      <line x1="13" y1="19" x2="17" y2="19" strokeWidth={1.5} />
    </svg>
  );
}

function IconExtract() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      {/* Paper body */}
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      {/* Folded corner */}
      <polyline points="14 2 14 8 20 8" />
      {/* Arrow pointing right in the center */}
      <line x1="10" y1="12" x2="16" y2="12" strokeWidth={1.5} />
      <polyline points="13 9 16 12 13 15" strokeWidth={1.5} />
    </svg>
  );
}

function IconRotateLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function IconRotateRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function IconDelete() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

// ── InsertPoint — blue "+" centered in the 32px grid gap ─────────────────────────────────
// gap-12 = 48px, button = 28px (w-7).
// left: calc(100% + 10px) → button center = tile.right + 10px + 14px = tile.right + 24px = gap center.
// Button right = tile.right + 38px = 10px into next tile. Visually centered in the 48px gap.

function InsertPoint({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-1/2 -translate-y-1/2
                 w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white
                 flex items-center justify-center shadow-md z-20"
      style={{ left: "calc(100% + 10px)" }}
      title="Insert pages from another PDF"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
           strokeLinecap="round" className="w-4 h-4">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}

// ── PageTile ───────────────────────────────────────────────────────────────────

function PageTile({
  page,
  onSelect,
  onRotateCW,
  onRotateCCW,
  onDelete,
  allSelected,
}: {
  page: PageState;
  onSelect: () => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onDelete: () => void;
  allSelected: boolean;
}) {
  if (page.deleted) return null;

  return (
    <div className="flex flex-col items-center">

      {/* Page tile */}
      <div className="relative group cursor-pointer" onClick={onSelect}>
        {/* Selection indicator */}
        <div
          className={`
            absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded flex items-center justify-center
            transition-colors select-none pointer-events-none
            ${page.selected
              ? "bg-blue-500 text-white"
              : allSelected
                ? "bg-white/80 border border-gray-300"
                : "bg-white/50 border border-gray-300"
            }
          `}
        >
          {page.selected && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}
                    d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* Per-page hover toolbar */}
        <div
          className={`
            absolute right-1.5 top-1.5 z-10 flex flex-col gap-1
            transition-opacity duration-150
            ${page.selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
          `}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onRotateCCW(); }}
            className="w-6 h-6 bg-white/90 hover:bg-blue-50 rounded border border-gray-200
                       shadow-sm flex items-center justify-center transition-colors"
            title="Rotate left"
          >
            <svg className="w-3.5 h-3.5 text-gray-700" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRotateCW(); }}
            className="w-6 h-6 bg-white/90 hover:bg-blue-50 rounded border border-gray-200
                       shadow-sm flex items-center justify-center transition-colors"
            title="Rotate right"
          >
            <svg className="w-3.5 h-3.5 text-gray-700" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-6 h-6 bg-white/90 hover:bg-red-50 rounded border border-gray-200
                       shadow-sm flex items-center justify-center transition-colors"
            title="Delete page"
          >
            <svg className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>

        {/* Thumbnail */}
        <img
          src={page.thumbnail}
          alt={`Page ${page.originalIndex + 1}`}
          className={`
            w-36 h-52 object-cover border-2 rounded transition-all duration-150 select-none
            block
            ${page.selected
              ? "border-blue-500 ring-2 ring-blue-300 ring-offset-1"
              : "border-gray-200 group-hover:border-gray-400"
            }
          `}
          style={{ transform: `rotate(${page.rotation}deg)` }}
        />

        {/* Page number badge */}
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs bg-black/60
                         text-white px-1.5 py-0.5 rounded pointer-events-none">
          {page.originalIndex + 1}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────

export default function OrganizePage() {
  const navigate = useNavigate();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [primaryDocId, setPrimaryDocId] = useState<number | null>(null);
  const [primaryDocName, setPrimaryDocName] = useState("");
  const [pages, setPages] = useState<PageState[]>([]);
  const [mode, setMode] = useState<AppMode>("normal");
  const [outputFilename, setOutputFilename] = useState("organized.pdf");
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const [uploading, setUploading] = useState(false);

  // Hidden file input for insert-PDF dialog
  const insertInputRef = useRef<HTMLInputElement>(null);
  const [pendingInsertAfterIdx, setPendingInsertAfterIdx] = useState<number | null>(null);

  const { job: polledJob } = useJobPoll(createdJob?.id ?? 0);

  // ── Derived ───────────────────────────────────────────────────────────────
  const visiblePages = pages.filter((p) => !p.deleted);
  const selectedCount = visiblePages.filter((p) => p.selected).length;
  const allVisibleSelected = visiblePages.length > 0 && visiblePages.every((p) => p.selected);

  const isProcessing = createdJob?.status === "pending" || createdJob?.status === "processing";
  const isDone = polledJob?.status === "done" || createdJob?.status === "done";
  const isFailed = polledJob?.status === "failed" || createdJob?.status === "failed";

  // ── Grid: 5 tiles per row; "+" shown between adjacent tiles in insert mode ─────
  // Split visiblePages into chunks of 5 for row layout.
  const ROW_SIZE = 5;
  const chunks = [];
  for (let i = 0; i < visiblePages.length; i += ROW_SIZE) {
    chunks.push(visiblePages.slice(i, i + ROW_SIZE));
  }

  // ── Upload first PDF ──────────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      setPrimaryDocId(doc.id);
      setPrimaryDocName(doc.original_filename);
      setPages([]);
      setCreatedJob(null);
      setMode("normal");
      setOutputFilename(doc.original_filename.replace(/\.pdf$/i, "") + "_organized.pdf");

      const thumbs = await api.getDocumentThumbnails(doc.id);
      setPages(buildInitialPages(doc.id, thumbs));
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
    disabled: uploading || pages.length > 0, // only allow upload when no doc loaded
  });

  // ── Per-page actions ──────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => p.id === id ? { ...p, selected: !p.selected } : p)
    );
  }, []);

  const rotateCW = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => p.id === id ? { ...p, rotation: ROTATE_CW(p.rotation) } : p)
    );
  }, []);

  const rotateCCW = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => p.id === id ? { ...p, rotation: ROTATE_CCW(p.rotation) } : p)
    );
  }, []);

  const deletePage = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => p.id === id ? { ...p, deleted: true } : p)
    );
  }, []);

  // ── Batch operations ─────────────────────────────────────────────────────
  const selectAll = useCallback(() => {
    const newVal = !allVisibleSelected;
    setPages((prev) =>
      prev.map((p) => ({ ...p, selected: newVal && !p.deleted }))
    );
  }, [allVisibleSelected]);

  const rotateAllSelectedCW = useCallback(() => {
    setPages((prev) =>
      prev.map((p) =>
        p.selected && !p.deleted ? { ...p, rotation: ROTATE_CW(p.rotation) } : p
      )
    );
  }, []);

  const rotateAllSelectedCCW = useCallback(() => {
    setPages((prev) =>
      prev.map((p) =>
        p.selected && !p.deleted ? { ...p, rotation: ROTATE_CCW(p.rotation) } : p
      )
    );
  }, []);

  const deleteAllSelected = useCallback(() => {
    setPages((prev) =>
      prev.map((p) => (p.selected && !p.deleted ? { ...p, deleted: true } : p))
    );
  }, []);

  // ── Insert PDF ────────────────────────────────────────────────────────────
  const triggerInsert = useCallback((afterIdx: number) => {
    setPendingInsertAfterIdx(afterIdx);
    insertInputRef.current?.click();
  }, []);

  const handleInsertFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || pendingInsertAfterIdx === null || primaryDocId === null) return;
    e.target.value = "";

    setUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      const thumbs = await api.getDocumentThumbnails(doc.id);

      const newPages: PageState[] = thumbs.map((t, i) => ({
        id: `p-${doc.id}-${i}`,
        sourceDocId: doc.id,
        originalIndex: t.page_number - 1,
        thumbnail: t.image_base64,
        selected: false,
        rotation: 0,
        deleted: false,
      }));

      setPages((prev) => {
        const arr = [...prev];
        arr.splice(pendingInsertAfterIdx, 0, ...newPages);
        return arr;
      });

      toast.success(`Inserted ${newPages.length} pages from ${doc.original_filename}`);
    } catch {
      toast.error("Failed to insert pages");
    } finally {
      setUploading(false);
      setPendingInsertAfterIdx(null);
    }
  }, [pendingInsertAfterIdx, primaryDocId]);

  // ── Mode toggles ───────────────────────────────────────────────────────────
  const enterInsertMode  = useCallback(() => setMode("insert"), []);
  const enterExtractMode = useCallback(() => setMode("extract"), []);
  const exitInsertMode   = useCallback(() => setMode("normal"), []);
  const exitExtractMode  = useCallback(() => setMode("normal"), []);

  // ── Save (normal mode) ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (!primaryDocId) return;
    const remaining = pages.filter((p) => !p.deleted);
    if (remaining.length === 0) {
      toast.error("No pages left in the document");
      return;
    }
    try {
      const j = await api.createOrganizeJob(
        primaryDocId,
        remaining.map((p) => ({
          original_index: p.originalIndex,
          source_document_id: p.sourceDocId,
          rotation: p.rotation,
          deleted: false,
        })),
        outputFilename
      );
      setCreatedJob(j);
      toast.success("Organizing PDF…");
    } catch {
      toast.error("Failed to start organize job");
    }
  };

  // ── Extract (extract mode) ───────────────────────────────────────────────
  const handleExtract = async () => {
    if (!primaryDocId) return;
    const selected = visiblePages.filter((p) => p.selected);
    if (selected.length === 0) {
      toast.error("Select pages to extract");
      return;
    }
    try {
      const j = await api.createOrganizeJob(
        primaryDocId,
        selected.map((p) => ({
          original_index: p.originalIndex,
          source_document_id: p.sourceDocId,
          rotation: p.rotation,
          deleted: false,
        })),
        outputFilename
      );
      setCreatedJob(j);
      toast.success("Extracting pages…");
    } catch {
      toast.error("Failed to start extract");
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setPrimaryDocId(null);
    setPrimaryDocName("");
    setPages([]);
    setCreatedJob(null);
    setMode("normal");
    setOutputFilename("organized.pdf");
  };

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = async (jobId: number, filename: string) => {
    try {
      const blob = await api.downloadJobResult(jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const jobToShow = polledJob ?? createdJob;

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organize Pages</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Reorder, rotate, delete, insert, or extract pages
        </p>
      </div>

      {/* Processing card */}
      {jobToShow && (isProcessing) && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">
              {mode === "extract" ? "Extracting pages…" : "Organizing pages…"}
            </h2>
          </CardHeader>
          <CardBody className="space-y-2">
            <ProgressBar value={jobToShow.progress} />
            <p className="text-xs text-gray-400 text-right">{jobToShow.progress}%</p>
          </CardBody>
        </Card>
      )}

      {/* Done card */}
      {jobToShow && isDone && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-green-700">
              {mode === "extract" ? "Pages extracted!" : "PDF organized!"}
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">
              Your {mode === "extract" ? "extracted pages" : "organized PDF"} is ready.
            </p>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button
                onClick={() =>
                  handleDownload(jobToShow.id, jobToShow.output_filename ?? outputFilename)
                }
              >
                Download {outputFilename}
              </Button>
              <Button variant="ghost" onClick={handleReset}>
                {mode === "extract" ? "Extract Another" : "Organize Another"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Failed card */}
      {jobToShow && isFailed && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-red-700">Operation failed</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">
              {jobToShow.error_message || "An unexpected error occurred."}
            </p>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleReset}>Try Again</Button>
              <Button variant="ghost" onClick={() => navigate("/")}>Dashboard</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Main content (hidden while processing / done) */}
      {!jobToShow || (!isProcessing && !isDone && !isFailed) ? (
        <>
          {/* ── Upload drop zone (shown only when no PDF loaded) ── */}
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
                    <><Spinner size="sm" className="mx-auto mb-2" />
                    <p>Uploading…</p></>
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

          {/* ── Page editor (shown when PDF is loaded) ── */}
          {pages.length > 0 && (
            <Card>
              <CardHeader>
                {/* Top action bar: Insert / Extract / RotateL / RotateR / Delete */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Left: doc name + select all */}
                  <div className="flex items-center gap-3 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate max-w-xs"
                       title={primaryDocName}>
                      {primaryDocName}
                    </p>
                    <button
                      onClick={selectAll}
                      className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                        flex-shrink-0
                        ${allVisibleSelected
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "border-gray-300 bg-white hover:border-blue-400"
                        }
                      `}
                      title="Select / deselect all"
                    >
                      {allVisibleSelected && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}
                                d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className="text-sm text-gray-500">
                      {mode === "extract"
                        ? selectedCount > 0
                          ? `${selectedCount} selected`
                          : "Select pages"
                        : `${visiblePages.length} pages`
                      }
                    </span>
                  </div>

                  {/* Center: action icons */}
                  <div className="flex items-center gap-1">
                    {/* Insert icon — always leads to insert mode */}
                    <button
                      onClick={mode === "insert" ? exitInsertMode : enterInsertMode}
                      className={`
                        w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                        ${mode === "insert"
                          ? "bg-blue-500 text-white shadow-sm"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }
                      `}
                      title={mode === "insert" ? "Exit insert mode" : "Enter insert mode"}
                    >
                      <IconInsert />
                    </button>

                    {/* Extract icon — always leads to extract mode */}
                    <button
                      onClick={mode === "extract" ? exitExtractMode : enterExtractMode}
                      className={`
                        w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                        ${mode === "extract"
                          ? "bg-blue-500 text-white shadow-sm"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }
                      `}
                      title={mode === "extract" ? "Exit extract mode" : "Enter extract mode"}
                    >
                      <IconExtract />
                    </button>

                    {/* Divider */}
                    <div className="w-px h-6 bg-gray-200 mx-1" />

                    {/* Rotate Left */}
                    <button
                      onClick={rotateAllSelectedCCW}
                      disabled={selectedCount === 0 && mode === "extract"}
                      className="w-9 h-9 rounded-lg bg-white border border-gray-200
                                 text-gray-600 hover:bg-gray-50 flex items-center justify-center
                                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Rotate all selected pages left"
                    >
                      <IconRotateLeft />
                    </button>

                    {/* Rotate Right */}
                    <button
                      onClick={rotateAllSelectedCW}
                      disabled={selectedCount === 0 && mode === "extract"}
                      className="w-9 h-9 rounded-lg bg-white border border-gray-200
                                 text-gray-600 hover:bg-gray-50 flex items-center justify-center
                                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Rotate all selected pages right"
                    >
                      <IconRotateRight />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={deleteAllSelected}
                      disabled={selectedCount === 0}
                      className="w-9 h-9 rounded-lg bg-white border border-gray-200
                                 text-red-500 hover:bg-red-50 flex items-center justify-center
                                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Delete all selected pages"
                    >
                      <IconDelete />
                    </button>
                  </div>

                  {/* Right: hidden to match image (no separate action buttons here) */}
                  <div />
                </div>

                {pages.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {mode === "extract"
                      ? "Select pages to extract — only selected pages will be included."
                      : "Click + to insert pages from another PDF. Drag thumbnails to reorder."
                    }
                  </p>
                )}
              </CardHeader>

              <CardBody>
                {uploading && pages.length === 0 ? (
                  <div className="flex justify-center py-10"><Spinner /></div>
                ) : (
                  <>
                    {/* Thumbnail grid: CSS grid, 5 columns × gap-12. + is absolute child of each tile. */}
                    <div
                      className="grid gap-12"
                      style={{ gridTemplateColumns: "repeat(5, 9rem)" }}
                    >
                      {chunks.map((rowPages, rowIdx) =>
                        rowPages.map((page, colIdx) => {
                          const globalIdx = rowIdx * ROW_SIZE + colIdx;
                          return (
                            <div key={page.id} className="relative flex flex-col items-center">
                              <PageTile
                                page={page}
                                onSelect={() => toggleSelect(page.id)}
                                onRotateCW={() => rotateCW(page.id)}
                                onRotateCCW={() => rotateCCW(page.id)}
                                onDelete={() => deletePage(page.id)}
                                allSelected={allVisibleSelected}
                              />

                              {/* "+" overlaid at the right edge of this tile in insert mode,
                                  but only for tiles that have a next tile (not the last one) */}
                              {mode === "insert" && colIdx < rowPages.length - 1 && (
                                <InsertPoint onClick={() => triggerInsert(globalIdx + 1)} />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Hidden file input for insert */}
                    <input
                      ref={insertInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleInsertFile}
                    />
                  </>
                )}
              </CardBody>

              {/* Bottom action bar: output filename + Save/Extract */}
              <CardFooter className="flex-col items-stretch gap-4">
                <div className="flex gap-3 items-end">
                  <Input
                    label="Output filename"
                    value={outputFilename}
                    onChange={(e) => setOutputFilename(e.target.value)}
                    placeholder="output.pdf"
                  />
                  {mode === "extract" ? (
                    <Button
                      onClick={handleExtract}
                      disabled={selectedCount === 0 || isProcessing}
                    >
                      Extract ({selectedCount} selected)
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSave}
                      disabled={visiblePages.length === 0 || isProcessing}
                    >
                      Save ({visiblePages.length} pages)
                    </Button>
                  )}
                  <Button variant="ghost" onClick={handleReset}>Cancel</Button>
                </div>
              </CardFooter>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
