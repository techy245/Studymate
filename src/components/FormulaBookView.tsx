import React, { useState } from 'react';
import { Bookmark, Plus, Search } from 'lucide-react';
import type { AcademicYear, AstraAppState, FormulaEntry, SubjectId } from '../types';
import { ACADEMIC_YEARS, SUBJECTS } from '../data/pucSyllabus';
import { formatAcademicYear } from '../lib/conceptConnections';
import { MathRenderer } from './MathRenderer';

interface FormulaBookViewProps {
  state: AstraAppState;
  onCreateFormula: (formulas: Omit<FormulaEntry, 'id'>[]) => Promise<void>;
  onUpdateFormula: (id: string, patch: Partial<FormulaEntry>) => Promise<void>;
}

export const FormulaBookView: React.FC<FormulaBookViewProps> = ({
  state,
  onCreateFormula,
  onUpdateFormula,
}) => {
  const [yearFilter, setYearFilter] = useState<AcademicYear | 'COMBINED'>('COMBINED');
  const [subjectFilter, setSubjectFilter] = useState<SubjectId | 'all'>('all');
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // Add formula form
  const [fYear, setFYear] = useState<AcademicYear>(state.settings.activeAcademicYear ?? 'PUC_1');
  const [fSubj, setFSubj] = useState<SubjectId>('physics');
  const [fChapter, setFChapter] = useState<string>(
    state.chapters.find((c) => c.academic_year === fYear && c.subjectId === 'physics')?.id ?? ''
  );
  const [fTopic, setFTopic] = useState('');
  const [fTitle, setFTitle] = useState('');
  const [fLatex, setFLatex] = useState('');
  const [fVars, setFVars] = useState('');
  const [fUnits, setFUnits] = useState('');
  const [fCond, setFCond] = useState('');
  const [fExample, setFExample] = useState('');

  const enabledSet = new Set(
    state.settings.enabledSubjects ??
      (state.settings.includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'])
  );
  const visibleSubjects = SUBJECTS.filter((s) => enabledSet.has(s.id));

  const filtered = state.formulas.filter((f) => {
    if (yearFilter !== 'COMBINED' && f.academic_year !== yearFilter) return false;
    if (subjectFilter !== 'all' && f.subjectId !== subjectFilter) return false;
    if (chapterFilter !== 'all' && f.chapterId !== chapterFilter) return false;
    if (onlyBookmarked && !f.bookmarked) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.topic.toLowerCase().includes(q) ||
        f.latex.toLowerCase().includes(q) ||
        f.conditions.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fTitle.trim() || !fLatex.trim()) return;
    await onCreateFormula([
      {
        academic_year: fYear,
        subjectId: fSubj,
        chapterId: fChapter || `${fYear === 'PUC_1' ? 'puc1' : 'puc2'}-${fSubj}-general`,
        topic: fTopic.trim() || 'Core Formula',
        title: fTitle.trim(),
        latex: fLatex.trim(),
        variables: [{ symbol: 'Vars', meaning: fVars.trim() || 'See notation', unit: fUnits.trim() || 'SI' }],
        conditions: fCond.trim() || 'Standard PUC conditions',
        relatedFormulas: [],
        example: fExample.trim() || 'Apply values in consistent SI units.',
        bookmarked: false,
      },
    ]);
    setFTitle('');
    setFLatex('');
    setFTopic('');
    setFVars('');
    setFUnits('');
    setFCond('');
    setFExample('');
    setShowAdd(false);
  };

  const formChapters = state.chapters
    .filter((c) => c.academic_year === fYear && c.subjectId === fSubj)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
              Formula Book — LaTeX Reference Library
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Organised across 1st PUC &amp; 2nd PUC by Subject, Chapter, and Topic with SI units and worked examples.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#131D33] p-1 border border-slate-200 dark:border-slate-800">
              {(['COMBINED', 'PUC_1', 'PUC_2'] as const).map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setYearFilter(yr);
                    setChapterFilter('all');
                  }}
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

            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Formula</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search formula name, topic, or equation..."
              aria-label="Search formula book"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
            />
          </div>

          <select
            aria-label="Filter formulas by subject"
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value as SubjectId | 'all');
              setChapterFilter('all');
            }}
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
          >
            <option value="all">All Subjects</option>
            {visibleSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter formulas by chapter"
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
          >
            <option value="all">All Chapters</option>
            {state.chapters
              .filter(
                (c) =>
                  (yearFilter === 'COMBINED' || c.academic_year === yearFilter) &&
                  (subjectFilter === 'all' || c.subjectId === subjectFilter)
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {formatAcademicYear(c.academic_year)} · {c.title}
                </option>
              ))}
          </select>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyBookmarked}
            onChange={(e) => setOnlyBookmarked(e.target.checked)}
            className="w-4 h-4 rounded accent-amber-500"
          />
          <span>Show Bookmarked Only</span>
        </label>

        {showAdd && (
          <form onSubmit={handleAdd} className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                aria-label="Formula academic year"
                value={fYear}
                onChange={(e) => {
                  const y = e.target.value as AcademicYear;
                  setFYear(y);
                  const first = state.chapters.find((c) => c.academic_year === y && c.subjectId === fSubj);
                  setFChapter(first?.id ?? '');
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
                aria-label="Formula subject"
                value={fSubj}
                onChange={(e) => {
                  const s = e.target.value as SubjectId;
                  setFSubj(s);
                  const first = state.chapters.find((c) => c.academic_year === fYear && c.subjectId === s);
                  setFChapter(first?.id ?? '');
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
                aria-label="Formula chapter"
                value={fChapter}
                onChange={(e) => setFChapter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              >
                {formChapters.length === 0 ? (
                  <option value="">General ({formatAcademicYear(fYear)})</option>
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
                value={fTopic}
                onChange={(e) => setFTopic(e.target.value)}
                placeholder="Topic (e.g., Gauss Law)"
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                placeholder="Formula Title"
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
              <input
                type="text"
                value={fLatex}
                onChange={(e) => setFLatex(e.target.value)}
                placeholder="LaTeX expression (e.g., F = \frac{1}{4\pi\varepsilon_0}\frac{q_1 q_2}{r^2})"
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm font-mono"
              />
              <input
                type="text"
                value={fVars}
                onChange={(e) => setFVars(e.target.value)}
                placeholder="Variable meanings"
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
              <input
                type="text"
                value={fUnits}
                onChange={(e) => setFUnits(e.target.value)}
                placeholder="SI units"
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
              <input
                type="text"
                value={fCond}
                onChange={(e) => setFCond(e.target.value)}
                placeholder="Conditions of application"
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
              <input
                type="text"
                value={fExample}
                onChange={(e) => setFExample(e.target.value)}
                placeholder="Short numerical example"
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-medium">
                Save Formula
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.length === 0 ? (
          <div className="lg:col-span-2 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-10 text-center text-sm text-slate-500">
            {state.formulas.length === 0
              ? 'No formulas saved yet. Add a formula manually or extract formulas from your PDFs in AI PDF Analyser.'
              : 'No formulas match your filter.'}
          </div>
        ) : (
          filtered.map((f) => {
            const ch = state.chapters.find((c) => c.id === f.chapterId);
            return (
              <div
                key={f.id}
                className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatAcademicYear(f.academic_year)} · {f.subjectId.toUpperCase()} ·{' '}
                      {ch?.title ?? 'General'} · {f.topic}
                      {f.sourcePage ? ` · PDF p.${f.sourcePage}` : ''}
                    </div>
                    <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white mt-0.5">
                      {f.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateFormula(f.id, { bookmarked: !f.bookmarked })}
                    aria-label={`Bookmark ${f.title}`}
                    className={`p-1.5 rounded ${
                      f.bookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800">
                  <MathRenderer text={f.latex} blockLatex />
                </div>

                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {f.variables.map((v, idx) => (
                    <div key={idx}>
                      <code className="font-mono text-cyan-600 dark:text-cyan-400">{v.symbol}</code>: {v.meaning} ({v.unit})
                    </div>
                  ))}
                  <div className="pt-1">
                    <strong>Conditions:</strong> {f.conditions}
                  </div>
                  {f.relatedFormulas.length > 0 && (
                    <div>
                      <strong>Related:</strong>{' '}
                      {f.relatedFormulas.map((rf, i) => (
                        <span key={i} className="mr-3 inline-block">
                          <MathRenderer text={`$${rf}$`} />
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="pt-1 text-slate-800 dark:text-slate-200">
                    <strong>Example:</strong> {f.example}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
