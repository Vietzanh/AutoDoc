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
  docNumber: 1 | 2;
}

const THUMB_WIDTH = 180;
const PREVIEW_WIDTH = 800;

function buildPages(
  docId: number,
  thumbnails: PageImage[],
  previews: PageImage[],
  idPrefix: string,
  docNumber: 1 | 2
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
      docNumber,
    };
  });
}

function cloneInsertedPage(page: PageState, copyId: number): PageState {
  return {
    ...page,
    id: `inserted-${page.sourceDocId}-${page.originalIndex}-${copyId}`,
  };
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
  activePage,
}: {
  activePage: PageState | null;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-gray-100">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 flex items-center justify-center">
        {activePage ? (
          <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <img
              src={activePage.preview}
              alt={`Page ${activePage.originalIndex + 1}`}
              className="mx-auto block max-w-full max-h-[calc(100vh-10rem)] object-contain"
            />
            <div className="mt-2 text-center text-xs text-gray-500">
              Source Doc {activePage.docNumber} - Page {activePage.originalIndex + 1}
            </div>
          </div>
        ) : (
          <div className="text-gray-400">Select a page to preview</div>
        )}
      </div>
    </section>
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
        const pageId = event.dataTransfer.getData("application/autodoc-insert-page-id");
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

function PageTile({
  page,
  displayIndex,
  isActive,
  onPreview,
  onDelete,
  isDraggable,
}: {
  page: PageState;
  displayIndex: number;
  isActive: boolean;
  onPreview: () => void;
  onDelete?: () => void;
  isDraggable?: boolean;
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
        draggable={isDraggable}
        onDragStart={isDraggable ? (event) => {
          event.dataTransfer.setData("application/autodoc-insert-page-id", page.id);
          event.dataTransfer.effectAllowed = "copyMove";
        } : undefined}
      >
        {onDelete && (
          <div className="absolute right-1.5 top-1.5 z-20 flex flex-col gap-1">
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onDelete(); }}
              className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white/95 text-red-500 shadow-sm hover:bg-red-50"
              title="Remove inserted page"
            >
              <IconDelete />
            </button>
          </div>
        )}

        <img
          src={page.thumbnail}
          alt={`Page ${page.originalIndex + 1}`}
          className={`block h-40 w-28 rounded border-2 object-cover transition-all ${
            isActive
              ? "border-blue-500 ring-2 ring-blue-200"
              : "border-gray-200 hover:border-gray-400"
          } ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""}`}
        />

        <span className={`pointer-events-none absolute top-1 left-2 text-lg font-bold drop-shadow-md ${page.docNumber === 2 ? "text-red-600" : "text-blue-700"}`}>
          {page.docNumber}
        </span>
        <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
          {displayIndex + 1}
        </span>
      </div>
    </div>
  );
}

export default function InsertPage() {
  const navigate = useNavigate();
  const [primaryDocId, setPrimaryDocId] = useState<number | null>(null);
  const [secondaryDocId, setSecondaryDocId] = useState<number | null>(null);
  
  const [primaryPages, setPrimaryPages] = useState<PageState[]>([]);
  const [secondaryPages, setSecondaryPages] = useState<PageState[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  
  const [outputFilename, setOutputFilename] = useState("inserted.pdf");
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const [outputBlobUrl, setOutputBlobUrl] = useState<string | null>(null);
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingSecondary, setUploadingSecondary] = useState(false);

  const insertedCopyCounter = useRef(0);
  const primaryThumbnailRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { job: polledJob } = useJobPoll(createdJob?.id ?? 0);
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

  const loadDocumentPages = useCallback(async (docId: number, idPrefix: string, docNumber: 1 | 2) => {
    const [thumbnails, previews] = await Promise.all([
      api.getDocumentThumbnails(docId, THUMB_WIDTH),
      api.getDocumentThumbnails(docId, PREVIEW_WIDTH),
    ]);
    return buildPages(docId, thumbnails, previews, idPrefix, docNumber);
  }, []);

  const onDropPrimary = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadingPrimary(true);
    try {
      const doc = await api.uploadDocument(file);
      const loadedPages = await loadDocumentPages(doc.id, "primary", 1);
      setPrimaryDocId(doc.id);
      setPrimaryPages(loadedPages);
      setOutputFilename(doc.original_filename.replace(/\.pdf$/i, "") + "_inserted.pdf");
      if (!activePageId) setActivePageId(loadedPages[0]?.id ?? null);
    } catch {
      toast.error("Primary upload failed");
    } finally {
      setUploadingPrimary(false);
    }
  }, [loadDocumentPages, activePageId]);

  const onDropSecondary = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadingSecondary(true);
    try {
      const doc = await api.uploadDocument(file);
      const loadedPages = await loadDocumentPages(doc.id, "secondary", 2);
      setSecondaryDocId(doc.id);
      setSecondaryPages(loadedPages);
    } catch {
      toast.error("Secondary upload failed");
    } finally {
      setUploadingSecondary(false);
    }
  }, [loadDocumentPages]);

  const { getRootProps: getPrimaryRoot, getInputProps: getPrimaryInput, isDragActive: isPrimaryDrag } = useDropzone({
    onDrop: onDropPrimary,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploadingPrimary || primaryDocId !== null,
  });

  const { getRootProps: getSecondaryRoot, getInputProps: getSecondaryInput, isDragActive: isSecondaryDrag } = useDropzone({
    onDrop: onDropSecondary,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploadingSecondary || secondaryDocId !== null,
  });

  const handleDropInsertedPage = useCallback((sourcePageId: string, insertIndex: number) => {
    const sourcePage = secondaryPages.find((p) => p.id === sourcePageId);
    if (!sourcePage) return; // Not found in secondary pages

    insertedCopyCounter.current += 1;
    const newInsertedPage = cloneInsertedPage(sourcePage, insertedCopyCounter.current);

    setPrimaryPages((prevPrimary) => {
      const next = [...prevPrimary];
      next.splice(insertIndex, 0, newInsertedPage);
      return next;
    });

    setSecondaryPages((prevSecondary) => prevSecondary.filter(p => p.id !== sourcePageId));

    setActivePageId(newInsertedPage.id);
    setTimeout(() => {
        primaryThumbnailRefs.current[newInsertedPage.id]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
  }, [secondaryPages]);

  const handleDeleteInsertedPage = useCallback((pageId: string) => {
    const pageToDelete = primaryPages.find(p => p.id === pageId);
    if (!pageToDelete || pageToDelete.docNumber !== 2) return;

    setPrimaryPages((prevPrimary) => prevPrimary.filter(p => p.id !== pageId));

    setSecondaryPages((prevSecondary) => {
      const next = [...prevSecondary];
      // Reconstruct original page object
      const originalPage: PageState = {
        id: `secondary-${pageToDelete.sourceDocId}-${pageToDelete.originalIndex}`,
        sourceDocId: pageToDelete.sourceDocId,
        originalIndex: pageToDelete.originalIndex,
        thumbnail: pageToDelete.thumbnail,
        preview: pageToDelete.preview,
        widthPts: pageToDelete.widthPts,
        heightPts: pageToDelete.heightPts,
        docNumber: 2,
      };
      
      if (!next.some(p => p.id === originalPage.id)) {
        next.push(originalPage);
        next.sort((a, b) => a.originalIndex - b.originalIndex);
      }
      return next;
    });
  }, [primaryPages]);

  const handleSave = async () => {
    if (!primaryDocId || !secondaryDocId) return;
    if (outputFilenameError) {
      toast.error(outputFilenameError);
      return;
    }

    try {
      const job = await api.createInsertJob(
        primaryDocId,
        secondaryDocId,
        primaryPages.map((page) => ({
          original_index: page.originalIndex,
          source_document_id: page.sourceDocId,
        })),
        outputFilename
      );
      setCreatedJob(job);
      toast.success("Inserting pages...");
    } catch {
      toast.error("Failed to start insert job");
    }
  };

  const handleReset = () => {
    setPrimaryDocId(null);
    setSecondaryDocId(null);
    setPrimaryPages([]);
    setSecondaryPages([]);
    setActivePageId(null);
    setCreatedJob(null);
    if (outputBlobUrl) {
      URL.revokeObjectURL(outputBlobUrl);
      setOutputBlobUrl(null);
    }
    setOutputFilename("inserted.pdf");
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

  const isWorkspace = primaryDocId !== null && secondaryDocId !== null && !jobToShow;
  
  const allPages = useMemo(() => [...primaryPages, ...secondaryPages], [primaryPages, secondaryPages]);
  const activePageObj = useMemo(() => allPages.find(p => p.id === activePageId) || null, [allPages, activePageId]);

  return (
    <div className={`flex flex-col bg-gray-50 ${isWorkspace ? "h-[calc(100vh-4rem)] overflow-hidden" : "min-h-[calc(100vh-4rem)] pb-8"}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insert Pages</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Insert pages from one document into another
            </p>
          </div>

          {isWorkspace && (
            <div className="relative flex flex-wrap items-end justify-end gap-3">
              <Input
                label="Output filename"
                value={outputFilename}
                onChange={(event) => setOutputFilename(event.target.value)}
                placeholder="output.pdf"
                className="w-72"
              />
              <Button
                onClick={handleSave}
                disabled={primaryPages.length === 0 || isProcessing || Boolean(outputFilenameError)}
              >
                Save
              </Button>
              {outputFilenameError && (
                <p className="absolute -bottom-5 right-0 text-xs text-red-500">
                  {outputFilenameError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {(!primaryDocId || !secondaryDocId) && !jobToShow && (
        <div className="flex flex-col md:flex-row gap-6 p-6">
          <Card className="flex-1">
            <CardHeader><h3 className="font-semibold text-gray-700">Step 1: Original Document</h3></CardHeader>
            <CardBody>
              {primaryDocId ? (
                <div className="p-4 border border-green-200 bg-green-50 text-green-700 rounded-lg flex justify-between items-center">
                  <span>Document uploaded successfully!</span>
                  <Button size="sm" variant="secondary" onClick={() => setPrimaryDocId(null)}>Change</Button>
                </div>
              ) : (
                <div
                  {...getPrimaryRoot()}
                  className={`rounded-xl border-2 border-dashed p-10 text-center text-sm transition-colors ${
                    isPrimaryDrag
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  } ${uploadingPrimary ? "cursor-wait opacity-50" : "cursor-pointer"}`}
                >
                  <input {...getPrimaryInput()} />
                  {uploadingPrimary ? (
                    <><Spinner size="sm" className="mx-auto mb-2" /><p>Uploading...</p></>
                  ) : (
                    <p>Drop original PDF here, or <span className="font-medium text-blue-600">click</span> to select</p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="flex-1">
            <CardHeader><h3 className="font-semibold text-gray-700">Step 2: Document to Insert</h3></CardHeader>
            <CardBody>
              {secondaryDocId ? (
                <div className="p-4 border border-green-200 bg-green-50 text-green-700 rounded-lg flex justify-between items-center">
                  <span>Document uploaded successfully!</span>
                  <Button size="sm" variant="secondary" onClick={() => setSecondaryDocId(null)}>Change</Button>
                </div>
              ) : (
                <div
                  {...getSecondaryRoot()}
                  className={`rounded-xl border-2 border-dashed p-10 text-center text-sm transition-colors ${
                    isSecondaryDrag
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  } ${uploadingSecondary ? "cursor-wait opacity-50" : "cursor-pointer"}`}
                >
                  <input {...getSecondaryInput()} />
                  {uploadingSecondary ? (
                    <><Spinner size="sm" className="mx-auto mb-2" /><p>Uploading...</p></>
                  ) : (
                    <p>Drop PDF to insert here, or <span className="font-medium text-blue-600">click</span> to select</p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {jobToShow && isProcessing && (
        <Card className="mx-6 mt-6">
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Inserting pages...</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            <ProgressBar value={jobToShow.progress} />
            <p className="text-right text-xs text-gray-400">{jobToShow.progress}%</p>
          </CardBody>
        </Card>
      )}

      {jobToShow && isDone && (
        <Card className="mx-6 mt-6">
          <CardHeader>
            <h2 className="font-semibold text-green-700">Pages inserted!</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600 mb-2">Your PDF is ready.</p>
            {outputBlobUrl && <PdfPreview fileUrl={outputBlobUrl} />}
          </CardBody>
          <CardFooter>
            <div className="flex gap-3 w-full justify-end">
              <Button variant="ghost" onClick={handleReset}>Create Another</Button>
              <Button onClick={() => handleDownload(jobToShow.id, jobToShow.output_filename ?? outputFilename)} className="bg-blue-600 hover:bg-blue-700 text-white">
                Download {outputFilename}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {jobToShow && isFailed && (
        <Card className="mx-6 mt-6">
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

      {isWorkspace && (
        <section className="flex min-h-0 flex-1 flex-col bg-white">
          <div className="min-h-0 flex-1 p-0">
            <div className="flex h-full min-h-0 overflow-hidden">
              <PreviewPane activePage={activePageObj} />

              <aside className="flex w-[610px] min-w-[610px] flex-col bg-white border-l border-gray-200">
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-gray-700">Original Document (1)</h3>
                    <span className="text-xs text-gray-500">{primaryPages.length} pages</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                    <div className="grid grid-cols-4 gap-x-4 gap-y-5 pr-1">
                      {primaryPages.map((page, index) => (
                        <div key={page.id} ref={(node) => { primaryThumbnailRefs.current[page.id] = node; }} className="relative flex justify-center">
                          <DropSlot index={index} onDropPage={handleDropInsertedPage} />
                          <PageTile
                            page={page}
                            displayIndex={index}
                            isActive={page.id === activePageId}
                            onPreview={() => setActivePageId(page.id)}
                            onDelete={page.docNumber === 2 ? () => handleDeleteInsertedPage(page.id) : undefined}
                          />
                          {index === primaryPages.length - 1 && (
                            <div className="absolute -right-2 top-0">
                              <DropSlot index={primaryPages.length} onDropPage={handleDropInsertedPage} />
                            </div>
                          )}
                        </div>
                      ))}
                      {primaryPages.length === 0 && (
                        <div className="col-span-4 relative h-40 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                           <DropSlot index={0} onDropPage={handleDropInsertedPage} />
                           <span className="text-gray-400">Drop pages here</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-1/3 flex flex-col min-h-[250px] border-t border-gray-300 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                  <div className="border-b border-gray-200 bg-blue-50 px-3 py-2 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-blue-800">Document to Insert (2)</h3>
                    <span className="text-xs text-blue-600">{secondaryPages.length} pages left</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 bg-white">
                    <div className="grid grid-cols-4 gap-x-4 gap-y-5 pr-1">
                      {secondaryPages.map((page, index) => (
                        <div key={page.id} className="relative flex justify-center">
                          <PageTile
                            page={page}
                            displayIndex={index}
                            isActive={page.id === activePageId}
                            onPreview={() => setActivePageId(page.id)}
                            isDraggable={true}
                          />
                        </div>
                      ))}
                      {secondaryPages.length === 0 && (
                        <div className="col-span-4 flex items-center justify-center h-20 text-sm text-gray-400 italic">
                          All pages inserted
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
