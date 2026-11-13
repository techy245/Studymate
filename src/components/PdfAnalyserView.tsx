import React, { useState } from 'react';
import {
  Bookmark,
  Download,
  FileUp,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Sigma,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AcademicYear,
  AstraAppState,
  Flashcard,
  FormulaEntry,
  PdfAnalysisResult,
  PdfDocType,
  SubjectId,
  UploadedPdf,
} from '../types';
import { ACADEMIC_YEARS, SUBJECTS } from '../data/pucSyllabus';
import { formatAcademicYear } from '../lib/conceptConnections';
import { MathRenderer } from './MathRenderer';

interface PdfAnalyserViewProps {
  state: AstraAppState;
  initialAcademicYear: AcademicYear;
  initialSubject: SubjectId;
  initialChapterId: string;
  initialPdfId?: string;
  onUploadPdf: (
    file: File,
    academic_year: AcademicYear,
    subjectId: SubjectId,
    chapterId: string,
    docType: PdfDocType
  ) => Promise<UploadedPdf>;
  onAnalyzePdf: (pdfId: string) => Promise<PdfAnalysisResult>;
  onSaveAnalysis: (pdfId: string, analysis: PdfAnalysisResult) => Promise<void>;
  onDeletePdf: (pdfId: string) => Promise<void>;
  onSaveFlashcards: (
    cards: Omit<
      Flashcard,
      'id' | 'intervalDays' | 'easeFactor' | 'repetitions' | 'nextReviewDate' | 'lapseCount' | 'createdAt'
    >[]
  ) => Promise<void>;
  onSaveFormulas: (formulas: Omit<FormulaEntry, 'id'>[]) => Promise<void>;
}

type CategoryTab =
  | 'definitions'
  | 'formulas'
  | 'derivations'
  | 'keywords'
  | 'importantNotes'
  | 'examImportance'
  | 'rawPages';

const DOC_TYPES: PdfDocType[] = [
  'Textbook',
  'Chapter PDF',
  'Class Notes',
  'Reference Material',
  'Handwritten Notes',
  'Past Question Paper',
];

export const PdfAnalyserView: React.FC<PdfAnalyserViewProps> = ({
  state,
  initialAcademicYear,
  initialSubject,
  initialChapterId,
  initialPdfId,
  onUploadPdf,
  onAnalyzePdf,
  onSaveAnalysis,
  onDeletePdf,
  onSaveFlashcards,
  onSaveFormulas,
}) => {
  const [academicYear, setAcademicYear] = useState<AcademicYear>(initialAcademicYear);
  const [subjectId, setSubjectId] = useState<SubjectId>(initialSubject);
  const subjectChapters = state.chapters
    .filter((c) => c.academic_year === academicYear && c.subjectId === subjectId)
    .sort((a, b) => a.order - b.order);
  const [chapterId, setChapterId] = useState<string>(
    subjectChapters.some((c) => c.id === initialChapterId)
      ? initialChapterId
      : subjectChapters[0]?.id ?? ''
  );
  const [docType, setDocType] = useState<PdfDocType>('Chapter PDF');
  const [selectedPdfId, setSelectedPdfId] = useState<string>(initialPdfId ?? state.pdfs[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<CategoryTab>('definitions');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');

  const enabledSet = new Set(
    state.settings.enabledSubjects ??
      (state.settings.includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'])
  );
  const visibleSubjects = SUBJECTS.filter((s) => enabledSet.has(s.id));
  const activePdf = state.pdfs.find((p) => p.id === selectedPdfId) ?? state.pdfs[0] ?? null;

  const handleYearChange = (nextYear: AcademicYear) => {
    setAcademicYear(nextYear);
    const first = state.chapters
      .filter((c) => c.academic_year === nextYear && c.subjectId === subjectId)
      .sort((a, b) => a.order - b.order)[0];
    setChapterId(first?.id ?? '');
  };

  const handleSubjectChange = (nextSubj: SubjectId) => {
    setSubjectId(nextSubj);
    const first = state.chapters
      .filter((c) => c.academic_year === academicYear && c.subjectId === nextSubj)
      .sort((a, b) => a.order - b.order)[0];
    setChapterId(first?.id ?? '');
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      const uploaded = await onUploadPdf(file, academicYear, subjectId, chapterId, docType);
      setSelectedPdfId(uploaded.id);
      if (!chapterId && uploaded.chapterId) {
        setChapterId(uploaded.chapterId);
      }
      setNotice(
        `Uploaded "${uploaded.fileName}" under ${formatAcademicYear(uploaded.academic_year)} (${uploaded.totalPages} pages). ${uploaded.extractionMessage || ''}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!activePdf) return;
    setError(null);
    setNotice(null);
    setAnalyzing(true);
    try {
      await onAnalyzePdf(activePdf.id);
      setActiveTab('definitions');
      setNotice('Gemini AI completed grounded analysis with PDF page citations.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleBookmark = async (
    category: Exclude<CategoryTab, 'rawPages'>,
    itemId: string
  ) => {
    if (!activePdf?.analysis) return;
    const updatedList = activePdf.analysis[category].map((item) =>
      item.id === itemId ? { ...item, bookmarked: !item.bookmarked } : item
    );
    const nextAnalysis: PdfAnalysisResult = {
      ...activePdf.analysis,
      [category]: updatedList,
    };
    await onSaveAnalysis(activePdf.id, nextAnalysis);
  };

  const handleExportMarkdown = () => {
    if (!activePdf?.analysis) return;
    const a = activePdf.analysis;
    const lines: string[] = [
      `# ${activePdf.fileName} — Astra Study AI Grounded Notes`,
      `Document Type: ${activePdf.docType} | Pages: ${activePdf.totalPages}`,
      `Grounding Note: ${a.groundingNote}`,
      '',
      '## A. Definitions',
      ...a.definitions.map(
        (d) => `### ${d.term} (Page ${d.pageNumber})\n- Simple: ${d.simpleExplanation}\n- Textbook: ${d.textbookDefinition}\n- Source: ${d.sourceLocation}`
      ),
      '',
      '## B. Formulas',
      ...a.formulas.map(
        (f) => `### ${f.name} (Page ${f.pageNumber})\n- Formula: ${f.expression}\n- Variables: ${f.variables}\n- SI Units: ${f.siUnits}\n- Conditions: ${f.conditions}\n- Example: ${f.shortExample}`
      ),
      '',
      '## C. Derivations',
      ...a.derivations.map(
        (der) => `### ${der.title} (Page ${der.pageNumber})\n- Final Result: ${der.finalResult}\n- Steps:\n${der.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
      ),
      '',
      '## D. Keywords',
      ...a.keywords.map((k) => `- **${k.term}** (Page ${k.pageNumber}): ${k.examUsage}`),
      '',
      '## E. Important Notes',
      ...a.importantNotes.map(
        (n) => `### ${n.title} (Page ${n.pageNumber})\n${n.summary}\n- Exceptions: ${n.exceptions}\n- Confused With: ${n.frequentlyConfused}`
      ),
      '',
      '## F. Exam Importance',
      ...a.examImportance.map(
        (e) => `- **${e.topic}** (Page ${e.pageNumber}) — KCET: ${e.kcetRelevance} | Board: ${e.boardRelevance}`
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activePdf.fileName.replace(/\.pdf$/i, '')}-notes.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleConvertToFlashcards = async () => {
    if (!activePdf?.analysis) return;
    const cards: Omit<
      Flashcard,
      'id' | 'intervalDays' | 'easeFactor' | 'repetitions' | 'nextReviewDate' | 'lapseCount' | 'createdAt'
    >[] = [];

    for (const def of activePdf.analysis.definitions.slice(0, 6)) {
      cards.push({
        academic_year: activePdf.academic_year,
        subjectId: activePdf.subjectId,
        chapterId: activePdf.chapterId,
        cardType: 'definition',
        front: `Define ${def.term} (from ${activePdf.fileName})`,
        back: `${def.textbookDefinition}\n\nSimple explanation: ${def.simpleExplanation}`,
        sourcePage: def.pageNumber,
      });
    }
    for (const f of activePdf.analysis.formulas.slice(0, 6)) {
      cards.push({
        academic_year: activePdf.academic_year,
        subjectId: activePdf.subjectId,
        chapterId: activePdf.chapterId,
        cardType: 'formula',
        front: `Formula & SI Units for ${f.name}`,
        back: `${f.expression}\nVariables: ${f.variables}\nUnits: ${f.siUnits}`,
        sourcePage: f.pageNumber,
      });
    }
    for (const kw of activePdf.analysis.keywords.slice(0, 4)) {
      cards.push({
        academic_year: activePdf.academic_year,
        subjectId: activePdf.subjectId,
        chapterId: activePdf.chapterId,
        cardType: 'keyword',
        front: `Key exam term: ${kw.term}`,
        back: `${kw.examUsage} (Must appear in: ${kw.mustAppearIn})`,
        sourcePage: kw.pageNumber,
      });
    }

    if (cards.length === 0) {
      setError('No definitions, formulas, or keywords available to convert into flashcards.');
      return;
    }
    await onSaveFlashcards(cards);
    setNotice(
      `Added ${cards.length} spaced-repetition flashcards under ${formatAcademicYear(activePdf.academic_year)}!`
    );
  };

  const handleSaveToFormulaBook = async () => {
    if (!activePdf?.analysis?.formulas.length) {
      setError('No extracted formulas available in this analysis.');
      return;
    }
    const entries: Omit<FormulaEntry, 'id'>[] = activePdf.analysis.formulas.map((f) => ({
      academic_year: activePdf.academic_year,
      subjectId: activePdf.subjectId,
      chapterId: activePdf.chapterId,
      topic: f.sourceLocation || 'Extracted Formula',
      title: f.name,
      latex: f.expression.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, ''),
      variables: [{ symbol: 'Vars', meaning: f.variables, unit: f.siUnits }],
      conditions: f.conditions,
      relatedFormulas: f.relatedFormulas ? [f.relatedFormulas] : [],
      example: f.shortExample,
      sourcePage: f.pageNumber,
      sourcePdfName: activePdf.fileName,
      bookmarked: f.bookmarked,
    }));
    await onSaveFormulas(entries);
    setNotice(
      `Saved ${entries.length} formulas under ${formatAcademicYear(activePdf.academic_year)} in Formula Book!`
    );
  };

  const tabs: { id: CategoryTab; label: string; count?: number }[] = [
    { id: 'definitions', label: 'A. Definitions', count: activePdf?.analysis?.definitions.length },
    { id: 'formulas', label: 'B. Formulas', count: activePdf?.analysis?.formulas.length },
    { id: 'derivations', label: 'C. Derivations', count: activePdf?.analysis?.derivations.length },
    { id: 'keywords', label: 'D. Keywords', count: activePdf?.analysis?.keywords.length },
    { id: 'importantNotes', label: 'E. Important Notes', count: activePdf?.analysis?.importantNotes.length },
    { id: 'examImportance', label: 'F. Exam Importance', count: activePdf?.analysis?.examImportance.length },
    { id: 'rawPages', label: 'Extracted PDF Pages', count: activePdf?.totalPages },
  ];

  return (
    <div className="space-y-6">
      {/* Upload Panel */}
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
              Upload Study PDF (Textbooks, Class Notes, Handwritten Notes, PYQs)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Every uploaded PDF is parsed page-by-page with page citations preserved for Gemini AI analysis.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="pdf-year" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Academic Year
            </label>
            <select
              id="pdf-year"
              value={academicYear}
              onChange={(e) => handleYearChange(e.target.value as AcademicYear)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            >
              {ACADEMIC_YEARS.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pdf-subject" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Subject
            </label>
            <select
              id="pdf-subject"
              value={subjectId}
              onChange={(e) => handleSubjectChange(e.target.value as SubjectId)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            >
              {visibleSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pdf-chapter" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Chapter
            </label>
            <select
              id="pdf-chapter"
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            >
              {subjectChapters.length === 0 ? (
                <option value="">Auto-create chapter from PDF filename</option>
              ) : (
                subjectChapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.order}. {c.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="pdf-doctype" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Material Type
            </label>
            <select
              id="pdf-doctype"
              value={docType}
              onChange={(e) => setDocType(e.target.value as PdfDocType)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-500 bg-slate-50/60 dark:bg-[#10182B] cursor-pointer transition-colors">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
          ) : (
            <FileUp className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          )}
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            {uploading ? 'Extracting PDF pages & indexing chunks...' : 'Click to choose a PDF file (up to 30 MB)'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Supports selectable PDFs and legible scanned / handwritten notes
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void handleFileSelected(f);
              e.target.value = '';
            }}
            className="sr-only"
          />
        </label>

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-300">
            {notice}
          </div>
        )}
      </section>

      {/* Library + Analysis Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Uploaded PDFs List */}
        <div className="lg:col-span-4 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-3">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Uploaded Documents ({state.pdfs.length})
          </h3>
          {state.pdfs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              Upload your first PDF above to inspect extracted pages and generate grounded study notes.
            </p>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto">
              {state.pdfs.map((pdf) => {
                const ch = state.chapters.find((c) => c.id === pdf.chapterId);
                const selected = activePdf?.id === pdf.id;
                return (
                  <div
                    key={pdf.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      selected
                        ? 'bg-cyan-500/10 border-cyan-500/40'
                        : 'bg-slate-50 dark:bg-[#111A2E] border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPdfId(pdf.id)}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {pdf.fileName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatAcademicYear(pdf.academic_year)} · {pdf.subjectId.toUpperCase()} · {ch?.title ?? 'Uploaded Chapter'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {pdf.docType} · {pdf.totalPages} pages ·{' '}
                          {pdf.analysis ? 'Analysed' : 'Pending analysis'}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePdf(pdf.id)}
                        aria-label={`Delete ${pdf.fileName}`}
                        className="p-1.5 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active PDF Analysis Viewer */}
        <div className="lg:col-span-8 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-5">
          {!activePdf ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Select or upload a PDF document to view extracted pages and AI-generated notes isolated by year and chapter.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                    {activePdf.fileName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatAcademicYear(activePdf.academic_year)} · {activePdf.subjectId.toUpperCase()} ·{' '}
                    {activePdf.docType} · {activePdf.totalPages} pages · {activePdf.chunks.length} indexed chunks ·{' '}
                    {activePdf.extractionMessage}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunAnalysis}
                    disabled={analyzing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-sm font-medium whitespace-nowrap"
                  >
                    {analyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : activePdf.analysis ? (
                      <RefreshCw className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>
                      {analyzing
                        ? 'Analysing with Gemini...'
                        : activePdf.analysis
                          ? 'Regenerate Analysis'
                          : 'Analyse with Gemini AI'}
                    </span>
                  </button>

                  {activePdf.analysis && (
                    <>
                      <button
                        type="button"
                        onClick={handleConvertToFlashcards}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>To Flashcards</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveToFormulaBook}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Sigma className="w-3.5 h-3.5" />
                        <span>To Formula Book</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportMarkdown}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export .md</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {activePdf.analysis && (
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-white">Grounding Report:</strong>{' '}
                  {activePdf.analysis.groundingNote}
                </div>
              )}

              {/* Category Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      activeTab === t.id
                        ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t.label}
                    {typeof t.count === 'number' ? ` (${t.count})` : ''}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'rawPages' ? (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {activePdf.pages.map((p) => (
                    <div
                      key={p.pageNumber}
                      className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-1.5"
                    >
                      <div className="text-xs font-mono font-medium text-cyan-600 dark:text-cyan-400">
                        Page {p.pageNumber}
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {p.text || '[No selectable text on this page — Gemini multimodal reading applies during analysis]'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : !activePdf.analysis ? (
                <div className="py-10 text-center space-y-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Click <strong>Analyse with Gemini AI</strong> to extract grounded definitions, formulas, derivations, keywords, notes, and exam importance with page citations.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {activeTab === 'definitions' &&
                    (activePdf.analysis.definitions.length === 0 ? (
                      <p className="text-sm text-slate-500">No definitions found in this document.</p>
                    ) : (
                      activePdf.analysis.definitions.map((d) => (
                        <div
                          key={d.id}
                          className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                                {d.term}
                              </h4>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Page {d.pageNumber} · {d.sourceLocation}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleBookmark('definitions', d.id)}
                              aria-label={`Bookmark ${d.term}`}
                              className={`p-1.5 rounded ${d.bookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>
                          </div>
                          {editingItemId === d.id ? (
                            <div className="space-y-2">
                              <textarea
                                rows={3}
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                className="w-full p-2 rounded bg-white dark:bg-[#0D1424] border border-cyan-500 text-sm"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const next = {
                                    ...activePdf.analysis!,
                                    definitions: activePdf.analysis!.definitions.map((item) =>
                                      item.id === d.id ? { ...item, simpleExplanation: editDraft } : item
                                    ),
                                  };
                                  await onSaveAnalysis(activePdf.id, next);
                                  setEditingItemId(null);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-cyan-600 text-white text-xs font-medium"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Save Edit</span>
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm text-slate-700 dark:text-slate-200">
                                <strong>Simple:</strong> <MathRenderer text={d.simpleExplanation} />
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-300">
                                <strong>Textbook:</strong> <MathRenderer text={d.textbookDefinition} />
                              </div>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Terms: {d.terminology.join(', ')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItemId(d.id);
                                    setEditDraft(d.simpleExplanation);
                                  }}
                                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                                >
                                  Edit
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    ))}

                  {activeTab === 'formulas' &&
                    (activePdf.analysis.formulas.length === 0 ? (
                      <p className="text-sm text-slate-500">No formulas found in this document.</p>
                    ) : (
                      activePdf.analysis.formulas.map((f) => (
                        <div
                          key={f.id}
                          className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                                {f.name}
                              </h4>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Page {f.pageNumber} · {f.sourceLocation}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleBookmark('formulas', f.id)}
                              aria-label={`Bookmark ${f.name}`}
                              className={`p-1.5 rounded ${f.bookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="p-3 rounded-lg bg-white dark:bg-[#0A101E] border border-slate-200 dark:border-slate-800">
                            <MathRenderer text={f.expression} blockLatex={!f.expression.includes('$')} />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <div><strong>Variables:</strong> {f.variables}</div>
                            <div><strong>SI Units:</strong> {f.siUnits}</div>
                            <div><strong>Conditions:</strong> {f.conditions}</div>
                            <div><strong>Related:</strong> {f.relatedFormulas}</div>
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-200">
                            <strong>Example:</strong> <MathRenderer text={f.shortExample} />
                          </div>
                        </div>
                      ))
                    ))}

                  {activeTab === 'derivations' &&
                    (activePdf.analysis.derivations.length === 0 ? (
                      <p className="text-sm text-slate-500">No derivations found in this document.</p>
                    ) : (
                      activePdf.analysis.derivations.map((der) => (
                        <div
                          key={der.id}
                          className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                                {der.title}
                              </h4>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Page {der.pageNumber} · {der.sourceLocation}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleBookmark('derivations', der.id)}
                              aria-label={`Bookmark ${der.title}`}
                              className={`p-1.5 rounded ${der.bookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>
                          </div>
                          <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                            {der.steps.map((s, idx) => (
                              <li key={idx}>
                                <MathRenderer text={s} />
                              </li>
                            ))}
                          </ol>
                          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1">
                            <div><strong>Reasoning:</strong> {der.mathematicalReasoning}</div>
                            <div><strong>Final Result:</strong> <MathRenderer text={der.finalResult} /></div>
                            <div><strong>Assumptions:</strong> {der.assumptions}</div>
                            <div><strong>Exam Steps:</strong> {der.examRelevantSteps}</div>
                          </div>
                        </div>
                      ))
                    ))}

                  {activeTab === 'keywords' &&
                    (activePdf.analysis.keywords.length === 0 ? (
                      <p className="text-sm text-slate-500">No keywords extracted from this document.</p>
                    ) : (
                      activePdf.analysis.keywords.map((kw) => (
                        <div
                          key={kw.id}
                          className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                              {kw.term}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Page {kw.pageNumber} · {kw.sourceLocation}
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-200">{kw.examUsage}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Must appear in: {kw.mustAppearIn}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleBookmark('keywords', kw.id)}
                            aria-label={`Bookmark ${kw.term}`}
                            className={`p-1.5 rounded ${kw.bookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                          >
                            <Bookmark className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ))}

                  {activeTab === 'importantNotes' &&
                    (activePdf.analysis.importantNotes.length === 0 ? (
                      <p className="text-sm text-slate-500">No important notes extracted.</p>
                    ) : (
                      activePdf.analysis.importantNotes.map((n) => (
                        <div
                          key={n.id}
                          className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                                {n.title}
                              </h4>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Page {n.pageNumber} · {n.sourceLocation}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleBookmark('importantNotes', n.id)}
                              aria-label={`Bookmark ${n.title}`}
                              className={`p-1.5 rounded ${n.bookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200">
                            <MathRenderer text={n.summary} />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <div><strong>Observations:</strong> {n.observations}</div>
                            <div><strong>Exceptions:</strong> {n.exceptions}</div>
                            <div><strong>Confused With:</strong> {n.frequentlyConfused}</div>
                            <div><strong>Diagrams:</strong> {n.diagramsToPractise}</div>
                          </div>
                        </div>
                      ))
                    ))}

                  {activeTab === 'examImportance' &&
                    (activePdf.analysis.examImportance.length === 0 ? (
                      <p className="text-sm text-slate-500">No exam importance items found.</p>
                    ) : (
                      activePdf.analysis.examImportance.map((e) => (
                        <div
                          key={e.id}
                          className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                                {e.topic}
                              </h4>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Page {e.pageNumber} · {e.sourceLocation}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleBookmark('examImportance', e.id)}
                              aria-label={`Bookmark ${e.topic}`}
                              className={`p-1.5 rounded ${e.bookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200">
                            <strong>KCET Relevance:</strong> {e.kcetRelevance}
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200">
                            <strong>Board Exam Relevance:</strong> {e.boardRelevance}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {e.frequencyNote}
                          </div>
                        </div>
                      ))
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};
