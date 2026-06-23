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
import { validatePdfOutputFilename } from "@/utils/pdfFilename";

export default function MergePage() {
  const navigate = useNavigate();

  const [sessionDocs, setSessionDocs] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [outputFilename, setOutputFilename] = useState("merged.pdf");
  const [createdJob, setCreatedJob] = useState<Job | null>(null);

  const { job } = useJobPoll(createdJob?.id ?? 0);

  useEffect(() => {
    if (job) setCreatedJob(job);
  }, [job]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      setSessionDocs((prev) => [...prev, doc]);
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

  const selectedDocs = sessionDocs.filter((doc) => selectedIds.has(doc.id));
  const outputFilenameError = validatePdfOutputFilename(outputFilename);

  const handleStartJob = async () => {
    if (selectedIds.size < 2) {
      toast.error("Select at least 2 documents to merge");
      return;
    }
    if (outputFilenameError) {
      toast.error(outputFilenameError);
      return;
    }

    try {
      const j = await api.createMergeJob(
        selectedDocs.map((doc) => doc.id),
        outputFilename.trim()
      );
      setCreatedJob(j);
      toast.success("Merge job started!");
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
      a.download = createdJob.output_filename || "merged.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Download error:", msg, err);
      toast.error(msg || "Download failed");
    }
  };

  const handleDeleteAll = async () => {
    if (sessionDocs.length === 0) return;
    if (!window.confirm(`Delete all ${sessionDocs.length} documents? This cannot be undone.`)) return;
    setLoadingDocs(true);
    try {
      await Promise.all(sessionDocs.map((doc) => api.deleteDocument(doc.id)));
      setSessionDocs([]);
      setSelectedIds(new Set());
      toast.success("All documents deleted");
    } catch {
      toast.error("Failed to delete some documents");
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
    ) {
      return;
    }
    setLoadingDocs(true);
    try {
      await Promise.all(ids.map((id) => api.deleteDocument(id)));
      setSessionDocs((prev) => prev.filter((doc) => !selectedIds.has(doc.id)));
      setSelectedIds(new Set());
      toast.success(`${count} document${count > 1 ? "s" : ""} deleted`);
    } catch {
      toast.error("Failed to delete some documents");
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleReset = () => {
    setCreatedJob(null);
    setSelectedIds(new Set());
    setOutputFilename("merged.pdf");
  };

  const isProcessing =
    createdJob?.status === "pending" || createdJob?.status === "processing";
  const isDone = createdJob?.status === "done";
  const isFailed = createdJob?.status === "failed";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Merge PDFs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select multiple PDFs and merge them into a single document
        </p>
      </div>

      {createdJob && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 capitalize">
              {isProcessing ? "Processing..." : isDone ? "Done" : isFailed ? "Failed" : ""}
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <ProgressBar value={createdJob.progress} />
            {isDone && (
              <div className="mt-4 flex gap-3">
                <Button onClick={handleDownload}>Download Merged PDF</Button>
                <Button variant="ghost" onClick={handleReset}>Start Over</Button>
              </div>
            )}
            {isFailed && (
              <div className="mt-4 flex gap-3">
                <Button variant="danger" onClick={handleReset}>Try Again</Button>
                <Button variant="ghost" onClick={() => navigate("/")}>Home</Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {!createdJob && (
        <>
          <Card>
            <CardBody>
              <div
                {...getRootProps()}
                className={`
                  cursor-pointer rounded-xl border-2 border-dashed p-10 text-center text-sm
                  transition-colors
                  ${isDragActive ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-600 hover:border-gray-400"}
                  ${uploading ? "cursor-wait opacity-50" : ""}
                `}
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
                  <Button variant="danger" size="sm" onClick={handleDeleteAll} disabled={sessionDocs.length === 0 || loadingDocs}>
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
              ) : sessionDocs.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-gray-500">
                  <p className="text-sm">No documents available</p>
                  <p className="mt-1 text-xs text-gray-400">Upload a PDF to get started</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {sessionDocs.map((doc, idx) => (
                    <li
                      key={doc.id}
                      className="flex cursor-pointer items-center gap-4 px-6 py-3 transition-colors hover:bg-gray-50"
                      onClick={() => toggleDoc(doc)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => {}}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
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

          {selectedIds.size >= 2 && (
            <Card>
              <CardBody className="space-y-4">
                <Input
                  label="Output filename"
                  value={outputFilename}
                  onChange={(event) => setOutputFilename(event.target.value)}
                  placeholder="merged.pdf"
                  error={outputFilenameError ?? undefined}
                />
                <p className="text-xs text-gray-400">
                  {selectedIds.size} documents selected - they will be merged in the order shown above
                </p>
              </CardBody>
              <CardFooter>
                <Button onClick={handleStartJob} disabled={Boolean(outputFilenameError)}>
                  Merge ({selectedIds.size} files)
                </Button>
              </CardFooter>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
