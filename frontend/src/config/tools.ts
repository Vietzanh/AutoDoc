export type ToolCategory = "convert" | "edit";

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  route: string;
  category: ToolCategory;
  icon: "docx" | "merge" | "split" | "organize" | "reorder" | "numbers" | "crop" | "insert";
}

export const convertTools: ToolDefinition[] = [
  {
    id: "pdf-to-docx",
    name: "PDF to DOCX",
    description: "Convert PDF documents into editable DOCX files while preserving layout and structure.",
    route: "/reconstruct",
    category: "convert",
    icon: "docx",
  },
];

export const editTools: ToolDefinition[] = [
  {
    id: "merge-pdfs",
    name: "Merge PDFs",
    description: "Merge multiple PDF files into one document in the order you choose.",
    route: "/merge",
    category: "edit",
    icon: "merge",
  },
  {
    id: "split-pdfs",
    name: "Split PDFs",
    description: "Separate a PDF into smaller files using clear page split points.",
    route: "/split",
    category: "edit",
    icon: "split",
  },
  {
    id: "organize-pdfs",
    name: "Organize PDFs",
    description: "Preview, select, rotate, delete, and extract pages across PDF documents.",
    route: "/organize",
    category: "edit",
    icon: "organize",
  },
  {
    id: "insert-pages",
    name: "Insert pages",
    description: "Insert pages from one PDF into another by dragging and dropping.",
    route: "/insert",
    category: "edit",
    icon: "insert",
  },
  {
    id: "reorder-pages",
    name: "Reorder pages",
    description: "Drag pages into a new order and export a clean rearranged PDF.",
    route: "/reorder",
    category: "edit",
    icon: "reorder",
  },
  {
    id: "page-numbers",
    name: "Page numbers",
    description: "Add styled page numbers with single-page or facing-page placement.",
    route: "/page-numbers",
    category: "edit",
    icon: "numbers",
  },
  {
    id: "crop-pdfs",
    name: "Crop PDFs",
    description: "Crop pages by margins or custom rectangles for cleaner PDF output.",
    route: "/crop",
    category: "edit",
    icon: "crop",
  },
];

export const allTools: ToolDefinition[] = [...convertTools, ...editTools];
