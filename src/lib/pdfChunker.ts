import type { PdfChunk, PdfPageText } from '../types.ts';

const STOP_WORDS = new Set([
  'the', 'is', 'in', 'at', 'of', 'on', 'and', 'a', 'an', 'to', 'for', 'with',
  'by', 'as', 'from', 'that', 'this', 'it', 'are', 'be', 'or', 'we', 'can',
  'which', 'if', 'into', 'when', 'where', 'how', 'what', 'why', 'not', 'but',
]);

/**
 * Splits extracted PDF pages into overlapping chunks while preserving exact page numbers.
 */
export function chunkPdfPages(
  pdfId: string,
  pages: PdfPageText[],
  maxChunkChars: number = 1400,
  overlapChars: number = 180
): PdfChunk[] {
  const chunks: PdfChunk[] = [];
  let globalIdx = 0;

  for (const page of pages) {
    const cleaned = page.text.replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;

    if (cleaned.length <= maxChunkChars) {
      chunks.push({
        id: `${pdfId}-c-${globalIdx}`,
        pdfId,
        pageNumber: page.pageNumber,
        chunkIndex: globalIdx,
        text: cleaned,
      });
      globalIdx += 1;
      continue;
    }

    let start = 0;
    while (start < cleaned.length) {
      let end = Math.min(cleaned.length, start + maxChunkChars);
      if (end < cleaned.length) {
        const lastPeriod = cleaned.lastIndexOf('. ', end);
        if (lastPeriod > start + maxChunkChars * 0.55) {
          end = lastPeriod + 1;
        }
      }
      const slice = cleaned.slice(start, end).trim();
      if (slice.length > 0) {
        chunks.push({
          id: `${pdfId}-c-${globalIdx}`,
          pdfId,
          pageNumber: page.pageNumber,
          chunkIndex: globalIdx,
          text: slice,
        });
        globalIdx += 1;
      }
      if (end >= cleaned.length) break;
      start = Math.max(start + 1, end - overlapChars);
    }
  }

  return chunks;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Retrieves top-K relevant PDF chunks for a query using keyword overlap + term frequency weighting.
 * If query is empty or matches are weak, returns evenly sampled chunks across the document.
 */
export function retrieveRelevantChunks(
  chunks: PdfChunk[],
  query: string,
  topK: number = 8
): PdfChunk[] {
  if (chunks.length <= topK) {
    return chunks;
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return sampleEvenly(chunks, topK);
  }

  const queryFreq = new Map<string, number>();
  for (const token of queryTokens) {
    queryFreq.set(token, (queryFreq.get(token) ?? 0) + 1);
  }

  const scored = chunks.map((chunk) => {
    const lower = chunk.text.toLowerCase();
    const words = tokenize(chunk.text);
    const wordSet = new Set(words);
    let score = 0;
    for (const [term, qCount] of queryFreq.entries()) {
      if (wordSet.has(term)) {
        score += 3 * qCount;
      } else if (lower.includes(term)) {
        score += 1.5 * qCount;
      }
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex);
  const positive = scored.filter((item) => item.score > 0).slice(0, topK).map((i) => i.chunk);

  if (positive.length >= Math.min(3, topK)) {
    return positive.sort((a, b) => a.pageNumber - b.pageNumber || a.chunkIndex - b.chunkIndex);
  }

  return sampleEvenly(chunks, topK);
}

function sampleEvenly(chunks: PdfChunk[], count: number): PdfChunk[] {
  if (chunks.length <= count) return chunks;
  const result: PdfChunk[] = [];
  const step = (chunks.length - 1) / Math.max(1, count - 1);
  for (let i = 0; i < count; i += 1) {
    result.push(chunks[Math.round(i * step)]);
  }
  return result;
}

export function formatChunksForPrompt(chunks: PdfChunk[]): string {
  return chunks
    .map((c) => `[Page ${c.pageNumber} | Chunk ${c.chunkIndex + 1}]\n${c.text}`)
    .join('\n\n---\n\n');
}
