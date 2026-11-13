import React, { useState } from 'react';
import type { AcademicYear, AstraAppState } from '../types';
import { SUBJECTS } from '../data/pucSyllabus';
import { analyzeWeaknesses } from '../lib/weaknessEngine';
import { formatAcademicYear } from '../lib/conceptConnections';

interface ProgressAnalyticsViewProps {
  state: AstraAppState;
}

export const ProgressAnalyticsView: React.FC<ProgressAnalyticsViewProps> = ({ state }) => {
  const [yearFilter, setYearFilter] = useState<AcademicYear | 'COMBINED'>('COMBINED');

  const enabledSet = new Set(
    state.settings.enabledSubjects ??
      (state.settings.includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'])
  );
  const activeSubjects = SUBJECTS.filter((s) => enabledSet.has(s.id));
  const activeChapters = state.chapters.filter((c) => enabledSet.has(c.subjectId));
  const scopedChapters =
    yearFilter === 'COMBINED'
      ? activeChapters
      : activeChapters.filter((c) => c.academic_year === yearFilter);

  const puc1Chapters = activeChapters.filter((c) => c.academic_year === 'PUC_1');
  const puc2Chapters = activeChapters.filter((c) => c.academic_year === 'PUC_2');
  const puc1Completion =
    puc1Chapters.length > 0
      ? Math.round(puc1Chapters.reduce((s, c) => s + c.progressPercent, 0) / puc1Chapters.length)
      : 0;
  const puc2Completion =
    puc2Chapters.length > 0
      ? Math.round(puc2Chapters.reduce((s, c) => s + c.progressPercent, 0) / puc2Chapters.length)
      : 0;

  const weakness = analyzeWeaknesses({
    chapters: activeChapters,
    quizAttempts: state.quizAttempts,
    flashcards: state.flashcards,
    doubts: state.doubts,
    formulas: state.formulas,
    memoryDrills: state.memoryDrills,
    academicYearFilter: yearFilter,
  });

  const scopedAttempts = state.quizAttempts.filter(
    (a) => yearFilter === 'COMBINED' || a.academic_year === yearFilter || a.academic_year === 'COMBINED'
  );
  const recentAttempts = [...scopedAttempts].slice(0, 8).reverse();

  const scopedCards = state.flashcards.filter(
    (f) => yearFilter === 'COMBINED' || f.academic_year === yearFilter
  );
  const reviewedCards = scopedCards.filter((f) => f.repetitions > 0).length;
  const consistencyPct =
    scopedCards.length > 0 ? Math.round((reviewedCards / scopedCards.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Year Scope Switcher */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            1st PUC, 2nd PUC &amp; KCET Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track syllabus coverage, quiz accuracy trend, and recall mastery across academic years.
          </p>
        </div>

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
      </section>

      {/* Top KPI Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">1st PUC Completion</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {puc1Completion}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {puc1Chapters.filter((c) => c.status === 'Completed').length}/{puc1Chapters.length} chapters
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">2nd PUC Completion</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {puc2Completion}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {puc2Chapters.filter((c) => c.status === 'Completed').length}/{puc2Chapters.length} chapters
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Quiz Accuracy</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
            {weakness.overallAccuracy}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Across {scopedAttempts.length} KCET tests
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Revision Consistency</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {consistencyPct}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {state.settings.streakDays}-day active study streak
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Study Time Today</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {state.settings.studyMinutesToday} min
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Goal: {state.settings.dailyGoalMinutes} min/day
          </div>
        </div>
      </section>

      {/* Subject Completion + KCET Accuracy SVG Chart */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Subject-Wise Completion ({formatAcademicYear(yearFilter)})
          </h3>
          {scopedChapters.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
              No chapters added yet for this selection.
            </p>
          ) : (
            <div className="space-y-4">
              {activeSubjects.map((subj) => {
                const chs = scopedChapters.filter((c) => c.subjectId === subj.id);
                const pct =
                  chs.length > 0
                    ? Math.round(chs.reduce((s, c) => s + c.progressPercent, 0) / chs.length)
                    : 0;
                const completed = chs.filter((c) => c.status === 'Completed').length;
                const revision = chs.filter((c) => c.status === 'Revision').length;
                const learning = chs.filter((c) => c.status === 'Learning').length;
                return (
                  <div key={subj.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">{subj.name}</span>
                      <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {completed} Done · {revision} Rev · {learning} Learn · {pct}%
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: subj.accentColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* KCET Accuracy Bar Chart */}
        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            KCET Practice Accuracy Trend
          </h3>
          {recentAttempts.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Complete a KCET Practice test to view your accuracy trend.
            </p>
          ) : (
            <div className="space-y-2">
              <svg viewBox="0 0 400 160" className="w-full h-44 overflow-visible" role="img" aria-label="KCET quiz accuracy bar chart">
                {[0, 25, 50, 75, 100].map((yVal) => {
                  const y = 135 - (yVal / 100) * 115;
                  return (
                    <g key={yVal}>
                      <line x1="30" x2="390" y1={y} y2={y} stroke="currentColor" strokeOpacity={0.1} />
                      <text x="24" y={y + 3} textAnchor="end" className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono">
                        {yVal}%
                      </text>
                    </g>
                  );
                })}
                {recentAttempts.map((att, idx) => {
                  const barWidth = Math.min(34, Math.floor(320 / recentAttempts.length) - 8);
                  const step = 340 / Math.max(1, recentAttempts.length);
                  const x = 42 + idx * step;
                  const h = Math.max(4, (att.accuracyPercent / 100) * 115);
                  const y = 135 - h;
                  return (
                    <g key={att.id}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={h}
                        rx={4}
                        className="fill-cyan-500"
                      />
                      <text
                        x={x + barWidth / 2}
                        y={y - 5}
                        textAnchor="middle"
                        className="fill-slate-600 dark:fill-slate-300 text-[9px] font-mono"
                      >
                        {att.accuracyPercent}%
                      </text>
                      <text
                        x={x + barWidth / 2}
                        y={150}
                        textAnchor="middle"
                        className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono"
                      >
                        T{idx + 1}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </section>

      {/* Strongest vs Weakest Chapters */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-3">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Strongest Chapters
          </h3>
          {weakness.strongestChapters.length === 0 ? (
            <p className="text-xs text-slate-500">Keep practising to build strong chapter mastery.</p>
          ) : (
            <div className="space-y-2">
              {weakness.strongestChapters.map((c) => (
                <div
                  key={c.chapterId}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-slate-900 dark:text-white truncate">
                    {formatAcademicYear(c.academic_year)} · {c.chapterTitle}
                  </span>
                  <span className="font-mono text-xs text-emerald-500 shrink-0">{c.accuracyPercent}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-3">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Weakest Chapters (Focus Next)
          </h3>
          {weakness.weakestChapters.length === 0 ? (
            <p className="text-xs text-slate-500">Add chapters and practise tests to highlight focus chapters.</p>
          ) : (
            <div className="space-y-2">
              {weakness.weakestChapters.slice(0, 4).map((c) => (
                <div
                  key={c.chapterId}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-slate-900 dark:text-white truncate">
                    {formatAcademicYear(c.academic_year)} · {c.chapterTitle}
                  </span>
                  <span className="font-mono text-xs text-amber-500 shrink-0">{c.accuracyPercent}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
