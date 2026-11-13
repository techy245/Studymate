import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Flame,
  FlaskConical,
  GitBranch,
  Layers,
  Loader2,
  Plus,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { AcademicYear, AstraAppState, NavSection, SubjectId } from '../types';
import { SUBJECTS } from '../data/pucSyllabus';
import { formatIsoDate, getDueFlashcards } from '../lib/srs';
import { analyzeWeaknesses } from '../lib/weaknessEngine';
import { formatAcademicYear } from '../lib/conceptConnections';

interface DashboardViewProps {
  state: AstraAppState;
  onNavigate: (
    section: NavSection,
    context?: {
      academic_year?: AcademicYear;
      subjectId?: SubjectId;
      chapterId?: string;
      pdfId?: string;
      tutorPrompt?: string;
    }
  ) => void;
  onToggleSession: (sessionId: string, completed: boolean) => Promise<void>;
  onImportSyllabus: (academic_year: AcademicYear | 'BOTH') => Promise<number>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onNavigate,
  onToggleSession,
  onImportSyllabus,
}) => {
  const [importing, setImporting] = useState<'PUC_1' | 'PUC_2' | 'BOTH' | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const today = formatIsoDate(new Date());
  const enabledIds =
    state.settings.enabledSubjects && state.settings.enabledSubjects.length > 0
      ? state.settings.enabledSubjects
      : SUBJECTS.filter((s) => !s.optional || state.settings.includeBiology).map((s) => s.id);
  const activeSubjects = SUBJECTS.filter((s) => enabledIds.includes(s.id));

  const activeChapters = state.chapters.filter((c) => enabledIds.includes(c.subjectId));
  const puc1Chapters = activeChapters.filter((c) => c.academic_year === 'PUC_1');
  const puc2Chapters = activeChapters.filter((c) => c.academic_year === 'PUC_2');

  const calcCompletion = (list: typeof activeChapters) =>
    list.length > 0
      ? Math.round(list.reduce((sum, c) => sum + c.progressPercent, 0) / list.length)
      : 0;

  const puc1Pct = calcCompletion(puc1Chapters);
  const puc2Pct = calcCompletion(puc2Chapters);
  const puc1Done = puc1Chapters.filter((c) => c.status === 'Completed').length;
  const puc2Done = puc2Chapters.filter((c) => c.status === 'Completed').length;

  const dueCards = getDueFlashcards(state.flashcards, today);
  const puc1RevisionPending =
    dueCards.filter((f) => f.academic_year === 'PUC_1').length +
    puc1Chapters.filter((c) => c.status === 'Revision').length;
  const puc2RevisionPending =
    dueCards.filter((f) => f.academic_year === 'PUC_2').length +
    puc2Chapters.filter((c) => c.status === 'Revision').length;

  const todaySessions = state.studySessions.filter((s) => s.date === today);
  const completedSessionsToday = todaySessions.filter(
    (s) => s.completed && s.sessionType !== 'break'
  ).length;
  const totalStudySessionsToday = todaySessions.filter((s) => s.sessionType !== 'break').length;

  const lastChapter =
    state.chapters.find((c) => c.id === state.settings.lastOpenedChapterId) ?? activeChapters[0] ?? null;

  const weakness = analyzeWeaknesses({
    chapters: activeChapters,
    quizAttempts: state.quizAttempts,
    flashcards: state.flashcards,
    doubts: state.doubts,
    formulas: state.formulas,
    memoryDrills: state.memoryDrills,
    academicYearFilter: 'COMBINED',
  });

  const kcetAvgAccuracy =
    state.quizAttempts.length > 0
      ? Math.round(
          state.quizAttempts.reduce((sum, a) => sum + a.accuracyPercent, 0) /
            state.quizAttempts.length
        )
      : 0;

  const dailyPct = Math.min(
    100,
    Math.round(
      (state.settings.studyMinutesToday / Math.max(30, state.settings.dailyGoalMinutes)) * 100
    )
  );

  const isCleanEmpty = activeChapters.length === 0 && state.pdfs.length === 0;

  const handleImport = async (yr: 'PUC_1' | 'PUC_2' | 'BOTH') => {
    setImporting(yr);
    setImportNotice(null);
    try {
      const added = await onImportSyllabus(yr);
      setImportNotice(
        added > 0
          ? `Imported ${added} verified Karnataka PUC syllabus chapters.`
          : 'All Karnataka PUC chapters for your enabled subjects are already in your workspace.'
      );
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Welcome + Continue Learning Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 flex flex-col justify-between gap-6">
          <div className="space-y-2">
            <div className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
              Karnataka 1st PUC + 2nd PUC · Unified KCET Academic Workspace
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white [text-wrap:balance]">
              {isCleanEmpty
                ? 'Your fresh academic workspace is ready'
                : `Welcome back, ${state.settings.studentName}`}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
              {isCleanEmpty
                ? 'Start from scratch by adding chapters manually, uploading a chapter PDF, or importing the verified Karnataka 1st & 2nd PUC syllabus.'
                : dueCards.length > 0
                  ? `${dueCards.length} spaced-repetition card${dueCards.length === 1 ? '' : 's'} due today across 1st & 2nd PUC · ${activeChapters.length - puc1Done - puc2Done} chapters remaining.`
                  : `All due flashcards are caught up for today. Practise combined 1st + 2nd PUC KCET tests or upload chapter PDFs.`}
            </p>
          </div>

          {/* Quick Access Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => onNavigate('subjects')}
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-slate-100 dark:bg-[#131D33] hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15 border border-slate-200 dark:border-slate-800 text-left transition-colors"
            >
              <BookOpen className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                1st &amp; 2nd PUC
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pdf-analyser')}
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-slate-100 dark:bg-[#131D33] hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15 border border-slate-200 dark:border-slate-800 text-left transition-colors"
            >
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                PDF Notes
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('revision')}
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-slate-100 dark:bg-[#131D33] hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15 border border-slate-200 dark:border-slate-800 text-left transition-colors"
            >
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                Revision
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('kcet')}
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-slate-100 dark:bg-[#131D33] hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15 border border-slate-200 dark:border-slate-800 text-left transition-colors"
            >
              <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                KCET Arena
              </span>
            </button>
          </div>
        </div>

        {/* Continue Learning or Fresh Start Quick Setup Card */}
        <div className="lg:col-span-4 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 flex flex-col justify-between gap-4">
          {!lastChapter ? (
            <>
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Fresh Start Setup
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  No chapters added yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Import the official Karnataka 1st &amp; 2nd PUC syllabus or add your own chapters step by step.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={importing !== null}
                  onClick={() => void handleImport('BOTH')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {importing === 'BOTH' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 shrink-0" />
                  )}
                  <span>Import 1st &amp; 2nd PUC Syllabus</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('subjects')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Chapters Manually</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Continue Learning</span>
                  <span className="font-mono tabular-nums">{lastChapter.progressPercent}%</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  {lastChapter.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatAcademicYear(lastChapter.academic_year)} · {lastChapter.subjectId.toUpperCase()} ·{' '}
                  {lastChapter.status} · Confidence {lastChapter.confidence}/5
                </p>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all"
                    style={{ width: `${lastChapter.progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('subjects', {
                      academic_year: lastChapter.academic_year,
                      subjectId: lastChapter.subjectId,
                      chapterId: lastChapter.id,
                    })
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <span>Resume Chapter</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('tutor', {
                      academic_year: lastChapter.academic_year,
                      subjectId: lastChapter.subjectId,
                      chapterId: lastChapter.id,
                    })
                  }
                  className="px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Ask Tutor
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {importNotice && (
        <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{importNotice}</span>
          <button type="button" onClick={() => setImportNotice(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Academic Year + Overall KCET Indicators (1st PUC, 2nd PUC, KCET, Pending Revisions) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>1st PUC Completion</span>
            <BookOpen className="w-4 h-4 text-cyan-500 shrink-0" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
            {puc1Pct}%
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {puc1Done}/{puc1Chapters.length} chapters done
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>2nd PUC Completion</span>
            <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
            {puc2Pct}%
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {puc2Done}/{puc2Chapters.length} chapters done
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Overall KCET Prep</span>
            <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
            {kcetAvgAccuracy}%
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {state.quizAttempts.length} attempt{state.quizAttempts.length === 1 ? '' : 's'} ·{' '}
            {state.questionsBank.length} Qs
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>1st PUC Rev. Pending</span>
            <CalendarCheck className="w-4 h-4 text-sky-500 shrink-0" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
            {puc1RevisionPending}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Due cards &amp; rev chapters
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>2nd PUC Rev. Pending</span>
            <CalendarCheck className="w-4 h-4 text-violet-500 shrink-0" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
            {puc2RevisionPending}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Due cards &amp; rev chapters
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Daily Study &amp; Streak</span>
            <Flame className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
            {state.settings.studyMinutesToday}m · {state.settings.streakDays}d
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-cyan-500" style={{ width: `${dailyPct}%` }} />
          </div>
        </div>
      </section>

      {/* Main Split: Today's Plan + Subject Breakdown (1st & 2nd PUC) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Study Plan */}
        <div className="lg:col-span-6 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
                Today’s Study Plan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {today} · {completedSessionsToday}/{totalStudySessionsToday} sessions completed
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('planner')}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0"
            >
              Open Planner
            </button>
          </div>

          {todaySessions.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No study sessions scheduled yet.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('planner')}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500"
              >
                Create Study Plan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800/70">
              {todaySessions.map((sess) => (
                <div key={sess.id} className="py-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleSession(sess.id, !sess.completed)}
                    className="flex items-center gap-3 text-left min-w-0 flex-1"
                  >
                    <CheckCircle2
                      className={`w-5 h-5 shrink-0 transition-colors ${
                        sess.completed
                          ? 'text-emerald-500'
                          : 'text-slate-300 dark:text-slate-600 hover:text-cyan-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          sess.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {sess.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {sess.startTime} · {sess.durationMinutes} min · {sess.sessionType}
                      </div>
                    </div>
                  </button>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0 uppercase">
                    {sess.subjectId === 'break' ? 'REST' : sess.subjectId.slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Combined Subject Progress across 1st PUC & 2nd PUC */}
        <div className="lg:col-span-6 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Subject Progress (1st &amp; 2nd PUC)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active stream: {activeSubjects.map((s) => s.name).join(', ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('subjects')}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0"
            >
              Manage Syllabus
            </button>
          </div>

          <div className="space-y-4">
            {activeSubjects.map((subj) => {
              const p1 = puc1Chapters.filter((c) => c.subjectId === subj.id);
              const p2 = puc2Chapters.filter((c) => c.subjectId === subj.id);
              const total = p1.length + p2.length;
              const avgPct =
                total > 0
                  ? Math.round(
                      [...p1, ...p2].reduce((s, c) => s + c.progressPercent, 0) / total
                    )
                  : 0;
              return (
                <div key={subj.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {subj.name}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      1st PUC: {p1.length} ch · 2nd PUC: {p2.length} ch · {avgPct}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${avgPct}%`, backgroundColor: subj.accentColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom Row: Combined Weak-Topic Analysis + Concept Connections & Recent PDFs */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-500" />
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Combined Weak-Topic &amp; Concept Connection
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('weakness')}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Full Report
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {weakness.headline}
          </p>

          {weakness.weakestChapters.length > 0 && (
            <div className="divide-y divide-slate-200 dark:divide-slate-800/70">
              {weakness.weakestChapters.slice(0, 3).map((w) => (
                <div key={w.chapterId} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {w.chapterTitle}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatAcademicYear(w.academic_year)} · {w.subjectId.toUpperCase()} ·{' '}
                      {w.accuracyPercent}% accuracy · {w.statusLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('kcet', {
                        academic_year: w.academic_year,
                        subjectId: w.subjectId,
                        chapterId: w.chapterId,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    Practise
                  </button>
                </div>
              ))}
            </div>
          )}

          {weakness.conceptConnections.length > 0 && (
            <div className="p-3.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                <GitBranch className="w-3.5 h-3.5" />
                <span>Concept Connection Alert</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {weakness.conceptConnections[0].triggerReason} — build 1st PUC foundation in{' '}
                <strong>{weakness.conceptConnections[0].prerequisiteChapterTitle}</strong>.
              </p>
              <button
                type="button"
                onClick={() =>
                  onNavigate('tutor', {
                    academic_year: 'PUC_2',
                    subjectId: weakness.conceptConnections[0].subjectId,
                    chapterId: weakness.conceptConnections[0].targetChapterId,
                    tutorPrompt: weakness.conceptConnections[0].tutorPrompt,
                  })
                }
                className="text-xs font-medium text-cyan-700 dark:text-cyan-300 underline inline-flex items-center gap-1"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Explain 1st PUC Prerequisite in AI Tutor</span>
              </button>
            </div>
          )}
        </div>

        {/* Recently Uploaded PDFs */}
        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Chapter PDF Library
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('pdf-analyser')}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Upload PDF
            </button>
          </div>

          {state.pdfs.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No PDFs uploaded yet. Attach textbooks, class notes, or handwritten sheets independently to any 1st PUC or 2nd PUC chapter.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('pdf-analyser')}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
              >
                Open AI PDF Analyser
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800/70">
              {state.pdfs.slice(0, 4).map((pdf) => {
                const ch = state.chapters.find((c) => c.id === pdf.chapterId);
                return (
                  <div key={pdf.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {pdf.fileName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {formatAcademicYear(pdf.academic_year)} · {ch?.title ?? pdf.chapterId} ·{' '}
                        {pdf.totalPages} pages · {pdf.analysis ? 'Analysed' : 'Ready to analyse'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate('pdf-analyser', {
                          academic_year: pdf.academic_year,
                          subjectId: pdf.subjectId,
                          chapterId: pdf.chapterId,
                          pdfId: pdf.id,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      Open
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
