import React, { useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import type { AcademicYear, AstraAppState, NavSection, SubjectId } from '../types';
import { searchEverything, type SearchResultCategory } from '../lib/searchEngine';

interface SearchViewProps {
  state: AstraAppState;
  onNavigate: (
    section: NavSection,
    context?: {
      academic_year?: AcademicYear;
      subjectId?: SubjectId;
      chapterId?: string;
    }
  ) => void;
}

const CATEGORIES: { id: SearchResultCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'definition', label: 'Definitions' },
  { id: 'formula', label: 'Formulas' },
  { id: 'derivation', label: 'Derivations' },
  { id: 'keyword', label: 'Keywords' },
  { id: 'chapter', label: 'Chapters' },
  { id: 'note', label: 'Notes' },
  { id: 'flashcard', label: 'Flashcards' },
  { id: 'question', label: 'Questions' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'doubt', label: 'Doubts' },
];

export const SearchView: React.FC<SearchViewProps> = ({ state, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchResultCategory | 'all'>('all');
  const [yearFilter, setYearFilter] = useState<AcademicYear | 'all'>('all');

  const hits = searchEverything(state, query, category, yearFilter);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
              Search Everything
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Search across 1st PUC &amp; 2nd PUC definitions, formulas, derivations, keywords, chapters, personal notes, flashcards, MCQs, doubts, and PDF pages.
            </p>
          </div>

          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#131D33] p-1 border border-slate-200 dark:border-slate-800">
            {(['all', 'PUC_1', 'PUC_2'] as const).map((yr) => (
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
                {yr === 'all' ? 'All Years' : yr === 'PUC_1' ? '1st PUC' : '2nd PUC'}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try: vectors, Gauss, Nernst, redox, calculus, thermodynamics..."
            aria-label="Global search input"
            autoFocus
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                category === c.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-[#131D33] text-slate-600 dark:text-slate-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6">
        {!query.trim() ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
            Start typing above to search every item in your 1st &amp; 2nd PUC workspace.
          </p>
        ) : hits.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
            No matching results for “{query}”.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800/70">
            {hits.map((hit) => (
              <div key={hit.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium uppercase">
                    {hit.category} · {hit.subtitle}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {hit.title}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {hit.snippet}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate(hit.targetView, {
                      academic_year: hit.academic_year,
                      subjectId: hit.subjectId,
                      chapterId: hit.chapterId,
                    })
                  }
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <span>Open</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
