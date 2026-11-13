import type { AcademicYear, Chapter, DoubtItem, SubjectId } from '../types.ts';

export const ACADEMIC_YEAR_LABELS: Record<AcademicYear, string> = {
  PUC_1: '1st PUC (Class 11)',
  PUC_2: '2nd PUC (Class 12)',
};

export const SHORT_YEAR_LABELS: Record<AcademicYear, string> = {
  PUC_1: '1st PUC',
  PUC_2: '2nd PUC',
};

export function formatAcademicYear(year: AcademicYear | 'COMBINED', short = true): string {
  if (year === 'COMBINED') return short ? 'Combined (1st & 2nd PUC)' : 'Combined (1st & 2nd PUC)';
  return short ? SHORT_YEAR_LABELS[year] : ACADEMIC_YEAR_LABELS[year];
}

export interface ConceptConnectionRule {
  id: string;
  subjectId: SubjectId;
  targetYear: 'PUC_2';
  targetChapterKeywords: string[];
  targetChapterLabel: string;
  prerequisiteYear: 'PUC_1';
  prerequisiteSubjectId: SubjectId;
  prerequisiteChapterKeywords: string[];
  prerequisiteChapterLabel: string;
  targetConcepts: string[];
  prerequisiteConcepts: string[];
  whyItMatters: string;
  tutorPrompt: string;
}

export interface ResolvedConceptConnection extends ConceptConnectionRule {
  targetChapterId?: string;
  targetChapterTitle: string;
  prerequisiteChapterId?: string;
  prerequisiteChapterTitle: string;
  triggerReason?: string;
}

export const CONCEPT_CONNECTION_RULES: ConceptConnectionRule[] = [
  // PHYSICS
  {
    id: 'cc-phy-electrostatics-vectors',
    subjectId: 'physics',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['electric charges', 'electrostatic potential', 'moving charges', 'magnetism'],
    targetChapterLabel: 'Electrostatics & Electromagnetism (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'physics',
    prerequisiteChapterKeywords: ['motion in a plane', 'work, energy and power', 'gravitation'],
    prerequisiteChapterLabel: 'Motion in a Plane, Work-Energy & Gravitation (1st PUC)',
    targetConcepts: ['Coulomb vector superposition', 'Electric potential energy & work done', 'Lorentz force & circular motion'],
    prerequisiteConcepts: ['Vector addition & resolution', 'Conservative forces & potential energy', 'Inverse-square central fields & centripetal force'],
    whyItMatters: 'Electrostatic potential and Gauss-law field calculations directly mirror 1st PUC gravitational potential and vector decomposition.',
    tutorPrompt: 'I am studying 2nd PUC Electrostatics / Magnetism. Please explain the 1st PUC prerequisites first: vector resolution, conservative potential energy, and inverse-square field analogies from Gravitation.',
  },
  {
    id: 'cc-phy-ac-oscillations',
    subjectId: 'physics',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['alternating current', 'electromagnetic waves', 'wave optics'],
    targetChapterLabel: 'Alternating Current, EM Waves & Wave Optics (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'physics',
    prerequisiteChapterKeywords: ['oscillations', 'waves'],
    prerequisiteChapterLabel: 'Oscillations & Waves (1st PUC)',
    targetConcepts: ['Phasors & LCR resonance', 'Huygens wavelets & interference', 'Path difference vs phase difference'],
    prerequisiteConcepts: ['Simple Harmonic Motion (SHM) & phase angle', 'Superposition of waves & standing waves', 'Wave equation y = A sin(ωt - kx)'],
    whyItMatters: 'AC phasor diagrams, resonance quality factor, and YDSE fringe width rely directly on 1st PUC SHM phase and wave superposition.',
    tutorPrompt: 'Before I dive deeper into 2nd PUC AC / Wave Optics, please review 1st PUC SHM phase angle, resonance, and wave superposition with simple examples.',
  },
  {
    id: 'cc-phy-semiconductors-thermo',
    subjectId: 'physics',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['atoms', 'nuclei', 'dual nature', 'semiconductor'],
    targetChapterLabel: 'Modern Physics & Semiconductors (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'physics',
    prerequisiteChapterKeywords: ['units and measurements', 'work, energy and power', 'kinetic theory'],
    prerequisiteChapterLabel: 'Units & Measurements, Work-Energy & Kinetic Theory (1st PUC)',
    targetConcepts: ['Bohr quantisation & binding energy', 'Photoelectric stopping potential', 'Energy bands & p-n junction'],
    prerequisiteConcepts: ['Conservation of energy & angular momentum', 'Dimensional analysis & eV conversions', 'Thermal excitation of carriers'],
    whyItMatters: 'Modern Physics numericals frequently combine 1st PUC energy/momentum conservation with atomic and nuclear transitions.',
    tutorPrompt: 'Explain the 1st PUC energy, angular momentum, and unit conversion foundations needed for 2nd PUC Modern Physics.',
  },

  // CHEMISTRY
  {
    id: 'cc-che-solutions-mole',
    subjectId: 'chemistry',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['solutions'],
    targetChapterLabel: 'Solutions (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'chemistry',
    prerequisiteChapterKeywords: ['some basic concepts of chemistry', 'thermodynamics'],
    prerequisiteChapterLabel: 'Some Basic Concepts of Chemistry (1st PUC)',
    targetConcepts: ['Raoult’s law & colligative properties', 'Van’t Hoff factor', 'Molarity-molality conversions'],
    prerequisiteConcepts: ['Mole concept & stoichiometry', 'Concentration terms (M, m, mole fraction)', 'Ideal behaviour & enthalpy of mixing'],
    whyItMatters: 'Every colligative property numerical in 2nd PUC Solutions starts by converting mass % or molarity using 1st PUC mole calculations.',
    tutorPrompt: 'I am working on 2nd PUC Solutions. Please bridge the 1st PUC mole concept, molarity, molality, and mole fraction conversions first.',
  },
  {
    id: 'cc-che-electrochem-redox',
    subjectId: 'chemistry',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['electrochemistry'],
    targetChapterLabel: 'Electrochemistry (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'chemistry',
    prerequisiteChapterKeywords: ['redox reactions', 'equilibrium', 'thermodynamics'],
    prerequisiteChapterLabel: 'Redox Reactions, Thermodynamics & Equilibrium (1st PUC)',
    targetConcepts: ['Nernst equation', 'Galvanic cell EMF & ΔG° = -nFE°', 'Electrolysis & Faraday laws'],
    prerequisiteConcepts: ['Oxidation numbers & half-reaction balancing', 'Gibbs free energy & spontaneity (ΔG)', 'Reaction quotient Q & equilibrium constant K'],
    whyItMatters: 'Finding n and Q in the Nernst equation requires balancing redox half-reactions and relating ΔG to K from 1st PUC.',
    tutorPrompt: 'Before I solve Nernst equation problems in 2nd PUC Electrochemistry, please teach me 1st PUC redox half-reaction balancing, oxidation numbers, and ΔG vs Q.',
  },
  {
    id: 'cc-che-kinetics-equil',
    subjectId: 'chemistry',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['chemical kinetics'],
    targetChapterLabel: 'Chemical Kinetics (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'chemistry',
    prerequisiteChapterKeywords: ['equilibrium', 'thermodynamics'],
    prerequisiteChapterLabel: 'Equilibrium & Thermodynamics (1st PUC)',
    targetConcepts: ['Integrated rate laws & Arrhenius equation', 'Activation energy & catalysis'],
    prerequisiteConcepts: ['Law of mass action & Kc/Kp', 'Enthalpy diagram & reaction coordinates', 'Logarithm properties'],
    whyItMatters: 'Understanding forward/reverse activation energies and rate expressions builds on 1st PUC equilibrium constants and reaction energetics.',
    tutorPrompt: 'Connect 1st PUC chemical equilibrium and enthalpy diagrams to 2nd PUC Chemical Kinetics and Arrhenius activation energy.',
  },
  {
    id: 'cc-che-organic-goc',
    subjectId: 'chemistry',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['haloalkanes', 'alcohols', 'aldehydes', 'amines', 'biomolecules'],
    targetChapterLabel: 'Organic Chemistry Reactions (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'chemistry',
    prerequisiteChapterKeywords: ['organic chemistry', 'chemical bonding', 'hydrocarbons'],
    prerequisiteChapterLabel: 'General Organic Chemistry (GOC), Bonding & Hydrocarbons (1st PUC)',
    targetConcepts: ['SN1/SN2 mechanisms', 'Nucleophilic addition & aldol condensation', 'Basicity of amines & acidity of phenols'],
    prerequisiteConcepts: ['Inductive, resonance (+M/-M) & hyperconjugation effects', 'Carbocation & carbanion stability', 'Hybridisation (sp³, sp², sp) & IUPAC nomenclature'],
    whyItMatters: 'Predicting organic products, acidity/basicity order, and reaction mechanisms in 2nd PUC depends 100% on 1st PUC GOC electronic effects.',
    tutorPrompt: 'I am struggling with 2nd PUC Organic Chemistry mechanisms and acidity/basicity orders. Please review 1st PUC GOC: inductive effect, resonance, hyperconjugation, and carbocation stability.',
  },
  {
    id: 'cc-che-coordination-bonding',
    subjectId: 'chemistry',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['coordination compounds', 'd- and f-block'],
    targetChapterLabel: 'Coordination Compounds & d/f-Block (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'chemistry',
    prerequisiteChapterKeywords: ['structure of atom', 'classification of elements', 'chemical bonding'],
    prerequisiteChapterLabel: 'Atomic Structure, Periodicity & Chemical Bonding (1st PUC)',
    targetConcepts: ['Crystal Field Theory (CFT) & magnetic moment', 'VBT hybridisation (dsp² vs sp³d²)', 'Lanthanoid contraction & variable oxidation states'],
    prerequisiteConcepts: ['Electronic configuration & d-orbital shapes', 'VSEPR & hybridisation', 'Ionisation enthalpy & atomic radii trends'],
    whyItMatters: 'Writing d-electron counts, predicting inner/outer orbital complexes, and periodic trends require 1st PUC electronic configurations and bonding.',
    tutorPrompt: 'Review 1st PUC electronic configuration, periodic trends, and VBT hybridisation so I can master 2nd PUC Coordination Compounds and d-block elements.',
  },

  // MATHEMATICS
  {
    id: 'cc-mat-relations-itf',
    subjectId: 'mathematics',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['relations and functions', 'inverse trigonometric'],
    targetChapterLabel: 'Relations, Functions & Inverse Trig (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'mathematics',
    prerequisiteChapterKeywords: ['sets', 'relations and functions', 'trigonometric functions'],
    prerequisiteChapterLabel: 'Sets, Relations & Functions, and Trigonometric Functions (1st PUC)',
    targetConcepts: ['Bijective functions & invertibility', 'Principal value branches of sin⁻¹, cos⁻¹, tan⁻¹'],
    prerequisiteConcepts: ['Domain, range & Cartesian products', 'Trigonometric identities (2θ, 3θ) & quadrant signs'],
    whyItMatters: 'Inverse trigonometric simplification and bijectivity proofs directly apply 1st PUC domain-range restrictions and trig identities.',
    tutorPrompt: 'Please review 1st PUC domain, range, and key trigonometric identities before solving 2nd PUC Relations & Inverse Trigonometric Functions.',
  },
  {
    id: 'cc-mat-calculus-limits',
    subjectId: 'mathematics',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['continuity', 'applications of derivatives', 'application of derivatives', 'integrals', 'differential equations'],
    targetChapterLabel: 'Calculus: Derivatives, Integrals & Differential Equations (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'mathematics',
    prerequisiteChapterKeywords: ['limits and derivatives', 'relations and functions', 'trigonometric functions'],
    prerequisiteChapterLabel: 'Limits & Derivatives and Functions (1st PUC)',
    targetConcepts: ['LHL/RHL continuity & chain rule', 'Maxima/minima & rate of change', 'Integration by substitution/parts & differential equations'],
    prerequisiteConcepts: ['Left-hand & right-hand limits', 'First-principle & standard derivatives', 'Basic function behaviour & trig transformations'],
    whyItMatters: 'Integrals and Applications of Derivatives break down quickly unless 1st PUC limits, standard derivatives, and trig formulas are rock solid.',
    tutorPrompt: 'I want to strengthen 2nd PUC Calculus (Derivatives / Integrals). Please walk me through the 1st PUC foundations: limits, basic derivatives, and essential trig/algebra identities.',
  },
  {
    id: 'cc-mat-3d-lines',
    subjectId: 'mathematics',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['vector algebra', 'three dimensional geometry', 'linear programming'],
    targetChapterLabel: 'Vectors, 3D Geometry & LPP (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'mathematics',
    prerequisiteChapterKeywords: ['straight lines', 'introduction to three dimensional geometry', 'linear inequalities'],
    prerequisiteChapterLabel: 'Straight Lines, Intro to 3D Geometry & Linear Inequalities (1st PUC)',
    targetConcepts: ['Line/plane equations in 3D, shortest distance', 'Feasible region & corner-point optimisation'],
    prerequisiteConcepts: ['2D slope-point lines & angle between lines', '3D octants, distance & section formula', 'Graphing linear half-planes'],
    whyItMatters: '3D geometry extends 1st PUC straight lines and 3D coordinates, while Linear Programming directly graphs 1st PUC linear inequalities.',
    tutorPrompt: 'Bridge 1st PUC Straight Lines, 3D Coordinates, and Linear Inequalities to 2nd PUC Vectors, 3D Geometry, and LPP.',
  },
  {
    id: 'cc-mat-probability',
    subjectId: 'mathematics',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['probability'],
    targetChapterLabel: 'Probability (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'mathematics',
    prerequisiteChapterKeywords: ['probability', 'permutations and combinations', 'sets'],
    prerequisiteChapterLabel: '1st PUC Probability, Permutations & Combinations, and Sets (1st PUC)',
    targetConcepts: ['Conditional probability & Bayes’ theorem', 'Random variables & probability distributions'],
    prerequisiteConcepts: ['Sample space, mutually exclusive events & addition theorem', 'Counting outcomes with nPr & nCr', 'Set operations (∪, ∩, complement)'],
    whyItMatters: 'Bayes’ theorem and conditional probability in KCET depend on counting favourable outcomes using 1st PUC P&C and set Venn logic.',
    tutorPrompt: 'Explain how 1st PUC Permutations & Combinations, Sets, and basic Probability connect to 2nd PUC Conditional Probability and Bayes’ Theorem.',
  },

  // BIOLOGY
  {
    id: 'cc-bio-genetics-cell',
    subjectId: 'biology',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['inheritance', 'molecular basis', 'reproduction'],
    targetChapterLabel: 'Reproduction & Genetics (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'biology',
    prerequisiteChapterKeywords: ['cell cycle', 'biomolecules', 'cell: the unit of life'],
    prerequisiteChapterLabel: 'Cell Cycle & Division and Biomolecules (1st PUC)',
    targetConcepts: ['Gametogenesis & linkage', 'DNA replication, transcription & translation'],
    prerequisiteConcepts: ['Mitosis vs Meiosis (crossing over in Pachytene)', 'Nucleotides, nucleic acids & enzymes'],
    whyItMatters: 'Understanding Mendel’s laws, crossing over, and DNA structure requires 1st PUC Meiosis stages and nucleic acid chemistry.',
    tutorPrompt: 'Before studying 2nd PUC Genetics / Reproduction, review 1st PUC Meiosis-I crossing over and Biomolecules (DNA/RNA nucleotides).',
  },
  {
    id: 'cc-bio-biotech-microbes',
    subjectId: 'biology',
    targetYear: 'PUC_2',
    targetChapterKeywords: ['biotechnology', 'microbes', 'human health'],
    targetChapterLabel: 'Biotechnology & Human Health (2nd PUC)',
    prerequisiteYear: 'PUC_1',
    prerequisiteSubjectId: 'biology',
    prerequisiteChapterKeywords: ['biological classification', 'cell: the unit of life', 'biomolecules'],
    prerequisiteChapterLabel: 'Biological Classification, Cell Structure & Biomolecules (1st PUC)',
    targetConcepts: ['Restriction enzymes, PCR & recombinant plasmids', 'Immunity & pathogens'],
    prerequisiteConcepts: ['Prokaryotic plasmids & bacterial cell wall', 'Protein/enzyme structure & classification of microbes'],
    whyItMatters: 'Recombinant DNA tools and pathogen life cycles build directly on 1st PUC prokaryotic cell structure and microbial taxonomy.',
    tutorPrompt: 'Review 1st PUC prokaryotic cell structure (plasmids) and microbial classification as prerequisites for 2nd PUC Biotechnology.',
  },
];

function matchesAnyKeyword(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export function findConceptConnectionsForChapter(
  chapterTitle: string,
  subjectId: SubjectId,
  academicYear: AcademicYear,
  allChapters: Chapter[] = []
): ResolvedConceptConnection[] {
  if (academicYear !== 'PUC_2') {
    return [];
  }

  const matchingRules = CONCEPT_CONNECTION_RULES.filter(
    (rule) =>
      rule.subjectId === subjectId &&
      matchesAnyKeyword(chapterTitle, rule.targetChapterKeywords)
  );

  return matchingRules.map((rule) => {
    let prereqChapter: Chapter | undefined;
    for (const kw of rule.prerequisiteChapterKeywords) {
      prereqChapter = allChapters.find(
        (ch) =>
          ch.academic_year === 'PUC_1' &&
          ch.subjectId === rule.prerequisiteSubjectId &&
          ch.title.toLowerCase().includes(kw.toLowerCase())
      );
      if (prereqChapter) break;
    }
    const targetChapter = allChapters.find(
      (ch) =>
        ch.academic_year === 'PUC_2' &&
        ch.subjectId === subjectId &&
        ch.title.toLowerCase() === chapterTitle.toLowerCase()
    );

    return {
      ...rule,
      targetChapterId: targetChapter?.id,
      targetChapterTitle: chapterTitle,
      prerequisiteChapterId: prereqChapter?.id,
      prerequisiteChapterTitle: prereqChapter?.title ?? rule.prerequisiteChapterLabel,
    };
  });
}

export function findStrugglingConceptConnections(
  weakChapters: Array<{
    chapterId: string;
    chapterTitle: string;
    subjectId: SubjectId;
    academic_year: AcademicYear;
    weaknessScore: number;
    confidence: number;
    unresolvedDoubts: number;
    accuracyPercent: number;
  }>,
  allChapters: Chapter[] = [],
  doubts: DoubtItem[] = []
): ResolvedConceptConnection[] {
  const seenRuleIds = new Set<string>();
  const resolved: ResolvedConceptConnection[] = [];

  for (const w of weakChapters) {
    if (w.academic_year !== 'PUC_2') continue;
    const isStruggling =
      w.weaknessScore >= 30 ||
      w.confidence <= 2 ||
      w.unresolvedDoubts > 0 ||
      w.accuracyPercent < 65;

    if (!isStruggling) continue;

    const conns = findConceptConnectionsForChapter(
      w.chapterTitle,
      w.subjectId,
      'PUC_2',
      allChapters
    );

    const chapterDoubtCount = doubts.filter(
      (d) => d.chapterId === w.chapterId && d.status !== 'solved'
    ).length;

    for (const c of conns) {
      if (seenRuleIds.has(c.id)) continue;
      seenRuleIds.add(c.id);
      const reasons: string[] = [];
      if (w.confidence <= 2) reasons.push(`low confidence (${w.confidence}/5)`);
      if (w.accuracyPercent < 65) reasons.push(`${w.accuracyPercent}% practice accuracy`);
      if (w.unresolvedDoubts > 0 || chapterDoubtCount > 0) {
        reasons.push(`${Math.max(w.unresolvedDoubts, chapterDoubtCount)} unresolved doubt(s)`);
      }
      if (reasons.length === 0) reasons.push('recommended prerequisite foundation');

      resolved.push({
        ...c,
        targetChapterId: w.chapterId,
        targetChapterTitle: w.chapterTitle,
        triggerReason: `${w.chapterTitle}: ${reasons.join(', ')}`,
      });
    }
  }

  return resolved;
}
