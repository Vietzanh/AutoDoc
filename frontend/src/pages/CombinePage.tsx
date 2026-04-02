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

  const [selectedDocs, setSelectedDocs] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [outputFilename, setOutputFilename] = useState("combined.pdf");
  const [createdJob, setCreatedJob] = useState<Job | null>(null);

  const { job } = useJobPoll(createdJob?.id ?? 0);

  useEffect(() => {
    if (job) setCreatedJob(job);
  }, [job]);

  // Load existing documents
  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await api.listDocuments(0, 100);
      setSelectedDocs(res.documents);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // File drop — upload and add to selection
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      setSelectedDocs((prev) => [doc, ...prev]);
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
    setSelectedDocs((prev) => {
      const exists = prev.some((d) => d.id === doc.id);
      return exists ? prev.filter((d) => d.id !== doc.id) : [...prev, doc];
    });
  };

  const handleStartJob = async () => {
    if (selectedDocs.length < 2) {
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = createdJob.output_filename || `combined.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  const handleReset = () => {
    setCreatedJob(null);
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
                  border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                  transition-colors text-sm
                  ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
                  ${uploading ? "opacity-50 cursor-wait" : ""}
                `}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <>
                    <Spinner size="sm" className="mx-auto mb-2" />
                    <p className="text-gray-600">Uploading…</p>
                  </>
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
                  Select Documents ({selectedDocs.length})
                </h2>
                <Button variant="ghost" size="sm" onClick={loadDocuments}>
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {loadingDocs ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : selectedDocs.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-gray-500">
                  <p className="text-sm">No documents available</p>
                  <p className="text-xs text-gray-400 mt-1">Upload a PDF to get started</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {selectedDocs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleDoc(doc)}
                    >
                      <input
                        type="checkbox"
                        checked
                        readOnly
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
                        #{doc.id}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Output filename + start */}
          {selectedDocs.length >= 2 && (
            <Card>
              <CardBody className="space-y-4">
                <Input
                  label="Output filename"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  placeholder="combined.pdf"
                />
                <p className="text-xs text-gray-400">
                  {selectedDocs.length} documents selected — they will be merged in the order shown above
                </p>
              </CardBody>
              <CardFooter>
                <div className="flex gap-3">
                  <Button onClick={handleStartJob}>
                    Combine ({selectedDocs.length} files)
                  </Button>
                  <Button variant="ghost" onClick={handleReset}>Clear Selection</Button>
                </div>
              </CardFooter>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
