import type {
  AcademicYear,
  Chapter,
  DoubtItem,
  Flashcard,
  FormulaEntry,
  MemoryDrillRecord,
  QuizAttempt,
  SubjectId,
} from '../types.ts';
import {
  findStrugglingConceptConnections,
  type ResolvedConceptConnection,
} from './conceptConnections.ts';

export interface ChapterWeaknessSummary {
  chapterId: string;
  chapterTitle: string;
  academic_year: AcademicYear;
  subjectId: SubjectId;
  accuracyPercent: number;
  avgTimePerQuestionSec: number;
  flashcardLapses: number;
  unresolvedDoubts: number;
  confidence: number;
  weaknessScore: number; // Higher means needs more attention (0-100)
  statusLabel: 'Needs Immediate Focus' | 'Moderate Attention' | 'Strong';
}

export interface WeaknessReport {
  headline: string;
  overallAccuracy: number;
  avgTimePerQuestionSec: number;
  weakestChapters: ChapterWeaknessSummary[];
  strongestChapters: ChapterWeaknessSummary[];
  repeatedMistakeTopics: {
    topic: string;
    chapterTitle: string;
    academic_year: AcademicYear;
    mistakeCount: number;
    subjectId: SubjectId;
  }[];
  conceptConnections: ResolvedConceptConnection[];
  recommendations: {
    conceptsToRelearn: string[];
    formulasToRevise: string[];
    questionsToPractise: string[];
    revisionActivities: string[];
  };
}

export function analyzeWeaknesses(params: {
  chapters: Chapter[];
  quizAttempts: QuizAttempt[];
  flashcards: Flashcard[];
  doubts: DoubtItem[];
  formulas: FormulaEntry[];
  memoryDrills: MemoryDrillRecord[];
  academicYearFilter?: AcademicYear | 'COMBINED';
}): WeaknessReport {
  const {
    chapters,
    quizAttempts,
    flashcards,
    doubts,
    formulas,
    memoryDrills,
    academicYearFilter = 'COMBINED',
  } = params;

  const filteredChapters =
    academicYearFilter === 'COMBINED'
      ? chapters
      : chapters.filter((c) => c.academic_year === academicYearFilter);

  const allResults = quizAttempts
    .flatMap((a) => a.results)
    .filter((r) => academicYearFilter === 'COMBINED' || r.academic_year === academicYearFilter);

  const filteredDrills = memoryDrills.filter(
    (d) => academicYearFilter === 'COMBINED' || d.academic_year === academicYearFilter
  );
  const filteredCards = flashcards.filter(
    (f) => academicYearFilter === 'COMBINED' || f.academic_year === academicYearFilter
  );
  const filteredDoubts = doubts.filter(
    (d) => academicYearFilter === 'COMBINED' || d.academic_year === academicYearFilter
  );
  const filteredFormulas = formulas.filter(
    (f) => academicYearFilter === 'COMBINED' || f.academic_year === academicYearFilter
  );

  const totalQ = allResults.length;
  const totalCorrect = allResults.filter((r) => r.isCorrect).length;
  const overallAccuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;
  const avgTimePerQuestionSec =
    totalQ > 0
      ? Math.round(allResults.reduce((acc, r) => acc + r.timeSpentSeconds, 0) / totalQ)
      : 0;

  if (filteredChapters.length === 0 && totalQ === 0 && filteredDoubts.length === 0) {
    return {
      headline:
        'No academic data recorded yet. Add chapters, upload PDFs, or take a KCET practice quiz to unlock combined 1st & 2nd PUC weak-topic diagnostics.',
      overallAccuracy: 0,
      avgTimePerQuestionSec: 0,
      weakestChapters: [],
      strongestChapters: [],
      repeatedMistakeTopics: [],
      conceptConnections: [],
      recommendations: {
        conceptsToRelearn: [],
        formulasToRevise: [],
        questionsToPractise: [],
        revisionActivities: [],
      },
    };
  }

  const chapterMap = new Map(chapters.map((c) => [c.id, c]));

  const summaries: ChapterWeaknessSummary[] = filteredChapters.map((chapter) => {
    const chResults = allResults.filter((r) => r.chapterId === chapter.id);
    const chDrills = filteredDrills.filter((d) => d.chapterId === chapter.id);
    const chCards = filteredCards.filter((f) => f.chapterId === chapter.id);
    const chDoubts = filteredDoubts.filter(
      (d) => d.chapterId === chapter.id && d.status !== 'solved'
    );

    const totalAttempts = chResults.length + chDrills.length;
    const totalRight =
      chResults.filter((r) => r.isCorrect).length + chDrills.filter((d) => d.correct).length;

    const accuracyPercent =
      totalAttempts > 0 ? Math.round((totalRight / totalAttempts) * 100) : chapter.confidence * 20;

    const chAvgTime =
      chResults.length > 0
        ? Math.round(chResults.reduce((acc, r) => acc + r.timeSpentSeconds, 0) / chResults.length)
        : 0;

    const flashcardLapses = chCards.reduce(
      (acc, c) =>
        acc + c.lapseCount + (c.lastRating === 'Again' || c.lastRating === 'Difficult' ? 1 : 0),
      0
    );

    const lowConfidencePenalty = (5 - chapter.confidence) * 10;
    const accuracyPenalty = Math.max(0, 100 - accuracyPercent) * 0.55;
    const lapsePenalty = Math.min(20, flashcardLapses * 4);
    const doubtPenalty = Math.min(15, chDoubts.length * 5);
    const speedPenalty = chAvgTime > 75 ? 8 : 0;

    const weaknessScore = Math.min(
      100,
      Math.round(
        lowConfidencePenalty * 0.4 +
          accuracyPenalty +
          lapsePenalty +
          doubtPenalty +
          speedPenalty
      )
    );

    let statusLabel: ChapterWeaknessSummary['statusLabel'] = 'Strong';
    if (weaknessScore >= 52) statusLabel = 'Needs Immediate Focus';
    else if (weaknessScore >= 30) statusLabel = 'Moderate Attention';

    return {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      academic_year: chapter.academic_year,
      subjectId: chapter.subjectId,
      accuracyPercent,
      avgTimePerQuestionSec: chAvgTime,
      flashcardLapses,
      unresolvedDoubts: chDoubts.length,
      confidence: chapter.confidence,
      weaknessScore,
      statusLabel,
    };
  });

  const sortedWeak = [...summaries].sort((a, b) => b.weaknessScore - a.weaknessScore);
  const sortedStrong = [...summaries]
    .filter((s) => s.weaknessScore < 45)
    .sort((a, b) => a.weaknessScore - b.weaknessScore);

  const topicMistakes = new Map<
    string,
    {
      topic: string;
      chapterTitle: string;
      academic_year: AcademicYear;
      count: number;
      subjectId: SubjectId;
    }
  >();

  for (const r of allResults) {
    if (!r.isCorrect) {
      const key = `${r.chapterId}::${r.topic}`;
      const existing = topicMistakes.get(key);
      const ch = chapterMap.get(r.chapterId);
      topicMistakes.set(key, {
        topic: r.topic,
        chapterTitle: ch?.title ?? r.chapterTitle ?? r.chapterId,
        academic_year: r.academic_year ?? ch?.academic_year ?? 'PUC_2',
        count: (existing?.count ?? 0) + 1,
        subjectId: r.subjectId,
      });
    }
  }

  for (const d of filteredDoubts) {
    if (d.status !== 'solved') {
      const key = `${d.chapterId}::${d.topic}`;
      const existing = topicMistakes.get(key);
      const ch = chapterMap.get(d.chapterId);
      topicMistakes.set(key, {
        topic: d.topic,
        chapterTitle: ch?.title ?? d.chapterId,
        academic_year: d.academic_year ?? ch?.academic_year ?? 'PUC_2',
        count: (existing?.count ?? 0) + 1,
        subjectId: d.subjectId,
      });
    }
  }

  const repeatedMistakeTopics = [...topicMistakes.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((t) => ({
      topic: t.topic,
      chapterTitle: t.chapterTitle,
      academic_year: t.academic_year,
      mistakeCount: t.count,
      subjectId: t.subjectId,
    }));

  const conceptConnections = findStrugglingConceptConnections(
    sortedWeak,
    chapters,
    filteredDoubts
  );

  const topWeak = sortedWeak[0];
  const topStrong = sortedStrong[0];
  let headline = 'Complete a KCET practice quiz or flashcard review to unlock deeper diagnostics.';
  if (topWeak && topStrong && topWeak.chapterId !== topStrong.chapterId) {
    headline = `Strongest area: ${topStrong.chapterTitle} (${topStrong.accuracyPercent}% accuracy). Top priority: ${topWeak.chapterTitle} (${topWeak.accuracyPercent}% accuracy, ${topWeak.unresolvedDoubts} open doubts).`;
  } else if (topWeak) {
    headline = `${topWeak.chapterTitle} currently shows the highest revision priority (${topWeak.accuracyPercent}% accuracy, ${topWeak.flashcardLapses} recall lapses).`;
  }

  const weakChapterIds = new Set(sortedWeak.slice(0, 4).map((w) => w.chapterId));

  const conceptsToRelearn =
    repeatedMistakeTopics.length > 0
      ? repeatedMistakeTopics.slice(0, 4).map((t) => `${t.topic} (${t.chapterTitle})`)
      : sortedWeak.slice(0, 3).map((w) => `Core fundamentals of ${w.chapterTitle}`);

  const matchingFormulas = filteredFormulas
    .filter((f) => weakChapterIds.has(f.chapterId))
    .slice(0, 4)
    .map((f) => `${f.title} — ${f.topic}`);
  const formulasToRevise =
    matchingFormulas.length > 0
      ? matchingFormulas
      : filteredFormulas.slice(0, 3).map((f) => `${f.title} (${f.topic})`);

  const questionsToPractise = sortedWeak.slice(0, 3).map(
    (w) => `15 timed Medium/Hard KCET MCQs on ${w.chapterTitle}`
  );

  const revisionActivities =
    sortedWeak.length > 0
      ? [
          `Run a 15-minute Last-Minute Revision sheet on ${sortedWeak[0].chapterTitle}`,
          'Practice Active Recall & Formula Recall in Memory Lab for lapsed cards',
          'Revisit unresolved items in Doubt Notebook and solve similar questions',
        ]
      : [];

  return {
    headline,
    overallAccuracy,
    avgTimePerQuestionSec,
    weakestChapters: sortedWeak.slice(0, 6),
    strongestChapters: sortedStrong.slice(0, 4),
    repeatedMistakeTopics,
    conceptConnections,
    recommendations: {
      conceptsToRelearn,
      formulasToRevise,
      questionsToPractise,
      revisionActivities,
    },
  };
}
