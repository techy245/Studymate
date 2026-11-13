import React, { useState } from 'react';
import { CheckCircle2, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { AcademicYear, AstraAppState, DoubtItem, McqQuestion, MistakeType, SubjectId } from '../types';
import { ACADEMIC_YEARS, SUBJECTS } from '../data/pucSyllabus';
import { formatAcademicYear } from '../lib/conceptConnections';
import { MathRenderer } from './MathRenderer';

interface DoubtNotebookViewProps {
  state: AstraAppState;
  onCreateDoubt: (doubt: Omit<DoubtItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateDoubt: (id: string, patch: Partial<DoubtItem>) => Promise<void>;
  onDeleteDoubt: (id: string) => Promise<void>;
  onGenerateSimilar: (id: string) => Promise<McqQuestion>;
}

const MISTAKE_TYPES: MistakeType[] = [
  'Conceptual Gap',
  'Formula Error',
  'Calculation Slip',
  'Misread Question',
  'Time Pressure',
];

export const DoubtNotebookView: React.FC<DoubtNotebookViewProps> = ({
  state,
  onCreateDoubt,
  onUpdateDoubt,
  onDeleteDoubt,
  onGenerateSimilar,
}) => {
  const [yearFilter, setYearFilter] = useState<AcademicYear | 'COMBINED'>('COMBINED');
  const [subjectFilter, setSubjectFilter] = useState<SubjectId | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DoubtItem['status']>('all');
  const [showAdd, setShowAdd] = useState(false);

  const [academicYear, setAcademicYear] = useState<AcademicYear>(state.settings.activeAcademicYear ?? 'PUC_1');
  const [subjectId, setSubjectId] = useState<SubjectId>('physics');
  const [chapterId, setChapterId] = useState<string>(
    state.chapters.find((c) => c.academic_year === academicYear && c.subjectId === 'physics')?.id ?? ''
  );
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [attempt, setAttempt] = useState('');
  const [notes, setNotes] = useState('');
  const [mistakeType, setMistakeType] = useState<MistakeType>('Conceptual Gap');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [simChoices, setSimChoices] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const enabledSet = new Set(
    state.settings.enabledSubjects ??
      (state.settings.includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'])
  );
  const visibleSubjects = SUBJECTS.filter((s) => enabledSet.has(s.id));

  const filtered = state.doubts.filter((d) => {
    if (yearFilter !== 'COMBINED' && d.academic_year !== yearFilter) return false;
    if (subjectFilter !== 'all' && d.subjectId !== subjectFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    await onCreateDoubt({
      academic_year: academicYear,
      subjectId,
      chapterId: chapterId || `${academicYear === 'PUC_1' ? 'puc1' : 'puc2'}-${subjectId}-general`,
      topic: topic.trim() || 'General Concept',
      question: question.trim(),
      studentAttempt: attempt.trim() || 'Could not solve during practice',
      solutionNotes: notes.trim() || 'Revisit textbook derivation and solve again.',
      mistakeType,
      status: 'unsolved',
    });
    setQuestion('');
    setAttempt('');
    setNotes('');
    setTopic('');
    setShowAdd(false);
  };

  const formChapters = state.chapters
    .filter((c) => c.academic_year === academicYear && c.subjectId === subjectId)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
              Doubt Notebook
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track unsolved questions across 1st &amp; 2nd PUC by Subject, Chapter, Topic, and Mistake Type, then practise AI-generated similar problems.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log New Doubt</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#131D33] p-1 border border-slate-200 dark:border-slate-800">
            {(['COMBINED', 'PUC_1', 'PUC_2'] as const).map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setYearFilter(yr)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                  yearFilter === yr
                    ? 'bg-white dark:bg-[#0D1424] text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {yr === 'COMBINED' ? 'Combined' : yr === 'PUC_1' ? '1st PUC' : '2nd PUC'}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter doubts by subject"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value as SubjectId | 'all')}
            className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-xs"
          >
            <option value="all">All Subjects</option>
            {visibleSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter doubts by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | DoubtItem['status'])}
            className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="unsolved">Unsolved</option>
            <option value="revisiting">Revisiting</option>
            <option value="solved">Solved</option>
          </select>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {showAdd && (
          <form onSubmit={handleAdd} className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <select
                aria-label="Doubt academic year"
                value={academicYear}
                onChange={(e) => {
                  const yr = e.target.value as AcademicYear;
                  setAcademicYear(yr);
                  const first = state.chapters.find((c) => c.academic_year === yr && c.subjectId === subjectId);
                  setChapterId(first?.id ?? '');
                }}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Doubt subject"
                value={subjectId}
                onChange={(e) => {
                  const s = e.target.value as SubjectId;
                  setSubjectId(s);
                  const first = state.chapters.find((c) => c.academic_year === academicYear && c.subjectId === s);
                  setChapterId(first?.id ?? '');
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
                aria-label="Doubt chapter"
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                {formChapters.length === 0 ? (
                  <option value="">General ({formatAcademicYear(academicYear)})</option>
                ) : (
                  formChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))
                )}
              </select>

              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic"
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />

              <select
                aria-label="Mistake type"
                value={mistakeType}
                onChange={(e) => setMistakeType(e.target.value as MistakeType)}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                {MISTAKE_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Question you could not solve..."
              className="w-full p-3 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <textarea
                rows={2}
                value={attempt}
                onChange={(e) => setAttempt(e.target.value)}
                placeholder="Where did you get stuck / what went wrong?"
                className="p-3 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Correct approach or takeaway..."
                className="p-3 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-medium">
                Save Doubt
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-10 text-center text-sm text-slate-500">
            {state.doubts.length === 0
              ? 'No doubts logged yet. Log tough numericals manually or save wrong KCET questions directly into your Doubt Notebook.'
              : 'No doubts logged under these filters.'}
          </div>
        ) : (
          filtered.map((d) => {
            const ch = state.chapters.find((c) => c.id === d.chapterId);
            return (
              <div
                key={d.id}
                className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatAcademicYear(d.academic_year)} · {d.subjectId.toUpperCase()} ·{' '}
                      {ch?.title ?? 'General'} · {d.topic} · {d.mistakeType}
                    </div>
                    <div className="text-base font-medium text-slate-900 dark:text-white mt-1">
                      <MathRenderer text={d.question} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label={`Status for doubt ${d.topic}`}
                      value={d.status}
                      onChange={(e) =>
                        onUpdateDoubt(d.id, { status: e.target.value as DoubtItem['status'] })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <option value="unsolved">Unsolved</option>
                      <option value="revisiting">Revisiting</option>
                      <option value="solved">Solved</option>
                    </select>

                    <button
                      type="button"
                      disabled={generatingId === d.id}
                      onClick={async () => {
                        setError(null);
                        setGeneratingId(d.id);
                        try {
                          await onGenerateSimilar(d.id);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to generate similar question.');
                        } finally {
                          setGeneratingId(null);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap"
                    >
                      {generatingId === d.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>Practise Similar Question</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteDoubt(d.id)}
                      aria-label="Delete doubt"
                      className="p-1.5 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800">
                    <strong className="text-slate-900 dark:text-white">Your Attempt / Mistake:</strong>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{d.studentAttempt}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800">
                    <strong className="text-slate-900 dark:text-white">Resolution Notes:</strong>
                    <div className="mt-1 text-slate-600 dark:text-slate-300">
                      <MathRenderer text={d.solutionNotes} />
                    </div>
                  </div>
                </div>

                {d.similarQuestion && (
                  <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/25 space-y-2.5">
                    <div className="text-xs font-medium text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Similar Practice Question ({d.similarQuestion.sourceLabel})</span>
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      <MathRenderer text={d.similarQuestion.question} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {d.similarQuestion.options.map((opt, idx) => {
                        const chosen = simChoices[d.id];
                        const isRight = idx === d.similarQuestion!.correctIndex;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSimChoices((prev) => ({ ...prev, [d.id]: idx }))}
                            className={`p-2 rounded-lg border text-left text-xs ${
                              chosen !== undefined
                                ? isRight
                                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-200'
                                  : chosen === idx
                                    ? 'bg-red-500/15 border-red-500 text-red-700 dark:text-red-200'
                                    : 'border-slate-200 dark:border-slate-800 opacity-60'
                                : 'border-slate-200 dark:border-slate-800 hover:border-cyan-500'
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}. <MathRenderer text={opt} />
                          </button>
                        );
                      })}
                    </div>
                    {simChoices[d.id] !== undefined && (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <strong>Explanation:</strong> <MathRenderer text={d.similarQuestion.explanation} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
