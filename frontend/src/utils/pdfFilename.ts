const PDF_EXTENSION_REGEX = /\.pdf$/i;

export function validatePdfOutputFilename(filename: string): string | null {
  const trimmed = filename.trim();

  if (!trimmed || !PDF_EXTENSION_REGEX.test(trimmed)) {
    return "Output filename must end with .pdf";
  }

  return null;
}
