import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { api, Document, Job } from "@/services/api";
import { useJobPoll } from "@/hooks/useJobPoll";
import { toPoints, convertUnit, UNIT_OPTIONS } from "@/hooks/useUnitConversion";
import type { MeasurementUnit } from "@/hooks/useUnitConversion";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { CropOverlayThumbnail } from "@/components/ui/CropOverlayThumbnail";
import { validatePdfOutputFilename } from "@/utils/pdfFilename";
import { PdfPreview } from "@/components/ui/PdfPreview";

interface PageThumbnail {
  page_number: number;
  image_base64: string;
  width_pts: number;
  height_pts: number;
}

export default function CropPage() {
  const navigate = useNavigate();

  // ── Document State ──────────────────────────────────────────────────────────
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ── Crop Options ────────────────────────────────────────────────────────────
  const [unit, setUnit] = useState<MeasurementUnit>("pt");

  // Margins stored in the *current display unit* (not points).
  // Converted to points on demand for overlay computation + API call.
  const [marginTop, setMarginTop] = useState<number | "">(0);
  const [marginBottom, setMarginBottom] = useState<number | "">(0);
  const [marginLeft, setMarginLeft] = useState<number | "">(0);
  const [marginRight, setMarginRight] = useState<number | "">(0);

  const [pageRangeMode, setPageRangeMode] = useState<"all" | "custom">("all");
  const [fromPage, setFromPage] = useState<number | "">(1);
  const [toPage, setToPage] = useState<number | "">(1);

  const [outputFilename, setOutputFilename] = useState("cropped.pdf");

  // ── Job State ───────────────────────────────────────────────────────────────
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const [outputBlobUrl, setOutputBlobUrl] = useState<string | null>(null);
  const { job } = useJobPoll(createdJob?.id ?? 0);

  useEffect(() => {
    if (job) setCreatedJob(job);
  }, [job]);

  useEffect(() => {
    if (createdJob?.status === "done" && !outputBlobUrl) {
      api.downloadJobResult(createdJob.id)
        .then(blob => setOutputBlobUrl(URL.createObjectURL(blob)))
        .catch(() => toast.error("Failed to load PDF preview"));
    }
  }, [createdJob, outputBlobUrl]);

  // ── Computed: margins in points (for overlay + API) ─────────────────────────
  const marginsPts = useMemo(() => ({
    top: toPoints(marginTop === "" ? 0 : marginTop, unit),
    bottom: toPoints(marginBottom === "" ? 0 : marginBottom, unit),
    left: toPoints(marginLeft === "" ? 0 : marginLeft, unit),
    right: toPoints(marginRight === "" ? 0 : marginRight, unit),
  }), [marginTop, marginBottom, marginLeft, marginRight, unit]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setSelectedDoc(null);
    setThumbnails([]);
    setCreatedJob(null);
    if (outputBlobUrl) {
      URL.revokeObjectURL(outputBlobUrl);
      setOutputBlobUrl(null);
    }
    setUploading(true);

    try {
      const doc = await api.uploadDocument(file);
      setSelectedDoc(doc);
      setOutputFilename(`cropped_${doc.original_filename}`);
      setLoadingThumbs(true);
      try {
        // Request higher-res thumbnails for the crop page (400px wide)
        const thumbs = await api.getDocumentThumbnails(doc.id, 400);
        setThumbnails(thumbs as PageThumbnail[]);
        setFromPage(1);
        setToPage(thumbs.length);
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
  const outputFilenameError = validatePdfOutputFilename(outputFilename);

  /** Switch unit and convert existing margin values. */
  const handleUnitChange = useCallback((newUnit: MeasurementUnit) => {
    const oldUnit = unit;
    if (oldUnit === newUnit) return;

    const convert = (v: number | ""): number | "" => {
      if (v === "" || v === 0) return v;
      return convertUnit(v, oldUnit, newUnit, 4);
    };

    setMarginTop(convert);
    setMarginBottom(convert);
    setMarginLeft(convert);
    setMarginRight(convert);
    setUnit(newUnit);
  }, [unit]);

  const handleReset = useCallback(() => {
    setMarginTop(0);
    setMarginBottom(0);
    setMarginLeft(0);
    setMarginRight(0);
    setPageRangeMode("all");
    setFromPage(1);
    setToPage(thumbnails.length || 1);
    setUnit("pt");
    if (outputBlobUrl) {
      URL.revokeObjectURL(outputBlobUrl);
      setOutputBlobUrl(null);
    }
  }, [thumbnails.length, outputBlobUrl]);

  const handleStartJob = useCallback(async () => {
    if (!selectedDoc) return;
    if (outputFilenameError) {
      toast.error(outputFilenameError);
      return;
    }

    try {
      const j = await api.createCropJob({
        document_id: selectedDoc.id,
        margins: {
          top: marginsPts.top,
          bottom: marginsPts.bottom,
          left: marginsPts.left,
          right: marginsPts.right,
        },
        from_page: pageRangeMode === "all" ? 1 : (fromPage === "" ? 1 : fromPage),
        to_page: pageRangeMode === "all" ? 0 : (toPage === "" ? thumbnails.length : toPage),
        output_filename: outputFilename,
      });
      setCreatedJob(j);
      toast.success("Crop job started!");
    } catch {
      toast.error("Failed to start crop job");
    }
  }, [selectedDoc, marginsPts, pageRangeMode, fromPage, toPage, thumbnails.length, outputFilename, outputFilenameError]);

  const handleDownload = useCallback(async () => {
    if (!createdJob) return;
    try {
      const blob = await api.downloadJobResult(createdJob.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = createdJob.output_filename || "cropped.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  }, [createdJob]);

  const handleCropAnother = useCallback(() => {
    setSelectedDoc(null);
    setThumbnails([]);
    if (outputBlobUrl) {
      URL.revokeObjectURL(outputBlobUrl);
      setOutputBlobUrl(null);
    }
    setCreatedJob(null);
    handleReset();
  }, [handleReset]);

  // ── Derived state ───────────────────────────────────────────────────────────
  const isProcessing = createdJob?.status === "pending" || createdJob?.status === "processing";
  const isDone = createdJob?.status === "done";
  const isFailed = createdJob?.status === "failed";

  const hasAnyMargin = marginsPts.top > 0 || marginsPts.bottom > 0 || marginsPts.left > 0 || marginsPts.right > 0;

  const isCustomRange = pageRangeMode === "custom";
  const isValidFrom = fromPage !== "" && fromPage >= 1 && fromPage <= thumbnails.length;
  const isValidTo = toPage !== "" && toPage >= 1 && toPage <= thumbnails.length && toPage >= (fromPage !== "" ? fromPage : 1);
  const isPageRangeValid = !isCustomRange || (isValidFrom && isValidTo);
  const pageRangeError = isCustomRange && !isPageRangeValid 
    ? `Please enter a valid range (1 - ${thumbnails.length}) where start <= end.` 
    : null;

  // Helper: is this page in the crop range?
  const isPageInRange = useCallback((pageNum: number): boolean => {
    if (pageRangeMode === "all") return true;
    const fp = fromPage === "" ? 1 : fromPage;
    const tp = toPage === "" ? thumbnails.length : toPage;
    return pageNum >= fp && pageNum <= tp;
  }, [pageRangeMode, fromPage, toPage, thumbnails.length]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Crop Pages</h1>
        <p className="text-sm text-gray-500 mt-1">
          Trim margins from your PDF pages with a live preview.
        </p>
      </div>

      {/* Processing state */}
      {createdJob && isProcessing && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Processing...</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <ProgressBar value={createdJob.progress} />
            <p className="text-xs text-gray-400 text-right">{createdJob.progress}% complete</p>
          </CardBody>
        </Card>
      )}

      {/* Done state */}
      {createdJob && isDone && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-green-700">Finished!</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600 mb-2">Your PDF has been cropped successfully.</p>
            {outputBlobUrl && <PdfPreview fileUrl={outputBlobUrl} />}
          </CardBody>
          <CardFooter>
            <div className="flex gap-3 w-full justify-end">
              <Button variant="ghost" onClick={handleCropAnother}>Crop Another</Button>
              <Button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700 text-white">
                Download Cropped PDF
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Failed state */}
      {createdJob && isFailed && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-red-700">Job failed</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">{createdJob.error_message || "An unexpected error occurred."}</p>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleCropAnother}>Try Again</Button>
              <Button variant="ghost" onClick={() => navigate("/")}>Home</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Upload state */}
      {!createdJob && !selectedDoc && (
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
                  Drop a PDF here, or <span className="text-blue-600 font-medium">click</span> to select
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Configure state — two-panel layout */}
      {!createdJob && selectedDoc && !loadingThumbs && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left panel: Thumbnails ────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-gray-900">Pages Preview</h2>
                  <Button variant="ghost" size="sm" onClick={handleCropAnother}>Change PDF</Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[700px] overflow-y-auto pr-2">
                  {thumbnails.map((thumb) => (
                    <CropOverlayThumbnail
                      key={thumb.page_number}
                      thumbnail={thumb.image_base64}
                      pageNumber={thumb.page_number}
                      widthPts={thumb.width_pts}
                      heightPts={thumb.height_pts}
                      margins={marginsPts}
                      showOverlay={hasAnyMargin && isPageInRange(thumb.page_number)}
                    />
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* ── Right panel: Tool board ───────────────────────────────────── */}
          <div className="lg:col-span-1 border rounded-xl overflow-hidden bg-white flex flex-col h-fit">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-semibold text-gray-900">Page Settings</h2>
            </div>

            <div className="p-4 space-y-6">

              {/* Units */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Units</label>
                <div className="relative">
                  <select
                    value={unit}
                    onChange={(e) => handleUnitChange(e.target.value as MeasurementUnit)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none pr-8 cursor-pointer"
                  >
                    {UNIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Trim Margins */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Trim Margins</label>
                <div className="grid grid-cols-2 gap-3">
                  <MarginInput label="Top" value={marginTop} onChange={setMarginTop} />
                  <MarginInput label="Bottom" value={marginBottom} onChange={setMarginBottom} />
                  <MarginInput label="Left" value={marginLeft} onChange={setMarginLeft} />
                  <MarginInput label="Right" value={marginRight} onChange={setMarginRight} />
                </div>
              </div>

              {/* Page Range */}
              <div className="space-y-3 pb-6">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Page Range</label>
                <div className="flex flex-col gap-2 relative">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={pageRangeMode === "all"}
                      onChange={() => setPageRangeMode("all")}
                      className="text-blue-500 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-sm text-gray-700">All</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={pageRangeMode === "custom"}
                      onChange={() => setPageRangeMode("custom")}
                      className="text-blue-500 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-sm text-gray-700">From</span>
                    <input
                      type="number"
                      min={1}
                      max={thumbnails.length}
                      value={fromPage}
                      onChange={(e) => setFromPage(e.target.value === "" ? "" : parseInt(e.target.value))}
                      disabled={pageRangeMode !== "custom"}
                      className="w-16 h-8 rounded-md border border-gray-300 px-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-gray-700">to</span>
                    <input
                      type="number"
                      min={1}
                      max={thumbnails.length}
                      value={toPage}
                      onChange={(e) => setToPage(e.target.value === "" ? "" : parseInt(e.target.value))}
                      disabled={pageRangeMode !== "custom"}
                      className="w-16 h-8 rounded-md border border-gray-300 px-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </label>
                  {pageRangeError && (
                    <div className="absolute -bottom-6 left-0 text-xs text-red-500">{pageRangeError}</div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-gray-100 flex flex-col gap-4">
                <div className="w-full">
                  <Input
                    label="Output filename"
                    value={outputFilename}
                    onChange={(event) => setOutputFilename(event.target.value)}
                    placeholder="cropped.pdf"
                    error={outputFilenameError ?? undefined}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={handleStartJob}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!hasAnyMargin || Boolean(outputFilenameError) || !isPageRangeValid}
                  >
                    Crop
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Margin input sub-component ──────────────────────────────────────────────

interface MarginInputProps {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}

function MarginInput({ label, value, onChange }: MarginInputProps) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : parseFloat(e.target.value))}
        className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
