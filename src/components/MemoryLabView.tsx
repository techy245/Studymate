import React, { useMemo, useState } from 'react';
import { Check, Eye, RefreshCw, X } from 'lucide-react';
import type { AcademicYear, AstraAppState, SubjectId } from '../types';
import { formatAcademicYear } from '../lib/conceptConnections';
import { MathRenderer } from './MathRenderer';

interface MemoryLabViewProps {
  state: AstraAppState;
  onRecordDrill: (payload: {
    concept: string;
    academic_year: AcademicYear;
    subjectId: SubjectId;
    chapterId: string;
    drillType: 'active-recall' | 'fill-blank' | 'formula-recall' | 'definition-recall' | 'match' | 'quick-quiz';
    correct: boolean;
  }) => Promise<void>;
}

type DrillMode =
  | 'active-recall'
  | 'fill-blank'
  | 'formula-recall'
  | 'definition-recall'
  | 'match'
  | 'quick-quiz';

const DRILL_TABS: { id: DrillMode; label: string }[] = [
  { id: 'active-recall', label: 'Active Recall' },
  { id: 'fill-blank', label: 'Fill in the Blanks' },
  { id: 'formula-recall', label: 'Formula Recall' },
  { id: 'definition-recall', label: 'Definition Recall' },
  { id: 'match', label: 'Match the Following' },
  { id: 'quick-quiz', label: 'Mixed Quick Quiz' },
];

function createBlankPrompt(text: string): { masked: string; missingWord: string } {
  const words = text.split(/\s+/).filter((w) => w.replace(/[^a-zA-Z0-9]/g, '').length >= 5);
  const target = words[Math.floor(words.length / 2)] || words[0] || 'concept';
  const cleanTarget = target.replace(/[.,;:!?()]/g, '');
  const masked = text.replace(cleanTarget, '________');
  return { masked, missingWord: cleanTarget };
}

export const MemoryLabView: React.FC<MemoryLabViewProps> = ({ state, onRecordDrill }) => {
  const [yearFilter, setYearFilter] = useState<AcademicYear | 'COMBINED'>('COMBINED');
  const [drillMode, setDrillMode] = useState<DrillMode>('active-recall');
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [blankInput, setBlankInput] = useState('');
  const [blankResult, setBlankResult] = useState<'correct' | 'wrong' | null>(null);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);

  const scopedFlashcards = useMemo(
    () =>
      state.flashcards.filter(
        (c) => yearFilter === 'COMBINED' || c.academic_year === yearFilter
      ),
    [state.flashcards, yearFilter]
  );

  const scopedFormulas = useMemo(
    () =>
      state.formulas.filter(
        (f) => yearFilter === 'COMBINED' || f.academic_year === yearFilter
      ),
    [state.formulas, yearFilter]
  );

  const scopedQuestions = useMemo(
    () =>
      state.questionsBank.filter(
        (q) => yearFilter === 'COMBINED' || q.academic_year === yearFilter
      ),
    [state.questionsBank, yearFilter]
  );

  const scopedDrills = useMemo(
    () =>
      state.memoryDrills.filter(
        (d) => yearFilter === 'COMBINED' || d.academic_year === yearFilter
      ),
    [state.memoryDrills, yearFilter]
  );

  const recallPool = useMemo(() => {
    if (drillMode === 'formula-recall') {
      return scopedFormulas.map((f) => ({
        id: f.id,
        academic_year: f.academic_year,
        subjectId: f.subjectId,
        chapterId: f.chapterId,
        prompt: `Write the formula & SI unit for: ${f.title} (${f.topic})`,
        answer: `$$${f.latex}$$\nConditions: ${f.conditions}`,
        concept: f.title,
      }));
    }
    if (drillMode === 'definition-recall') {
      const defs = scopedFlashcards.filter((c) => c.cardType === 'definition');
      const source = defs.length > 0 ? defs : scopedFlashcards;
      return source.map((c) => ({
        id: c.id,
        academic_year: c.academic_year,
        subjectId: c.subjectId,
        chapterId: c.chapterId,
        prompt: c.front,
        answer: c.back,
        concept: c.front.slice(0, 60),
      }));
    }
    return scopedFlashcards.map((c) => ({
      id: c.id,
      academic_year: c.academic_year,
      subjectId: c.subjectId,
      chapterId: c.chapterId,
      prompt: c.front,
      answer: c.back,
      concept: c.front.slice(0, 60),
    }));
  }, [drillMode, scopedFlashcards, scopedFormulas]);

  const currentItem = recallPool[idx % Math.max(1, recallPool.length)] ?? null;

  const blankChallenge = useMemo(() => {
    if (!currentItem) return null;
    return createBlankPrompt(currentItem.answer.replace(/\$\$/g, ''));
  }, [currentItem]);

  const matchPairs = useMemo(() => {
    return scopedFormulas.slice(0, 4).map((f) => ({
      id: f.id,
      left: f.title,
      right: f.topic,
      academic_year: f.academic_year,
      subjectId: f.subjectId,
      chapterId: f.chapterId,
    }));
  }, [scopedFormulas]);

  const shuffledRights = useMemo(() => {
    return [...matchPairs].reverse();
  }, [matchPairs]);

  const currentQuizQ = scopedQuestions[idx % Math.max(1, scopedQuestions.length)] ?? null;

  const totalDrills = scopedDrills.length;
  const correctDrills = scopedDrills.filter((d) => d.correct).length;
  const accuracy = totalDrills > 0 ? Math.round((correctDrills / totalDrills) * 100) : 0;

  const forgottenConcepts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of scopedDrills) {
      if (!d.correct) {
        counts.set(d.concept, (counts.get(d.concept) ?? 0) + 1);
      }
    }
    for (const f of scopedFlashcards) {
      if (f.lapseCount > 0) {
        counts.set(f.front.slice(0, 60), (counts.get(f.front.slice(0, 60)) ?? 0) + f.lapseCount);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [scopedDrills, scopedFlashcards]);

  const handleMarkRecall = async (correct: boolean) => {
    if (!currentItem) return;
    await onRecordDrill({
      concept: currentItem.concept,
      academic_year: currentItem.academic_year,
      subjectId: currentItem.subjectId,
      chapterId: currentItem.chapterId,
      drillType: drillMode,
      correct,
    });
    setRevealed(false);
    setBlankInput('');
    setBlankResult(null);
    setIdx((i) => i + 1);
  };

  return (
    <div className="space-y-6">
      {/* Mode Selector + Accuracy Summary */}
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
              Memory Lab — Active Recall &amp; Retention Training
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Attempt to recall before revealing across 1st &amp; 2nd PUC · Repeatedly missed concepts are surfaced automatically
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#131D33] p-1 border border-slate-200 dark:border-slate-800">
              {(['COMBINED', 'PUC_1', 'PUC_2'] as const).map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setYearFilter(yr);
                    setIdx(0);
                    setRevealed(false);
                    setBlankResult(null);
                    setQuizChoice(null);
                    setMatchedIds([]);
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

            <div className="text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
              Drill Accuracy: <strong className="text-cyan-600 dark:text-cyan-400">{accuracy}%</strong> ({correctDrills}/{totalDrills})
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {DRILL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setDrillMode(t.id);
                setRevealed(false);
                setBlankResult(null);
                setQuizChoice(null);
                setMatchedIds([]);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                drillMode === t.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-[#131D33] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Interactive Drill Stage */}
        <section className="lg:col-span-8 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-5">
          {drillMode === 'match' ? (
            matchPairs.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No formulas saved yet for this scope. Add formulas or extract them from a PDF first.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                    Match Formula / Concept to Topic
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setMatchedIds([]);
                      setSelectedLeft(null);
                    }}
                    className="text-xs text-cyan-600 dark:text-cyan-400 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {matchPairs.map((pair) => {
                      const done = matchedIds.includes(pair.id);
                      const active = selectedLeft === pair.id;
                      return (
                        <button
                          key={pair.id}
                          type="button"
                          disabled={done}
                          onClick={() => setSelectedLeft(pair.id)}
                          className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${
                            done
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                              : active
                                ? 'bg-cyan-500/15 border-cyan-500 text-slate-900 dark:text-white'
                                : 'bg-slate-50 dark:bg-[#111A2E] border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {pair.left}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    {shuffledRights.map((pair) => {
                      const done = matchedIds.includes(pair.id);
                      return (
                        <button
                          key={pair.id}
                          type="button"
                          disabled={done || !selectedLeft}
                          onClick={async () => {
                            if (!selectedLeft) return;
                            const isMatch = selectedLeft === pair.id;
                            if (isMatch) {
                              setMatchedIds((prev) => [...prev, pair.id]);
                            }
                            await onRecordDrill({
                              concept: pair.left,
                              academic_year: pair.academic_year,
                              subjectId: pair.subjectId,
                              chapterId: pair.chapterId,
                              drillType: 'match',
                              correct: isMatch,
                            });
                            setSelectedLeft(null);
                          }}
                          className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${
                            done
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                              : 'bg-slate-50 dark:bg-[#111A2E] border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-cyan-500/50'
                          }`}
                        >
                          {pair.right}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )
          ) : drillMode === 'quick-quiz' ? (
            !currentQuizQ ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No questions in bank yet. Generate MCQs in KCET Practice Arena first.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatAcademicYear(currentQuizQ.academic_year)} · {currentQuizQ.subjectId.toUpperCase()} ·{' '}
                  {currentQuizQ.topic} · {currentQuizQ.difficulty}
                </div>
                <div className="text-base font-medium text-slate-900 dark:text-white">
                  <MathRenderer text={currentQuizQ.question} />
                </div>
                <div className="space-y-2">
                  {currentQuizQ.options.map((opt, optIdx) => {
                    const picked = quizChoice === optIdx;
                    const isRight = optIdx === currentQuizQ.correctIndex;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        disabled={quizChoice !== null}
                        onClick={async () => {
                          setQuizChoice(optIdx);
                          await onRecordDrill({
                            concept: currentQuizQ.topic,
                            academic_year: currentQuizQ.academic_year,
                            subjectId: currentQuizQ.subjectId,
                            chapterId: currentQuizQ.chapterId,
                            drillType: 'quick-quiz',
                            correct: isRight,
                          });
                        }}
                        className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${
                          quizChoice !== null
                            ? isRight
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-200'
                              : picked
                                ? 'bg-red-500/15 border-red-500 text-red-700 dark:text-red-200'
                                : 'bg-slate-50 dark:bg-[#111A2E] border-slate-200 dark:border-slate-800 opacity-60'
                            : 'bg-slate-50 dark:bg-[#111A2E] border-slate-200 dark:border-slate-800 hover:border-cyan-500'
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}. {opt}
                      </button>
                    );
                  })}
                </div>
                {quizChoice !== null && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      <strong>Explanation:</strong> <MathRenderer text={currentQuizQ.explanation} />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuizChoice(null);
                        setIdx((i) => i + 1);
                      }}
                      className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-xs font-medium"
                    >
                      Next Question
                    </button>
                  </div>
                )}
              </div>
            )
          ) : !currentItem ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No flashcards or formulas added yet for this filter. Add cards in Smart Revision or extract notes from a PDF.
            </p>
          ) : drillMode === 'fill-blank' && blankChallenge ? (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {formatAcademicYear(currentItem.academic_year)} · {currentItem.subjectId.toUpperCase()} · Fill in the missing keyword
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                <MathRenderer text={currentItem.prompt} />
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200">
                {blankChallenge.masked}
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const isOk =
                    blankInput.trim().toLowerCase() === blankChallenge.missingWord.toLowerCase();
                  setBlankResult(isOk ? 'correct' : 'wrong');
                  await onRecordDrill({
                    concept: currentItem.concept,
                    academic_year: currentItem.academic_year,
                    subjectId: currentItem.subjectId,
                    chapterId: currentItem.chapterId,
                    drillType: 'fill-blank',
                    correct: isOk,
                  });
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={blankInput}
                  onChange={(e) => setBlankInput(e.target.value)}
                  placeholder="Type missing word..."
                  aria-label="Missing keyword"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium"
                >
                  Check
                </button>
              </form>
              {blankResult && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-xs">
                  <span>
                    {blankResult === 'correct'
                      ? 'Exact match!'
                      : `Expected keyword: "${blankChallenge.missingWord}"`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBlankInput('');
                      setBlankResult(null);
                      setIdx((i) => i + 1);
                    }}
                    className="px-3 py-1.5 rounded bg-cyan-600 text-white font-medium"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Active Recall / Formula Recall / Definition Recall */
            <div className="space-y-5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {formatAcademicYear(currentItem.academic_year)} · {currentItem.subjectId.toUpperCase()} · Recall from memory before revealing
              </div>
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="text-base font-medium text-slate-900 dark:text-white">
                  <MathRenderer text={currentItem.prompt} />
                </div>

                {!revealed ? (
                  <div className="p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                    Answer hidden — recite or write it down mentally first.
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200">
                    <MathRenderer text={currentItem.answer} />
                  </div>
                )}
              </div>

              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium inline-flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Reveal Solution</span>
                </button>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleMarkRecall(false)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-500/10 text-sm font-medium inline-flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Forgot / Needs Practice</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkRecall(true)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/10 text-sm font-medium inline-flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Recalled Accurately</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Repeatedly Forgotten Concepts */}
        <aside className="lg:col-span-4 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-5 space-y-4">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Frequently Forgotten Concepts
          </h3>
          {forgottenConcepts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete memory drills to surface concepts that need repeated recall.
            </p>
          ) : (
            <div className="space-y-2.5">
              {forgottenConcepts.map(([concept, lapses]) => (
                <div
                  key={concept}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2"
                >
                  <span className="text-xs text-slate-800 dark:text-slate-200">{concept}</span>
                  <span className="text-xs font-mono text-amber-600 dark:text-amber-400 shrink-0">
                    {lapses}x missed
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
