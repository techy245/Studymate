import React, { useState } from 'react';
import { Eye, Plus, RotateCw, Trash2 } from 'lucide-react';
import type {
  AcademicYear,
  AstraAppState,
  CardType,
  Flashcard,
  ReviewRating,
  SubjectId,
} from '../types';
import { ACADEMIC_YEARS, SUBJECTS } from '../data/pucSyllabus';
import { computeNextReview, formatIsoDate, getDueFlashcards } from '../lib/srs';
import { formatAcademicYear } from '../lib/conceptConnections';
import { MathRenderer } from './MathRenderer';

interface RevisionCenterViewProps {
  state: AstraAppState;
  initialAcademicYear: AcademicYear;
  initialSubject: SubjectId;
  initialChapterId: string;
  onReviewCard: (cardId: string, rating: ReviewRating) => Promise<void>;
  onCreateFlashcards: (
    cards: Omit<
      Flashcard,
      'id' | 'intervalDays' | 'easeFactor' | 'repetitions' | 'nextReviewDate' | 'lapseCount' | 'createdAt'
    >[]
  ) => Promise<void>;
  onDeleteFlashcard: (cardId: string) => Promise<void>;
}

const CARD_TYPES: { id: CardType | 'all'; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'flashcard', label: 'Flashcards' },
  { id: 'qa', label: 'Q&A Cards' },
  { id: 'formula', label: 'Formula Cards' },
  { id: 'definition', label: 'Definition Cards' },
  { id: 'keyword', label: 'Keyword Cards' },
];

export const RevisionCenterView: React.FC<RevisionCenterViewProps> = ({
  state,
  initialAcademicYear,
  initialSubject,
  initialChapterId,
  onReviewCard,
  onCreateFlashcards,
  onDeleteFlashcard,
}) => {
  const today = formatIsoDate(new Date());
  const [yearFilter, setYearFilter] = useState<AcademicYear | 'COMBINED'>('COMBINED');
  const [queueFilter, setQueueFilter] = useState<'due' | 'all' | 'knowledge' | 'summary'>('due');
  const [typeFilter, setTypeFilter] = useState<CardType | 'all'>('all');
  const [subjectFilter, setSubjectFilter] = useState<SubjectId | 'all'>('all');
  const [revealed, setRevealed] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);

  // Manual add card form
  const [showAdd, setShowAdd] = useState(false);
  const [newYear, setNewYear] = useState<AcademicYear>(initialAcademicYear);
  const [newSubject, setNewSubject] = useState<SubjectId>(initialSubject);
  const [newChapterId, setNewChapterId] = useState<string>(initialChapterId);
  const [newType, setNewType] = useState<CardType>('flashcard');
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');

  const enabledIds =
    state.settings.enabledSubjects && state.settings.enabledSubjects.length > 0
      ? state.settings.enabledSubjects
      : SUBJECTS.filter((s) => !s.optional || state.settings.includeBiology).map((s) => s.id);
  const visibleSubjects = SUBJECTS.filter((s) => enabledIds.includes(s.id));

  const yearScopedCards = state.flashcards.filter(
    (c) => yearFilter === 'COMBINED' || c.academic_year === yearFilter
  );

  const filteredCards = (
    queueFilter === 'due' ? getDueFlashcards(yearScopedCards, today) : yearScopedCards
  ).filter(
    (c) =>
      (typeFilter === 'all' || c.cardType === typeFilter) &&
      (subjectFilter === 'all' || c.subjectId === subjectFilter)
  );

  const currentCard = filteredCards[cardIndex % Math.max(1, filteredCards.length)] ?? null;

  const handleRate = async (rating: ReviewRating) => {
    if (!currentCard) return;
    await onReviewCard(currentCard.id, rating);
    setRevealed(false);
    setCardIndex(0);
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    await onCreateFlashcards([
      {
        academic_year: newYear,
        subjectId: newSubject,
        chapterId: newChapterId,
        cardType: newType,
        front: newFront.trim(),
        back: newBack.trim(),
      },
    ]);
    setNewFront('');
    setNewBack('');
    setShowAdd(false);
  };

  const yearScopedChapters = state.chapters.filter(
    (c) => yearFilter === 'COMBINED' || c.academic_year === yearFilter
  );

  const summaryChapter =
    yearScopedChapters.find((c) => c.id === newChapterId) ?? yearScopedChapters[0] ?? null;
  const summaryPdf = state.pdfs.find((p) => p.chapterId === summaryChapter?.id && p.analysis);
  const summaryFormulas = state.formulas.filter((f) => f.chapterId === summaryChapter?.id);

  // Unified knowledge browser (Formulas, Definitions, Derivations, Keywords from both years)
  const unifiedFormulas = state.formulas.filter(
    (f) =>
      (yearFilter === 'COMBINED' || f.academic_year === yearFilter) &&
      (subjectFilter === 'all' || f.subjectId === subjectFilter)
  );
  const unifiedPdfItems = state.pdfs.filter(
    (p) =>
      p.analysis &&
      (yearFilter === 'COMBINED' || p.academic_year === yearFilter) &&
      (subjectFilter === 'all' || p.subjectId === subjectFilter)
  );

  return (
    <div className="space-y-6">
      {/* Controls & Academic Year Filters */}
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Year Scope Filter: Combined / 1st PUC / 2nd PUC */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 max-w-full">
            {(
              [
                ['COMBINED', 'Combined Revision'],
                ['PUC_1', '1st PUC Revision'],
                ['PUC_2', '2nd PUC Revision'],
              ] as const
            ).map(([yr, label]) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setYearFilter(yr);
                  setCardIndex(0);
                  setRevealed(false);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  yearFilter === yr
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Revision Card</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#131D33]">
            <button
              type="button"
              onClick={() => {
                setQueueFilter('due');
                setCardIndex(0);
                setRevealed(false);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                queueFilter === 'due'
                  ? 'bg-white dark:bg-[#1C2A47] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Due Today ({getDueFlashcards(yearScopedCards, today).length})
            </button>
            <button
              type="button"
              onClick={() => {
                setQueueFilter('all');
                setCardIndex(0);
                setRevealed(false);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                queueFilter === 'all'
                  ? 'bg-white dark:bg-[#1C2A47] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Flashcards ({yearScopedCards.length})
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter('knowledge')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                queueFilter === 'knowledge'
                  ? 'bg-white dark:bg-[#1C2A47] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Formulas, Definitions &amp; Derivations
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter('summary')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                queueFilter === 'summary'
                  ? 'bg-white dark:bg-[#1C2A47] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              One-Page Summary
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter by subject"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value as SubjectId | 'all')}
              className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            >
              <option value="all">All Subjects</option>
              {visibleSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by card type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as CardType | 'all')}
              className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            >
              {CARD_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showAdd && (
          <form
            onSubmit={handleAddCard}
            className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                aria-label="New card academic year"
                value={newYear}
                onChange={(e) => {
                  const yr = e.target.value as AcademicYear;
                  setNewYear(yr);
                  const first = state.chapters.find(
                    (c) => c.academic_year === yr && c.subjectId === newSubject
                  );
                  setNewChapterId(first?.id ?? '');
                }}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.shortLabel}
                  </option>
                ))}
              </select>

              <select
                aria-label="New card subject"
                value={newSubject}
                onChange={(e) => {
                  const s = e.target.value as SubjectId;
                  setNewSubject(s);
                  const first = state.chapters.find(
                    (c) => c.academic_year === newYear && c.subjectId === s
                  );
                  setNewChapterId(first?.id ?? '');
                }}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                {visibleSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="New card chapter"
                value={newChapterId}
                onChange={(e) => setNewChapterId(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                <option value="">General Subject Card</option>
                {state.chapters
                  .filter((c) => c.academic_year === newYear && c.subjectId === newSubject)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </select>

              <select
                aria-label="New card type"
                value={newType}
                onChange={(e) => setNewType(e.target.value as CardType)}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                {CARD_TYPES.filter((t) => t.id !== 'all').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <textarea
                rows={2}
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                placeholder="Front / Question / Concept prompt..."
                className="p-3 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
              <textarea
                rows={2}
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                placeholder="Back / Answer / Formula & explanation..."
                className="p-3 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-medium"
              >
                Save Card
              </button>
            </div>
          </form>
        )}
      </section>

      {queueFilter === 'knowledge' ? (
        <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-5">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
              Combined Revision Library — {formatAcademicYear(yearFilter)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review formulas, definitions, derivations, and exam keywords from both academic years in one place.
            </p>
          </div>

          {unifiedFormulas.length === 0 && unifiedPdfItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No extracted formulas, definitions, or derivations yet for this filter. Upload and analyse a chapter PDF or add formulas in Formula Book.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unifiedFormulas.map((f) => (
                <div
                  key={f.id}
                  className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">
                    FORMULA · {formatAcademicYear(f.academic_year)} · {f.subjectId.toUpperCase()}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {f.title}
                  </div>
                  <MathRenderer text={f.latex} blockLatex />
                  <div className="text-xs text-slate-500 dark:text-slate-400">{f.conditions}</div>
                </div>
              ))}

              {unifiedPdfItems.flatMap((pdf) => [
                ...pdf.analysis!.definitions.map((d) => (
                  <div
                    key={d.id}
                    className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="text-xs text-indigo-500 font-medium">
                      DEFINITION · {formatAcademicYear(pdf.academic_year)} · {pdf.subjectId.toUpperCase()} · p.{d.pageNumber}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {d.term}
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      <MathRenderer text={d.textbookDefinition} />
                    </div>
                  </div>
                )),
                ...pdf.analysis!.derivations.map((der) => (
                  <div
                    key={der.id}
                    className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="text-xs text-emerald-500 font-medium">
                      DERIVATION · {formatAcademicYear(pdf.academic_year)} · {pdf.subjectId.toUpperCase()} · p.{der.pageNumber}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {der.title}
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      <MathRenderer text={der.finalResult} />
                    </div>
                  </div>
                )),
                ...pdf.analysis!.keywords.map((kw) => (
                  <div
                    key={kw.id}
                    className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-1"
                  >
                    <div className="text-xs text-amber-500 font-medium">
                      KEYWORD · {formatAcademicYear(pdf.academic_year)} · {pdf.subjectId.toUpperCase()} · p.{kw.pageNumber}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {kw.term}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">{kw.examUsage}</div>
                  </div>
                )),
              ])}
            </div>
          )}
        </section>
      ) : queueFilter === 'summary' ? (
        <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-5">
          {yearScopedChapters.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No chapters added yet under {formatAcademicYear(yearFilter)}. Add chapters or import syllabus to compile a one-page summary.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                    One-Page Quick Revision Sheet — {summaryChapter?.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {summaryChapter ? formatAcademicYear(summaryChapter.academic_year) : ''} · Compiled from your chapter notes, Formula Book, and analysed PDFs.
                  </p>
                </div>
                <select
                  aria-label="Choose chapter for one-page summary"
                  value={summaryChapter?.id}
                  onChange={(e) => setNewChapterId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-xs"
                >
                  {yearScopedChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatAcademicYear(c.academic_year)} · {c.subjectId.toUpperCase()} · {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                    Personal Notes &amp; Key Takeaways
                  </h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {summaryChapter?.personalNotes || 'No personal notes saved for this chapter yet.'}
                  </p>
                  {summaryPdf?.analysis?.importantNotes.slice(0, 3).map((n) => (
                    <div
                      key={n.id}
                      className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <strong>
                        {n.title} (p.{n.pageNumber}):
                      </strong>{' '}
                      {n.summary}
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                    Essential Formulas ({summaryFormulas.length})
                  </h4>
                  {summaryFormulas.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No formulas linked to this chapter yet.
                    </p>
                  ) : (
                    summaryFormulas.map((f) => (
                      <div
                        key={f.id}
                        className="pt-2 border-t border-slate-200 dark:border-slate-800"
                      >
                        <div className="text-xs font-medium text-slate-900 dark:text-white">
                          {f.title}
                        </div>
                        <MathRenderer text={f.latex} blockLatex />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      ) : (
        /* Spaced Repetition Card Runner */
        <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-6">
          {!currentCard ? (
            <div className="py-12 text-center space-y-2">
              <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
                {yearScopedCards.length === 0
                  ? `No revision flashcards added yet (${formatAcademicYear(yearFilter)})`
                  : queueFilter === 'due'
                    ? 'Revision queue complete for today'
                    : 'No cards match these filters'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add flashcards manually above or convert an analysed chapter PDF into spaced-repetition flashcards.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {formatAcademicYear(currentCard.academic_year)} ·{' '}
                  {currentCard.subjectId.toUpperCase()} · {currentCard.cardType} ·{' '}
                  {currentCard.sourcePage ? `PDF Page ${currentCard.sourcePage}` : 'Study Card'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums">
                    Card {(cardIndex % filteredCards.length) + 1} of {filteredCards.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onDeleteFlashcard(currentCard.id)}
                    aria-label="Delete current flashcard"
                    className="text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-[200px] p-6 rounded-xl bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <div className="text-xs font-medium text-cyan-600 dark:text-cyan-400">Prompt</div>
                  <div className="text-base sm:text-lg font-medium text-slate-900 dark:text-white">
                    <MathRenderer text={currentCard.front} />
                  </div>
                  {currentCard.hint && !revealed && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Hint: {currentCard.hint}
                    </div>
                  )}
                </div>

                {revealed && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Answer
                    </div>
                    <div className="text-sm sm:text-base text-slate-800 dark:text-slate-200">
                      <MathRenderer text={currentCard.back} />
                    </div>
                  </div>
                )}
              </div>

              {!revealed ? (
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCardIndex((i) => i + 1)}
                    className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Skip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Reveal Answer</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-center text-slate-500 dark:text-slate-400">
                    Rate recall difficulty to schedule your next spaced-repetition interval:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(['Again', 'Difficult', 'Good', 'Easy'] as ReviewRating[]).map((rating) => {
                      const preview = computeNextReview(currentCard, rating, today);
                      const colorCls =
                        rating === 'Again'
                          ? 'border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-500/10'
                          : rating === 'Difficult'
                            ? 'border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10'
                            : rating === 'Good'
                              ? 'border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10'
                              : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10';
                      return (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => void handleRate(rating)}
                          className={`p-3 rounded-lg border bg-white dark:bg-[#111A2E] transition-colors text-center ${colorCls}`}
                        >
                          <div className="text-sm font-semibold">{rating}</div>
                          <div className="text-xs opacity-80 font-mono mt-0.5">
                            {preview.humanLabel}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
};
