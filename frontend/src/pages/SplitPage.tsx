import { useState, useCallback, useEffect } from "react";
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

// ── SplitLine — blue scissor click target between two page thumbnails ─────────
interface SplitLineProps {
  pageEnd: number;        // 0-based index of the last page in the current part
  isActive: boolean;      // whether a split point is set here
  onToggle: (gapIndex: number) => void;
}

function SplitLine({ pageEnd, isActive, onToggle }: SplitLineProps) {
  const [hovered, setHovered] = useState(false);
  const gapIndex = pageEnd + 1; // gap index: split after pageEnd (0-based) = before pageEnd+1

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center select-none
        w-6 h-56 cursor-pointer transition-colors duration-150 flex-shrink-0
        ${isActive ? "bg-red-50" : "bg-transparent"}
        ${hovered && !isActive ? "bg-blue-50" : ""}
      `}
      style={{ width: "1.5rem", minWidth: "1.5rem" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onToggle(gapIndex)}
      title={isActive ? "Remove split point" : "Click to split here"}
    >
      {/* Vertical line — blue before click, red after */}
      <div
        className={`
          absolute left-1/2 top-2 bottom-2 w-px
          transition-colors duration-150
          ${isActive ? "bg-red-500" : "bg-blue-300"}
        `}
      />

      {/* Scissor icon — shown on hover or when active */}
      {(hovered || isActive) && (
        <div className="z-10 transition-all duration-150">
          <svg
            className={`w-5 h-5 ${isActive ? "text-red-600" : "text-blue-500"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
        </div>
      )}
    </div>
  );
}

interface Thumbnail {
  page_number: number;
  image_base64: string;
}

export default function SplitPage() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [splitPoints, setSplitPoints] = useState<number[]>([]); // 0-based page indices
  const [outputFilename, setOutputFilename] = useState("split_part");
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const [splitParts, setSplitParts] = useState<{ filename: string; pages: string }[]>([]);

  const { job } = useJobPoll(createdJob?.id ?? 0);

  useEffect(() => {
    if (job) setCreatedJob(job);
  }, [job]);

  // ── Upload & select — single PDF at a time ──────────────────────────────────
  // Drop zone handles both initial upload and "Split Another" re-upload.
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Reset state before uploading a new file
    setSelectedDoc(null);
    setThumbnails([]);
    setSplitPoints([]);
    setCreatedJob(null);
    setSplitParts([]);
    setUploading(true);

    try {
      const doc = await api.uploadDocument(file);
      setSelectedDoc(doc);
      setLoadingThumbs(true);
      try {
        const thumbs = await api.getDocumentThumbnails(doc.id);
        setThumbnails(thumbs);
      } catch {
        toast.error("Failed to load page thumbnails");
        setSelectedDoc(null);
      } finally {
        setLoadingThumbs(false);
      }
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
    disabled: uploading || loadingThumbs,
  });

  // ── Split point logic ───────────────────────────────────────────────────────
  const toggleSplitPoint = useCallback((gapIndex: number) => {
    const pageEnd = gapIndex - 1;
    setSplitPoints((prev) => {
      if (prev.includes(pageEnd)) {
        return prev.filter((p) => p !== pageEnd);
      }
      return [...prev, pageEnd].sort((a, b) => a - b);
    });
  }, []);

  const handleStartJob = async () => {
    if (!selectedDoc) return;
    if (splitPoints.length === 0) {
      toast.error("Add at least one split point by clicking between pages");
      return;
    }
    try {
      const j = await api.createSplitJob(selectedDoc.id, splitPoints, outputFilename);
      setCreatedJob(j);
      toast.success("Split job started!");
    } catch {
      toast.error("Failed to start split job");
    }
  };

  // Fetch parts list after job completes
  useEffect(() => {
    if (job?.status === "done" && job.tool === "split") {
      api.getSplitParts(job.id)
        .then(setSplitParts)
        .catch(() => toast.error("Failed to load split parts list"));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  const handleDownload = async () => {
    if (!createdJob) return;
    try {
      const blob = await api.downloadJobResult(createdJob.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `split_parts_${createdJob.id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  // Reset everything — back to the upload drop zone
  const handleReset = () => {
    setSelectedDoc(null);
    setThumbnails([]);
    setSplitPoints([]);
    setCreatedJob(null);
    setSplitParts([]);
    setOutputFilename("split_part");
  };

  const isProcessing = createdJob?.status === "pending" || createdJob?.status === "processing";
  const isDone = createdJob?.status === "done";
  const isFailed = createdJob?.status === "failed";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Split PDF</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a PDF, click the blue split lines between pages, then split into separate files
        </p>
      </div>

      {/* ── Processing / Done / Failed states ── */}
      {createdJob && isProcessing && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Splitting…</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <ProgressBar value={createdJob.progress} />
            <p className="text-xs text-gray-400 text-right">{createdJob.progress}% complete</p>
          </CardBody>
        </Card>
      )}

      {createdJob && isDone && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-green-700">Split complete!</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {splitParts.length > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Part</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Pages</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {splitParts.map((part, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{part.filename}</td>
                        <td className="px-4 py-2 text-gray-500">{part.pages}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-sm text-gray-600">
              {splitParts.length} part{splitParts.length !== 1 ? "s" : ""} generated — download as ZIP below.
            </p>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button onClick={handleDownload}>Download ZIP ({splitParts.length} files)</Button>
              <Button variant="ghost" onClick={handleReset}>Split Another</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {createdJob && isFailed && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-red-700">Split failed</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">{createdJob.error_message || "An unexpected error occurred."}</p>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleReset}>Try Again</Button>
              <Button variant="ghost" onClick={() => navigate("/")}>Dashboard</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* ── Upload drop zone — always shown when no job exists ── */}
      {!createdJob && (
        <Card>
          <CardBody>
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
                transition-colors text-sm
                ${isDragActive ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 hover:border-gray-400 text-gray-600"}
                ${uploading || loadingThumbs ? "opacity-50 cursor-wait" : ""}
              `}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <><Spinner size="sm" className="mx-auto mb-2" /><p>Uploading…</p></>
              ) : loadingThumbs ? (
                <><Spinner size="sm" className="mx-auto mb-2" /><p>Loading pages…</p></>
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

      {/* ── Thumbnail strip + split lines — shown after a PDF is uploaded ── */}
      {!createdJob && selectedDoc && !loadingThumbs && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                Click the blue lines between pages to add split points
                {splitPoints.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    — {splitPoints.length} split point{splitPoints.length !== 1 ? "s" : ""}
                  </span>
                )}
              </h2>
              <div className="flex gap-2">
                {splitPoints.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSplitPoints([])}>
                    Clear all
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Split Another
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {thumbnails.length} pages — hover over the space between pages to reveal a split line, then click to split.
            </p>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {/* 5-per-row thumbnail strip with blue scissor split lines */}
              <div className="flex flex-wrap gap-0 overflow-x-auto">
                {thumbnails.map((thumb, idx) => (
                  <div key={thumb.page_number} className="flex items-start flex-shrink-0">
                    {/* Thumbnail */}
                    <div className="relative">
                      <img
                        src={thumb.image_base64}
                        alt={`Page ${thumb.page_number}`}
                        className="w-40 h-56 object-cover border border-gray-200"
                        style={{ display: "block" }}
                      />
                      {/* Page number badge */}
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                        {thumb.page_number}
                      </span>
                    </div>

                    {/* Blue scissor split line — rendered between every pair of thumbnails */}
                    {idx < thumbnails.length - 1 && (
                      <SplitLine
                        pageEnd={thumb.page_number - 1}
                        isActive={splitPoints.includes(thumb.page_number - 1)}
                        onToggle={toggleSplitPoint}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Active split point chips */}
              {splitPoints.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {splitPoints.map((pt) => (
                    <span
                      key={pt}
                      className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs px-2 py-1 rounded"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M6 9l6 6 6-6" /><path d="M6 15l6-6 6 6" />
                      </svg>
                      Split after page {pt + 1}
                      <button
                        onClick={() => toggleSplitPoint(pt + 1)}
                        className="ml-1 text-red-400 hover:text-red-700 font-bold"
                        title="Remove split point"
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardBody>

          {/* Action footer */}
          {thumbnails.length > 1 && (
            <CardFooter className="flex-col items-stretch gap-4">
              <div className="flex gap-3 items-end">
                <Input
                  label="Base filename"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  placeholder="split_part"
                />
                <Button
                  onClick={handleStartJob}
                  disabled={splitPoints.length === 0}
                >
                  Split PDF ({splitPoints.length > 0 ? `${splitPoints.length + 1} parts` : "add points first"})
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}
