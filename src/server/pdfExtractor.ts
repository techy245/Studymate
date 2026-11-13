import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PdfChunk, PdfPageText } from '../types.ts';
import { chunkPdfPages } from '../lib/pdfChunker.ts';

export interface ExtractedPdfResult {
  totalPages: number;
  pages: PdfPageText[];
  chunks: PdfChunk[];
  extractionStatus: 'extracted' | 'empty-or-scanned';
  extractionMessage: string;
}

export async function extractPdfPages(pdfId: string, buffer: Buffer): Promise<ExtractedPdfResult> {
  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useWorkerFetch: false,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });

  const doc = await loadingTask.promise;
  const totalPages = doc.numPages;
  const pages: PdfPageText[] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;
    let currentLine = '';

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const textItem = item as { str: string; transform?: number[] };
      const y = textItem.transform ? Math.round(textItem.transform[5]) : null;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = textItem.str;
      } else {
        currentLine += (currentLine && !currentLine.endsWith(' ') && !textItem.str.startsWith(' ') ? ' ' : '') + textItem.str;
      }
      lastY = y;
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    const pageText = lines.join('\n').trim();
    totalChars += pageText.length;
    pages.push({ pageNumber: pageNum, text: pageText });
  }

  await doc.cleanup();

  const chunks = chunkPdfPages(pdfId, pages);
  const isScannedOrEmpty = totalChars < 40;

  return {
    totalPages,
    pages,
    chunks,
    extractionStatus: isScannedOrEmpty ? 'empty-or-scanned' : 'extracted',
    extractionMessage: isScannedOrEmpty
      ? 'Minimal selectable text found (likely scanned or handwritten PDF). Gemini multimodal PDF reading will be used when analysing.'
      : `Extracted ${totalChars.toLocaleString()} characters across ${totalPages} page${totalPages === 1 ? '' : 's'}.`,
  };
}
