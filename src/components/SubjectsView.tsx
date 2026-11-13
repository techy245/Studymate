import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Download,
  FileSearch,
  GitBranch,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AcademicYear,
  AstraAppState,
  Chapter,
  ChapterStatus,
  NavSection,
  SubjectId,
} from '../types';
import { ACADEMIC_YEARS, SUBJECTS } from '../data/pucSyllabus';
import { findConceptConnectionsForChapter, formatAcademicYear } from '../lib/conceptConnections';

interface SubjectsViewProps {
  state: AstraAppState;
  selectedAcademicYear: AcademicYear;
  selectedSubject: SubjectId;
  selectedChapterId: string;
  onSelectAcademicYear: (yr: AcademicYear) => void;
  onSelectSubject: (s: SubjectId) => void;
  onSelectChapter: (id: string) => void;
  onToggleSubject: (subjectId: SubjectId, enabled: boolean) => Promise<void>;
  onAddChapter: (academic_year: AcademicYear, subjectId: SubjectId, title: string) => Promise<void>;
  onImportSyllabus: (academic_year: AcademicYear | 'BOTH', subjectIds?: SubjectId[]) => Promise<number>;
  onUpdateChapter: (id: string, patch: Partial<Chapter>) => Promise<void>;
  onReorderChapters: (
    academic_year: AcademicYear,
    subjectId: SubjectId,
    orderedIds: string[]
  ) => Promise<void>;
  onDeleteChapter: (id: string) => Promise<void>;
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
}

const STATUS_OPTIONS: ChapterStatus[] = ['Not Started', 'Learning', 'Revision', 'Completed'];

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  state,
  selectedAcademicYear,
  selectedSubject,
  selectedChapterId,
  onSelectAcademicYear,
  onSelectSubject,
  onSelectChapter,
  onToggleSubject,
  onAddChapter,
  onImportSyllabus,
  onUpdateChapter,
  onReorderChapters,
  onDeleteChapter,
  onNavigate,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showAddInputFocus, setShowAddInputFocus] = useState(false);

  const enabledSubjects =
    state.settings.enabledSubjects && state.settings.enabledSubjects.length > 0
      ? state.settings.enabledSubjects
      : SUBJECTS.filter((s) => !s.optional || state.settings.includeBiology).map((s) => s.id);

  const visibleSubjects = SUBJECTS.filter((s) => enabledSubjects.includes(s.id));
  const currentSubject = visibleSubjects.some((s) => s.id === selectedSubject)
    ? selectedSubject
    : visibleSubjects[0]?.id ?? 'physics';

  const subjectChapters = state.chapters
    .filter((c) => c.academic_year === selectedAcademicYear && c.subjectId === currentSubject)
    .sort((a, b) => a.order - b.order);

  const activeChapter =
    subjectChapters.find((c) => c.id === selectedChapterId) ?? subjectChapters[0] ?? null;

  const currentNotes =
    activeChapter && notesDraft[activeChapter.id] !== undefined
      ? notesDraft[activeChapter.id]
      : activeChapter?.personalNotes ?? '';

  const chapterPdfs = activeChapter
    ? state.pdfs.filter(
        (p) =>
          p.chapterId === activeChapter.id && p.academic_year === activeChapter.academic_year
      )
    : [];

  const conceptConnections = activeChapter
    ? findConceptConnectionsForChapter(
        activeChapter.title,
        activeChapter.subjectId,
        activeChapter.academic_year,
        state.chapters
      )
    : [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await onAddChapter(selectedAcademicYear, currentSubject, newTitle.trim());
      setNewTitle('');
      setFeedback(
        `Chapter added to ${formatAcademicYear(selectedAcademicYear)} ${currentSubject}.`
      );
    } finally {
      setAdding(false);
    }
  };

  const handleImportSubject = async () => {
    setImporting(true);
    try {
      const added = await onImportSyllabus(selectedAcademicYear, [currentSubject]);
      setFeedback(
        added > 0
          ? `Imported ${added} verified Karnataka ${formatAcademicYear(selectedAcademicYear)} ${currentSubject} chapters.`
          : `All Karnataka ${formatAcademicYear(selectedAcademicYear)} ${currentSubject} chapters are already listed.`
      );
    } finally {
      setImporting(false);
    }
  };

  const handleImportFullYear = async () => {
    setImporting(true);
    try {
      const added = await onImportSyllabus(selectedAcademicYear, enabledSubjects);
      setFeedback(
        added > 0
          ? `Imported ${added} verified Karnataka ${formatAcademicYear(selectedAcademicYear)} syllabus chapters across your enabled subjects.`
          : `All Karnataka ${formatAcademicYear(selectedAcademicYear)} syllabus chapters are already listed.`
      );
    } finally {
      setImporting(false);
    }
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= subjectChapters.length) return;
    const ids = subjectChapters.map((c) => c.id);
    const [moved] = ids.splice(idx, 1);
    ids.splice(targetIdx, 0, moved);
    await onReorderChapters(selectedAcademicYear, currentSubject, ids);
  };

  const handleSaveNotes = async () => {
    if (!activeChapter) return;
    setSavingNotes(true);
    try {
      await onUpdateChapter(activeChapter.id, { personalNotes: currentNotes });
      setFeedback('Personal chapter notes saved.');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Academic Year Navigation + Stream Subject Management */}
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* 1st PUC / 2nd PUC Switcher */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 max-w-full">
            {ACADEMIC_YEARS.map((yr) => {
              const active = selectedAcademicYear === yr.id;
              const yearCount = state.chapters.filter(
                (c) => c.academic_year === yr.id && enabledSubjects.includes(c.subjectId)
              ).length;
              return (
                <button
                  key={yr.id}
                  type="button"
                  onClick={() => {
                    onSelectAcademicYear(yr.id);
                    const first = state.chapters.find(
                      (c) => c.academic_year === yr.id && c.subjectId === currentSubject
                    );
                    onSelectChapter(first?.id ?? '');
                  }}
                  className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {yr.label} ({yearCount})
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={importing}
            onClick={() => void handleImportFullYear()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 text-xs font-medium whitespace-nowrap max-w-full disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Download className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">Import Karnataka {formatAcademicYear(selectedAcademicYear)} Syllabus</span>
          </button>
        </div>

        {/* Stream Subject Toggles + Subject Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#131D33]">
            {visibleSubjects.map((subj) => {
              const active = currentSubject === subj.id;
              const count = state.chapters.filter(
                (c) => c.academic_year === selectedAcademicYear && c.subjectId === subj.id
              ).length;
              return (
                <button
                  key={subj.id}
                  type="button"
                  onClick={() => {
                    onSelectSubject(subj.id);
                    const first = state.chapters.find(
                      (c) => c.academic_year === selectedAcademicYear && c.subjectId === subj.id
                    );
                    onSelectChapter(first?.id ?? '');
                  }}
                  className={`px-3.5 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-[#1C2A47] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {subj.name} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-500 dark:text-slate-400">Active Stream:</span>
            {SUBJECTS.map((subj) => {
              const checked = enabledSubjects.includes(subj.id);
              const isLastEnabled = checked && enabledSubjects.length <= 1;
              return (
                <label
                  key={subj.id}
                  className="inline-flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLastEnabled}
                    onChange={(e) => void onToggleSubject(subj.id, e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-cyan-600"
                  />
                  <span>{subj.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Editable Chapter List or Empty Workspace */}
        <div className="lg:col-span-5 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                {formatAcademicYear(selectedAcademicYear)} ·{' '}
                {SUBJECTS.find((s) => s.id === currentSubject)?.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subjectChapters.length} chapters · Add, rename, reorder, or upload PDFs
              </p>
            </div>
          </div>

          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={`Add ${formatAcademicYear(selectedAcademicYear)} chapter title...`}
              aria-label="New chapter title"
              autoFocus={showAddInputFocus}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              type="submit"
              disabled={adding || !newTitle.trim()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </form>

          {subjectChapters.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-[#111A2E] border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-4">
              <div className="space-y-1">
                <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  No chapters added yet.
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose how you want to populate {formatAcademicYear(selectedAcademicYear)}{' '}
                  {SUBJECTS.find((s) => s.id === currentSubject)?.name}:
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddInputFocus(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Chapter Manually Above</span>
                </button>
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => void handleImportSubject()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Import Karnataka PUC Syllabus</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('pdf-analyser', {
                      academic_year: selectedAcademicYear,
                      subjectId: currentSubject,
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <FileSearch className="w-3.5 h-3.5" />
                  <span>Upload Chapter PDF &amp; Generate Notes</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {subjectChapters.map((ch, idx) => {
                const isSelected = activeChapter?.id === ch.id;
                const isEditing = editingTitleId === ch.id;
                return (
                  <div
                    key={ch.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40'
                        : 'bg-slate-50 dark:bg-[#111A2E] border-slate-200 dark:border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {isEditing ? (
                        <form
                          className="flex-1 flex gap-1.5"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (editingTitleValue.trim()) {
                              await onUpdateChapter(ch.id, { title: editingTitleValue.trim() });
                            }
                            setEditingTitleId(null);
                          }}
                        >
                          <input
                            type="text"
                            value={editingTitleValue}
                            onChange={(e) => setEditingTitleValue(e.target.value)}
                            aria-label={`Rename ${ch.title}`}
                            className="flex-1 px-2 py-1 rounded bg-white dark:bg-[#0D1424] border border-cyan-500 text-sm"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1 rounded bg-cyan-600 text-white text-xs font-medium"
                          >
                            Save
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectChapter(ch.id)}
                          className="text-left flex-1 min-w-0"
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {idx + 1}. {ch.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {ch.status} · {ch.progressPercent}% · Confidence {ch.confidence}/5
                          </div>
                        </button>
                      )}

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleMove(idx, -1)}
                          disabled={idx === 0}
                          aria-label={`Move ${ch.title} up`}
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMove(idx, 1)}
                          disabled={idx === subjectChapters.length - 1}
                          aria-label={`Move ${ch.title} down`}
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTitleId(ch.id);
                            setEditingTitleValue(ch.title);
                          }}
                          aria-label={`Rename ${ch.title}`}
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteChapter(ch.id)}
                          aria-label={`Delete ${ch.title}`}
                          className="p-1.5 rounded text-slate-500 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Chapter Workspace + Cross-Year Concept Connection */}
        <div className="lg:col-span-7 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-6">
          {!activeChapter ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No chapters added yet for {formatAcademicYear(selectedAcademicYear)}{' '}
                {SUBJECTS.find((s) => s.id === currentSubject)?.name}. Add a chapter or import the Karnataka PUC syllabus to start tracking progress, notes, and PDFs.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('pdf-analyser', {
                      academic_year: selectedAcademicYear,
                      subjectId: currentSubject,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 text-white text-xs font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upload PDF &amp; Generate Notes</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {formatAcademicYear(activeChapter.academic_year)} ·{' '}
                    {activeChapter.subjectId.toUpperCase()} · Chapter {activeChapter.order}
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {activeChapter.title}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('pdf-analyser', {
                        academic_year: activeChapter.academic_year,
                        subjectId: activeChapter.subjectId,
                        chapterId: activeChapter.id,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium whitespace-nowrap"
                  >
                    <FileSearch className="w-3.5 h-3.5" />
                    <span>Upload / Analyse PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('tutor', {
                        academic_year: activeChapter.academic_year,
                        subjectId: activeChapter.subjectId,
                        chapterId: activeChapter.id,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>AI Tutor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('revision', {
                        academic_year: activeChapter.academic_year,
                        subjectId: activeChapter.subjectId,
                        chapterId: activeChapter.id,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Flashcards</span>
                  </button>
                </div>
              </div>

              {/* Cross-Year Concept Connection Card (for 2nd PUC chapters) */}
              {conceptConnections.length > 0 && (
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                    <GitBranch className="w-4 h-4 shrink-0" />
                    <span>CONCEPT CONNECTION · 1st PUC Prerequisite Foundations</span>
                  </div>
                  {conceptConnections.map((conn) => (
                    <div key={conn.id} className="space-y-2">
                      <div className="text-xs text-slate-800 dark:text-slate-200">
                        <strong>Prerequisite Chapter:</strong> {conn.prerequisiteChapterTitle}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        <strong>Key 1st PUC Concepts:</strong>{' '}
                        {conn.prerequisiteConcepts.join(' · ')}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {conn.whyItMatters}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate('tutor', {
                              academic_year: activeChapter.academic_year,
                              subjectId: activeChapter.subjectId,
                              chapterId: activeChapter.id,
                              tutorPrompt: conn.tutorPrompt,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Explain 1st PUC Prerequisites in AI Tutor</span>
                        </button>
                        {conn.prerequisiteChapterId && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAcademicYear('PUC_1');
                              onSelectSubject(conn.prerequisiteSubjectId);
                              onSelectChapter(conn.prerequisiteChapterId!);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-cyan-500/40 text-xs font-medium text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10"
                          >
                            Open 1st PUC Chapter
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Status, Progress, Confidence Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div>
                  <label
                    htmlFor="chapter-status-select"
                    className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
                  >
                    Chapter Status
                  </label>
                  <select
                    id="chapter-status-select"
                    value={activeChapter.status}
                    onChange={(e) =>
                      void onUpdateChapter(activeChapter.id, {
                        status: e.target.value as ChapterStatus,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="chapter-progress-range"
                    className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
                  >
                    Progress ({activeChapter.progressPercent}%)
                  </label>
                  <input
                    id="chapter-progress-range"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={activeChapter.progressPercent}
                    onChange={(e) =>
                      void onUpdateChapter(activeChapter.id, {
                        progressPercent: Number(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-600 mt-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="chapter-confidence-range"
                    className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
                  >
                    Confidence ({activeChapter.confidence}/5)
                  </label>
                  <input
                    id="chapter-confidence-range"
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={activeChapter.confidence}
                    onChange={(e) =>
                      void onUpdateChapter(activeChapter.id, {
                        confidence: Number(e.target.value),
                      })
                    }
                    className="w-full accent-indigo-500 mt-2"
                  />
                </div>
              </div>

              {/* Personal Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="chapter-personal-notes"
                    className="text-sm font-medium text-slate-900 dark:text-white"
                  >
                    Personal Chapter Notes
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSaveNotes()}
                    disabled={savingNotes}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-cyan-600 text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingNotes ? 'Saving...' : 'Save Notes'}</span>
                  </button>
                </div>
                <textarea
                  id="chapter-personal-notes"
                  rows={5}
                  value={currentNotes}
                  onChange={(e) =>
                    setNotesDraft((prev) => ({ ...prev, [activeChapter.id]: e.target.value }))
                  }
                  placeholder="Write key points, tough derivations, or board exam reminders for this chapter..."
                  className="w-full p-3 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Chapter PDFs */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                    Chapter PDFs ({chapterPdfs.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('pdf-analyser', {
                        academic_year: activeChapter.academic_year,
                        subjectId: activeChapter.subjectId,
                        chapterId: activeChapter.id,
                      })
                    }
                    className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    + Upload PDF for this chapter
                  </button>
                </div>

                {chapterPdfs.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No PDFs attached to this chapter yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {chapterPdfs.map((pdf) => (
                      <div
                        key={pdf.id}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {pdf.fileName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {pdf.docType} · {pdf.totalPages} pages ·{' '}
                            {pdf.analysis ? 'Analysed' : 'Not analysed'}
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
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-medium whitespace-nowrap"
                        >
                          View Analysis
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
