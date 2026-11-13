import type {
  AcademicYear,
  AstraAppState,
  Chapter,
  SubjectId,
  SubjectInfo,
} from '../types.ts';
import { formatIsoDate } from '../lib/srs.ts';

export const ACADEMIC_YEARS: { id: AcademicYear; label: string; shortLabel: string; classLabel: string }[] = [
  { id: 'PUC_1', label: '1st PUC (Class 11)', shortLabel: '1st PUC', classLabel: 'Class 11' },
  { id: 'PUC_2', label: '2nd PUC (Class 12)', shortLabel: '2nd PUC', classLabel: 'Class 12' },
];

export const SUBJECTS: SubjectInfo[] = [
  { id: 'physics', name: 'Physics', code: 'PHY', accentColor: '#06B6D4' },
  { id: 'chemistry', name: 'Chemistry', code: 'CHE', accentColor: '#6366F1' },
  { id: 'mathematics', name: 'Mathematics', code: 'MAT', accentColor: '#3B82F6' },
  { id: 'biology', name: 'Biology', code: 'BIO', accentColor: '#10B981', optional: true },
];

/**
 * Verified Karnataka DPUE / KSEAB Rationalised Syllabus Chapter Lists
 * Used when the user explicitly chooses "Import Karnataka PUC Syllabus" or as
 * optional syllabus topic hints for KCET practice.
 */
export const KARNATAKA_PUC_SYLLABUS: Record<AcademicYear, Record<SubjectId, string[]>> = {
  PUC_1: {
    physics: [
      'Units and Measurements',
      'Motion in a Straight Line',
      'Motion in a Plane',
      'Laws of Motion',
      'Work, Energy and Power',
      'System of Particles and Rotational Motion',
      'Gravitation',
      'Mechanical Properties of Solids',
      'Mechanical Properties of Fluids',
      'Thermal Properties of Matter',
      'Thermodynamics',
      'Kinetic Theory',
      'Oscillations',
      'Waves',
    ],
    chemistry: [
      'Some Basic Concepts of Chemistry',
      'Structure of Atom',
      'Classification of Elements and Periodicity in Properties',
      'Chemical Bonding and Molecular Structure',
      'Thermodynamics',
      'Equilibrium',
      'Redox Reactions',
      'Organic Chemistry – Some Basic Principles and Techniques',
      'Hydrocarbons',
    ],
    mathematics: [
      'Sets',
      'Relations and Functions',
      'Trigonometric Functions',
      'Complex Numbers and Quadratic Equations',
      'Linear Inequalities',
      'Permutations and Combinations',
      'Binomial Theorem',
      'Sequences and Series',
      'Straight Lines',
      'Conic Sections',
      'Introduction to Three Dimensional Geometry',
      'Limits and Derivatives',
      'Statistics',
      'Probability',
    ],
    biology: [
      'The Living World',
      'Biological Classification',
      'Plant Kingdom',
      'Animal Kingdom',
      'Morphology of Flowering Plants',
      'Anatomy of Flowering Plants',
      'Structural Organisation in Animals',
      'Cell: The Unit of Life',
      'Biomolecules',
      'Cell Cycle and Cell Division',
      'Photosynthesis in Higher Plants',
      'Respiration in Plants',
      'Plant Growth and Development',
      'Breathing and Exchange of Gases',
      'Body Fluids and Circulation',
      'Excretory Products and Their Elimination',
      'Locomotion and Movement',
      'Neural Control and Coordination',
      'Chemical Coordination and Integration',
    ],
  },
  PUC_2: {
    physics: [
      'Electric Charges and Fields',
      'Electrostatic Potential and Capacitance',
      'Current Electricity',
      'Moving Charges and Magnetism',
      'Magnetism and Matter',
      'Electromagnetic Induction',
      'Alternating Current',
      'Electromagnetic Waves',
      'Ray Optics and Optical Instruments',
      'Wave Optics',
      'Dual Nature of Radiation and Matter',
      'Atoms',
      'Nuclei',
      'Semiconductor Electronics: Materials, Devices and Simple Circuits',
    ],
    chemistry: [
      'Solutions',
      'Electrochemistry',
      'Chemical Kinetics',
      'The d- and f-Block Elements',
      'Coordination Compounds',
      'Haloalkanes and Haloarenes',
      'Alcohols, Phenols and Ethers',
      'Aldehydes, Ketones and Carboxylic Acids',
      'Amines',
      'Biomolecules',
    ],
    mathematics: [
      'Relations and Functions',
      'Inverse Trigonometric Functions',
      'Matrices',
      'Determinants',
      'Continuity and Differentiability',
      'Applications of Derivatives',
      'Integrals',
      'Applications of Integrals',
      'Differential Equations',
      'Vector Algebra',
      'Three Dimensional Geometry',
      'Linear Programming',
      'Probability',
    ],
    biology: [
      'Sexual Reproduction in Flowering Plants',
      'Human Reproduction',
      'Reproductive Health',
      'Principles of Inheritance and Variation',
      'Molecular Basis of Inheritance',
      'Evolution',
      'Human Health and Disease',
      'Microbes in Human Welfare',
      'Biotechnology: Principles and Processes',
      'Biotechnology and its Applications',
      'Organisms and Populations',
      'Ecosystem',
      'Biodiversity and Conservation',
    ],
  },
};

export function buildSyllabusChapters(
  academicYear: AcademicYear,
  subjectIds: SubjectId[],
  existingChapters: Chapter[] = []
): Chapter[] {
  const created: Chapter[] = [];
  const prefix = academicYear === 'PUC_1' ? 'puc1' : 'puc2';

  for (const subjectId of subjectIds) {
    const existingForSubject = existingChapters.filter(
      (c) => c.academic_year === academicYear && c.subjectId === subjectId
    );
    const existingTitles = new Set(existingForSubject.map((c) => c.title.trim().toLowerCase()));
    let nextOrder = existingForSubject.length + 1;

    const templateTitles = KARNATAKA_PUC_SYLLABUS[academicYear][subjectId] ?? [];
    templateTitles.forEach((title, idx) => {
      if (existingTitles.has(title.trim().toLowerCase())) return;
      created.push({
        id: `${prefix}-${subjectId}-${idx + 1}-${Date.now().toString(36)}`,
        academic_year: academicYear,
        subjectId,
        order: nextOrder,
        title,
        status: 'Not Started',
        progressPercent: 0,
        confidence: 3,
        personalNotes: '',
      });
      nextOrder += 1;
    });
  }

  return created;
}

/**
 * Fresh-start empty workspace: zero demo/sample chapters, notes, flashcards,
 * formulas, quizzes, doubts, sessions, or fabricated progress history.
 */
export function createCleanAppState(): AstraAppState {
  const today = formatIsoDate(new Date());

  return {
    chapters: [],
    pdfs: [],
    tutorMessages: [],
    flashcards: [],
    formulas: [],
    questionsBank: [],
    quizAttempts: [],
    doubts: [],
    studyPlanConfig: {
      boardExamDate: '2027-03-01',
      kcetExamDate: '2027-04-18',
      dailyHours: 4,
      weakSubjects: ['physics', 'mathematics'],
      includeBacklog: true,
      revisionFrequencyDays: 3,
    },
    studySessions: [],
    memoryDrills: [],
    lastMinuteSheets: [],
    settings: {
      studentName: 'PUC Scholar',
      theme: 'dark',
      includeBiology: false,
      enabledSubjects: ['physics', 'chemistry', 'mathematics'],
      activeAcademicYear: 'PUC_1',
      dailyGoalMinutes: 180,
      studyMinutesToday: 0,
      streakDays: 0,
      lastStudyDate: today,
      lastOpenedChapterId: null,
      revisionHistoryDates: [],
      workspaceInitializedClean: true,
    },
  };
}

export function createInitialAppState(): AstraAppState {
  return createCleanAppState();
}
