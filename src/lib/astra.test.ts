import test from 'node:test';
import assert from 'node:assert/strict';
import { computeNextReview, getDueFlashcards, addDaysToIsoDate } from './srs.ts';
import { chunkPdfPages, retrieveRelevantChunks } from './pdfChunker.ts';
import { analyzeWeaknesses } from './weaknessEngine.ts';
import { generateWeeklyStudyPlan } from './studyPlanner.ts';
import { searchEverything } from './searchEngine.ts';
import {
  buildSyllabusChapters,
  createCleanAppState,
  KARNATAKA_PUC_SYLLABUS,
} from '../data/pucSyllabus.ts';
import {
  findConceptConnectionsForChapter,
  findStrugglingConceptConnections,
} from './conceptConnections.ts';

test('Fresh start state opens completely clean with zero sample chapters, cards, quizzes, or fake streaks', () => {
  const clean = createCleanAppState();
  assert.equal(clean.chapters.length, 0);
  assert.equal(clean.flashcards.length, 0);
  assert.equal(clean.formulas.length, 0);
  assert.equal(clean.questionsBank.length, 0);
  assert.equal(clean.quizAttempts.length, 0);
  assert.equal(clean.doubts.length, 0);
  assert.equal(clean.studySessions.length, 0);
  assert.equal(clean.tutorMessages.length, 0);
  assert.equal(clean.settings.streakDays, 0);
  assert.equal(clean.settings.studyMinutesToday, 0);
  assert.deepEqual(clean.settings.enabledSubjects, ['physics', 'chemistry', 'mathematics']);
  assert.equal(clean.settings.activeAcademicYear, 'PUC_1');
});

test('Karnataka PUC syllabus builder generates separate 1st PUC and 2nd PUC chapters without duplicates', () => {
  const puc1 = buildSyllabusChapters('PUC_1', ['physics', 'chemistry', 'mathematics'], []);
  const puc2 = buildSyllabusChapters('PUC_2', ['physics', 'chemistry', 'mathematics'], puc1);

  assert.equal(
    puc1.length,
    KARNATAKA_PUC_SYLLABUS.PUC_1.physics.length +
      KARNATAKA_PUC_SYLLABUS.PUC_1.chemistry.length +
      KARNATAKA_PUC_SYLLABUS.PUC_1.mathematics.length
  );
  assert.equal(
    puc2.length,
    KARNATAKA_PUC_SYLLABUS.PUC_2.physics.length +
      KARNATAKA_PUC_SYLLABUS.PUC_2.chemistry.length +
      KARNATAKA_PUC_SYLLABUS.PUC_2.mathematics.length
  );
  assert.ok(puc1.every((c) => c.academic_year === 'PUC_1'));
  assert.ok(puc2.every((c) => c.academic_year === 'PUC_2'));

  // Re-importing does not duplicate
  const dupes = buildSyllabusChapters('PUC_1', ['physics'], puc1);
  assert.equal(dupes.length, 0);
});

test('Cross-year Concept Connection maps 2nd PUC topics to 1st PUC prerequisites', () => {
  const allChapters = [
    ...buildSyllabusChapters('PUC_1', ['physics', 'chemistry', 'mathematics'], []),
    ...buildSyllabusChapters('PUC_2', ['physics', 'chemistry', 'mathematics'], []),
  ];

  const calcLinks = findConceptConnectionsForChapter(
    'Applications of Derivatives',
    'mathematics',
    'PUC_2',
    allChapters
  );
  assert.ok(calcLinks.length >= 1);
  assert.equal(calcLinks[0].prerequisiteYear, 'PUC_1');
  assert.ok(calcLinks[0].prerequisiteChapterTitle.includes('Limits and Derivatives'));

  // Should return empty for 1st PUC chapters
  const puc1Links = findConceptConnectionsForChapter('Laws of Motion', 'physics', 'PUC_1', allChapters);
  assert.equal(puc1Links.length, 0);

  // Struggling detection triggers on low confidence / accuracy
  const electrochem = allChapters.find(
    (c) => c.academic_year === 'PUC_2' && c.title === 'Electrochemistry'
  )!;
  const triggered = findStrugglingConceptConnections(
    [
      {
        chapterId: electrochem.id,
        chapterTitle: electrochem.title,
        subjectId: 'chemistry',
        academic_year: 'PUC_2',
        weaknessScore: 60,
        confidence: 2,
        unresolvedDoubts: 1,
        accuracyPercent: 40,
      },
    ],
    allChapters,
    []
  );
  assert.ok(triggered.length >= 1);
  assert.ok(triggered[0].prerequisiteChapterTitle.includes('Redox'));
});

test('SRS scheduling applies exact intervals for Again, Difficult, Good, Easy', () => {
  const baseCard = { intervalDays: 0, easeFactor: 2.5, repetitions: 0, lapseCount: 0 };
  const today = '2026-11-13';

  const again = computeNextReview(baseCard, 'Again', today);
  assert.equal(again.intervalDays, 0);
  assert.equal(again.nextReviewDate, today);
  assert.equal(again.lapseCount, 1);

  const difficult = computeNextReview(baseCard, 'Difficult', today);
  assert.equal(difficult.intervalDays, 1);
  assert.equal(difficult.nextReviewDate, addDaysToIsoDate(today, 1));

  const good1 = computeNextReview(baseCard, 'Good', today);
  assert.equal(good1.intervalDays, 3);
  assert.equal(good1.nextReviewDate, addDaysToIsoDate(today, 3));

  const good2 = computeNextReview(good1, 'Good', today);
  assert.equal(good2.intervalDays, 7);

  const good3 = computeNextReview(good2, 'Good', today);
  assert.equal(good3.intervalDays, 14);

  const easy1 = computeNextReview(baseCard, 'Easy', today);
  assert.equal(easy1.intervalDays, 7);
});

test('getDueFlashcards returns cards due on or before today sorted by due date & lapses', () => {
  const today = '2026-11-13';
  const cards = [
    {
      id: 'c1',
      academic_year: 'PUC_1' as const,
      subjectId: 'physics' as const,
      chapterId: 'ch1',
      cardType: 'flashcard' as const,
      front: 'State Newton second law',
      back: 'F = dp/dt',
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 1,
      nextReviewDate: '2026-11-12',
      lapseCount: 1,
      createdAt: today,
    },
    {
      id: 'c2',
      academic_year: 'PUC_2' as const,
      subjectId: 'chemistry' as const,
      chapterId: 'ch2',
      cardType: 'formula' as const,
      front: 'Nernst Equation',
      back: 'E = E0 - (0.0591/n) log Q',
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 1,
      nextReviewDate: '2026-11-13',
      lapseCount: 0,
      createdAt: today,
    },
    {
      id: 'c3',
      academic_year: 'PUC_2' as const,
      subjectId: 'mathematics' as const,
      chapterId: 'ch3',
      cardType: 'definition' as const,
      front: 'Symmetric Matrix',
      back: 'A^T = A',
      intervalDays: 7,
      easeFactor: 2.5,
      repetitions: 2,
      nextReviewDate: '2026-11-20',
      lapseCount: 0,
      createdAt: today,
    },
  ];

  const due = getDueFlashcards(cards, today);
  assert.equal(due.length, 2);
  assert.equal(due[0].id, 'c1');
});

test('PDF chunker preserves page numbers and retriever ranks matching page chunks highest', () => {
  const pages = [
    { pageNumber: 1, text: 'Electrostatics studies stationary electric charges and Coulomb force.' },
    { pageNumber: 2, text: 'Gauss law relates electric flux to enclosed charge divided by epsilon zero.' },
    { pageNumber: 3, text: 'Parallel plate capacitor capacitance depends on plate area and dielectric constant K.' },
  ];
  const chunks = chunkPdfPages('pdf-test', pages, 200, 20);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[1].pageNumber, 2);

  const retrieved = retrieveRelevantChunks(chunks, 'What is Gauss law electric flux?', 1);
  assert.equal(retrieved.length, 1);
  assert.equal(retrieved[0].pageNumber, 2);
});

test('Weakness analyser handles empty state cleanly and analyses populated 1st & 2nd PUC chapters', () => {
  const emptyState = createCleanAppState();
  const emptyReport = analyzeWeaknesses({
    chapters: emptyState.chapters,
    quizAttempts: emptyState.quizAttempts,
    flashcards: emptyState.flashcards,
    doubts: emptyState.doubts,
    formulas: emptyState.formulas,
    memoryDrills: emptyState.memoryDrills,
  });
  assert.equal(emptyReport.weakestChapters.length, 0);
  assert.equal(emptyReport.overallAccuracy, 0);

  const chapters = [
    ...buildSyllabusChapters('PUC_1', ['physics'], []),
    ...buildSyllabusChapters('PUC_2', ['physics'], []),
  ];
  const report = analyzeWeaknesses({
    chapters,
    quizAttempts: [],
    flashcards: [],
    doubts: [],
    formulas: [],
    memoryDrills: [],
    academicYearFilter: 'PUC_1',
  });
  assert.ok(report.weakestChapters.length > 0);
  assert.ok(report.weakestChapters.every((w) => w.academic_year === 'PUC_1'));
});

test('Study planner returns empty on clean workspace and generates bounded 7-day plan once chapters exist', () => {
  const clean = createCleanAppState();
  assert.equal(
    generateWeeklyStudyPlan(clean.studyPlanConfig, clean.chapters, false, '2026-11-13').length,
    0
  );

  const chapters = buildSyllabusChapters('PUC_1', ['physics', 'chemistry', 'mathematics'], []);
  const sessions = generateWeeklyStudyPlan(clean.studyPlanConfig, chapters, false, '2026-11-13');
  assert.ok(sessions.length >= 14);
  const breaks = sessions.filter((s) => s.sessionType === 'break');
  assert.ok(breaks.length > 0);
  const day1StudyMins = sessions
    .filter((s) => s.date === '2026-11-13' && s.sessionType !== 'break')
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  assert.ok(day1StudyMins <= clean.studyPlanConfig.dailyHours * 60);
});

test('Search everything filters by academic_year across 1st and 2nd PUC items', () => {
  const state = createCleanAppState();
  state.chapters = [
    ...buildSyllabusChapters('PUC_1', ['physics'], []),
    ...buildSyllabusChapters('PUC_2', ['physics'], []),
  ];
  state.formulas.push({
    id: 'f1',
    academic_year: 'PUC_2',
    subjectId: 'physics',
    chapterId: state.chapters.find((c) => c.academic_year === 'PUC_2')?.id ?? 'c2',
    topic: 'Dielectrics',
    title: 'Dielectric Capacitance Formula',
    latex: 'C = K C_0',
    variables: [{ symbol: 'K', meaning: 'Dielectric constant', unit: 'dimensionless' }],
    conditions: 'Parallel plate fully filled',
    relatedFormulas: [],
    example: 'K=4 doubles capacitance fourfold.',
    bookmarked: false,
  });

  const allHits = searchEverything(state, 'dielectric', 'all', 'all');
  assert.ok(allHits.some((h) => h.category === 'formula' && h.academic_year === 'PUC_2'));

  const puc1Hits = searchEverything(state, 'dielectric', 'all', 'PUC_1');
  assert.equal(puc1Hits.length, 0);
});
