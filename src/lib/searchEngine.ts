import type { AcademicYear, AstraAppState, NavSection, SubjectId } from '../types.ts';
import { formatAcademicYear } from './conceptConnections.ts';

export type SearchResultCategory =
  | 'chapter'
  | 'definition'
  | 'formula'
  | 'derivation'
  | 'keyword'
  | 'note'
  | 'flashcard'
  | 'question'
  | 'pdf'
  | 'doubt';

export interface SearchHit {
  id: string;
  category: SearchResultCategory;
  title: string;
  subtitle: string;
  snippet: string;
  academic_year?: AcademicYear;
  subjectId?: SubjectId;
  chapterId?: string;
  targetView: NavSection;
  sourcePage?: number;
}

export function searchEverything(
  state: AstraAppState,
  rawQuery: string,
  categoryFilter: SearchResultCategory | 'all' = 'all',
  academicYearFilter: AcademicYear | 'all' = 'all'
): SearchHit[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];

  const matches = (...fields: (string | undefined)[]) =>
    fields.some((f) => f && f.toLowerCase().includes(q));

  const yearMatches = (y?: AcademicYear) =>
    academicYearFilter === 'all' || y === academicYearFilter;

  // 1. Chapters & Personal Notes
  for (const ch of state.chapters) {
    if (!yearMatches(ch.academic_year)) continue;
    if (matches(ch.title, ch.personalNotes)) {
      hits.push({
        id: `ch-${ch.id}`,
        category:
          ch.personalNotes.toLowerCase().includes(q) && !ch.title.toLowerCase().includes(q)
            ? 'note'
            : 'chapter',
        title: ch.title,
        subtitle: `${formatAcademicYear(ch.academic_year)} · ${ch.subjectId.toUpperCase()} · ${ch.status}`,
        snippet: ch.personalNotes
          ? ch.personalNotes.slice(0, 140)
          : `Chapter ${ch.order} in ${formatAcademicYear(ch.academic_year)} ${ch.subjectId}`,
        academic_year: ch.academic_year,
        subjectId: ch.subjectId,
        chapterId: ch.id,
        targetView: 'subjects',
      });
    }
  }

  // 2. Formula Book
  for (const f of state.formulas) {
    if (!yearMatches(f.academic_year)) continue;
    if (matches(f.title, f.topic, f.latex, f.conditions, f.example)) {
      hits.push({
        id: `form-${f.id}`,
        category: 'formula',
        title: f.title,
        subtitle: `${formatAcademicYear(f.academic_year)} · ${f.subjectId.toUpperCase()} · ${f.topic}`,
        snippet: `${f.latex} — ${f.conditions}`,
        academic_year: f.academic_year,
        subjectId: f.subjectId,
        chapterId: f.chapterId,
        targetView: 'formula-book',
        sourcePage: f.sourcePage,
      });
    }
  }

  // 3. Flashcards
  for (const fc of state.flashcards) {
    if (!yearMatches(fc.academic_year)) continue;
    if (matches(fc.front, fc.back, fc.hint)) {
      hits.push({
        id: `fc-${fc.id}`,
        category: 'flashcard',
        title: fc.front,
        subtitle: `${formatAcademicYear(fc.academic_year)} · ${fc.subjectId.toUpperCase()} · ${fc.cardType}`,
        snippet: fc.back.slice(0, 140),
        academic_year: fc.academic_year,
        subjectId: fc.subjectId,
        chapterId: fc.chapterId,
        targetView: 'revision',
        sourcePage: fc.sourcePage,
      });
    }
  }

  // 4. KCET Questions
  for (const mq of state.questionsBank) {
    if (!yearMatches(mq.academic_year)) continue;
    if (matches(mq.question, mq.topic, mq.relatedConcept, mq.explanation, mq.chapterTitle)) {
      hits.push({
        id: `q-${mq.id}`,
        category: 'question',
        title: mq.question,
        subtitle: `${formatAcademicYear(mq.academic_year)} · ${mq.subjectId.toUpperCase()} · ${mq.difficulty} · ${mq.topic}`,
        snippet: mq.explanation.slice(0, 140),
        academic_year: mq.academic_year,
        subjectId: mq.subjectId,
        chapterId: mq.chapterId,
        targetView: 'kcet',
      });
    }
  }

  // 5. Doubts
  for (const d of state.doubts) {
    if (!yearMatches(d.academic_year)) continue;
    if (matches(d.question, d.topic, d.solutionNotes, d.mistakeType)) {
      hits.push({
        id: `doubt-${d.id}`,
        category: 'doubt',
        title: d.question,
        subtitle: `${formatAcademicYear(d.academic_year)} · ${d.subjectId.toUpperCase()} · ${d.mistakeType}`,
        snippet: d.solutionNotes.slice(0, 140),
        academic_year: d.academic_year,
        subjectId: d.subjectId,
        chapterId: d.chapterId,
        targetView: 'doubts',
      });
    }
  }

  // 6. Uploaded PDFs & AI Analysis
  for (const pdf of state.pdfs) {
    if (!yearMatches(pdf.academic_year)) continue;
    const yearTag = formatAcademicYear(pdf.academic_year);

    if (matches(pdf.fileName, pdf.docType)) {
      hits.push({
        id: `pdf-${pdf.id}`,
        category: 'pdf',
        title: pdf.fileName,
        subtitle: `${yearTag} · ${pdf.subjectId.toUpperCase()} · ${pdf.totalPages} pages · ${pdf.docType}`,
        snippet: pdf.pages[0]?.text.slice(0, 140) || 'Uploaded PDF document',
        academic_year: pdf.academic_year,
        subjectId: pdf.subjectId,
        chapterId: pdf.chapterId,
        targetView: 'pdf-analyser',
      });
    }

    if (pdf.analysis) {
      for (const def of pdf.analysis.definitions) {
        if (matches(def.term, def.simpleExplanation, def.textbookDefinition)) {
          hits.push({
            id: `def-${def.id}`,
            category: 'definition',
            title: def.term,
            subtitle: `${yearTag} · ${pdf.fileName} · Page ${def.pageNumber}`,
            snippet: def.simpleExplanation.slice(0, 140),
            academic_year: pdf.academic_year,
            subjectId: pdf.subjectId,
            chapterId: pdf.chapterId,
            targetView: 'pdf-analyser',
            sourcePage: def.pageNumber,
          });
        }
      }

      for (const der of pdf.analysis.derivations) {
        if (matches(der.title, der.finalResult, der.mathematicalReasoning)) {
          hits.push({
            id: `der-${der.id}`,
            category: 'derivation',
            title: der.title,
            subtitle: `${yearTag} · ${pdf.fileName} · Page ${der.pageNumber}`,
            snippet: der.finalResult.slice(0, 140),
            academic_year: pdf.academic_year,
            subjectId: pdf.subjectId,
            chapterId: pdf.chapterId,
            targetView: 'pdf-analyser',
            sourcePage: der.pageNumber,
          });
        }
      }

      for (const kw of pdf.analysis.keywords) {
        if (matches(kw.term, kw.examUsage, kw.mustAppearIn)) {
          hits.push({
            id: `kw-${kw.id}`,
            category: 'keyword',
            title: kw.term,
            subtitle: `${yearTag} · ${pdf.fileName} · Page ${kw.pageNumber}`,
            snippet: kw.examUsage.slice(0, 140),
            academic_year: pdf.academic_year,
            subjectId: pdf.subjectId,
            chapterId: pdf.chapterId,
            targetView: 'pdf-analyser',
            sourcePage: kw.pageNumber,
          });
        }
      }

      for (const note of pdf.analysis.importantNotes) {
        if (matches(note.title, note.summary, note.observations, note.exceptions)) {
          hits.push({
            id: `anote-${note.id}`,
            category: 'note',
            title: note.title,
            subtitle: `${yearTag} · ${pdf.fileName} · Page ${note.pageNumber}`,
            snippet: note.summary.slice(0, 140),
            academic_year: pdf.academic_year,
            subjectId: pdf.subjectId,
            chapterId: pdf.chapterId,
            targetView: 'pdf-analyser',
            sourcePage: note.pageNumber,
          });
        }
      }
    }

    const matchedChunk = pdf.chunks.find((c) => c.text.toLowerCase().includes(q));
    if (matchedChunk) {
      hits.push({
        id: `chunk-${matchedChunk.id}`,
        category: 'pdf',
        title: `Excerpt in ${pdf.fileName}`,
        subtitle: `${yearTag} · Page ${matchedChunk.pageNumber} · ${pdf.subjectId.toUpperCase()}`,
        snippet: matchedChunk.text.slice(0, 160),
        academic_year: pdf.academic_year,
        subjectId: pdf.subjectId,
        chapterId: pdf.chapterId,
        targetView: 'pdf-analyser',
        sourcePage: matchedChunk.pageNumber,
      });
    }
  }

  if (categoryFilter === 'all') {
    return hits.slice(0, 60);
  }
  return hits.filter((h) => h.category === categoryFilter).slice(0, 60);
}
