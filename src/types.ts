export type AcademicYear = 'PUC_1' | 'PUC_2';

export type SubjectId = 'physics' | 'chemistry' | 'mathematics' | 'biology';

export type ChapterStatus = 'Not Started' | 'Learning' | 'Revision' | 'Completed';

export type PdfDocType =
  | 'Textbook'
  | 'Chapter PDF'
  | 'Class Notes'
  | 'Reference Material'
  | 'Handwritten Notes'
  | 'Past Question Paper';

export type TutorMode =
  | 'simple'
  | 'deep'
  | 'example'
  | 'step-by-step'
  | 'exam-answer'
  | 'doubt-solving'
  | 'compare';

export type ReviewRating = 'Again' | 'Difficult' | 'Good' | 'Easy';

export type CardType = 'flashcard' | 'qa' | 'formula' | 'definition' | 'keyword';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export type MistakeType =
  | 'Conceptual Gap'
  | 'Formula Error'
  | 'Calculation Slip'
  | 'Misread Question'
  | 'Time Pressure';

export type NavSection =
  | 'dashboard'
  | 'subjects'
  | 'pdf-analyser'
  | 'tutor'
  | 'revision'
  | 'memory-lab'
  | 'kcet'
  | 'weakness'
  | 'planner'
  | 'formula-book'
  | 'last-minute'
  | 'doubts'
  | 'search'
  | 'analytics';

export interface SubjectInfo {
  id: SubjectId;
  name: string;
  code: string;
  accentColor: string;
  optional?: boolean;
}

export interface Chapter {
  id: string;
  academic_year: AcademicYear;
  subjectId: SubjectId;
  order: number;
  title: string;
  status: ChapterStatus;
  progressPercent: number;
  confidence: number; // 1 to 5
  personalNotes: string;
  lastStudiedAt?: string;
}

export interface PdfPageText {
  pageNumber: number;
  text: string;
}

export interface PdfChunk {
  id: string;
  pdfId: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
}

export interface AnalyzedDefinition {
  id: string;
  term: string;
  simpleExplanation: string;
  textbookDefinition: string;
  terminology: string[];
  pageNumber: number;
  sourceLocation: string;
  bookmarked: boolean;
}

export interface AnalyzedFormula {
  id: string;
  name: string;
  expression: string;
  variables: string;
  siUnits: string;
  conditions: string;
  relatedFormulas: string;
  shortExample: string;
  pageNumber: number;
  sourceLocation: string;
  bookmarked: boolean;
}

export interface AnalyzedDerivation {
  id: string;
  title: string;
  steps: string[];
  mathematicalReasoning: string;
  finalResult: string;
  assumptions: string;
  examRelevantSteps: string;
  pageNumber: number;
  sourceLocation: string;
  bookmarked: boolean;
}

export interface AnalyzedKeyword {
  id: string;
  term: string;
  examUsage: string;
  mustAppearIn: string;
  pageNumber: number;
  sourceLocation: string;
  bookmarked: boolean;
}

export interface AnalyzedNote {
  id: string;
  title: string;
  summary: string;
  observations: string;
  exceptions: string;
  frequentlyConfused: string;
  diagramsToPractise: string;
  pageNumber: number;
  sourceLocation: string;
  bookmarked: boolean;
}

export interface AnalyzedExamImportance {
  id: string;
  topic: string;
  kcetRelevance: string;
  boardRelevance: string;
  frequencyNote: string;
  pageNumber: number;
  sourceLocation: string;
  bookmarked: boolean;
}

export interface PdfAnalysisResult {
  analyzedAt: string;
  groundingNote: string;
  definitions: AnalyzedDefinition[];
  formulas: AnalyzedFormula[];
  derivations: AnalyzedDerivation[];
  keywords: AnalyzedKeyword[];
  importantNotes: AnalyzedNote[];
  examImportance: AnalyzedExamImportance[];
}

export interface UploadedPdf {
  id: string;
  fileName: string;
  academic_year: AcademicYear;
  subjectId: SubjectId;
  chapterId: string;
  docType: PdfDocType;
  uploadedAt: string;
  totalPages: number;
  fileSizeBytes: number;
  extractionStatus: 'extracted' | 'empty-or-scanned' | 'error';
  extractionMessage?: string;
  pages: PdfPageText[];
  chunks: PdfChunk[];
  analysis?: PdfAnalysisResult;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  mode: TutorMode;
  academic_year?: AcademicYear;
  subjectId?: SubjectId;
  chapterId?: string;
  pdfId?: string;
  content: string;
  understandingCheck?: string;
  sources?: string[];
  imagePreview?: string;
  createdAt: string;
}

export interface Flashcard {
  id: string;
  academic_year: AcademicYear;
  subjectId: SubjectId;
  chapterId: string;
  cardType: CardType;
  front: string;
  back: string;
  hint?: string;
  sourcePage?: number;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  nextReviewDate: string; // YYYY-MM-DD
  lastRating?: ReviewRating;
  lapseCount: number;
  createdAt: string;
}

export interface FormulaEntry {
  id: string;
  academic_year: AcademicYear;
  subjectId: SubjectId;
  chapterId: string;
  topic: string;
  title: string;
  latex: string;
  variables: { symbol: string; meaning: string; unit: string }[];
  conditions: string;
  relatedFormulas: string[];
  example: string;
  sourcePage?: number;
  sourcePdfName?: string;
  bookmarked: boolean;
}

export interface McqQuestion {
  id: string;
  academic_year: AcademicYear;
  subjectId: SubjectId;
  chapterId: string;
  chapterTitle?: string;
  topic: string;
  difficulty: DifficultyLevel;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  relatedConcept: string;
  sourceType: 'ai-generated' | 'uploaded-pyq';
  sourceLabel: string;
}

export interface QuizQuestionResult {
  questionId: string;
  question: string;
  academic_year: AcademicYear;
  subjectId: SubjectId;
  chapterId: string;
  chapterTitle?: string;
  topic: string;
  difficulty: DifficultyLevel;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  timeSpentSeconds: number;
  explanation: string;
  relatedConcept: string;
  options: [string, string, string, string];
  sourceType: 'ai-generated' | 'uploaded-pyq';
}

export interface QuizAttempt {
  id: string;
  title: string;
  academic_year: AcademicYear | 'COMBINED';
  mode: 'chapter' | 'subject' | 'topic' | 'mixed' | 'timed' | 'full-mock' | 'pyq';
  subjectId: SubjectId | 'mixed';
  chapterIds: string[];
  totalQuestions: number;
  correctCount: number;
  accuracyPercent: number;
  timeTakenSeconds: number;
  completedAt: string;
  results: QuizQuestionResult[];
}

export interface DoubtItem {
  id: string;
  academic_year: AcademicYear;
  subjectId: SubjectId;
  chapterId: string;
  topic: string;
  question: string;
  studentAttempt: string;
  solutionNotes: string;
  mistakeType: MistakeType;
  status: 'unsolved' | 'revisiting' | 'solved';
  similarQuestion?: McqQuestion;
  createdAt: string;
}

export interface StudySession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  durationMinutes: number;
  academic_year?: AcademicYear;
  subjectId: SubjectId | 'break';
  chapterId?: string;
  title: string;
  sessionType: 'study' | 'revision' | 'kcet-practice' | 'break' | 'backlog';
  completed: boolean;
}

export interface StudyPlanConfig {
  boardExamDate: string;
  kcetExamDate: string;
  dailyHours: number;
  weakSubjects: SubjectId[];
  includeBacklog: boolean;
  revisionFrequencyDays: number;
}

export interface MemoryDrillRecord {
  id: string;
  concept: string;
  academic_year: AcademicYear;
  subjectId: SubjectId;
  chapterId: string;
  drillType: 'active-recall' | 'fill-blank' | 'formula-recall' | 'definition-recall' | 'match' | 'quick-quiz';
  correct: boolean;
  attemptedAt: string;
}

export interface LastMinuteRevisionSheet {
  id: string;
  academic_year: AcademicYear;
  chapterId: string;
  subjectId: SubjectId;
  durationMinutes: 5 | 15 | 30;
  generatedAt: string;
  essential: {
    definitions: string[];
    formulas: string[];
    derivations: string[];
    keyConcepts: string[];
    keywords: string[];
    commonMistakes: string[];
    frequentlyConfused: string[];
    summary: string;
  };
  supplementary: {
    extraNotes: string[];
    bonusTips: string[];
  };
  quickTest: McqQuestion[];
}

export interface UserSettings {
  studentName: string;
  theme: 'dark' | 'light';
  includeBiology: boolean;
  enabledSubjects: SubjectId[];
  activeAcademicYear: AcademicYear;
  dailyGoalMinutes: number;
  studyMinutesToday: number;
  streakDays: number;
  lastStudyDate: string;
  lastOpenedChapterId: string | null;
  revisionHistoryDates: string[]; // YYYY-MM-DD dates when user studied/revised
  workspaceInitializedClean?: boolean;
}

export interface AstraAppState {
  chapters: Chapter[];
  pdfs: UploadedPdf[];
  tutorMessages: TutorMessage[];
  flashcards: Flashcard[];
  formulas: FormulaEntry[];
  questionsBank: McqQuestion[];
  quizAttempts: QuizAttempt[];
  doubts: DoubtItem[];
  studyPlanConfig: StudyPlanConfig;
  studySessions: StudySession[];
  memoryDrills: MemoryDrillRecord[];
  lastMinuteSheets: LastMinuteRevisionSheet[];
  settings: UserSettings;
}
