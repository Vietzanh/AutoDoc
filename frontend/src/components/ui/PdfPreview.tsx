import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Spinner } from "./Spinner";

// Set worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewProps {
  fileUrl: string;
}

export function PdfPreview({ fileUrl }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>("1");

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setInputValue("1");
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      let newPage = parseInt(inputValue, 10);
      if (!isNaN(newPage)) {
        if (newPage < 1) newPage = 1;
        if (newPage > numPages) newPage = numPages;
        setPageNumber(newPage);
        setInputValue(newPage.toString());
      } else {
        setInputValue(pageNumber.toString());
      }
    }
  };

  const next = () => {
    if (pageNumber < numPages) {
      setPageNumber((p) => p + 1);
      setInputValue((pageNumber + 1).toString());
    }
  };

  const prev = () => {
    if (pageNumber > 1) {
      setPageNumber((p) => p - 1);
      setInputValue((pageNumber - 1).toString());
    }
  };

  return (
    <div className="flex flex-col items-center bg-gray-50 rounded-xl p-4 border border-gray-200 mt-4">
      <div className="flex items-center gap-4 mb-4 bg-white px-5 py-2 rounded-full shadow-sm border border-gray-200">
        <button
          onClick={prev}
          disabled={pageNumber <= 1}
          className="text-gray-600 disabled:opacity-30 hover:text-blue-600 transition p-1"
          title="Previous Page"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setInputValue(pageNumber.toString())}
            className="w-12 text-center border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none py-1"
            title="Type a page number and press Enter"
          />
          <span>/ {numPages || "--"}</span>
        </div>
        <button
          onClick={next}
          disabled={pageNumber >= numPages || numPages === 0}
          className="text-gray-600 disabled:opacity-30 hover:text-blue-600 transition p-1"
          title="Next Page"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="max-h-[75vh] overflow-y-auto overflow-x-hidden w-full flex justify-center bg-gray-200 shadow-inner rounded-lg p-4 custom-scrollbar">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center p-10">
              <Spinner size="lg" />
              <p className="mt-4 text-gray-500 text-sm">Loading document preview...</p>
            </div>
          }
          error={<p className="text-red-500 p-4 text-center">Failed to load preview.</p>}
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-md [&>canvas]:!max-w-full [&>canvas]:!h-auto"
            scale={2.0}
          />
        </Document>
      </div>
    </div>
  );
}
