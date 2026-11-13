import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPdfPages } from '../server/pdfExtractor.ts';

function buildMinimalPdfBuffer(page1Text: string, page2Text: string): Buffer {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const stream1 = `BT /F1 12 Tf 50 720 Td (${esc(page1Text)}) Tj ET`;
  const stream2 = `BT /F1 12 Tf 50 720 Td (${esc(page2Text)}) Tj ET`;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n',
    '4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream1)} >>\nstream\n${stream1}\nendstream\nendobj\n`,
    `6 0 obj\n<< /Length ${Buffer.byteLength(stream2)} >>\nstream\n${stream2}\nendstream\nendobj\n`,
    '7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf-8');
}

test('extractPdfPages extracts text per page with accurate page numbers', async () => {
  const buf = buildMinimalPdfBuffer(
    'Gauss Law states total electric flux equals enclosed charge over epsilon zero.',
    'Parallel plate capacitor capacitance increases by factor K with dielectric slab.'
  );
  const res = await extractPdfPages('pdf-unit', buf);
  assert.equal(res.totalPages, 2);
  assert.equal(res.extractionStatus, 'extracted');
  assert.equal(res.pages[0].pageNumber, 1);
  assert.match(res.pages[0].text, /Gauss Law/);
  assert.equal(res.pages[1].pageNumber, 2);
  assert.match(res.pages[1].text, /dielectric slab/);
  assert.ok(res.chunks.length >= 2);
});
