import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { api, Document, Job } from "@/services/api";
import { useJobPoll } from "@/hooks/useJobPoll";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PageState {
  id: string; // stable unique key
  originalIndex: number; // 0-based index in the ORIGINAL uploaded PDF (never changes)
  thumbnail: string; // base64 data URL
  selected: boolean;
  rotation: number; // 0 | 90 | 180 | 270
  deleted: boolean;
  // For pages inserted from another PDF
  insertedDocId?: number;
  insertedDocName?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ROTATE_CW = (r: number) => (r + 90) % 360;
const ROTATE_CCW = (r: number) => (r - 90 + 360) % 360;

function insertAfter(arr: unknown[], index: number, item: unknown) {
  return [...arr.slice(0, index + 1), item, ...arr.slice(index + 1)];
}

function buildInitialPages(
  thumbnails: { page_number: number; image_base64: string }[]
): PageState[] {
  return thumbnails.map((t, displayIdx) => ({
    id: `page-${t.page_number - 1}`,
    originalIndex: t.page_number - 1,
    thumbnail: t.image_base64,
    selected: false,
    rotation: 0,
    deleted: false,
  }));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** A single page thumbnail tile */
function PageTile({
  page,
  displayIndex,
  isDragging,
  isDragTarget,
  onSelect,
  onRotateCW,
  onRotateCCW,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onInsertClick,
  onHover,
  onLeave,
}: {
  page: PageState;
  displayIndex: number;
  isDragging: boolean;
  isDragTarget: boolean;
  onSelect: () => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onInsertClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  if (page.deleted) return null;

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      {/* Insert "+" button — shown before every page tile */}
      <InsertButton onClick={onInsertClick} />

      {/* Page tile */}
      <div className="relative group" draggable onDragStart={onDragStart}>
        {/* Selection checkbox */}
        <div
          className={`
            absolute top-1 left-1 z-10 w-5 h-5 rounded cursor-pointer
            flex items-center justify-center transition-colors
            ${page.selected
              ? "bg-blue-500 text-white"
              : "bg-white/80 border border-gray-300 hover:bg-blue-50"
            }
          `}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          title="Select page"
        >
          {page.selected && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* Per-page hover toolbar */}
        <div
          className={`
            absolute top-1 right-1 z-10 flex flex-col gap-1
            transition-opacity duration-150
            ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}
          `}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onRotateCCW(); }}
            className="w-7 h-7 bg-white/90 hover:bg-blue-50 rounded border border-gray-200 shadow-sm flex items-center justify-center transition-colors"
            title="Rotate counter-clockwise"
          >
            <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRotateCW(); }}
            className="w-7 h-7 bg-white/90 hover:bg-blue-50 rounded border border-gray-200 shadow-sm flex items-center justify-center transition-colors"
            title="Rotate clockwise"
          >
            <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 bg-white/90 hover:bg-red-50 rounded border border-gray-200 shadow-sm flex items-center justify-center transition-colors"
            title="Delete page"
          >
            <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>

        {/* Drag handle indicator */}
        <div
          className={`
            absolute bottom-1 right-1 z-10 opacity-0 group-hover:opacity-100
            transition-opacity text-gray-400 cursor-grab
          `}
          title="Drag to reorder"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
          </svg>
        </div>

        {/* Thumbnail image */}
        <img
          src={page.thumbnail}
          alt={`Page ${page.originalIndex + 1}`}
          className={`
            w-36 h-52 object-cover border-2 rounded cursor-grab
            transition-all duration-150 select-none
            ${page.selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-400"}
            ${isDragging ? "opacity-30 scale-95" : ""}
            ${isDragTarget ? "ring-2 ring-blue-400 ring-offset-1" : ""}
          `}
          style={{ display: "block", transform: `rotate(${page.rotation}deg)` }}
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          onDragOver={onDragOver}
          onDrop={(e) => { e.preventDefault(); onDrop(); }}
        />

        {/* Page number badge */}
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded pointer-events-none">
          {page.originalIndex + 1}
        </span>
      </div>
    </div>
  );
}

/** "+" insert button between pages */
function InsertButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`
        relative flex items-center justify-center select-none
        w-5 h-5 transition-colors duration-100 cursor-pointer flex-shrink-0
        ${hovered ? "text-blue-500" : "text-gray-300 hover:text-blue-300"}
      `}
      style={{ width: "1.25rem", minWidth: "1.25rem" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      title="Insert pages from another PDF"
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      {hovered && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-blue-400" />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface Thumbnail {
  page_number: number;
  image_base64: string;
}

export default function OrganizePage() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [uploading, setUploading] = useState(false);

  /** Core page state — drives the entire UI */
  const [pages, setPages] = useState<PageState[]>([]);
  const [mode, setMode] = useState<"organize" | "extract">("organize");
  const [outputFilename, setOutputFilename] = useState("organized.pdf");
  const [createdJob, setCreatedJob] = useState<Job | null>(null);

  // Drag-and-drop
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragTargetIdx, setDragTargetIdx] = useState<number | null>(null);

  // Insert PDF from another doc
  const insertInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingInsertIdx, setPendingInsertIdx] = useState<number | null>(null);

  const { job } = useJobPoll(createdJob?.id ?? 0);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedCount = pages.filter((p) => p.selected && !p.deleted).length;
  const visiblePages = pages.filter((p) => !p.deleted);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await api.listDocuments(0, 100);
      setDocs(res.documents);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const selectDocument = useCallback(async (doc: Document) => {
    setSelectedDoc(doc);
    setPages([]);
    setCreatedJob(null);
    setThumbnails([]);
    setDraggedIdx(null);
    setDragTargetIdx(null);
    setMode("organize");
    setLoadingThumbs(true);
    try {
      const thumbs = await api.getDocumentThumbnails(doc.id);
      setThumbnails(thumbs);
      setPages(buildInitialPages(thumbs));
    } catch {
      toast.error("Failed to load page thumbnails");
      setSelectedDoc(null);
    } finally {
      setLoadingThumbs(false);
    }
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      setDocs((prev) => [doc, ...prev]);
      await selectDocument(doc);
      toast.success(`Uploaded: ${doc.original_filename}`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }, [selectDocument]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploading,
  });

  // ── Per-page operations ────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }, []);

  const rotatePageCW = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: ROTATE_CW(p.rotation) } : p))
    );
  }, []);

  const rotatePageCCW = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: ROTATE_CCW(p.rotation) } : p))
    );
  }, []);

  const deletePage = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, deleted: true } : p))
    );
  }, []);

  // ── Batch operations ───────────────────────────────────────────────────────
  const selectAll = useCallback(() => {
    const allSelected = visiblePages.every((p) => p.selected);
    setPages((prev) =>
      prev.map((p) => (!p.deleted ? { ...p, selected: !allSelected } : p))
    );
  }, [visiblePages]);

  const rotateAllSelected = useCallback(() => {
    setPages((prev) =>
      prev.map((p) =>
        p.selected && !p.deleted ? { ...p, rotation: ROTATE_CW(p.rotation) } : p
      )
    );
  }, []);

  const deleteAllSelected = useCallback(() => {
    setPages((prev) =>
      prev.map((p) => (p.selected && !p.deleted ? { ...p, deleted: true } : p))
    );
  }, []);

  // ── Drag-and-drop reorder ──────────────────────────────────────────────────
  const handleDragStart = useCallback((displayIdx: number) => {
    setDraggedIdx(displayIdx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, displayIdx: number) => {
    e.preventDefault();
    setDragTargetIdx(displayIdx);
  }, []);

  const handleDrop = useCallback((displayIdx: number) => {
    if (draggedIdx === null || draggedIdx === displayIdx) {
      setDraggedIdx(null);
      setDragTargetIdx(null);
      return;
    }
    setPages((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(draggedIdx, 1);
      arr.splice(displayIdx, 0, moved);
      return arr;
    });
    setDraggedIdx(null);
    setDragTargetIdx(null);
  }, [draggedIdx]);

  const handleDragEnd = useCallback(() => {
    setDraggedIdx(null);
    setDragTargetIdx(null);
  }, []);

  // ── Insert PDF at a position ───────────────────────────────────────────────
  const triggerInsert = useCallback((displayIdx: number) => {
    setPendingInsertIdx(displayIdx);
    insertInputRef.current?.click();
  }, []);

  const handleInsertFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || pendingInsertIdx === null) return;
    e.target.value = ""; // reset so same file can be re-selected

    try {
      const doc = await api.uploadDocument(file);
      setDocs((prev) => [doc, ...prev]);
      const thumbs = await api.getDocumentThumbnails(doc.id);

      const newPages: PageState[] = thumbs.map((t) => ({
        id: `inserted-${doc.id}-${t.page_number - 1}`,
        originalIndex: t.page_number - 1,
        thumbnail: t.image_base64,
        selected: false,
        rotation: 0,
        deleted: false,
        insertedDocId: doc.id,
        insertedDocName: doc.original_filename,
      }));

      setPages((prev) => {
        const arr = [...prev];
        arr.splice(pendingInsertIdx, 0, ...newPages);
        return arr;
      });

      toast.success(`Inserted ${newPages.length} pages from ${doc.original_filename}`);
    } catch {
      toast.error("Failed to insert pages");
    } finally {
      setPendingInsertIdx(null);
    }
  }, [pendingInsertIdx]);

  // ── Save / Extract job ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedDoc) return;
    const remaining = pages.filter((p) => !p.deleted);
    if (remaining.length === 0) {
      toast.error("No pages left in the document");
      return;
    }
    try {
      const j = await api.createOrganizeJob(
        selectedDoc.id,
        pages.map((p) => ({
          original_index: p.originalIndex,
          rotation: p.rotation,
          deleted: p.deleted,
        })),
        outputFilename
      );
      setCreatedJob(j);
      toast.success("Organizing PDF…");
    } catch {
      toast.error("Failed to start organize job");
    }
  };

  const handleExtract = async () => {
    if (!selectedDoc) return;
    const selected = visiblePages.filter((p) => p.selected);
    if (selected.length === 0) {
      toast.error("Select pages to extract");
      return;
    }
    try {
      const j = await api.createExtractJob(
        selectedDoc.id,
        selected.map((p) => ({
          original_index: p.originalIndex,
          rotation: p.rotation,
          deleted: p.deleted,
        })),
        outputFilename
      );
      // Extract is instant — wait for it to finish then download
      // Poll briefly
      let done = false;
      let attempt = 0;
      while (!done && attempt < 30) {
        await new Promise((r) => setTimeout(r, 500));
        const refreshed = await api.getJob(j.id);
        if (refreshed.status === "done") {
          done = true;
          const blob = await api.downloadJobResult(refreshed.id);
          downloadBlob(blob, outputFilename);
          toast.success("Extraction complete!");
        } else if (refreshed.status === "failed") {
          done = true;
          toast.error(refreshed.error_message || "Extraction failed");
        }
        attempt++;
      }
    } catch {
      toast.error("Failed to extract pages");
    }
  };

  // ── Reset ───────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setSelectedDoc(null);
    setThumbnails([]);
    setPages([]);
    setCreatedJob(null);
    setDraggedIdx(null);
    setDragTargetIdx(null);
    setMode("organize");
    setOutputFilename("organized.pdf");
  };

  const handleDownload = async (jobId: number, filename: string) => {
    try {
      const blob = await api.downloadJobResult(jobId);
      downloadBlob(blob, filename);
    } catch {
      toast.error("Download failed");
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Derived states ──────────────────────────────────────────────────────────
  const isProcessing = createdJob?.status === "pending" || createdJob?.status === "processing";
  const isDone = createdJob?.status === "done";
  const isFailed = createdJob?.status === "failed";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organize Pages</h1>
          <p className="text-sm text-gray-500 mt-1">
            Reorder, rotate, delete, insert, or extract pages from a PDF
          </p>
        </div>

        {/* Mode switcher */}
        {selectedDoc && pages.length > 0 && !createdJob && (
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("organize"); setOutputFilename("organized.pdf"); }}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                ${mode === "organize"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              Save
            </button>
            <button
              onClick={() => { setMode("extract"); setOutputFilename("extracted.pdf"); }}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                ${mode === "extract"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              Extract
            </button>
          </div>
        )}
      </div>

      {/* Processing state */}
      {createdJob && isProcessing && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">
              {mode === "organize" ? "Organizing pages…" : "Extracting pages…"}
            </h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <ProgressBar value={createdJob.progress} />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Deleting…</span>
              <span>{createdJob.progress}%</span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Done state */}
      {createdJob && isDone && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-green-700">
              {mode === "organize" ? "PDF organized!" : "Pages extracted!"}
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">
              Your {mode === "organize" ? "organized PDF" : "extracted pages"} is ready.
            </p>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button
                onClick={() =>
                  handleDownload(createdJob.id, createdJob.output_filename ?? outputFilename)
                }
              >
                Download {outputFilename}
              </Button>
              <Button variant="ghost" onClick={handleReset}>
                {mode === "organize" ? "Organize Another" : "Extract Another"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Failed state */}
      {createdJob && isFailed && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-red-700">Operation failed</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">
              {createdJob.error_message || "An unexpected error occurred."}
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

      {/* Document selection (hidden while processing or done) */}
      {!createdJob && (
        <>
          {/* Upload drop zone */}
          <Card>
            <CardBody>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-xl p-5 text-center cursor-pointer
                  transition-colors text-sm
                  ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
                  ${uploading ? "opacity-50 cursor-wait" : ""}
                `}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <><Spinner size="sm" className="mx-auto mb-2" /><p className="text-gray-600">Uploading…</p></>
                ) : isDragActive ? (
                  <p className="text-blue-600 font-medium">Drop PDF here</p>
                ) : (
                  <p className="text-gray-600">
                    Drop a PDF here to upload, or{" "}
                    <span className="text-blue-600 font-medium">click</span> to select
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Document list */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  Select a Document
                  {selectedDoc && (
                    <span className="ml-2 text-sm font-normal text-blue-600">
                      — {selectedDoc.original_filename}
                    </span>
                  )}
                </h2>
                <Button variant="ghost" size="sm" onClick={loadDocs}>Refresh</Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {loadingDocs ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : docs.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-gray-500">
                  <p className="text-sm">No documents available</p>
                  <p className="text-xs text-gray-400 mt-1">Upload a PDF above to get started</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {docs.map((doc) => (
                    <li
                      key={doc.id}
                      className={`
                        flex items-center gap-4 px-6 py-3 cursor-pointer transition-colors
                        ${selectedDoc?.id === doc.id ? "bg-blue-50" : "hover:bg-gray-50"}
                      `}
                      onClick={() => selectDocument(doc)}
                    >
                      <div className="w-8 h-8 bg-red-50 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.original_filename}</p>
                        <p className="text-xs text-gray-500">{doc.page_count ?? "?"} pages</p>
                      </div>
                      {selectedDoc?.id === doc.id && (
                        <span className="text-xs text-blue-600 font-medium">Selected</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* ── Page grid ── */}
          {selectedDoc && pages.length > 0 && (
            <Card>
              <CardHeader>
                {/* Toolbar row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Left: select all + count */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={selectAll}
                      className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                        ${visiblePages.every((p) => p.selected)
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "border-gray-300 bg-white hover:border-blue-400"
                        }
                      `}
                      title="Select / deselect all"
                    >
                      {visiblePages.every((p) => p.selected) && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className="text-sm text-gray-600">
                      {mode === "extract"
                        ? selectedCount > 0
                          ? `${selectedCount} page${selectedCount !== 1 ? "s" : ""} selected`
                          : "Click pages to select for extraction"
                        : `${visiblePages.length} pages`}
                    </span>
                  </div>

                  {/* Right: batch actions */}
                  <div className="flex items-center gap-2">
                    {mode === "organize" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={rotateAllSelected}
                          disabled={selectedCount === 0}
                          title="Rotate all selected pages clockwise"
                        >
                          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                          </svg>
                          Rotate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={deleteAllSelected}
                          disabled={selectedCount === 0}
                          title="Delete all selected pages"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                          Delete
                        </Button>
                      </>
                    )}
                    {mode === "extract" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={deleteAllSelected}
                        disabled={selectedCount === 0}
                        title="Remove selected pages from this extract"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-2">
                  {mode === "organize"
                    ? "Drag pages to reorder. Hover over a page for rotate/delete. Click + to insert pages from another PDF."
                    : "Select pages to extract — only selected pages will be included."}
                </p>
              </CardHeader>

              <CardBody>
                {loadingThumbs ? (
                  <div className="flex justify-center py-10"><Spinner /></div>
                ) : (
                  <div
                    className="flex flex-wrap content-start gap-0 min-h-16"
                    onDragEnd={handleDragEnd}
                  >
                    {pages.map((page, displayIdx) => (
                      <div key={page.id} className="flex items-start">
                        <PageTile
                          page={page}
                          displayIndex={displayIdx}
                          isDragging={draggedIdx === displayIdx}
                          isDragTarget={dragTargetIdx === displayIdx && draggedIdx !== displayIdx}
                          onSelect={() => toggleSelect(page.id)}
                          onRotateCW={() => rotatePageCW(page.id)}
                          onRotateCCW={() => rotatePageCCW(page.id)}
                          onDelete={() => deletePage(page.id)}
                          onDragStart={() => handleDragStart(displayIdx)}
                          onDragOver={(e) => handleDragOver(e, displayIdx)}
                          onDrop={() => handleDrop(displayIdx)}
                          onInsertClick={() => triggerInsert(displayIdx)}
                          onHover={() => {}}
                          onLeave={() => {}}
                        />
                        {/* Trailing insert button after the last tile */}
                        {displayIdx === pages.length - 1 && !page.deleted && (
                          <InsertButton onClick={() => triggerInsert(displayIdx + 1)} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Hidden file input for inserting PDFs */}
                <input
                  ref={insertInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleInsertFile}
                />
              </CardBody>

              {/* Action footer */}
              <CardFooter className="flex-col items-stretch gap-4">
                <div className="flex gap-3 items-end">
                  <Input
                    label="Output filename"
                    value={outputFilename}
                    onChange={(e) => setOutputFilename(e.target.value)}
                    placeholder="organized.pdf"
                  />
                  {mode === "organize" ? (
                    <Button
                      onClick={handleSave}
                      disabled={visiblePages.length === 0}
                    >
                      Save ({visiblePages.length} pages)
                    </Button>
                  ) : (
                    <Button
                      onClick={handleExtract}
                      disabled={selectedCount === 0}
                    >
                      Extract ({selectedCount} selected)
                    </Button>
                  )}
                  <Button variant="ghost" onClick={handleReset}>Cancel</Button>
                </div>
              </CardFooter>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
