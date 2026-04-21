import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { api, Document, Job, PageNumberMode, PageNumberPosition, PageNumberFormat } from "@/services/api";
import { useJobPoll } from "@/hooks/useJobPoll";
import { useFacingPages } from "@/hooks/useFacingPages";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { Thumbnail } from "@/components/ui/Thumbnail";
import { PositionGrid } from "@/components/ui/PositionGrid";

interface PageThumbnail {
  page_number: number;
  image_base64: string;
}

const FONTS = ["Helvetica", "Times-Roman", "Courier"];

export default function PageNumbersPage() {
  const navigate = useNavigate();

  // ── Document State ────────────────────────────────────────────────────────
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ── Options State ─────────────────────────────────────────────────────────
  const [mode, setMode] = useState<PageNumberMode>("single");
  const [position, setPosition] = useState<PageNumberPosition>("bottom-right");
  const [startNumber, setStartNumber] = useState<number>(1);
  const [fromPage, setFromPage] = useState<number>(1);
  const [toPage, setToPage] = useState<number>(1); // Updates when thumbnails load
  const [format, setFormat] = useState<PageNumberFormat>("number-only");
  const [customText, setCustomText] = useState<string>("Page {n}");
  
  const [fontName, setFontName] = useState<string>("Helvetica");
  const [fontSize, setFontSize] = useState<number>(10);
  const [bold, setBold] = useState<boolean>(false);
  const [italic, setItalic] = useState<boolean>(false);
  const [underline, setUnderline] = useState<boolean>(false);
  const [color, setColor] = useState<string>("#000000");

  const [outputFilename, setOutputFilename] = useState("numbered.pdf");

  // ── Job State ─────────────────────────────────────────────────────────────
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const { job } = useJobPoll(createdJob?.id ?? 0);

  useEffect(() => {
    if (job) setCreatedJob(job);
  }, [job]);

  // Hook for mirrored position
  const { getPositionForPage } = useFacingPages(mode, position);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setSelectedDoc(null);
    setThumbnails([]);
    setCreatedJob(null);
    setUploading(true);

    try {
      const doc = await api.uploadDocument(file);
      setSelectedDoc(doc);
      setOutputFilename(`numbered_${doc.original_filename}`);
      setLoadingThumbs(true);
      try {
        const thumbs = await api.getDocumentThumbnails(doc.id);
        setThumbnails(thumbs);
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

  const handleStartJob = async () => {
    if (!selectedDoc) return;
    try {
      const paramArgs = {
        document_id: selectedDoc.id,
        mode,
        position,
        start_number: startNumber,
        from_page: fromPage,
        to_page: toPage,
        format,
        custom_text: customText,
        text_style: {
          font_name: fontName,
          font_size: fontSize,
          bold,
          italic,
          underline,
          color,
        },
        output_filename: outputFilename,
      };

      const j = await api.createPageNumbersJob(paramArgs);
      setCreatedJob(j);
      toast.success("Page numbers job started!");
    } catch {
      toast.error("Failed to start page numbers job");
    }
  };

  const handleDownload = async () => {
    if (!createdJob) return;
    try {
      const blob = await api.downloadJobResult(createdJob.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = createdJob.output_filename || "numbered.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  const handleReset = () => {
    setSelectedDoc(null);
    setThumbnails([]);
    setCreatedJob(null);
  };

  const isProcessing = createdJob?.status === "pending" || createdJob?.status === "processing";
  const isDone = createdJob?.status === "done";
  const isFailed = createdJob?.status === "failed";

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Number Pages</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add page numbers to your document with custom formatting and position.
        </p>
      </div>

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

      {createdJob && isDone && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-green-700">Finished!</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">The document has been numbered successfully.</p>
          </CardBody>
          <CardFooter>
            <div className="flex gap-3">
              <Button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700 text-white">Download Numbered PDF</Button>
              <Button variant="ghost" onClick={handleReset}>Start Another</Button>
            </div>
          </CardFooter>
        </Card>
      )}

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
              <Button variant="danger" onClick={handleReset}>Try Again</Button>
              <Button variant="ghost" onClick={() => navigate("/")}>Dashboard</Button>
            </div>
          </CardFooter>
        </Card>
      )}

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

      {!createdJob && selectedDoc && !loadingThumbs && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-gray-900">Pages Preview</h2>
                  <Button variant="ghost" size="sm" onClick={handleReset}>Change PDF</Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
                  {thumbnails.map((thumb, idx) => {
                    const pageNum = thumb.page_number;
                    const inRange = pageNum >= fromPage && pageNum <= toPage;
                    return (
                      <Thumbnail
                        key={pageNum}
                        thumbnail={thumb.image_base64}
                        pageNumber={pageNum}
                        pageNumberPosition={inRange ? getPositionForPage(idx) : null}
                      />
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="lg:col-span-1 border rounded-xl overflow-hidden bg-white flex flex-col h-fit">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-semibold text-gray-900">Page Number Options</h2>
            </div>
            
            <div className="p-4 space-y-6">
              <div className="space-y-3">
                <span className="text-sm font-medium text-gray-700">Page mode</span>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="single" checked={mode === "single"} onChange={() => setMode("single")} className="text-blue-500 focus:ring-blue-500 h-4 w-4" />
                    <span className="text-sm text-gray-700">Single page</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="facing" checked={mode === "facing"} onChange={() => setMode("facing")} className="text-blue-500 focus:ring-blue-500 h-4 w-4" />
                    <span className="text-sm text-gray-700">Facing pages</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-sm font-medium text-gray-700">Position</span>
                <PositionGrid value={position} onChange={setPosition} />
              </div>

              <div className="space-y-3">
                <Input type="number" label="First number" min={1} value={startNumber} onChange={e => setStartNumber(parseInt(e.target.value) || 1)} />
              </div>

              <div className="space-y-3">
                <span className="text-sm font-medium text-gray-700">Pages</span>
                <div className="flex gap-2">
                  <Input type="number" label="From page" min={1} max={thumbnails.length} value={fromPage} onChange={e => setFromPage(parseInt(e.target.value) || 1)} />
                  <Input type="number" label="To page" min={1} max={thumbnails.length} value={toPage} onChange={e => setToPage(parseInt(e.target.value) || 1)} />
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-sm font-medium text-gray-700">Format</span>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="number-only" checked={format === "number-only"} onChange={() => setFormat("number-only")} className="text-blue-500 h-4 w-4" />
                    <span className="text-sm text-gray-700">Insert only number (recommended)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="page-n" checked={format === "page-n"} onChange={() => setFormat("page-n")} className="text-blue-500 h-4 w-4" />
                    <span className="text-sm text-gray-700">Page {"{n}"}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="page-n-of-p" checked={format === "page-n-of-p"} onChange={() => setFormat("page-n-of-p")} className="text-blue-500 h-4 w-4" />
                    <span className="text-sm text-gray-700">Page {"{n}"} to {"{p}"}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="custom" checked={format === "custom"} onChange={() => setFormat("custom")} className="text-blue-500 h-4 w-4" />
                    <span className="text-sm text-gray-700">Custom</span>
                  </label>
                </div>
                {format === "custom" && (
                  <div className="pt-2">
                    <Input label="Custom text" value={customText} onChange={e => setCustomText(e.target.value)} />
                    <p className="text-xs text-gray-500 mt-1">Text samples: {"{n}"}, Page {"{n}"}, Page {"{n}"} of {"{p}"}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-2 border-t border-gray-100">
                <span className="text-sm font-medium text-gray-700">Text format</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Font family</label>
                    <select className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" value={fontName} onChange={e => setFontName(e.target.value)}>
                      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Font size</label>
                    <input type="number" min={4} max={72} className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value) || 10)} />
                  </div>
                </div>

                <div className="flex gap-4 items-center">
                  <div className="flex rounded border border-gray-300 overflow-hidden">
                    <button type="button" onClick={() => setBold(!bold)} className={`px-3 py-1.5 font-serif font-bold text-sm ${bold ? "bg-blue-100 text-blue-700" : "bg-white text-gray-600"}`}>B</button>
                    <button type="button" onClick={() => setItalic(!italic)} className={`px-3 py-1.5 font-serif italic text-sm border-l border-r border-gray-300 ${italic ? "bg-blue-100 text-blue-700" : "bg-white text-gray-600"}`}>I</button>
                    <button type="button" onClick={() => setUnderline(!underline)} className={`px-3 py-1.5 font-serif underline text-sm ${underline ? "bg-blue-100 text-blue-700" : "bg-white text-gray-600"}`}>U</button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Color:</span>
                    <input type="color" className="w-8 h-8 rounded p-0 border-0 cursor-pointer" value={color} onChange={e => setColor(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <Button className="w-full" onClick={handleStartJob}>Add page numbers</Button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
