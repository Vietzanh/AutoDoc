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
import { PdfPreview } from "@/components/ui/PdfPreview";

export default function ReconstructPage() {
  const navigate = useNavigate();

  const [uploadedDoc, setUploadedDoc] = useState<Document | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null);

  // Once a job is created, start polling
  const { job } = useJobPoll(createdJob?.id ?? 0);

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
    if (originalFileUrl) {
      URL.revokeObjectURL(originalFileUrl);
    }
    setOriginalFileUrl(URL.createObjectURL(file));

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
    if (originalFileUrl) {
      URL.revokeObjectURL(originalFileUrl);
      setOriginalFileUrl(null);
    }
  };

  const isProcessing =
    createdJob?.status === "pending" || createdJob?.status === "processing";
  const isDone = createdJob?.status === "done";
  const isFailed = createdJob?.status === "failed";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">PDF-to-DOCX Conversion</h1>
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
                transition-colors text-sm
                ${isDragActive ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 hover:border-gray-400 text-gray-600"}
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
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Ready to convert</h2>
              <div className="flex gap-2">
                <Button onClick={handleStartJob}>Start Conversion</Button>
                <Button variant="ghost" onClick={handleReset}>Cancel</Button>
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {originalFileUrl && (
              <div className="bg-gray-200 shadow-inner custom-scrollbar rounded-b-xl border-t border-gray-200">
                <PdfPreview fileUrl={originalFileUrl} />
              </div>
            )}
          </CardBody>
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
              Please wait while your PDF is being converted.
            </p>
            <ProgressBar value={createdJob.progress} />
            <p className="text-xs text-gray-400 text-right">
              {createdJob.progress}% complete
            </p>
            {originalFileUrl && <PdfPreview fileUrl={originalFileUrl} />}
          </CardBody>
        </Card>
      )}

      {/* Job done */}
      {createdJob && isDone && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-green-700">Conversion complete!</h2>
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
              <Button variant="ghost" onClick={() => navigate("/")}>Back to Home</Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
