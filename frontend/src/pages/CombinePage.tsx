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

export default function CombinePage() {
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────
  // `allDocs`     — full document list fetched from the API
  // `selectedIds` — IDs of the docs currently checked for combining
  // Splitting these two means "Refresh" can reload the list without wiping selections.
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [outputFilename, setOutputFilename] = useState("combined.pdf");
  const [createdJob, setCreatedJob] = useState<Job | null>(null);

  const { job } = useJobPoll(createdJob?.id ?? 0);

  useEffect(() => {
    if (job) setCreatedJob(job);
  }, [job]);

  // ── Load documents from API ───────────────────────────────────────────────
  // Refresh button calls this — it replaces `allDocs` but preserves `selectedIds`.
  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await api.listDocuments(0, 100);
      setAllDocs(res.documents);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ── File drop — upload then append to selection ───────────────────────────
  // Files are added to the END so: upload order = UI order = output order.
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      setAllDocs((prev) => [...prev, doc]);
      setSelectedIds((prev) => new Set([...prev, doc.id]));
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
    disabled: uploading,
  });

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleDoc = (doc: Document) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(doc.id)) {
        next.delete(doc.id);
      } else {
        next.add(doc.id);
      }
      return next;
    });
  };

  // Derived: docs in the order they appear in `allDocs`, filtered to selectedIds
  const selectedDocs = allDocs.filter((d) => selectedIds.has(d.id));

  // ── Job actions ───────────────────────────────────────────────────────────
  const handleStartJob = async () => {
    if (selectedIds.size < 2) {
      toast.error("Select at least 2 documents to combine");
      return;
    }
    if (!outputFilename.trim()) {
      toast.error("Enter an output filename");
      return;
    }

    try {
      const j = await api.createCombineJob(
        selectedDocs.map((d) => d.id),
        outputFilename.trim()
      );
      setCreatedJob(j);
      toast.success("Combine job started!");
    } catch {
      toast.error("Failed to start job");
    }
  };

  const handleDownload = async () => {
    if (!createdJob) return;
    try {
      const blob = await api.downloadJobResult(createdJob.id);
      if (!blob || blob.size === 0) {
        toast.error("Download failed: empty response");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = createdJob.output_filename || `combined.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Download error:", msg, err);
      toast.error(msg || "Download failed");
    }
  };

  // ── Delete helpers ─────────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    if (allDocs.length === 0) return;
    if (!window.confirm(`Delete all ${allDocs.length} documents? This cannot be undone.`)) return;
    setLoadingDocs(true);
    try {
      await Promise.all(allDocs.map((doc) => api.deleteDocument(doc.id)));
      setAllDocs([]);
      setSelectedIds(new Set());
      toast.success("All documents deleted");
    } catch {
      toast.error("Failed to delete some documents");
      loadDocuments();
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDeleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const count = ids.length;
    if (
      !window.confirm(
        `Delete ${count} selected document${count > 1 ? "s" : ""}? This cannot be undone.`
      )
    )
      return;
    setLoadingDocs(true);
    try {
      await Promise.all(ids.map((id) => api.deleteDocument(id)));
      setAllDocs((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      setSelectedIds(new Set());
      toast.success(`${count} document${count > 1 ? "s" : ""} deleted`);
    } catch {
      toast.error("Failed to delete some documents");
      loadDocuments();
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Clears job + selection so the next session starts fresh (index #1, not #N)
  const handleReset = () => {
    setCreatedJob(null);
    setSelectedIds(new Set());
    setOutputFilename("combined.pdf");
  };

  const isProcessing =
    createdJob?.status === "pending" || createdJob?.status === "processing";
  const isDone = createdJob?.status === "done";
  const isFailed = createdJob?.status === "failed";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Combine PDFs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select multiple PDFs and merge them into a single document
        </p>
      </div>

      {/* Job in progress / done / failed — read-only view */}
      {createdJob && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 capitalize">
              {isProcessing ? "Processing…" : isDone ? "Done" : isFailed ? "Failed" : ""}
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <ProgressBar value={createdJob.progress} />
            {isDone && (
              <div className="flex gap-3 mt-4">
                <Button onClick={handleDownload}>Download Combined PDF</Button>
                <Button variant="ghost" onClick={handleReset}>Start Over</Button>
              </div>
            )}
            {isFailed && (
              <div className="flex gap-3 mt-4">
                <Button variant="danger" onClick={handleReset}>Try Again</Button>
                <Button variant="ghost" onClick={() => navigate("/")}>Dashboard</Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Document selector — hidden while processing */}
      {!createdJob && (
        <>
          {/* Drop zone for quick upload */}
          <Card>
            <CardBody>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
                  transition-colors text-sm
                  ${isDragActive ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 hover:border-gray-400 text-gray-600"}
                  ${uploading ? "opacity-50 cursor-wait" : ""}
                `}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <>
                    <Spinner size="sm" className="mx-auto mb-2" />
                    <p>Uploading…</p>
                  </>
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

          {/* Document list */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  Select Documents ({selectedIds.size})
                </h2>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleClearSelection} disabled={selectedIds.size === 0}>
                    Clear Selection
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDeleteSelected} disabled={selectedIds.size === 0}>
                    Delete ({selectedIds.size})
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDeleteAll} disabled={allDocs.length === 0 || loadingDocs}>
                    Delete All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {loadingDocs ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : allDocs.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-gray-500">
                  <p className="text-sm">No documents available</p>
                  <p className="text-xs text-gray-400 mt-1">Upload a PDF to get started</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {allDocs.map((doc, idx) => (
                    <li
                      key={doc.id}
                      className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleDoc(doc)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => {}} // handled by li onClick; prevents double-firing
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.original_filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {doc.page_count ?? "?"} pages
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        #{idx + 1}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Output filename + start */}
          {selectedIds.size >= 2 && (
            <Card>
              <CardBody className="space-y-4">
                <Input
                  label="Output filename"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  placeholder="combined.pdf"
                />
                <p className="text-xs text-gray-400">
                  {selectedIds.size} documents selected — they will be merged in the order shown above
                </p>
              </CardBody>
              <CardFooter>
                <Button onClick={handleStartJob}>
                  Combine ({selectedIds.size} files)
                </Button>
              </CardFooter>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
