import fs from 'node:fs/promises';
import path from 'node:path';
import type { AcademicYear, AstraAppState, Chapter, SubjectId } from '../types.ts';
import { createCleanAppState } from '../data/pucSyllabus.ts';
import { formatIsoDate, addDaysToIsoDate } from '../lib/srs.ts';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'astra-db.json');
const PDF_DIR = path.join(DATA_DIR, 'pdfs');

let cachedState: AstraAppState | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const LEGACY_SEED_CHAPTER_IDS = new Set([
  ...Array.from({ length: 14 }, (_, i) => `physics-${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `chemistry-${i + 1}`),
  ...Array.from({ length: 13 }, (_, i) => `mathematics-${i + 1}`),
  ...Array.from({ length: 13 }, (_, i) => `biology-${i + 1}`),
]);
const LEGACY_SEED_CHAPTER_NOTE =
  'Focus on equipotential surfaces, parallel plate capacitor with dielectric slab, and energy stored U = 1/2 CV^2.';
const LEGACY_SEED_FLASHCARD_IDS = new Set(['fc-1', 'fc-2', 'fc-3', 'fc-4', 'fc-5']);
const LEGACY_SEED_FORMULA_IDS = new Set(['f-phy-1', 'f-phy-2', 'f-phy-3', 'f-che-1', 'f-che-2', 'f-mat-1']);
const LEGACY_SEED_QUESTION_IDS = new Set([
  'q-phy-1',
  'q-phy-2',
  'q-phy-3',
  'q-che-1',
  'q-che-2',
  'q-mat-1',
  'q-mat-2',
  'q-bio-1',
]);

async function ensureDirs(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PDF_DIR, { recursive: true });
}

export function recordStudyActivity(state: AstraAppState, minutes: number): void {
  const today = formatIsoDate(new Date());
  const yesterday = addDaysToIsoDate(today, -1);

  if (state.settings.lastStudyDate !== today) {
    const continued = state.settings.lastStudyDate === yesterday && state.settings.streakDays > 0;
    state.settings.streakDays = continued ? state.settings.streakDays + 1 : 1;
    state.settings.studyMinutesToday = 0;
    state.settings.lastStudyDate = today;
  } else if (state.settings.streakDays === 0) {
    state.settings.streakDays = 1;
  }

  state.settings.studyMinutesToday += Math.max(0, minutes);
  if (!state.settings.revisionHistoryDates.includes(today)) {
    state.settings.revisionHistoryDates.push(today);
  }
}

function normalizeDailyRollover(state: AstraAppState): AstraAppState {
  const today = formatIsoDate(new Date());
  const yesterday = addDaysToIsoDate(today, -1);

  if (state.settings.lastStudyDate !== today) {
    const keptStreak =
      state.settings.lastStudyDate === yesterday ? state.settings.streakDays : 0;
    state.settings.studyMinutesToday = 0;
    state.settings.streakDays = keptStreak;
    state.settings.lastStudyDate = today;
  }
  return state;
}

function ensureBackfilledFields(state: AstraAppState): AstraAppState {
  const enabledSubjects: SubjectId[] =
    state.settings.enabledSubjects && state.settings.enabledSubjects.length > 0
      ? state.settings.enabledSubjects
      : state.settings.includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'];

  const activeAcademicYear: AcademicYear =
    state.settings.activeAcademicYear === 'PUC_1' || state.settings.activeAcademicYear === 'PUC_2'
      ? state.settings.activeAcademicYear
      : 'PUC_1';

  return {
    ...state,
    chapters: (state.chapters ?? []).map((c) => ({
      ...c,
      academic_year: c.academic_year ?? 'PUC_2',
    })),
    pdfs: (state.pdfs ?? []).map((p) => ({
      ...p,
      academic_year: p.academic_year ?? 'PUC_2',
    })),
    tutorMessages: (state.tutorMessages ?? []).map((m) => ({
      ...m,
      academic_year: m.academic_year ?? (m.chapterId ? 'PUC_2' : undefined),
    })),
    flashcards: (state.flashcards ?? []).map((f) => ({
      ...f,
      academic_year: f.academic_year ?? 'PUC_2',
    })),
    formulas: (state.formulas ?? []).map((f) => ({
      ...f,
      academic_year: f.academic_year ?? 'PUC_2',
    })),
    questionsBank: (state.questionsBank ?? []).map((q) => ({
      ...q,
      academic_year: q.academic_year ?? 'PUC_2',
    })),
    quizAttempts: (state.quizAttempts ?? []).map((a) => ({
      ...a,
      academic_year: a.academic_year ?? 'PUC_2',
      results: (a.results ?? []).map((r) => ({
        ...r,
        academic_year: r.academic_year ?? 'PUC_2',
      })),
    })),
    doubts: (state.doubts ?? []).map((d) => ({
      ...d,
      academic_year: d.academic_year ?? 'PUC_2',
    })),
    studySessions: (state.studySessions ?? []).map((s) => ({
      ...s,
      academic_year: s.academic_year ?? (s.chapterId ? 'PUC_2' : undefined),
    })),
    memoryDrills: (state.memoryDrills ?? []).map((d) => ({
      ...d,
      academic_year: d.academic_year ?? 'PUC_2',
    })),
    lastMinuteSheets: (state.lastMinuteSheets ?? []).map((l) => ({
      ...l,
      academic_year: l.academic_year ?? 'PUC_2',
    })),
    settings: {
      ...state.settings,
      enabledSubjects,
      includeBiology: enabledSubjects.includes('biology'),
      activeAcademicYear,
      workspaceInitializedClean: true,
    },
  };
}

/**
 * Migrates legacy seeded demo databases to the Fresh Start clean state while
 * strictly preserving any genuine user-uploaded PDFs, personal notes, custom
 * chapters, or user-created academic records (backfilling them with PUC_2).
 */
function migrateLegacySeedToCleanStart(parsed: AstraAppState): {
  state: AstraAppState;
  changed: boolean;
} {
  if (parsed.settings?.workspaceInitializedClean) {
    return { state: ensureBackfilledFields(parsed), changed: false };
  }

  const clean = createCleanAppState();

  const userPdfs = (parsed.pdfs ?? []).map((p) => ({
    ...p,
    academic_year: p.academic_year ?? ('PUC_2' as AcademicYear),
  }));
  const pdfChapterIds = new Set(userPdfs.map((p) => p.chapterId));

  const userFlashcards = (parsed.flashcards ?? [])
    .filter((f) => !LEGACY_SEED_FLASHCARD_IDS.has(f.id))
    .map((f) => ({ ...f, academic_year: f.academic_year ?? ('PUC_2' as AcademicYear) }));

  const userFormulas = (parsed.formulas ?? [])
    .filter((f) => !LEGACY_SEED_FORMULA_IDS.has(f.id))
    .map((f) => ({ ...f, academic_year: f.academic_year ?? ('PUC_2' as AcademicYear) }));

  const userQuestions = (parsed.questionsBank ?? [])
    .filter((q) => !LEGACY_SEED_QUESTION_IDS.has(q.id))
    .map((q) => ({ ...q, academic_year: q.academic_year ?? ('PUC_2' as AcademicYear) }));

  const userAttempts = (parsed.quizAttempts ?? [])
    .filter((a) => a.id !== 'attempt-seed-1')
    .map((a) => ({
      ...a,
      academic_year: a.academic_year ?? ('PUC_2' as AcademicYear),
      results: (a.results ?? []).map((r) => ({
        ...r,
        academic_year: r.academic_year ?? ('PUC_2' as AcademicYear),
      })),
    }));

  const userDoubts = (parsed.doubts ?? [])
    .filter((d) => d.id !== 'doubt-1')
    .map((d) => ({ ...d, academic_year: d.academic_year ?? ('PUC_2' as AcademicYear) }));

  const userTutorMessages = (parsed.tutorMessages ?? [])
    .filter((m) => m.id !== 'tutor-welcome')
    .map((m) => ({
      ...m,
      academic_year: m.academic_year ?? (m.chapterId ? ('PUC_2' as AcademicYear) : undefined),
    }));

  const referencedChapterIds = new Set<string>([
    ...pdfChapterIds,
    ...userFlashcards.map((f) => f.chapterId),
    ...userFormulas.map((f) => f.chapterId),
    ...userQuestions.map((q) => q.chapterId),
    ...userDoubts.map((d) => d.chapterId),
  ]);

  const userChapters: Chapter[] = (parsed.chapters ?? [])
    .filter((c) => {
      const hasCustomNote =
        Boolean(c.personalNotes?.trim()) && c.personalNotes.trim() !== LEGACY_SEED_CHAPTER_NOTE;
      const isCustomId = !LEGACY_SEED_CHAPTER_IDS.has(c.id);
      return isCustomId || hasCustomNote || referencedChapterIds.has(c.id);
    })
    .map((c) => ({
      ...c,
      academic_year: c.academic_year ?? ('PUC_2' as AcademicYear),
    }));

  const hasGenuineActivity =
    userPdfs.length > 0 ||
    userChapters.length > 0 ||
    userAttempts.length > 0 ||
    userDoubts.length > 0 ||
    userTutorMessages.length > 0;

  const enabledSubjects: SubjectId[] =
    parsed.settings?.enabledSubjects && parsed.settings.enabledSubjects.length > 0
      ? parsed.settings.enabledSubjects
      : parsed.settings?.includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'];

  const migrated: AstraAppState = {
    ...clean,
    chapters: userChapters,
    pdfs: userPdfs,
    tutorMessages: userTutorMessages,
    flashcards: userFlashcards,
    formulas: userFormulas,
    questionsBank: userQuestions,
    quizAttempts: userAttempts,
    doubts: userDoubts,
    memoryDrills: (parsed.memoryDrills ?? []).map((d) => ({
      ...d,
      academic_year: d.academic_year ?? ('PUC_2' as AcademicYear),
    })),
    lastMinuteSheets: (parsed.lastMinuteSheets ?? []).map((l) => ({
      ...l,
      academic_year: l.academic_year ?? ('PUC_2' as AcademicYear),
    })),
    studyPlanConfig: parsed.studyPlanConfig ?? clean.studyPlanConfig,
    studySessions: hasGenuineActivity ? (parsed.studySessions ?? []) : [],
    settings: {
      ...clean.settings,
      studentName:
        parsed.settings?.studentName && parsed.settings.studentName !== '2nd PUC Scholar'
          ? parsed.settings.studentName
          : clean.settings.studentName,
      theme: parsed.settings?.theme ?? 'dark',
      enabledSubjects,
      includeBiology: enabledSubjects.includes('biology'),
      activeAcademicYear: parsed.settings?.activeAcademicYear ?? 'PUC_1',
      dailyGoalMinutes: parsed.settings?.dailyGoalMinutes ?? 180,
      studyMinutesToday: hasGenuineActivity ? (parsed.settings?.studyMinutesToday ?? 0) : 0,
      streakDays: hasGenuineActivity ? (parsed.settings?.streakDays ?? 0) : 0,
      lastOpenedChapterId: userChapters[0]?.id ?? null,
      revisionHistoryDates: hasGenuineActivity ? (parsed.settings?.revisionHistoryDates ?? []) : [],
      workspaceInitializedClean: true,
    },
  };

  return { state: migrated, changed: true };
}

export async function loadState(): Promise<AstraAppState> {
  if (cachedState) {
    return cachedState;
  }
  await ensureDirs();
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as AstraAppState;
    const { state: migrated, changed } = migrateLegacySeedToCleanStart(parsed);
    const rolled = normalizeDailyRollover(migrated);
    cachedState = rolled;
    if (changed) {
      await saveState(rolled);
    }
    return cachedState;
  } catch {
    const initial = createCleanAppState();
    cachedState = initial;
    await saveState(initial);
    return initial;
  }
}

export async function saveState(nextState: AstraAppState): Promise<AstraAppState> {
  cachedState = nextState;
  writeQueue = writeQueue.then(async () => {
    await ensureDirs();
    const tmpPath = `${DB_PATH}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(nextState, null, 2), 'utf-8');
    await fs.rename(tmpPath, DB_PATH);
  });
  await writeQueue;
  return cachedState;
}

export async function mutateState(
  updater: (current: AstraAppState) => AstraAppState | void
): Promise<AstraAppState> {
  const current = await loadState();
  const maybeNext = updater(current);
  const next = maybeNext ?? current;
  return saveState(next);
}

export async function savePdfBinary(pdfId: string, buffer: Buffer): Promise<string> {
  await ensureDirs();
  const safeId = pdfId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(PDF_DIR, `${safeId}.pdf`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readPdfBinary(pdfId: string): Promise<Buffer | null> {
  const safeId = pdfId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(PDF_DIR, `${safeId}.pdf`);
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

export async function deletePdfBinary(pdfId: string): Promise<void> {
  const safeId = pdfId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(PDF_DIR, `${safeId}.pdf`);
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore if file already missing
  }
}
