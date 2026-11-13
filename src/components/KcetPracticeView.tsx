import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Play,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type {
  AcademicYear,
  AstraAppState,
  DifficultyLevel,
  DoubtItem,
  McqQuestion,
  QuizAttempt,
  QuizQuestionResult,
  SubjectId,
} from '../types';
import { KARNATAKA_PUC_SYLLABUS, SUBJECTS } from '../data/pucSyllabus';
import { formatAcademicYear } from '../lib/conceptConnections';
import { MathRenderer } from './MathRenderer';

interface KcetPracticeViewProps {
  state: AstraAppState;
  initialAcademicYear: AcademicYear;
  initialSubject: SubjectId;
  initialChapterId: string;
  onGenerateMcqs: (payload: {
    academic_year: AcademicYear | 'COMBINED';
    subjectId: SubjectId | 'mixed';
    chapterId: string;
    chapterTitle?: string;
    topic?: string;
    difficulty: DifficultyLevel;
    count: number;
    pdfId?: string;
    extractPyqOnly?: boolean;
  }) => Promise<McqQuestion[]>;
  onSaveAttempt: (attempt: QuizAttempt) => Promise<void>;
  onSaveToDoubtNotebook: (doubt: Omit<DoubtItem, 'id' | 'createdAt'>) => Promise<void>;
}

export const KcetPracticeView: React.FC<KcetPracticeViewProps> = ({
  state,
  initialAcademicYear,
  initialSubject,
  initialChapterId,
  onGenerateMcqs,
  onSaveAttempt,
  onSaveToDoubtNotebook,
}) => {
  const [yearScope, setYearScope] = useState<AcademicYear | 'COMBINED'>('COMBINED');
  const [practiceMode, setPracticeMode] = useState<
    'chapter' | 'subject' | 'mixed' | 'timed' | 'full-mock' | 'pyq'
  >('chapter');

  const enabledIds =
    state.settings.enabledSubjects && state.settings.enabledSubjects.length > 0
      ? state.settings.enabledSubjects
      : SUBJECTS.filter((s) => !s.optional || state.settings.includeBiology).map((s) => s.id);
  const visibleSubjects = SUBJECTS.filter((s) => enabledIds.includes(s.id));

  const [subjectId, setSubjectId] = useState<SubjectId | 'mixed'>(
    enabledIds.includes(initialSubject) ? initialSubject : enabledIds[0] ?? 'physics'
  );

  // Build chapter options: use user's chapters if added, else fall back cleanly to Karnataka PUC syllabus titles
  const targetYearForChapterDropdown: AcademicYear =
    yearScope === 'COMBINED' ? initialAcademicYear : yearScope;
  const effectiveSubj: SubjectId = subjectId === 'mixed' ? visibleSubjects[0]?.id ?? 'physics' : subjectId;

  const userChaptersForSelection = state.chapters.filter(
    (c) =>
      (yearScope === 'COMBINED' || c.academic_year === yearScope) &&
      (subjectId === 'mixed' || c.subjectId === subjectId)
  );

  const chapterOptions =
    userChaptersForSelection.length > 0
      ? userChaptersForSelection.map((c) => ({
          id: c.id,
          academic_year: c.academic_year,
          subjectId: c.subjectId,
          title: c.title,
          label: `${formatAcademicYear(c.academic_year)} · ${c.order}. ${c.title}`,
        }))
      : (yearScope === 'COMBINED' ? (['PUC_1', 'PUC_2'] as AcademicYear[]) : [targetYearForChapterDropdown]).flatMap(
          (yr) =>
            (KARNATAKA_PUC_SYLLABUS[yr][effectiveSubj] ?? []).map((title, idx) => ({
              id: `ref-${yr}-${effectiveSubj}-${idx + 1}`,
              academic_year: yr,
              subjectId: effectiveSubj,
              title,
              label: `${formatAcademicYear(yr)} · ${idx + 1}. ${title} (Syllabus Ref)`,
            }))
        );

  const [chapterId, setChapterId] = useState<string>(
    chapterOptions.some((c) => c.id === initialChapterId)
      ? initialChapterId
      : chapterOptions[0]?.id ?? ''
  );

  useEffect(() => {
    if (!chapterOptions.some((c) => c.id === chapterId)) {
      setChapterId(chapterOptions[0]?.id ?? '');
    }
  }, [yearScope, subjectId, state.chapters.length]);

  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [selectedPyqPdfId, setSelectedPyqPdfId] = useState('');

  // Active test state
  const [activeQuestions, setActiveQuestions] = useState<McqQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastResult, setLastResult] = useState<QuizAttempt | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDoubtIds, setSavedDoubtIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeQuestions) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeQuestions]);

  const selectedChapterOption = chapterOptions.find((c) => c.id === chapterId);

  const startFromBank = () => {
    setError(null);
    let pool = state.questionsBank.filter(
      (q) => yearScope === 'COMBINED' || q.academic_year === yearScope
    );

    if (practiceMode === 'chapter') {
      const chPool = pool.filter((q) => q.chapterId === chapterId);
      pool =
        chPool.length > 0
          ? chPool
          : pool.filter((q) => subjectId === 'mixed' || q.subjectId === subjectId);
    } else if (practiceMode === 'subject') {
      if (subjectId !== 'mixed') {
        pool = pool.filter((q) => q.subjectId === subjectId);
      }
    } else if (practiceMode === 'pyq') {
      pool = pool.filter((q) => q.sourceType === 'uploaded-pyq');
      if (pool.length === 0) {
        setError(
          'No extracted PYQs yet. Upload a Past Question Paper PDF and click “Extract PYQs from Uploaded PDF”.'
        );
        return;
      }
    }

    if (pool.length === 0) {
      setError(
        `No saved questions match ${formatAcademicYear(yearScope)}. Click “Generate Fresh KCET MCQs (AI)” to create targeted questions.`
      );
      return;
    }

    const chosen = pool.slice(0, questionCount);
    setActiveQuestions(chosen);
    setAnswers({});
    setElapsedSeconds(0);
    setLastResult(null);
  };

  const handleGenerateAndStart = async (extractPyqOnly: boolean) => {
    setError(null);
    setGenerating(true);
    try {
      const resolvedYear: AcademicYear | 'COMBINED' =
        practiceMode === 'chapter' && selectedChapterOption
          ? selectedChapterOption.academic_year
          : yearScope;
      const resolvedSubject: SubjectId | 'mixed' =
        practiceMode === 'full-mock' || practiceMode === 'mixed'
          ? subjectId
          : effectiveSubj;
      const resolvedChapterTitle =
        practiceMode === 'chapter'
          ? selectedChapterOption?.title ?? 'Selected Chapter'
          : practiceMode === 'subject'
            ? `${SUBJECTS.find((s) => s.id === effectiveSubj)?.name} (${formatAcademicYear(yearScope)})`
            : `${formatAcademicYear(yearScope)} Full KCET Syllabus`;

      const qs = await onGenerateMcqs({
        academic_year: resolvedYear,
        subjectId: resolvedSubject,
        chapterId: practiceMode === 'chapter' ? chapterId : '',
        chapterTitle: resolvedChapterTitle,
        topic: topic.trim(),
        difficulty,
        count: questionCount,
        pdfId: selectedPyqPdfId || undefined,
        extractPyqOnly,
      });

      if (qs.length === 0) {
        setError(
          extractPyqOnly
            ? 'No clear MCQs were found in the selected uploaded PDF.'
            : 'Could not generate MCQs.'
        );
        return;
      }
      setActiveQuestions(qs);
      setAnswers({});
      setElapsedSeconds(0);
      setLastResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MCQ generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitTest = async () => {
    if (!activeQuestions) return;
    const perQSec = Math.max(1, Math.round(elapsedSeconds / Math.max(1, activeQuestions.length)));
    const results: QuizQuestionResult[] = activeQuestions.map((q) => {
      const selectedIndex = answers[q.id] ?? null;
      const isCorrect = selectedIndex === q.correctIndex;
      const chTitle =
        q.chapterTitle ??
        state.chapters.find((c) => c.id === q.chapterId)?.title ??
        selectedChapterOption?.title;
      return {
        questionId: q.id,
        question: q.question,
        academic_year: q.academic_year ?? 'PUC_2',
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        chapterTitle: chTitle,
        topic: q.topic,
        difficulty: q.difficulty,
        selectedIndex,
        correctIndex: q.correctIndex,
        isCorrect,
        timeSpentSeconds: perQSec,
        explanation: q.explanation,
        relatedConcept: q.relatedConcept,
        options: q.options,
        sourceType: q.sourceType,
      };
    });

    const correctCount = results.filter((r) => r.isCorrect).length;
    const accuracyPercent = Math.round((correctCount / Math.max(1, results.length)) * 100);
    const chTitle = selectedChapterOption?.title ?? 'Combined Practice';

    const attempt: QuizAttempt = {
      id: `attempt-${Date.now()}`,
      title:
        practiceMode === 'mixed' || practiceMode === 'full-mock'
          ? `KCET ${formatAcademicYear(yearScope)} Test`
          : practiceMode === 'subject'
            ? `KCET ${effectiveSubj.toUpperCase()} (${formatAcademicYear(yearScope)})`
            : `KCET: ${chTitle}`,
      academic_year: yearScope,
      mode: practiceMode,
      subjectId: practiceMode === 'mixed' || practiceMode === 'full-mock' ? subjectId : effectiveSubj,
      chapterIds: Array.from(new Set(results.map((r) => r.chapterId).filter(Boolean))),
      totalQuestions: results.length,
      correctCount,
      accuracyPercent,
      timeTakenSeconds: elapsedSeconds,
      completedAt: new Date().toISOString(),
      results,
    };

    await onSaveAttempt(attempt);
    setActiveQuestions(null);
    setLastResult(attempt);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const pyqPdfs = state.pdfs.filter(
    (p) => p.docType === 'Past Question Paper' || p.totalPages > 0
  );

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      {!activeQuestions && (
        <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
                Unified KCET Practice Arena (1st PUC + 2nd PUC)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Practise 1st PUC only, 2nd PUC only, or Both Years together across chapter-wise, subject-wise, mixed, or full-length mock tests.
              </p>
            </div>

            {/* Academic Year Scope Filter */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 max-w-full">
              {(
                [
                  ['PUC_1', '1st PUC Only'],
                  ['PUC_2', '2nd PUC Only'],
                  ['COMBINED', 'Both Years (KCET)'],
                ] as const
              ).map(([yr, label]) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setYearScope(yr)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    yearScope === yr
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['chapter', 'Chapter-Wise'],
                ['subject', 'Subject-Wise'],
                ['mixed', 'Mixed Topics'],
                ['timed', 'Timed Sprint'],
                ['full-mock', 'Full-Length Mock'],
                ['pyq', 'Uploaded PYQ Paper'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPracticeMode(id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  practiceMode === id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 dark:bg-[#131D33] text-slate-700 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="kcet-subject"
                className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                Subject
              </label>
              <select
                id="kcet-subject"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value as SubjectId | 'mixed')}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                {(practiceMode === 'mixed' || practiceMode === 'full-mock') && (
                  <option value="mixed">All Enabled Subjects (Mixed)</option>
                )}
                {visibleSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="kcet-chapter"
                className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                Chapter
              </label>
              <select
                id="kcet-chapter"
                value={chapterId}
                disabled={practiceMode === 'subject' || practiceMode === 'full-mock'}
                onChange={(e) => setChapterId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50"
              >
                {chapterOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="kcet-difficulty"
                className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                Difficulty
              </label>
              <select
                id="kcet-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="kcet-count"
                className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                Questions &amp; Timer ({timeLimitMinutes} min)
              </label>
              <select
                id="kcet-count"
                value={questionCount}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setQuestionCount(n);
                  setTimeLimitMinutes(Math.max(5, Math.round(n * 1.2)));
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                <option value={5}>5 Qs</option>
                <option value={10}>10 Qs</option>
                <option value={15}>15 Qs</option>
                <option value={20}>20 Qs</option>
                <option value={30}>30 Qs (Mock Block)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="kcet-topic"
                className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                Specific Topic (Optional)
              </label>
              <input
                id="kcet-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Rotational motion, Chemical equilibrium, Integrals..."
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="kcet-pyq-pdf"
                className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                Uploaded PDF Source (Optional / PYQ Paper)
              </label>
              <select
                id="kcet-pyq-pdf"
                value={selectedPyqPdfId}
                onChange={(e) => setSelectedPyqPdfId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                <option value="">None selected</option>
                {pyqPdfs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatAcademicYear(p.academic_year)} · {p.fileName} ({p.docType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startFromBank}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-[#1B2A4A] hover:opacity-90 text-white text-sm font-medium whitespace-nowrap"
            >
              <Play className="w-4 h-4" />
              <span>Start from Practice Bank</span>
            </button>

            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerateAndStart(false)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium whitespace-nowrap"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Generate Fresh KCET MCQs (AI)</span>
            </button>

            {selectedPyqPdfId && (
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleGenerateAndStart(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 text-sm font-medium whitespace-nowrap"
              >
                <span>Extract PYQs from Uploaded PDF</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Active Test Runner */}
      {activeQuestions && (
        <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Active Practice Session ({Object.keys(answers).length}/{activeQuestions.length}{' '}
                answered)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatAcademicYear(yearScope)} · KCET Scoring: +1 per correct answer, no negative marking
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-mono tabular-nums text-sm text-cyan-600 dark:text-cyan-400">
                <Clock className="w-4 h-4" />
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>
              <button
                type="button"
                onClick={() => void handleSubmitTest()}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
              >
                Submit Test
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {activeQuestions.map((q, qIdx) => {
              const chTitle =
                q.chapterTitle ?? state.chapters.find((c) => c.id === q.chapterId)?.title;
              return (
                <div
                  key={q.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Q{qIdx + 1} · {formatAcademicYear(q.academic_year)} ·{' '}
                      {q.subjectId.toUpperCase()}
                      {chTitle ? ` · ${chTitle}` : ''} · {q.topic} · {q.difficulty}
                    </span>
                    <span className="font-medium text-cyan-600 dark:text-cyan-400">
                      {q.sourceLabel}
                    </span>
                  </div>
                  <div className="text-sm sm:text-base font-medium text-slate-900 dark:text-white">
                    <MathRenderer text={q.question} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => {
                      const selected = answers[q.id] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                          className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                            selected
                              ? 'bg-cyan-500/15 border-cyan-500 text-slate-900 dark:text-white'
                              : 'bg-white dark:bg-[#0D1424] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                          }`}
                        >
                          <span className="font-mono mr-2">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          <span className="inline-block align-top">
                            <MathRenderer text={opt} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Post-Test Performance Breakdown */}
      {lastResult && !activeQuestions && (
        <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                Test Report — {lastResult.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatAcademicYear(lastResult.academic_year)} · Completed in{' '}
                {formatTimer(lastResult.timeTakenSeconds)}
              </p>
            </div>
            <div className="flex items-center gap-6 font-mono tabular-nums">
              <div className="text-right">
                <div className="text-xs text-slate-500">Score</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {lastResult.correctCount} / {lastResult.totalQuestions}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Accuracy</div>
                <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                  {lastResult.accuracyPercent}%
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {lastResult.results.map((r, idx) => (
              <div
                key={`${r.questionId}-${idx}`}
                className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatAcademicYear(r.academic_year)} · {r.subjectId.toUpperCase()}
                      {r.chapterTitle ? ` · ${r.chapterTitle}` : ''} · {r.topic}
                    </div>
                    <div className="flex items-start gap-2">
                      {r.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-1" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-1" />
                      )}
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        Q{idx + 1}. <MathRenderer text={r.question} />
                      </div>
                    </div>
                  </div>

                  {!r.isCorrect && (
                    <button
                      type="button"
                      disabled={savedDoubtIds.has(r.questionId)}
                      onClick={async () => {
                        await onSaveToDoubtNotebook({
                          academic_year: r.academic_year,
                          subjectId: r.subjectId,
                          chapterId: r.chapterId,
                          topic: r.topic,
                          question: r.question,
                          studentAttempt:
                            r.selectedIndex !== null
                              ? `Selected Option ${String.fromCharCode(65 + r.selectedIndex)}: ${r.options[r.selectedIndex]}`
                              : 'Left unattempted',
                          solutionNotes: `${r.explanation}\n\nRelated concept: ${r.relatedConcept}`,
                          mistakeType: 'Conceptual Gap',
                          status: 'unsolved',
                        });
                        setSavedDoubtIds((prev) => new Set(prev).add(r.questionId));
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-500/40 text-xs font-medium text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>
                        {savedDoubtIds.has(r.questionId)
                          ? 'Saved to Doubts'
                          : 'Save to Doubt Notebook'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 pl-6 space-y-1">
                  <div>
                    <strong>Correct Answer:</strong> {String.fromCharCode(65 + r.correctIndex)}.{' '}
                    {r.options[r.correctIndex]}
                  </div>
                  <div>
                    <strong>Explanation:</strong> <MathRenderer text={r.explanation} />
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Related Concept: {r.relatedConcept}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
