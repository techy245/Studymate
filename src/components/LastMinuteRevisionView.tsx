import React, { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import type { AcademicYear, AstraAppState, LastMinuteRevisionSheet, SubjectId } from '../types';
import { ACADEMIC_YEARS, SUBJECTS } from '../data/pucSyllabus';
import { formatAcademicYear } from '../lib/conceptConnections';
import { MathRenderer } from './MathRenderer';

interface LastMinuteRevisionViewProps {
  state: AstraAppState;
  initialAcademicYear: AcademicYear;
  initialSubject: SubjectId;
  initialChapterId: string;
  onGenerateSheet: (chapterId: string, durationMinutes: 5 | 15 | 30) => Promise<LastMinuteRevisionSheet>;
}

export const LastMinuteRevisionView: React.FC<LastMinuteRevisionViewProps> = ({
  state,
  initialAcademicYear,
  initialSubject,
  initialChapterId,
  onGenerateSheet,
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
  const [duration, setDuration] = useState<5 | 15 | 30>(15);
  const [activeSheet, setActiveSheet] = useState<LastMinuteRevisionSheet | null>(
    state.lastMinuteSheets[0] ?? null
  );
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submittedTest, setSubmittedTest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledSet = new Set(
    state.settings.enabledSubjects ??
      (state.settings.includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'])
  );
  const visibleSubjects = SUBJECTS.filter((s) => enabledSet.has(s.id));

  const handleGenerate = async () => {
    if (!chapterId) {
      setError('Add or import a chapter first before generating a last-minute revision sheet.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const sheet = await onGenerateSheet(chapterId, duration);
      setActiveSheet(sheet);
      setAnswers({});
      setSubmittedTest(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate revision sheet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
        <div>
          <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
            Last-Minute Revision Sprint
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select 1st or 2nd PUC chapter and sprint duration (5, 15, or 30 min) for Essential vs Supplementary notes plus a quick check.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="lmr-year" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Academic Year
            </label>
            <select
              id="lmr-year"
              value={academicYear}
              onChange={(e) => {
                const yr = e.target.value as AcademicYear;
                setAcademicYear(yr);
                const first = state.chapters.find((c) => c.academic_year === yr && c.subjectId === subjectId);
                setChapterId(first?.id ?? '');
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
            >
              {ACADEMIC_YEARS.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="lmr-subject" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Subject
            </label>
            <select
              id="lmr-subject"
              value={subjectId}
              onChange={(e) => {
                const s = e.target.value as SubjectId;
                setSubjectId(s);
                const first = state.chapters.find((c) => c.academic_year === academicYear && c.subjectId === s);
                setChapterId(first?.id ?? '');
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
            >
              {visibleSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="lmr-chapter" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Chapter
            </label>
            <select
              id="lmr-chapter"
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
            >
              {subjectChapters.length === 0 ? (
                <option value="">No chapters added yet</option>
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
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Sprint Duration
            </span>
            <div className="flex gap-2">
              {([5, 15, 30] as const).map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDuration(mins)}
                  className={`flex-1 py-2 rounded-lg text-xs font-mono font-medium border transition-colors ${
                    duration === mins
                      ? 'bg-cyan-600 border-cyan-600 text-white'
                      : 'bg-slate-50 dark:bg-[#131D33] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>
        </div>

        {subjectChapters.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No chapters added yet for {formatAcademicYear(academicYear)} {subjectId}. Add or import chapters in Subjects &amp; Chapters first.
          </p>
        )}

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={loading || !chapterId}
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span>{loading ? 'Generating Revision Sheet...' : `Generate ${duration}-Minute Revision`}</span>
          </button>

          {state.lastMinuteSheets.length > 0 && (
            <select
              aria-label="Load saved last-minute sheet"
              value={activeSheet?.id || ''}
              onChange={(e) => {
                const found = state.lastMinuteSheets.find((s) => s.id === e.target.value);
                if (found) setActiveSheet(found);
              }}
              className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-xs"
            >
              {state.lastMinuteSheets.map((s) => {
                const ch = state.chapters.find((c) => c.id === s.chapterId);
                return (
                  <option key={s.id} value={s.id}>
                    {formatAcademicYear(s.academic_year)} · {ch?.title ?? s.chapterId} ({s.durationMinutes} min)
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </section>

      {activeSheet && (
        <section className="space-y-6">
          <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                ESSENTIAL — {formatAcademicYear(activeSheet.academic_year)} Core ({activeSheet.durationMinutes}-Minute Sprint)
              </h3>
              <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">HIGH PRIORITY</span>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200">
              <MathRenderer text={activeSheet.essential.summary} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {[
                ['Important Definitions', activeSheet.essential.definitions],
                ['Essential Formulas', activeSheet.essential.formulas],
                ['Key Derivations', activeSheet.essential.derivations],
                ['Core Concepts', activeSheet.essential.keyConcepts],
                ['Exam Keywords', activeSheet.essential.keywords],
                [
                  'Common Mistakes & Confused Topics',
                  [...activeSheet.essential.commonMistakes, ...activeSheet.essential.frequentlyConfused],
                ],
              ].map(([title, items]) => (
                <div
                  key={String(title)}
                  className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <h4 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                    {title}
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                    {(items as string[]).map((it, idx) => (
                      <li key={idx}>
                        <MathRenderer text={it} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-display font-semibold text-sm text-slate-600 dark:text-slate-300">
                SUPPLEMENTARY — If Extra Time Remains
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 list-disc pl-4">
                {[...activeSheet.supplementary.extraNotes, ...activeSheet.supplementary.bonusTips].map(
                  (it, idx) => (
                    <li key={idx}>
                      <MathRenderer text={it} />
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>

          {/* Quick 10-Question Test */}
          <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Quick {activeSheet.quickTest.length}-Question Sprint Check
              </h3>
              {!submittedTest && activeSheet.quickTest.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSubmittedTest(true)}
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-xs font-medium"
                >
                  Check Answers
                </button>
              )}
            </div>

            <div className="space-y-4">
              {activeSheet.quickTest.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {qIdx + 1}. <MathRenderer text={q.question} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => {
                      const picked = answers[q.id] === optIdx;
                      const isRight = optIdx === q.correctIndex;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={submittedTest}
                          onClick={() => setAnswers((p) => ({ ...p, [q.id]: optIdx }))}
                          className={`p-2.5 rounded-lg border text-left text-xs ${
                            submittedTest
                              ? isRight
                                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-200'
                                : picked
                                  ? 'bg-red-500/15 border-red-500 text-red-700 dark:text-red-200'
                                  : 'opacity-60 border-slate-200 dark:border-slate-800'
                              : picked
                                ? 'bg-cyan-500/15 border-cyan-500'
                                : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {String.fromCharCode(65 + optIdx)}. <MathRenderer text={opt} />
                        </button>
                      );
                    })}
                  </div>
                  {submittedTest && (
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      <strong>Explanation:</strong> <MathRenderer text={q.explanation} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
