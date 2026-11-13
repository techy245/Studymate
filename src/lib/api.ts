import type {
  AcademicYear,
  AstraAppState,
  Chapter,
  DifficultyLevel,
  DoubtItem,
  Flashcard,
  FormulaEntry,
  LastMinuteRevisionSheet,
  McqQuestion,
  PdfAnalysisResult,
  PdfDocType,
  QuizAttempt,
  ReviewRating,
  StudyPlanConfig,
  StudySession,
  SubjectId,
  TutorMessage,
  TutorMode,
  UploadedPdf,
  UserSettings,
} from '../types';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const errMsg =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error: string }).error)
        : `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return data as T;
}

export const api = {
  getHealth: () =>
    requestJson<{ ok: boolean; geminiConfigured: boolean; storageMode: string }>('/api/health'),
  getState: () => requestJson<AstraAppState>('/api/state'),

  updateSettings: (patch: Partial<UserSettings>) =>
    requestJson<UserSettings>('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  resetWorkspace: (preservePdfs = false) =>
    requestJson<AstraAppState>('/api/workspace/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preservePdfs }),
    }),

  addChapter: (academic_year: AcademicYear, subjectId: SubjectId, title: string) =>
    requestJson<Chapter>('/api/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ academic_year, subjectId, title }),
    }),

  importSyllabus: (academic_year: AcademicYear | 'BOTH', subjectIds?: SubjectId[]) =>
    requestJson<{ addedCount: number; chapters: Chapter[] }>('/api/chapters/import-syllabus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ academic_year, subjectIds }),
    }),

  updateChapter: (id: string, patch: Partial<Chapter>) =>
    requestJson<Chapter>(`/api/chapters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  reorderChapters: (academic_year: AcademicYear, subjectId: SubjectId, orderedIds: string[]) =>
    requestJson<Chapter[]>('/api/chapters/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ academic_year, subjectId, orderedIds }),
    }),

  deleteChapter: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/chapters/${id}`, { method: 'DELETE' }),

  uploadPdf: async (
    file: File,
    academic_year: AcademicYear,
    subjectId: SubjectId,
    chapterId: string,
    docType: PdfDocType
  ) => {
    const form = new FormData();
    form.append('file', file);
    form.append('academic_year', academic_year);
    form.append('subjectId', subjectId);
    form.append('chapterId', chapterId);
    form.append('docType', docType);
    return requestJson<UploadedPdf>('/api/pdfs/upload', {
      method: 'POST',
      body: form,
    });
  },

  deletePdf: (id: string) => requestJson<{ ok: boolean }>(`/api/pdfs/${id}`, { method: 'DELETE' }),

  analyzePdf: (id: string) =>
    requestJson<PdfAnalysisResult>(`/api/pdfs/${id}/analyze`, { method: 'POST' }),

  savePdfAnalysis: (id: string, analysis: PdfAnalysisResult) =>
    requestJson<PdfAnalysisResult>(`/api/pdfs/${id}/analysis`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysis),
    }),

  askTutor: (payload: {
    question: string;
    mode: TutorMode;
    academic_year: AcademicYear;
    subjectId: SubjectId;
    chapterId: string;
    pdfId?: string;
    imageBase64?: string;
    imageMimeType?: string;
    didNotUnderstand?: boolean;
  }) =>
    requestJson<{ userMessage: TutorMessage; assistantMessage: TutorMessage }>('/api/ai/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  clearTutorChat: () => requestJson<TutorMessage[]>('/api/ai/tutor', { method: 'DELETE' }),

  createFlashcards: (
    cards: Omit<
      Flashcard,
      'id' | 'intervalDays' | 'easeFactor' | 'repetitions' | 'nextReviewDate' | 'lapseCount' | 'createdAt'
    >[]
  ) =>
    requestJson<Flashcard[]>('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cards),
    }),

  reviewFlashcard: (id: string, rating: ReviewRating) =>
    requestJson<Flashcard>(`/api/flashcards/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    }),

  deleteFlashcard: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/flashcards/${id}`, { method: 'DELETE' }),

  createFormulas: (formulas: Omit<FormulaEntry, 'id'>[]) =>
    requestJson<FormulaEntry[]>('/api/formulas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formulas),
    }),

  updateFormula: (id: string, patch: Partial<FormulaEntry>) =>
    requestJson<FormulaEntry>(`/api/formulas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  generateMcqs: (payload: {
    academic_year: AcademicYear | 'COMBINED';
    subjectId: SubjectId | 'mixed';
    chapterId: string;
    chapterTitle?: string;
    topic?: string;
    difficulty: DifficultyLevel;
    count: number;
    pdfId?: string;
    extractPyqOnly?: boolean;
  }) =>
    requestJson<McqQuestion[]>('/api/kcet/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  saveQuizAttempt: (attempt: QuizAttempt) =>
    requestJson<QuizAttempt>('/api/kcet/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attempt),
    }),

  recordMemoryDrill: (payload: {
    concept: string;
    academic_year: AcademicYear;
    subjectId: SubjectId;
    chapterId: string;
    drillType:
      | 'active-recall'
      | 'fill-blank'
      | 'formula-recall'
      | 'definition-recall'
      | 'match'
      | 'quick-quiz';
    correct: boolean;
  }) =>
    requestJson<{ ok: boolean }>('/api/memory-drills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  generateLastMinuteRevision: (chapterId: string, durationMinutes: 5 | 15 | 30) =>
    requestJson<LastMinuteRevisionSheet>('/api/ai/last-minute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId, durationMinutes }),
    }),

  createDoubt: (doubt: Omit<DoubtItem, 'id' | 'createdAt'>) =>
    requestJson<DoubtItem>('/api/doubts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doubt),
    }),

  updateDoubt: (id: string, patch: Partial<DoubtItem>) =>
    requestJson<DoubtItem>(`/api/doubts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  generateSimilarDoubtQuestion: (id: string) =>
    requestJson<McqQuestion>(`/api/doubts/${id}/similar`, { method: 'POST' }),

  deleteDoubt: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/doubts/${id}`, { method: 'DELETE' }),

  generateStudyPlan: (config: StudyPlanConfig) =>
    requestJson<{ studyPlanConfig: StudyPlanConfig; studySessions: StudySession[] }>(
      '/api/planner/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }
    ),

  saveStudySessions: (sessions: StudySession[]) =>
    requestJson<StudySession[]>('/api/planner/sessions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessions),
    }),

  toggleStudySession: (id: string, completed: boolean) =>
    requestJson<StudySession>(`/api/planner/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    }),
};
