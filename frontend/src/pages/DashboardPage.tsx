import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, Document, Job } from "@/services/api";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected files for bulk deletion
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set());
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());

  const loadData = async () => {
    setLoading(true);
    try {
      const [docsRes, jobsRes] = await Promise.all([
        api.listDocuments(0, 100),
        api.listJobs("done", 0, 100),
      ]);
      setDocuments(docsRes.documents);
      setJobs(jobsRes.jobs.filter((j) => j.status === "done"));
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteDoc = async (id: number) => {
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setSelectedDocs((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("File deleted");
    } catch {
      toast.error("Failed to delete file");
    }
  };

  const handleDeleteJob = async (id: number) => {
    try {
      await api.deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setSelectedJobs((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("File deleted");
    } catch {
      toast.error("Failed to delete file");
    }
  };

  const handleBulkDeleteDocs = async () => {
    if (selectedDocs.size === 0) return;
    try {
      for (const id of Array.from(selectedDocs)) {
        await api.deleteDocument(id);
      }
      setDocuments((prev) => prev.filter((d) => !selectedDocs.has(d.id)));
      setSelectedDocs(new Set());
      toast.success("Selected uploaded files deleted");
    } catch {
      toast.error("Failed to delete some files");
    }
  };

  const handleBulkDeleteJobs = async () => {
    if (selectedJobs.size === 0) return;
    try {
      for (const id of Array.from(selectedJobs)) {
        await api.deleteJob(id);
      }
      setJobs((prev) => prev.filter((j) => !selectedJobs.has(j.id)));
      setSelectedJobs(new Set());
      toast.success("Selected output files deleted");
    } catch {
      toast.error("Failed to delete some files");
    }
  };

  const toggleDocSelection = (id: number) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleJobSelection = (id: number) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllDocs = () => {
    if (selectedDocs.size === documents.length && documents.length > 0) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map((d) => d.id)));
    }
  };

  const handleSelectAllJobs = () => {
    if (selectedJobs.size === jobs.length && jobs.length > 0) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(jobs.map((j) => j.id)));
    }
  };

  const downloadDoc = async (id: number, filename: string) => {
    try {
      const blob = await api.downloadDocument(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  const downloadJob = async (id: number, filename: string) => {
    try {
      const blob = await api.downloadJobResult(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          View your uploaded files and successfully processed outputs below. You can download them at any time or delete one or multiple files to free up storage space.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Uploaded Files Section */}
        <Card className="flex flex-col h-[600px]">
          <CardHeader className="flex justify-between items-center bg-gray-50 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Uploaded Files</h2>
            <div className="flex items-center gap-4">
              <label className={`flex items-center gap-2 text-sm font-medium ${documents.length === 0 ? "text-gray-400 cursor-not-allowed" : "text-gray-700 cursor-pointer"}`}>
                <input
                  type="checkbox"
                  checked={documents.length > 0 && selectedDocs.size === documents.length}
                  onChange={handleSelectAllDocs}
                  disabled={documents.length === 0}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                Select All
              </label>
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDeleteDocs}
                disabled={selectedDocs.size === 0}
              >
                Delete Selected ({selectedDocs.size})
              </Button>
            </div>
          </CardHeader>
          <CardBody className="overflow-auto p-0 custom-scrollbar flex-1">
            {documents.length === 0 ? (
              <p className="text-sm text-gray-400 p-8 text-center">No uploaded files yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <input
                        type="checkbox"
                        checked={selectedDocs.has(doc.id)}
                        onChange={() => toggleDocSelection(doc.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate" title={doc.original_filename}>
                          {doc.original_filename}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(doc.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => downloadDoc(doc.id, doc.original_filename)}>
                        Download
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteDoc(doc.id)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Output Files Section */}
        <Card className="flex flex-col h-[600px]">
          <CardHeader className="flex justify-between items-center bg-gray-50 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Processed Files</h2>
            <div className="flex items-center gap-4">
              <label className={`flex items-center gap-2 text-sm font-medium ${jobs.length === 0 ? "text-gray-400 cursor-not-allowed" : "text-gray-700 cursor-pointer"}`}>
                <input
                  type="checkbox"
                  checked={jobs.length > 0 && selectedJobs.size === jobs.length}
                  onChange={handleSelectAllJobs}
                  disabled={jobs.length === 0}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                Select All
              </label>
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDeleteJobs}
                disabled={selectedJobs.size === 0}
              >
                Delete Selected ({selectedJobs.size})
              </Button>
            </div>
          </CardHeader>
          <CardBody className="overflow-auto p-0 custom-scrollbar flex-1">
            {jobs.length === 0 ? (
              <p className="text-sm text-gray-400 p-8 text-center">No output files yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <li key={job.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <input
                        type="checkbox"
                        checked={selectedJobs.has(job.id)}
                        onChange={() => toggleJobSelection(job.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate" title={job.output_filename || "Output file"}>
                          {job.output_filename || "Output file"}
                        </p>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">
                          {job.tool === 'reconstruct' ? 'convert' : job.tool.replace("-", " ")} &middot; {new Date(job.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => downloadJob(job.id, job.output_filename || "output.pdf")}>
                        Download
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteJob(job.id)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
