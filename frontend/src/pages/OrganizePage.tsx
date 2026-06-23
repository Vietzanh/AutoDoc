import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { validatePdfOutputFilename } from "@/utils/pdfFilename";
import { PdfPreview } from "@/components/ui/PdfPreview";

interface PageImage {
  page_number: number;
  image_base64: string;
  width_pts: number;
  height_pts: number;
}

interface PageState {
  id: string;
  sourceDocId: number;
  originalIndex: number;
  thumbnail: string;
  preview: string;
  widthPts: number;
  heightPts: number;
  selected: boolean;
  rotation: number;
  deleted: boolean;
}

interface InsertSource {
  docId: number;
  name: string;
  pages: PageState[];
}

type AppMode = "normal" | "insert" | "extract";
type PreviewSource = "primary" | "insert";

const ROTATE_CW = (rotation: number) => rotation + 90;
const ROTATE_CCW = (rotation: number) => rotation - 90;
const THUMB_WIDTH = 180;
const PREVIEW_WIDTH = 800;

function buildPages(
  docId: number,
  thumbnails: PageImage[],
  previews: PageImage[],
  idPrefix: string
): PageState[] {
  const previewByPage = new Map(previews.map((page) => [page.page_number, page]));

  return thumbnails.map((thumbnail, index) => {
    const preview = previewByPage.get(thumbnail.page_number) ?? thumbnail;
    return {
      id: `${idPrefix}-${docId}-${index}`,
      sourceDocId: docId,
      originalIndex: thumbnail.page_number - 1,
      thumbnail: thumbnail.image_base64,
      preview: preview.image_base64,
      widthPts: preview.width_pts,
      heightPts: preview.height_pts,
      selected: false,
      rotation: 0,
      deleted: false,
    };
  });
}

function cloneInsertedPage(page: PageState, copyId: number): PageState {
  return {
    ...page,
    id: `inserted-${page.sourceDocId}-${page.originalIndex}-${copyId}`,
    selected: false,
    deleted: false,
  };
}

function IconInsert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="15" y1="17" x2="15" y2="21" />
      <line x1="13" y1="19" x2="17" y2="19" />
    </svg>
  );
}

function IconExtract() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="10" y1="12" x2="16" y2="12" />
      <polyline points="13 9 16 12 13 15" />
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

function PreviewPane({
  pages,
  activePageId,
  onVisiblePageChange,
}: {
  pages: PageState[];
  activePageId: string | null;
  onVisiblePageChange: (pageId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        const pageId = visibleEntry?.target.getAttribute("data-page-id");
        if (pageId) {
          onVisiblePageChange(pageId);
        }
      },
      {
        root: scroller,
        threshold: [0.35, 0.55, 0.75],
      }
    );

    pages.forEach((page) => {
      const node = pageRefs.current[page.id];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [onVisiblePageChange, pages]);

  useEffect(() => {
    if (!activePageId) return;
    pageRefs.current[activePageId]?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [activePageId]);

  return (
    <section className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-gray-100">
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {pages.map((page) => {
            const isActive = page.id === activePageId;
            return (
              <div
                key={page.id}
                ref={(node) => { pageRefs.current[page.id] = node; }}
                data-page-id={page.id}
                className={`rounded border bg-white p-3 shadow-sm transition-colors ${
                  isActive ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"
                }`}
              >
                <img
                  src={page.preview}
                  alt={`Page ${page.originalIndex + 1}`}
                  className="mx-auto block w-full max-w-2xl bg-white"
                  style={{ transform: `rotate(${page.rotation}deg)` }}
                />
                <div className="mt-2 text-center text-xs text-gray-500">
                  Page {page.originalIndex + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SelectionBox({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`absolute left-1.5 top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
        checked
          ? "border-blue-500 bg-blue-500 text-white"
          : "border-gray-300 bg-white/90 hover:border-blue-400"
      }`}
      title="Select page"
    >
      {checked && (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

function PageTile({
  page,
  isActive,
  allSelected,
  onPreview,
  onToggleSelect,
  onRotateCW,
  onRotateCCW,
  onDelete,
}: {
  page: PageState;
  isActive: boolean;
  allSelected: boolean;
  onPreview: () => void;
  onToggleSelect: () => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onDelete: () => void;
}) {
  const handlePreviewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPreview();
    }
  };

  return (
    <div className="group relative flex flex-col items-center">
      <div
        role="button"
        tabIndex={0}
        onClick={onPreview}
        onKeyDown={handlePreviewKeyDown}
        className="relative block text-left"
        title={`Show page ${page.originalIndex + 1}`}
      >
        <SelectionBox checked={page.selected} onClick={onToggleSelect} />

        <div
          className={`absolute right-1.5 top-1.5 z-20 flex flex-col gap-1 transition-opacity ${
            page.selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onRotateCCW(); }}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white/95 shadow-sm hover:bg-blue-50"
            title="Rotate left"
          >
            <IconRotateLeft />
          </button>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onRotateCW(); }}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white/95 shadow-sm hover:bg-blue-50"
            title="Rotate right"
          >
            <IconRotateRight />
          </button>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onDelete(); }}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white/95 text-red-500 shadow-sm hover:bg-red-50"
            title="Delete page"
          >
            <IconDelete />
          </button>
        </div>

        <img
          src={page.thumbnail}
          alt={`Page ${page.originalIndex + 1}`}
          className={`block h-40 w-28 rounded border-2 object-cover transition-all ${
            isActive
              ? "border-blue-500 ring-2 ring-blue-200"
              : page.selected
                ? "border-blue-500 ring-2 ring-blue-100"
                : allSelected
                  ? "border-gray-300"
                  : "border-gray-200 hover:border-gray-400"
          }`}
          style={{ transform: `rotate(${page.rotation}deg)` }}
        />

        <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
          {page.originalIndex + 1}
        </span>
      </div>
    </div>
  );
}

function DropSlot({
  index,
  onDropPage,
}: {
  index: number;
  onDropPage: (pageId: string, index: number) => void;
}) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const pageId = event.dataTransfer.getData("application/autodoc-page-id");
        if (pageId) {
          onDropPage(pageId, index);
        }
      }}
      className={`pointer-events-auto absolute -left-2 top-0 z-10 h-40 w-4 rounded transition-colors ${
        isOver ? "bg-blue-500" : "bg-transparent hover:bg-blue-200"
      }`}
      title="Drop inserted page here"
    />
  );
}

function OriginalThumbnailGrid({
  pages,
  activePageId,
  allSelected,
  onPreview,
  onToggleSelect,
  onRotateCW,
  onRotateCCW,
  onDelete,
  onDropInsertedPage,
}: {
  pages: PageState[];
  activePageId: string | null;
  allSelected: boolean;
  onPreview: (pageId: string) => void;
  onToggleSelect: (pageId: string) => void;
  onRotateCW: (pageId: string) => void;
  onRotateCCW: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onDropInsertedPage: (pageId: string, index: number) => void;
}) {
  const thumbnailRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!activePageId) return;
    thumbnailRefs.current[activePageId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activePageId]);

  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-5 pr-1">
      {pages.map((page, index) => (
        <div
          key={page.id}
          ref={(node) => { thumbnailRefs.current[page.id] = node; }}
          className="relative flex justify-center"
        >
          <DropSlot index={index} onDropPage={onDropInsertedPage} />
          <PageTile
            page={page}
            isActive={page.id === activePageId}
            allSelected={allSelected}
            onPreview={() => onPreview(page.id)}
            onToggleSelect={() => onToggleSelect(page.id)}
            onRotateCW={() => onRotateCW(page.id)}
            onRotateCCW={() => onRotateCCW(page.id)}
            onDelete={() => onDelete(page.id)}
          />
          {index === pages.length - 1 && (
            <div className="absolute -right-2 top-0">
              <DropSlot index={pages.length} onDropPage={onDropInsertedPage} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InsertSourceStrip({
  source,
  activePageId,
  onPreview,
}: {
  source: InsertSource;
  activePageId: string | null;
  onPreview: (pageId: string) => void;
}) {
  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <div className="flex h-9 items-center justify-between px-3">
        <p className="truncate text-xs font-medium text-gray-600" title={source.name}>
          Insert source: {source.name}
        </p>
        <span className="text-xs text-gray-400">{source.pages.length} pages</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-3 pb-3">
        {source.pages.map((page) => (
          <button
            key={page.id}
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/autodoc-page-id", page.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => onPreview(page.id)}
            className="relative flex-shrink-0"
            title={`Show or drag page ${page.originalIndex + 1}`}
          >
            <img
              src={page.thumbnail}
              alt={`Insert page ${page.originalIndex + 1}`}
              className={`h-24 w-16 rounded border-2 object-cover transition-all ${
                activePageId === page.id
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            />
            <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
              {page.originalIndex + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OrganizePage() {
  const navigate = useNavigate();
  const [primaryDocId, setPrimaryDocId] = useState<number | null>(null);
  const [primaryDocName, setPrimaryDocName] = useState("");
  const [pages, setPages] = useState<PageState[]>([]);
  const [insertSource, setInsertSource] = useState<InsertSource | null>(null);
  const [mode, setMode] = useState<AppMode>("normal");
  const [outputFilename, setOutputFilename] = useState("organized.pdf");
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const [outputBlobUrl, setOutputBlobUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewSource, setPreviewSource] = useState<PreviewSource>("primary");
  const [activePrimaryPageId, setActivePrimaryPageId] = useState<string | null>(null);
  const [activeInsertPageId, setActiveInsertPageId] = useState<string | null>(null);
  const insertInputRef = useRef<HTMLInputElement>(null);
  const insertedCopyCounter = useRef(0);

  const { job: polledJob } = useJobPoll(createdJob?.id ?? 0);

  const visiblePages = useMemo(() => pages.filter((page) => !page.deleted), [pages]);
  const selectedCount = visiblePages.filter((page) => page.selected).length;
  const allVisibleSelected = visiblePages.length > 0 && visiblePages.every((page) => page.selected);
  const jobToShow = polledJob ?? createdJob;
  const isProcessing = jobToShow?.status === "pending" || jobToShow?.status === "processing";
  const isDone = jobToShow?.status === "done";
  const isFailed = jobToShow?.status === "failed";
  const outputFilenameError = validatePdfOutputFilename(outputFilename);

  useEffect(() => {
    if (jobToShow?.status === "done" && !outputBlobUrl) {
      api.downloadJobResult(jobToShow.id)
        .then(blob => setOutputBlobUrl(URL.createObjectURL(blob)))
        .catch(() => toast.error("Failed to load PDF preview"));
    }
  }, [jobToShow, outputBlobUrl]);

  const previewPages = previewSource === "insert" && insertSource
    ? insertSource.pages
    : visiblePages;
  const activePreviewPageId = previewSource === "insert"
    ? activeInsertPageId
    : activePrimaryPageId;

  const loadDocumentPages = useCallback(async (docId: number, idPrefix: string) => {
    const [thumbnails, previews] = await Promise.all([
      api.getDocumentThumbnails(docId, THUMB_WIDTH),
      api.getDocumentThumbnails(docId, PREVIEW_WIDTH),
    ]);
    return buildPages(docId, thumbnails, previews, idPrefix);
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      const loadedPages = await loadDocumentPages(doc.id, "primary");
      setPrimaryDocId(doc.id);
      setPrimaryDocName(doc.original_filename);
      setPages(loadedPages);
      setInsertSource(null);
      setCreatedJob(null);
      if (outputBlobUrl) {
        URL.revokeObjectURL(outputBlobUrl);
        setOutputBlobUrl(null);
      }
      setMode("normal");
      setPreviewSource("primary");
      setActivePrimaryPageId(loadedPages[0]?.id ?? null);
      setActiveInsertPageId(null);
      setOutputFilename(doc.original_filename.replace(/\.pdf$/i, "") + "_organized.pdf");
      toast.success(`Uploaded: ${doc.original_filename}`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }, [loadDocumentPages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploading || pages.length > 0,
  });

  const showPrimaryPage = useCallback((pageId: string) => {
    setPreviewSource("primary");
    setActivePrimaryPageId(pageId);
  }, []);

  const showInsertPage = useCallback((pageId: string) => {
    setPreviewSource("insert");
    setActiveInsertPageId(pageId);
  }, []);

  const handleVisiblePreviewChange = useCallback((pageId: string) => {
    if (previewSource === "insert") {
      setActiveInsertPageId(pageId);
    } else {
      setActivePrimaryPageId(pageId);
    }
  }, [previewSource]);

  const toggleSelect = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((page) => page.id === id ? { ...page, selected: !page.selected } : page)
    );
  }, []);

  const rotateCW = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((page) => page.id === id ? { ...page, rotation: ROTATE_CW(page.rotation) } : page)
    );
  }, []);

  const rotateCCW = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((page) => page.id === id ? { ...page, rotation: ROTATE_CCW(page.rotation) } : page)
    );
  }, []);

  const deletePage = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((page) => page.id === id ? { ...page, deleted: true, selected: false } : page)
    );
  }, []);

  const selectAll = useCallback(() => {
    const newVal = !allVisibleSelected;
    setPages((prev) => prev.map((page) => ({ ...page, selected: newVal && !page.deleted })));
  }, [allVisibleSelected]);

  const rotateAllSelectedCW = useCallback(() => {
    setPages((prev) =>
      prev.map((page) =>
        page.selected && !page.deleted ? { ...page, rotation: ROTATE_CW(page.rotation) } : page
      )
    );
  }, []);

  const rotateAllSelectedCCW = useCallback(() => {
    setPages((prev) =>
      prev.map((page) =>
        page.selected && !page.deleted ? { ...page, rotation: ROTATE_CCW(page.rotation) } : page
      )
    );
  }, []);

  const deleteAllSelected = useCallback(() => {
    setPages((prev) =>
      prev.map((page) => page.selected && !page.deleted
        ? { ...page, deleted: true, selected: false }
        : page
      )
    );
  }, []);

  const handleInsertClick = useCallback(() => {
    setMode("insert");
    insertInputRef.current?.click();
  }, []);

  const handleInsertFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || primaryDocId === null) return;

    setUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      const loadedPages = await loadDocumentPages(doc.id, "insert-source");
      setInsertSource({ docId: doc.id, name: doc.original_filename, pages: loadedPages });
      setMode("insert");
      setPreviewSource("insert");
      setActiveInsertPageId(loadedPages[0]?.id ?? null);
      toast.success(`Loaded insert source: ${doc.original_filename}`);
    } catch {
      toast.error("Failed to load insert PDF");
    } finally {
      setUploading(false);
    }
  }, [loadDocumentPages, primaryDocId]);

  const handleDropInsertedPage = useCallback((sourcePageId: string, insertIndex: number) => {
    if (!insertSource) return;
    const sourcePage = insertSource.pages.find((page) => page.id === sourcePageId);
    if (!sourcePage) return;

    insertedCopyCounter.current += 1;
    const insertedPage = cloneInsertedPage(sourcePage, insertedCopyCounter.current);

    setPages((prev) => {
      const visibleBeforeTarget = visiblePages.slice(0, insertIndex);
      const previousVisibleId = visibleBeforeTarget[visibleBeforeTarget.length - 1]?.id;
      const nextVisibleId = visiblePages[insertIndex]?.id;
      let spliceIndex = prev.length;

      if (nextVisibleId) {
        spliceIndex = prev.findIndex((page) => page.id === nextVisibleId);
      } else if (previousVisibleId) {
        const previousIndex = prev.findIndex((page) => page.id === previousVisibleId);
        spliceIndex = previousIndex >= 0 ? previousIndex + 1 : prev.length;
      }

      const next = [...prev];
      next.splice(spliceIndex, 0, insertedPage);
      return next;
    });

    setPreviewSource("primary");
    setActivePrimaryPageId(insertedPage.id);
    toast.success(`Inserted page ${sourcePage.originalIndex + 1}`);
  }, [insertSource, visiblePages]);

  const enterExtractMode = useCallback(() => setMode((prev) => prev === "extract" ? "normal" : "extract"), []);

  const handleSave = async () => {
    if (!primaryDocId) return;
    const remaining = pages.filter((page) => !page.deleted);
    if (remaining.length === 0) {
      toast.error("No pages left in the document");
      return;
    }
    if (outputFilenameError) {
      toast.error(outputFilenameError);
      return;
    }

    try {
      const job = await api.createOrganizeJob(
        primaryDocId,
        remaining.map((page) => ({
          original_index: page.originalIndex,
          source_document_id: page.sourceDocId,
          rotation: page.rotation,
          deleted: false,
        })),
        outputFilename
      );
      setCreatedJob(job);
      toast.success("Organizing PDF...");
    } catch {
      toast.error("Failed to start organize job");
    }
  };

  const handleExtract = async () => {
    if (!primaryDocId) return;
    const selected = visiblePages.filter((page) => page.selected);
    if (selected.length === 0) {
      toast.error("Select pages to extract");
      return;
    }
    if (outputFilenameError) {
      toast.error(outputFilenameError);
      return;
    }

    try {
      const job = await api.createOrganizeJob(
        primaryDocId,
        selected.map((page) => ({
          original_index: page.originalIndex,
          source_document_id: page.sourceDocId,
          rotation: page.rotation,
          deleted: false,
        })),
        outputFilename
      );
      setCreatedJob(job);
      toast.success("Extracting pages...");
    } catch {
      toast.error("Failed to start extract");
    }
  };

  const handleReset = () => {
    setPrimaryDocId(null);
    setPrimaryDocName("");
    setPages([]);
    setInsertSource(null);
    setCreatedJob(null);
    if (outputBlobUrl) {
      URL.revokeObjectURL(outputBlobUrl);
      setOutputBlobUrl(null);
    }
    setMode("normal");
    setOutputFilename("organized.pdf");
    setPreviewSource("primary");
    setActivePrimaryPageId(null);
    setActiveInsertPageId(null);
  };

  const handleDownload = async (jobId: number, filename: string) => {
    try {
      const blob = await api.downloadJobResult(jobId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  const isWorkspace = !jobToShow || (!isProcessing && !isDone && !isFailed);

  return (
    <div className={`flex flex-col bg-gray-50 ${isWorkspace ? "h-[calc(100vh-4rem)] overflow-hidden" : "min-h-[calc(100vh-4rem)] pb-8"}`}>
      <div className="px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organize Pages</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Reorder, rotate, delete, insert, or extract pages
            </p>
          </div>

          {pages.length > 0 && !jobToShow && (
            <div className="relative flex flex-wrap items-end justify-end gap-3 pb-5">
              <Input
                label="Output filename"
                value={outputFilename}
                onChange={(event) => setOutputFilename(event.target.value)}
                placeholder="output.pdf"
                className="w-72"
              />
              {mode === "extract" ? (
                <Button
                  onClick={handleExtract}
                  disabled={selectedCount === 0 || isProcessing || Boolean(outputFilenameError)}
                >
                  Extract ({selectedCount} selected)
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={visiblePages.length === 0 || isProcessing || Boolean(outputFilenameError)}
                >
                  Save ({visiblePages.length} pages)
                </Button>
              )}
              {outputFilenameError && (
                <p className="absolute bottom-0 right-0 text-xs text-red-500">
                  {outputFilenameError}
                </p>
              )}
            </div>
          )}

          <input
            ref={insertInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleInsertFile}
          />
        </div>
      </div>

      {jobToShow && isProcessing && (
        <Card className="mx-6">
          <CardHeader>
            <h2 className="font-semibold text-gray-900">
              {mode === "extract" ? "Extracting pages..." : "Organizing pages..."}
            </h2>
          </CardHeader>
          <CardBody className="space-y-2">
            <ProgressBar value={jobToShow.progress} />
            <p className="text-right text-xs text-gray-400">{jobToShow.progress}%</p>
          </CardBody>
        </Card>
      )}

      {jobToShow && isDone && (
        <Card className="mx-6">
          <CardHeader>
            <h2 className="font-semibold text-green-700">
              {mode === "extract" ? "Pages extracted!" : "PDF organized!"}
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600 mb-2">
              Your {mode === "extract" ? "extracted pages" : "organized PDF"} is ready.
            </p>
            {outputBlobUrl && <PdfPreview fileUrl={outputBlobUrl} />}
          </CardBody>
          <CardFooter>
            <div className="flex gap-3 w-full justify-end">
              <Button variant="ghost" onClick={handleReset}>
                {mode === "extract" ? "Extract Another" : "Organize Another"}
              </Button>
              <Button onClick={() => handleDownload(jobToShow.id, jobToShow.output_filename ?? outputFilename)} className="bg-blue-600 hover:bg-blue-700 text-white">
                Download {outputFilename}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {jobToShow && isFailed && (
        <Card className="mx-6">
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
              <Button variant="ghost" onClick={() => navigate("/")}>Home</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {!jobToShow || (!isProcessing && !isDone && !isFailed) ? (
        <>
          {pages.length === 0 && (
            <Card className="mx-6">
              <CardBody>
                <div
                  {...getRootProps()}
                  className={`rounded-xl border-2 border-dashed p-10 text-center text-sm transition-colors ${
                    isDragActive
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  } ${uploading ? "cursor-wait opacity-50" : "cursor-pointer"}`}
                >
                  <input {...getInputProps()} />
                  {uploading ? (
                    <>
                      <Spinner size="sm" className="mx-auto mb-2" />
                      <p>Uploading...</p>
                    </>
                  ) : isDragActive ? (
                    <p className="font-medium">Drop PDF here</p>
                  ) : (
                    <p>
                      Drop a PDF here, or <span className="font-medium text-blue-600">click</span> to select
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {pages.length > 0 && (
            <section className="flex min-h-0 flex-1 flex-col border-t border-gray-200 bg-white">
              <div className="min-h-0 flex-1 p-0">
                <div className="flex h-full min-h-0 overflow-hidden">
                  <PreviewPane
                    pages={previewPages}
                    activePageId={activePreviewPageId}
                    onVisiblePageChange={handleVisiblePreviewChange}
                  />

                  <aside className="flex w-[610px] min-w-[610px] flex-col bg-white">
                    <div className="border-b border-gray-200 bg-gray-50">
                      <div className="flex h-9 items-center justify-between px-3">
                        <p className="truncate text-xs font-medium text-gray-600" title={primaryDocName}>
                          Original source: {primaryDocName}
                        </p>
                        <span className="text-xs text-gray-400">{visiblePages.length} pages</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3 px-3 pb-3">
                        <span className="text-sm text-gray-500">Select all pages</span>
                        <button
                          type="button"
                          onClick={selectAll}
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                            allVisibleSelected
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-gray-300 bg-white hover:border-blue-400"
                          }`}
                          title="Select / deselect all"
                        >
                          {allVisibleSelected && (
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleInsertClick}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                              mode === "insert"
                                ? "bg-blue-500 text-white shadow-sm"
                                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            }`}
                            title="Load insert PDF"
                          >
                            <IconInsert />
                          </button>

                          <button
                            type="button"
                            onClick={enterExtractMode}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                              mode === "extract"
                                ? "bg-blue-500 text-white shadow-sm"
                                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            }`}
                            title={mode === "extract" ? "Exit extract mode" : "Enter extract mode"}
                          >
                            <IconExtract />
                          </button>

                          <div className="mx-1 h-6 w-px bg-gray-200" />

                          <button
                            type="button"
                            onClick={rotateAllSelectedCCW}
                            disabled={selectedCount === 0}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Rotate all selected pages left"
                          >
                            <IconRotateLeft />
                          </button>
                          <button
                            type="button"
                            onClick={rotateAllSelectedCW}
                            disabled={selectedCount === 0}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Rotate all selected pages right"
                          >
                            <IconRotateRight />
                          </button>
                          <button
                            type="button"
                            onClick={deleteAllSelected}
                            disabled={selectedCount === 0}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Delete all selected pages"
                          >
                            <IconDelete />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                      {uploading && (
                        <div className="flex justify-center py-8">
                          <Spinner />
                        </div>
                      )}
                      <OriginalThumbnailGrid
                        pages={visiblePages}
                        activePageId={previewSource === "primary" ? activePrimaryPageId : null}
                        allSelected={allVisibleSelected}
                        onPreview={showPrimaryPage}
                        onToggleSelect={toggleSelect}
                        onRotateCW={rotateCW}
                        onRotateCCW={rotateCCW}
                        onDelete={deletePage}
                        onDropInsertedPage={handleDropInsertedPage}
                      />
                    </div>

                    {insertSource && (
                      <InsertSourceStrip
                        source={insertSource}
                        activePageId={previewSource === "insert" ? activeInsertPageId : null}
                        onPreview={showInsertPage}
                      />
                    )}
                  </aside>
                </div>
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
