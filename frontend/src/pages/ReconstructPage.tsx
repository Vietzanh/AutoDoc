import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { api, Document, Job } from "@/services/api";
import { useJobPoll } from "@/hooks/useJobPoll";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";

export default function ReconstructPage() {
  const navigate = useNavigate();

  const [uploadedDoc, setUploadedDoc] = useState<Document | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<Job | null>(null);

  // Once a job is created, start polling
  const { job, error: pollError } = useJobPoll(createdJob?.id ?? 0);

  // Update created job state when polling returns fresh data
  useEffect(() => {
    if (job) setCreatedJob(job);
  }, [job]);

  // File upload via react-dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadedDoc(null);
    setCreatedJob(null);

    try {
      const doc = await api.uploadDocument(file);
      setUploadedDoc(doc);
      toast.success(`Uploaded: ${doc.original_filename}`);
    } catch {
      setUploadError("Upload failed. Make sure the file is a valid PDF.");
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

  const handleStartJob = async () => {
    if (!uploadedDoc) return;

    try {
      const j = await api.createReconstructJob(uploadedDoc.id);
      setCreatedJob(j);
      toast.success("Reconstruction job started!");
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
      a.download = createdJob.output_filename || `reconstructed-${createdJob.id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  const handleReset = () => {
    setUploadedDoc(null);
    setCreatedJob(null);
    setUploadError(null);
  };

  const isProcessing =
    createdJob?.status === "pending" || createdJob?.status === "processing";
  const isDone = createdJob?.status === "done";
  const isFailed = createdJob?.status === "failed";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">PDF → DOCX Reconstruction</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a PDF and convert it to an editable DOCX file
        </p>
      </div>

      {/* Upload zone */}
      {!uploadedDoc && !createdJob && (
        <Card>
          <CardBody>
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
                transition-colors
                ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
                ${uploading ? "opacity-50 cursor-wait" : ""}
              `}
            >
              <input {...getInputProps()} />
              <svg className="w-10 h-10 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {uploading ? (
                <>
                  <Spinner size="md" className="mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Uploading…</p>
                </>
              ) : isDragActive ? (
                <p className="text-sm text-blue-600 font-medium">Drop your PDF here</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 font-medium">
                    Drag & drop a PDF here, or click to select
                  </p>
                  <p className="text-xs text-gray-400 mt-2">Only PDF files are supported</p>
                </>
              )}
            </div>

            {uploadError && (
              <p className="mt-3 text-sm text-red-500 text-center">{uploadError}</p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Document uploaded — show preview + start button */}
      {uploadedDoc && !createdJob && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Ready to reconstruct</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">{uploadedDoc.original_filename}</p>
                <p className="text-sm text-gray-500">
                  {uploadedDoc.page_count ?? "?"} pages
                </p>
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button onClick={handleStartJob}>Start Reconstruction</Button>
              <Button variant="ghost" onClick={handleReset}>Cancel</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Job in progress */}
      {createdJob && isProcessing && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Processing…</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-600">
              Please wait while your PDF is being reconstructed.
            </p>
            <ProgressBar value={createdJob.progress} />
            <p className="text-xs text-gray-400 text-right">
              {createdJob.progress}% complete
            </p>
          </CardBody>
        </Card>
      )}

      {/* Job done */}
      {createdJob && isDone && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-green-700">Reconstruction complete!</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-600">
              Your DOCX file is ready for download.
            </p>
            <ProgressBar value={100} />
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button onClick={handleDownload}>Download DOCX</Button>
              <Button variant="ghost" onClick={handleReset}>Start Over</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Job failed */}
      {createdJob && isFailed && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-red-700">Reconstruction failed</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">
              {createdJob.error_message || "An unexpected error occurred."}
            </p>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleReset}>Try Again</Button>
              <Button variant="ghost" onClick={() => navigate("/")}>Back to Dashboard</Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
