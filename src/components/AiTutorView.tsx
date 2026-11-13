import React, { useEffect, useState } from 'react';
import { GitBranch, HelpCircle, ImagePlus, Loader2, RotateCcw, Send, Sparkles, Trash2 } from 'lucide-react';
import type { AcademicYear, AstraAppState, SubjectId, TutorMode } from '../types';
import { ACADEMIC_YEARS, KARNATAKA_PUC_SYLLABUS, SUBJECTS } from '../data/pucSyllabus';
import { findConceptConnectionsForChapter, formatAcademicYear } from '../lib/conceptConnections';
import { MathRenderer } from './MathRenderer';

interface AiTutorViewProps {
  state: AstraAppState;
  initialAcademicYear: AcademicYear;
  initialSubject: SubjectId;
  initialChapterId: string;
  initialTutorPrompt?: string;
  onAskTutor: (payload: {
    question: string;
    mode: TutorMode;
    academic_year: AcademicYear;
    subjectId: SubjectId;
    chapterId: string;
    pdfId?: string;
    imageBase64?: string;
    imageMimeType?: string;
    didNotUnderstand?: boolean;
  }) => Promise<void>;
  onClearChat: () => Promise<void>;
}

const TUTOR_MODES: { id: TutorMode; label: string; desc: string }[] = [
  { id: 'simple', label: 'Simple Explanation', desc: 'Beginner-friendly intuition' },
  { id: 'deep', label: 'Deep Understanding', desc: 'First-principles reasoning' },
  { id: 'example', label: 'Example-Based', desc: 'Relatable real-world analogies' },
  { id: 'step-by-step', label: 'Step-by-Step Solving', desc: 'Numerical & derivation steps' },
  { id: 'exam-answer', label: 'Exam Answer Mode', desc: 'PUC board marking format' },
  { id: 'doubt-solving', label: 'Doubt Solving', desc: 'Text, image, or PDF doubts' },
  { id: 'compare', label: 'Compare Concepts', desc: 'Side-by-side comparison table' },
];

export const AiTutorView: React.FC<AiTutorViewProps> = ({
  state,
  initialAcademicYear,
  initialSubject,
  initialChapterId,
  initialTutorPrompt,
  onAskTutor,
  onClearChat,
}) => {
  const [mode, setMode] = useState<TutorMode>('simple');
  const [academicYear, setAcademicYear] = useState<AcademicYear>(initialAcademicYear);
  const [subjectId, setSubjectId] = useState<SubjectId>(initialSubject);
  const subjectChapters = state.chapters
    .filter((c) => c.academic_year === academicYear && c.subjectId === subjectId)
    .sort((a, b) => a.order - b.order);
  const fallbackChapters = KARNATAKA_PUC_SYLLABUS[academicYear][subjectId] ?? [];

  const [chapterId, setChapterId] = useState<string>(
    subjectChapters.some((c) => c.id === initialChapterId)
      ? initialChapterId
      : subjectChapters[0]?.id ?? fallbackChapters[0] ?? ''
  );
  const [pdfId, setPdfId] = useState<string>('');
  const [input, setInput] = useState(initialTutorPrompt ?? '');
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imageMimeType, setImageMimeType] = useState<string | undefined>();
  const [imageName, setImageName] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTutorPrompt) {
      setInput(initialTutorPrompt);
    }
  }, [initialTutorPrompt]);

  const enabledSet = new Set(
    state.settings.enabledSubjects ??
      (state.settings.includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'])
  );
  const visibleSubjects = SUBJECTS.filter((s) => enabledSet.has(s.id));
  const availablePdfs = state.pdfs.filter(
    (p) =>
      p.academic_year === academicYear &&
      (p.chapterId === chapterId || p.subjectId === subjectId)
  );

  const selectedUserChapter = subjectChapters.find((c) => c.id === chapterId);
  const activeChapterTitle = selectedUserChapter?.title ?? chapterId;

  const conceptConnections = findConceptConnectionsForChapter(
    activeChapterTitle,
    subjectId,
    academicYear,
    state.chapters
  );

  const handleYearChange = (nextYear: AcademicYear) => {
    setAcademicYear(nextYear);
    const list = state.chapters
      .filter((c) => c.academic_year === nextYear && c.subjectId === subjectId)
      .sort((a, b) => a.order - b.order);
    const fb = KARNATAKA_PUC_SYLLABUS[nextYear][subjectId] ?? [];
    setChapterId(list[0]?.id ?? fb[0] ?? '');
    setPdfId('');
  };

  const handleSubjectChange = (nextSubj: SubjectId) => {
    setSubjectId(nextSubj);
    const list = state.chapters
      .filter((c) => c.academic_year === academicYear && c.subjectId === nextSubj)
      .sort((a, b) => a.order - b.order);
    const fb = KARNATAKA_PUC_SYLLABUS[academicYear][nextSubj] ?? [];
    setChapterId(list[0]?.id ?? fb[0] ?? '');
    setPdfId('');
  };

  const handleImagePick = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      if (commaIdx !== -1) {
        setImageBase64(result.slice(commaIdx + 1));
        setImageMimeType(file.type || 'image/png');
        setImageName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const sendMessage = async (questionText: string, didNotUnderstand: boolean = false) => {
    if (!questionText.trim() && !imageBase64) return;
    setError(null);
    setLoading(true);
    try {
      await onAskTutor({
        question: questionText,
        mode,
        academic_year: academicYear,
        subjectId,
        chapterId,
        pdfId: pdfId || undefined,
        imageBase64,
        imageMimeType,
        didNotUnderstand,
      });
      if (!didNotUnderstand) {
        setInput('');
        setImageBase64(undefined);
        setImageMimeType(undefined);
        setImageName(undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach Astra AI Tutor.');
    } finally {
      setLoading(false);
    }
  };

  const lastUserMsg = [...state.tutorMessages].reverse().find((m) => m.role === 'user');

  return (
    <div className="space-y-5">
      {/* Mode & Context Selector */}
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Learning Mode &amp; Syllabus Grounding
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Covers 1st PUC &amp; 2nd PUC · Connects prerequisites automatically · Always ends with a quick understanding check
            </p>
          </div>
          {state.tutorMessages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Chat</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {TUTOR_MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  active
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-800 dark:text-cyan-200'
                    : 'bg-slate-50 dark:bg-[#111A2E] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="text-xs font-semibold truncate">{m.label}</div>
                <div className="text-[11px] opacity-75 truncate mt-0.5">{m.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="tutor-year" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Academic Year
            </label>
            <select
              id="tutor-year"
              value={academicYear}
              onChange={(e) => handleYearChange(e.target.value as AcademicYear)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            >
              {ACADEMIC_YEARS.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tutor-subject" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Subject
            </label>
            <select
              id="tutor-subject"
              value={subjectId}
              onChange={(e) => handleSubjectChange(e.target.value as SubjectId)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            >
              {visibleSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tutor-chapter" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Chapter {subjectChapters.length === 0 ? '(Karnataka Syllabus Reference)' : ''}
            </label>
            <select
              id="tutor-chapter"
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            >
              {subjectChapters.length > 0
                ? subjectChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.order}. {c.title}
                    </option>
                  ))
                : fallbackChapters.map((title, idx) => (
                    <option key={title} value={title}>
                      {idx + 1}. {title}
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label htmlFor="tutor-pdf" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Ground in Uploaded PDF (Optional)
            </label>
            <select
              id="tutor-pdf"
              value={pdfId}
              onChange={(e) => setPdfId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            >
              <option value="">Auto-match chapter PDF (if uploaded)</option>
              {availablePdfs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fileName} ({p.totalPages}p)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cross-Year Concept Connection Bridge */}
        {conceptConnections.length > 0 && (
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <GitBranch className="w-3.5 h-3.5 shrink-0" />
                <span>Concept Connection: 1st PUC Prerequisite Detected</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {activeChapterTitle} builds on{' '}
                <strong>{conceptConnections[0].prerequisiteChapterTitle}</strong> (
                {conceptConnections[0].prerequisiteConcepts.slice(0, 2).join(', ')}).
              </p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => void sendMessage(conceptConnections[0].tutorPrompt, false)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap shrink-0"
            >
              Review 1st PUC Prerequisite
            </button>
          </div>
        )}
      </section>

      {/* Conversation Thread */}
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 flex flex-col gap-4 min-h-[420px]">
        <div className="flex-1 space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {state.tutorMessages.length === 0 ? (
            <div className="py-10 text-center max-w-lg mx-auto space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Ask Astra AI Tutor ({formatAcademicYear(academicYear)})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Select an academic year, subject, and chapter above, then ask any question, upload a doubt photo, or ask for board-style derivations and 1st PUC prerequisite recaps.
              </p>
            </div>
          ) : (
            state.tutorMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-xl p-4 space-y-2.5 ${
                    msg.role === 'user'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  <div className="text-[11px] opacity-75">
                    {msg.role === 'user' ? 'You' : 'Astra AI Tutor'}
                    {msg.academic_year ? ` · ${formatAcademicYear(msg.academic_year)}` : ''} ·{' '}
                    {TUTOR_MODES.find((m) => m.id === msg.mode)?.label ?? msg.mode}
                  </div>
                  {msg.imagePreview && (
                    <img
                      src={msg.imagePreview}
                      alt="Uploaded doubt attachment"
                      className="max-h-48 rounded-lg border border-white/20 object-contain"
                    />
                  )}
                  <div className="text-sm">
                    <MathRenderer text={msg.content} />
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="text-xs text-cyan-600 dark:text-cyan-400 pt-1">
                      Sources: {msg.sources.join(' · ')}
                    </div>
                  )}
                  {msg.understandingCheck && (
                    <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-xs text-slate-800 dark:text-indigo-200 flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <strong>Quick Check:</strong> <MathRenderer text={msg.understandingCheck} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
              <span>Astra AI Tutor is formulating an explanation...</span>
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input, false);
          }}
          className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" />
                <span>{imageName ? `Attached: ${imageName}` : 'Attach Doubt Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImagePick(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>
              {lastUserMsg && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    void sendMessage(
                      `I don't understand the previous explanation for: "${lastUserMsg.content}". Explain it in a completely different, simpler way.`,
                      true
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>I don’t understand (Explain differently)</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask any 1st or 2nd PUC concept, numerical, derivation, or compare two topics..."
              aria-label="Ask Astra AI Tutor"
              className="flex-1 min-w-0 px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && !imageBase64)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Ask</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
