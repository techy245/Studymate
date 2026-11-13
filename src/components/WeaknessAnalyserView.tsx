import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  FlaskConical,
  GitBranch,
  Layers,
  Sigma,
} from 'lucide-react';
import type { AcademicYear, AstraAppState, NavSection, SubjectId } from '../types';
import { analyzeWeaknesses } from '../lib/weaknessEngine';
import { formatAcademicYear } from '../lib/conceptConnections';

interface WeaknessAnalyserViewProps {
  state: AstraAppState;
  onNavigate: (
    section: NavSection,
    context?: {
      academic_year?: AcademicYear;
      subjectId?: SubjectId;
      chapterId?: string;
      tutorPrompt?: string;
    }
  ) => void;
}

export const WeaknessAnalyserView: React.FC<WeaknessAnalyserViewProps> = ({ state, onNavigate }) => {
  const [yearFilter, setYearFilter] = useState<AcademicYear | 'COMBINED'>('COMBINED');

  const enabledSet = new Set(
    state.settings.enabledSubjects ??
      (state.settings.includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'])
  );
  const activeChapters = state.chapters.filter((c) => enabledSet.has(c.subjectId));

  const report = analyzeWeaknesses({
    chapters: activeChapters,
    quizAttempts: state.quizAttempts,
    flashcards: state.flashcards,
    doubts: state.doubts,
    formulas: state.formulas,
    memoryDrills: state.memoryDrills,
    academicYearFilter: yearFilter,
  });

  return (
    <div className="space-y-6">
      {/* Diagnostic Headline + Academic Year Switcher */}
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-cyan-600 dark:text-cyan-400">
            <Activity className="w-4 h-4" />
            <span>Combined 1st &amp; 2nd PUC Weak-Topic Diagnostic</span>
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
                {yr === 'COMBINED' ? 'Combined (1st & 2nd PUC)' : yr === 'PUC_1' ? '1st PUC' : '2nd PUC'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white [text-wrap:balance] flex-1 min-w-0">
            {report.headline}
          </h2>
          <div className="text-right font-mono tabular-nums shrink-0">
            <div className="text-xs text-slate-500 dark:text-slate-400">Overall Accuracy</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{report.overallAccuracy}%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Avg {report.avgTimePerQuestionSec}s / Q
            </div>
          </div>
        </div>
      </section>

      {/* Cross-Year Concept Connection Diagnostics */}
      {report.conceptConnections.length > 0 && (
        <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-indigo-500/30 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-500" />
            <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Concept Connections — 1st PUC Foundations Needed for Weak 2nd PUC Topics
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {report.conceptConnections.map((cc) => (
              <div
                key={cc.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  {cc.subjectId.toUpperCase()} · {cc.triggerReason}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  2nd PUC: {cc.targetChapterTitle} ← 1st PUC: {cc.prerequisiteChapterTitle}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {cc.whyItMatters}
                </p>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Key 1st PUC prerequisites: {cc.prerequisiteConcepts.join(' · ')}
                </div>
                <div className="pt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('tutor', {
                        academic_year: 'PUC_2',
                        subjectId: cc.subjectId,
                        chapterId: cc.targetChapterId,
                        tutorPrompt: cc.tutorPrompt,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                  >
                    Explain 1st PUC Prerequisite in AI Tutor
                  </button>
                  {cc.prerequisiteChapterId && (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate('subjects', {
                          academic_year: 'PUC_1',
                          subjectId: cc.prerequisiteSubjectId,
                          chapterId: cc.prerequisiteChapterId,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Open 1st PUC Chapter
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Weakest vs Repeated Mistake Topics */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Chapter Priority Matrix
          </h3>
          {report.weakestChapters.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
              No chapters added yet for this academic year scope. Add or import chapters to track priority matrix scores.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800/70">
              {report.weakestChapters.map((w) => (
                <div key={w.chapterId} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {w.chapterTitle}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatAcademicYear(w.academic_year)} · {w.subjectId.toUpperCase()} · Accuracy {w.accuracyPercent}% · {w.flashcardLapses} recall lapses · {w.unresolvedDoubts} doubts
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-medium ${
                        w.statusLabel === 'Needs Immediate Focus'
                          ? 'text-red-500'
                          : w.statusLabel === 'Moderate Attention'
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                      }`}
                    >
                      {w.statusLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate('last-minute', {
                          academic_year: w.academic_year,
                          subjectId: w.subjectId,
                          chapterId: w.chapterId,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Revise
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Repeated Mistake Topics
            </h3>
          </div>
          {report.repeatedMistakeTopics.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No repeated mistakes logged yet. Take a KCET Practice test or log doubts to track patterns.
            </p>
          ) : (
            <div className="space-y-2.5">
              {report.repeatedMistakeTopics.map((t, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{t.topic}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {formatAcademicYear(t.academic_year)} · {t.subjectId.toUpperCase()} · {t.chapterTitle}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-red-500 shrink-0">{t.mistakeCount}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4-Part Action Recommendations */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <BookOpen className="w-4 h-4 text-cyan-500" />
            <span>1. Concepts to Relearn</span>
          </div>
          {report.recommendations.conceptsToRelearn.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add chapters or attempt quizzes to identify concepts to relearn.
            </p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
              {report.recommendations.conceptsToRelearn.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => onNavigate('tutor')}
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 inline-flex items-center gap-1 hover:underline"
          >
            <span>Open AI Tutor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Sigma className="w-4 h-4 text-indigo-500" />
            <span>2. Formulas to Revise</span>
          </div>
          {report.recommendations.formulasToRevise.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Save or extract formulas from PDFs to populate formula revision targets.
            </p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
              {report.recommendations.formulasToRevise.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => onNavigate('formula-book')}
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 inline-flex items-center gap-1 hover:underline"
          >
            <span>Open Formula Book</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <FlaskConical className="w-4 h-4 text-emerald-500" />
            <span>3. Questions to Practise</span>
          </div>
          {report.recommendations.questionsToPractise.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Take chapter or combined KCET tests to unlock targeted MCQ sets.
            </p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
              {report.recommendations.questionsToPractise.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => onNavigate('kcet')}
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 inline-flex items-center gap-1 hover:underline"
          >
            <span>Start KCET Practice</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>4. Revision Activities</span>
          </div>
          {report.recommendations.revisionActivities.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete memory drills or flashcard reviews to generate tailored drills.
            </p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
              {report.recommendations.revisionActivities.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => onNavigate('memory-lab')}
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 inline-flex items-center gap-1 hover:underline"
          >
            <span>Open Memory Lab</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};
