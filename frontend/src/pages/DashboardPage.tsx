import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, Document, Job } from "@/services/api";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { JobStatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await api.listDocuments(0, 50);
      setDocuments(res.documents);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.listJobs(undefined, 0, 50);
      setJobs(res.jobs);
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
    fetchJobs();
  }, [fetchDocs, fetchJobs]);

  const handleDeleteDoc = async (docId: number) => {
    try {
      await api.deleteDocument(docId);
      toast.success("Document deleted");
      fetchDocs();
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    try {
      await api.deleteJob(jobId);
      toast.success("Job deleted");
      fetchJobs();
    } catch {
      toast.error("Failed to delete job");
    }
  };

  const handleDownloadJob = async (job: Job) => {
    try {
      const blob = await api.downloadJobResult(job.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = job.output_filename || `job-${job.id}-output`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your documents and view job history
        </p>
      </div>

      {/* Documents section */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">My Documents</h2>
        </CardHeader>
        <CardBody className="p-0">
          {loadingDocs ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-gray-500">
              <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">No documents uploaded yet</p>
              <p className="text-xs text-gray-400 mt-1">Upload a PDF to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-6 py-3 font-medium">Filename</th>
                    <th className="px-6 py-3 font-medium">Pages</th>
                    <th className="px-6 py-3 font-medium">Size</th>
                    <th className="px-6 py-3 font-medium">Uploaded</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-3 text-gray-900 font-medium max-w-xs truncate">
                        {doc.original_filename}
                      </td>
                      <td className="px-6 py-3 text-gray-600">{doc.page_count ?? "—"}</td>
                      <td className="px-6 py-3 text-gray-600">{formatBytes(doc.file_size)}</td>
                      <td className="px-6 py-3 text-gray-500">{formatDate(doc.created_at)}</td>
                      <td className="px-6 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteDoc(doc.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Jobs section */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
        </CardHeader>
        <CardBody className="p-0">
          {loadingJobs ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-gray-500">
              <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm">No jobs yet</p>
              <p className="text-xs text-gray-400 mt-1">Run a tool to see jobs here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-6 py-3 font-medium">Tool</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Progress</th>
                    <th className="px-6 py-3 font-medium">Created</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-3 text-gray-900 font-medium capitalize">
                        {job.tool}
                      </td>
                      <td className="px-6 py-3">
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="px-6 py-3 w-36">
                        {job.status === "failed" ? (
                          <span className="text-xs text-red-500">
                            {job.error_message || "Failed"}
                          </span>
                        ) : (
                          <ProgressBar value={job.progress} />
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-500">{formatDate(job.created_at)}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {job.status === "done" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadJob(job)}
                            >
                              Download
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteJob(job.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
