import { GoogleGenAI, Type } from '@google/genai';
import type {
  AcademicYear,
  DifficultyLevel,
  LastMinuteRevisionSheet,
  McqQuestion,
  PdfAnalysisResult,
  PdfChunk,
  SubjectId,
  TutorMessage,
  TutorMode,
} from '../types.ts';
import { formatChunksForPrompt, retrieveRelevantChunks } from '../lib/pdfChunker.ts';
import { formatAcademicYear } from '../lib/conceptConnections.ts';

const MODEL = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiServiceError(
      'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets to enable AI generation.',
      400,
      'API_KEY_MISSING'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export class GeminiServiceError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number = 500, code: string = 'GEMINI_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function handleGeminiFailure(err: unknown): never {
  if (err instanceof GeminiServiceError) throw err;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
    throw new GeminiServiceError(
      'Gemini API authentication failed. Please check your GEMINI_API_KEY in Settings > Secrets.',
      403,
      'API_KEY_INVALID'
    );
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    throw new GeminiServiceError(
      'Gemini API rate limit reached. Please wait a moment and try again.',
      429,
      'RATE_LIMITED'
    );
  }
  throw new GeminiServiceError(`Gemini AI request failed: ${msg}`, 502, 'GEMINI_UPSTREAM_ERROR');
}

export async function analyzePdfWithGemini(params: {
  pdfName: string;
  academicYear: AcademicYear;
  subjectId: SubjectId;
  chapterTitle: string;
  docType: string;
  chunks: PdfChunk[];
  pdfBufferForOcr?: Buffer | null;
}): Promise<PdfAnalysisResult> {
  const ai = getAiClient();
  const { pdfName, academicYear, subjectId, chapterTitle, docType, chunks, pdfBufferForOcr } = params;
  const yearLabel = formatAcademicYear(academicYear, false);

  const selectedChunks = retrieveRelevantChunks(
    chunks,
    `${chapterTitle} definitions formulas derivations keywords exam important`,
    16
  );

  const hasText = selectedChunks.length > 0 && selectedChunks.some((c) => c.text.length > 30);

  const systemInstruction = `You are Astra Study AI, an expert Karnataka ${yearLabel} & KCET academic analyst.
Analyze the provided uploaded document ("${pdfName}", ${docType}) strictly for:
- Academic Year: ${yearLabel}
- Subject: ${subjectId}
- Chapter: "${chapterTitle}"

STRICT GROUNDING RULES:
1. Extract information ONLY from the uploaded document content. NEVER invent formulas, definitions, derivations, or textbook statements not supported by the document.
2. Always include the exact PDF page number (integer) and short source location quote/section for every extracted item.
3. If a category (e.g., derivations or exam importance) has no clear content in the uploaded document, return an empty array or explicitly state in the groundingNote what was missing—do NOT fabricate content.
4. For mathematical expressions, use clean LaTeX wrapped in $...$ or $$...$$ where appropriate.`;

  const promptText = hasText
    ? `Analyze these extracted PDF chunks (with page numbers) and produce structured study notes across all 6 categories (Definitions, Formulas, Derivations, Keywords, Important Notes, Exam Importance):\n\n${formatChunksForPrompt(selectedChunks)}`
    : `Read the attached PDF document carefully (including handwritten or scanned text if legible) and extract structured study notes across all 6 categories with exact page numbers. If parts are illegible or missing, explicitly state that in groundingNote.`;

  const contents =
    !hasText && pdfBufferForOcr && pdfBufferForOcr.length < 18 * 1024 * 1024
      ? {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBufferForOcr.toString('base64'),
              },
            },
            { text: promptText },
          ],
        }
      : promptText;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            groundingNote: {
              type: Type.STRING,
              description: 'Summary of how the analysis was grounded in the PDF and any missing/unclear sections.',
            },
            definitions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  simpleExplanation: { type: Type.STRING },
                  textbookDefinition: { type: Type.STRING },
                  terminology: { type: Type.ARRAY, items: { type: Type.STRING } },
                  pageNumber: { type: Type.INTEGER },
                  sourceLocation: { type: Type.STRING },
                },
                required: ['term', 'simpleExplanation', 'textbookDefinition', 'terminology', 'pageNumber', 'sourceLocation'],
              },
            },
            formulas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  expression: { type: Type.STRING },
                  variables: { type: Type.STRING },
                  siUnits: { type: Type.STRING },
                  conditions: { type: Type.STRING },
                  relatedFormulas: { type: Type.STRING },
                  shortExample: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                  sourceLocation: { type: Type.STRING },
                },
                required: ['name', 'expression', 'variables', 'siUnits', 'conditions', 'relatedFormulas', 'shortExample', 'pageNumber', 'sourceLocation'],
              },
            },
            derivations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  mathematicalReasoning: { type: Type.STRING },
                  finalResult: { type: Type.STRING },
                  assumptions: { type: Type.STRING },
                  examRelevantSteps: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                  sourceLocation: { type: Type.STRING },
                },
                required: ['title', 'steps', 'mathematicalReasoning', 'finalResult', 'assumptions', 'examRelevantSteps', 'pageNumber', 'sourceLocation'],
              },
            },
            keywords: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  examUsage: { type: Type.STRING },
                  mustAppearIn: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                  sourceLocation: { type: Type.STRING },
                },
                required: ['term', 'examUsage', 'mustAppearIn', 'pageNumber', 'sourceLocation'],
              },
            },
            importantNotes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  observations: { type: Type.STRING },
                  exceptions: { type: Type.STRING },
                  frequentlyConfused: { type: Type.STRING },
                  diagramsToPractise: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                  sourceLocation: { type: Type.STRING },
                },
                required: ['title', 'summary', 'observations', 'exceptions', 'frequentlyConfused', 'diagramsToPractise', 'pageNumber', 'sourceLocation'],
              },
            },
            examImportance: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  kcetRelevance: { type: Type.STRING },
                  boardRelevance: { type: Type.STRING },
                  frequencyNote: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                  sourceLocation: { type: Type.STRING },
                },
                required: ['topic', 'kcetRelevance', 'boardRelevance', 'frequencyNote', 'pageNumber', 'sourceLocation'],
              },
            },
          },
          required: [
            'groundingNote',
            'definitions',
            'formulas',
            'derivations',
            'keywords',
            'importantNotes',
            'examImportance',
          ],
        },
      },
    });

    const raw = JSON.parse((response.text ?? '{}').trim()) as Omit<PdfAnalysisResult, 'analyzedAt'>;
    const tag = <T extends object>(arr: T[] | undefined, prefix: string) =>
      (arr ?? []).map((item, idx) => ({
        ...item,
        id: `${prefix}-${Date.now()}-${idx}`,
        bookmarked: false,
      }));

    return {
      analyzedAt: new Date().toISOString(),
      groundingNote: raw.groundingNote || `Grounded in ${pdfName} (${yearLabel})`,
      definitions: tag(raw.definitions, 'def'),
      formulas: tag(raw.formulas, 'form'),
      derivations: tag(raw.derivations, 'der'),
      keywords: tag(raw.keywords, 'kw'),
      importantNotes: tag(raw.importantNotes, 'note'),
      examImportance: tag(raw.examImportance, 'imp'),
    };
  } catch (err) {
    handleGeminiFailure(err);
  }
}

const MODE_INSTRUCTIONS: Record<TutorMode, string> = {
  simple:
    'SIMPLE EXPLANATION MODE: Explain the concept as if teaching a PUC student encountering it for the very first time. Avoid jargon without defining it first. Build from intuition.',
  deep:
    'DEEP UNDERSTANDING MODE: Explain the underlying physical, chemical, or mathematical reasoning and first principles behind why the concept works.',
  example:
    'EXAMPLE-BASED LEARNING MODE: Teach using relatable everyday Indian student analogies and concrete worked numerical/conceptual examples.',
  'step-by-step':
    'STEP-BY-STEP SOLVING MODE: Solve the problem step by step: Given data with SI units -> Formula used -> Substitution -> Algebraic steps -> Final answer with units and sanity check.',
  'exam-answer':
    'EXAM ANSWER MODE (Karnataka PUC Board): Format the answer exactly how a board topper writes it for 2/3/5 marks—clear headings, mandatory keywords, neatly stated laws/formulas, and diagram cues.',
  'doubt-solving':
    'DOUBT SOLVING MODE: Diagnose where the student might be stuck, clarify misconceptions directly from the context/image, and give a crisp resolution.',
  compare:
    'COMPARE CONCEPTS MODE: Contrast the confusing concepts side by side using a clean Markdown comparison table covering definition, formula, units, conditions, and typical exam traps.',
};

export async function askTutorWithGemini(params: {
  question: string;
  mode: TutorMode;
  academicYear: AcademicYear;
  subjectName: string;
  chapterTitle: string;
  history: TutorMessage[];
  pdfChunks: PdfChunk[];
  pdfName?: string;
  imageBase64?: string;
  imageMimeType?: string;
  didNotUnderstand?: boolean;
  prerequisiteHint?: string;
}): Promise<{ answer: string; understandingCheck: string; sources: string[] }> {
  const ai = getAiClient();
  const {
    question,
    mode,
    academicYear,
    subjectName,
    chapterTitle,
    history,
    pdfChunks,
    pdfName,
    imageBase64,
    imageMimeType,
    didNotUnderstand,
    prerequisiteHint,
  } = params;

  const yearLabel = formatAcademicYear(academicYear, false);
  const relevantChunks =
    pdfChunks.length > 0 ? retrieveRelevantChunks(pdfChunks, question, 6) : [];
  const sources = relevantChunks.map((c) => `${pdfName || 'PDF'} · Page ${c.pageNumber}`);

  const recentHistory = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n');

  const systemInstruction = `You are Astra AI Tutor, a patient, rigorous personal tutor for Karnataka ${yearLabel} and KCET students.
Academic Year: ${yearLabel} | Current Subject: ${subjectName} | Current Chapter: ${chapterTitle}
${MODE_INSTRUCTIONS[mode]}

PEDAGOGICAL RULES:
1. Never assume the student already knows foundational prerequisites—especially when teaching a 2nd PUC topic, explicitly bridge relevant 1st PUC foundations when needed.${prerequisiteHint ? `\n   RELEVANT 1ST PUC CONCEPT CONNECTION: ${prerequisiteHint}` : ''}
2. ${didNotUnderstand ? 'CRITICAL: The student clicked "I don\'t understand". Do NOT repeat your previous explanation! Use a completely different analogy, visual intuition, or simpler breakdown.' : 'Be clear, structured, and encouraging without fluff.'}
3. Use $...$ for inline math and $$...$$ for display equations.
4. If uploaded PDF excerpts are provided below, ground factual claims in them and cite [Page X]. If a detail is not in the PDF, clearly state that before providing standard ${yearLabel} syllabus explanation.
5. ALWAYS end with exactly one short "understandingCheck" question to test if the student grasped the core idea.

Return JSON with keys "answer" (Markdown string) and "understandingCheck" (one short question string).`;

  const userPrompt = [
    recentHistory ? `Recent conversation:\n${recentHistory}\n` : '',
    relevantChunks.length > 0
      ? `Uploaded PDF Context (${pdfName}):\n${formatChunksForPrompt(relevantChunks)}\n`
      : '',
    `Student Question: ${question}`,
  ]
    .filter(Boolean)
    .join('\n---\n');

  const contents =
    imageBase64 && imageMimeType
      ? {
          parts: [
            { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
            { text: userPrompt },
          ],
        }
      : userPrompt;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            understandingCheck: { type: Type.STRING },
          },
          required: ['answer', 'understandingCheck'],
        },
      },
    });
    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      answer?: string;
      understandingCheck?: string;
    };
    return {
      answer: parsed.answer || 'Let us break this concept down step by step.',
      understandingCheck:
        parsed.understandingCheck || 'Can you summarize the main rule we just used in one sentence?',
      sources: Array.from(new Set(sources)),
    };
  } catch (err) {
    handleGeminiFailure(err);
  }
}

export async function generateMcqsWithGemini(params: {
  academicYear: AcademicYear | 'COMBINED';
  subjectId: SubjectId | 'mixed';
  chapterId: string;
  chapterTitle: string;
  topic: string;
  difficulty: DifficultyLevel;
  count: number;
  chunks: PdfChunk[];
  pdfName?: string;
  extractPyqOnly?: boolean;
  allowedSubjects?: SubjectId[];
}): Promise<McqQuestion[]> {
  const ai = getAiClient();
  const {
    academicYear,
    subjectId,
    chapterId,
    chapterTitle,
    topic,
    difficulty,
    count,
    chunks,
    pdfName,
    extractPyqOnly,
    allowedSubjects = ['physics', 'chemistry', 'mathematics'],
  } = params;

  const relevantChunks =
    chunks.length > 0 ? retrieveRelevantChunks(chunks, `${chapterTitle} ${topic}`, 10) : [];

  const yearLabel =
    academicYear === 'COMBINED'
      ? 'BOTH 1st PUC (Class 11) and 2nd PUC (Class 12) combined Karnataka KCET syllabus'
      : formatAcademicYear(academicYear, false);

  const fallbackYear: AcademicYear = academicYear === 'PUC_1' ? 'PUC_1' : 'PUC_2';
  const fallbackSubject: SubjectId = subjectId === 'mixed' ? allowedSubjects[0] : subjectId;

  const systemInstruction = extractPyqOnly
    ? `You are extracting real Previous Year Questions (PYQs) ONLY from the uploaded question paper PDF "${pdfName}".
CRITICAL RULE: Do NOT fabricate or invent PYQs. Only extract actual MCQs visibly present in the provided PDF chunks. If fewer than ${count} MCQs exist in the text, return only the ones actually found. Tag each MCQ with academic_year ("PUC_1" or "PUC_2") and subjectId ("physics", "chemistry", "mathematics", or "biology").`
    : `You are an official Karnataka KCET question setter covering ${yearLabel}.
Generate ${count} original, high-quality ${difficulty}-level KCET MCQs for Subject: ${subjectId === 'mixed' ? allowedSubjects.join(', ') : subjectId} — Chapter/Scope: "${chapterTitle}"${topic ? `, Topic: "${topic}"` : ''}.
${academicYear === 'COMBINED' ? 'Distribute questions naturally across both 1st PUC (PUC_1) and 2nd PUC (PUC_2) topics.' : `Every MCQ MUST belong strictly to ${yearLabel}.`}
If PDF context is provided, ground questions in those concepts.
Each MCQ must specify academic_year ("PUC_1" or "PUC_2"), subjectId, chapterName, topic, 4 distinct options, 1 correctIndex (0-3), a concise step-by-step explanation, and relatedConcept.`;

  const prompt =
    relevantChunks.length > 0
      ? `Context from ${pdfName || 'uploaded PDF'}:\n${formatChunksForPrompt(relevantChunks)}\n\nReturn up to ${count} MCQs.`
      : `Generate ${count} ${difficulty} KCET-style MCQs for ${yearLabel}, subject "${subjectId}", chapter/scope "${chapterTitle}"${topic ? `, topic "${topic}"` : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              academic_year: { type: Type.STRING },
              subjectId: { type: Type.STRING },
              chapterName: { type: Type.STRING },
              topic: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              relatedConcept: { type: Type.STRING },
            },
            required: ['topic', 'question', 'options', 'correctIndex', 'explanation', 'relatedConcept'],
          },
        },
      },
    });

    const items = JSON.parse((response.text ?? '[]').trim()) as Array<{
      academic_year?: string;
      subjectId?: string;
      chapterName?: string;
      topic: string;
      difficulty?: string;
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
      relatedConcept: string;
    }>;

    return items
      .filter((item) => Array.isArray(item.options) && item.options.length === 4)
      .map((item, idx) => {
        const resolvedYear: AcademicYear =
          academicYear !== 'COMBINED'
            ? academicYear
            : item.academic_year === 'PUC_1'
              ? 'PUC_1'
              : item.academic_year === 'PUC_2'
                ? 'PUC_2'
                : idx % 2 === 0
                  ? 'PUC_1'
                  : 'PUC_2';

        const resolvedSubj: SubjectId =
          subjectId !== 'mixed'
            ? subjectId
            : item.subjectId === 'physics' ||
                item.subjectId === 'chemistry' ||
                item.subjectId === 'mathematics' ||
                item.subjectId === 'biology'
              ? item.subjectId
              : fallbackSubject;

        return {
          id: `ai-q-${Date.now()}-${idx}`,
          academic_year: resolvedYear ?? fallbackYear,
          subjectId: resolvedSubj,
          chapterId: chapterId || `${resolvedYear}-${resolvedSubj}`,
          chapterTitle: item.chapterName || chapterTitle,
          topic: item.topic || topic || chapterTitle,
          difficulty:
            item.difficulty === 'Easy' || item.difficulty === 'Medium' || item.difficulty === 'Hard'
              ? item.difficulty
              : difficulty,
          question: item.question,
          options: [item.options[0], item.options[1], item.options[2], item.options[3]],
          correctIndex: Math.min(3, Math.max(0, item.correctIndex ?? 0)),
          explanation: item.explanation,
          relatedConcept: item.relatedConcept,
          sourceType: extractPyqOnly ? 'uploaded-pyq' : 'ai-generated',
          sourceLabel: extractPyqOnly
            ? `Extracted from ${pdfName || 'Uploaded Question Paper'}`
            : `AI-Generated KCET Practice (${formatAcademicYear(resolvedYear)})`,
        };
      });
  } catch (err) {
    handleGeminiFailure(err);
  }
}

export async function generateLastMinuteSheetWithGemini(params: {
  academicYear: AcademicYear;
  subjectId: SubjectId;
  chapterId: string;
  chapterTitle: string;
  durationMinutes: 5 | 15 | 30;
  chunks: PdfChunk[];
  personalNotes: string;
}): Promise<LastMinuteRevisionSheet> {
  const ai = getAiClient();
  const { academicYear, subjectId, chapterId, chapterTitle, durationMinutes, chunks, personalNotes } = params;
  const yearLabel = formatAcademicYear(academicYear, false);

  const relevantChunks =
    chunks.length > 0 ? retrieveRelevantChunks(chunks, `${chapterTitle} formulas definitions derivations`, 10) : [];

  const systemInstruction = `Create a Last-Minute Revision sheet tailored to a ${durationMinutes}-minute sprint for Karnataka ${yearLabel} & KCET.
Subject: ${subjectId}, Chapter: "${chapterTitle}".
Clearly separate ESSENTIAL (must-know for passing & high-weightage KCET/Board marks) from SUPPLEMENTARY (extra depth/bonus if time remains).
Also generate a quick 10-question MCQ test (clearly marked as AI-generated quick check).
Use clean LaTeX ($...$) for formulas.`;

  const prompt = [
    relevantChunks.length > 0 ? `Uploaded PDF Context:\n${formatChunksForPrompt(relevantChunks)}` : '',
    personalNotes ? `Student Notes:\n${personalNotes}` : '',
    `Build a ${durationMinutes}-minute revision sheet and 10-question quick test for "${chapterTitle}" (${yearLabel}).`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            essential: {
              type: Type.OBJECT,
              properties: {
                definitions: { type: Type.ARRAY, items: { type: Type.STRING } },
                formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
                derivations: { type: Type.ARRAY, items: { type: Type.STRING } },
                keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
                frequentlyConfused: { type: Type.ARRAY, items: { type: Type.STRING } },
                summary: { type: Type.STRING },
              },
              required: [
                'definitions',
                'formulas',
                'derivations',
                'keyConcepts',
                'keywords',
                'commonMistakes',
                'frequentlyConfused',
                'summary',
              ],
            },
            supplementary: {
              type: Type.OBJECT,
              properties: {
                extraNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                bonusTips: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['extraNotes', 'bonusTips'],
            },
            quickTest: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  relatedConcept: { type: Type.STRING },
                },
                required: ['topic', 'question', 'options', 'correctIndex', 'explanation', 'relatedConcept'],
              },
            },
          },
          required: ['essential', 'supplementary', 'quickTest'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      essential: LastMinuteRevisionSheet['essential'];
      supplementary: LastMinuteRevisionSheet['supplementary'];
      quickTest: Array<{
        topic: string;
        difficulty?: string;
        question: string;
        options: string[];
        correctIndex: number;
        explanation: string;
        relatedConcept: string;
      }>;
    };

    const quickTest: McqQuestion[] = (parsed.quickTest ?? [])
      .filter((q) => Array.isArray(q.options) && q.options.length === 4)
      .slice(0, 10)
      .map((q, idx) => ({
        id: `lmr-q-${Date.now()}-${idx}`,
        academic_year: academicYear,
        subjectId,
        chapterId,
        chapterTitle,
        topic: q.topic || chapterTitle,
        difficulty: q.difficulty === 'Hard' ? 'Hard' : q.difficulty === 'Easy' ? 'Easy' : 'Medium',
        question: q.question,
        options: [q.options[0], q.options[1], q.options[2], q.options[3]],
        correctIndex: Math.min(3, Math.max(0, q.correctIndex ?? 0)),
        explanation: q.explanation,
        relatedConcept: q.relatedConcept,
        sourceType: 'ai-generated',
        sourceLabel: `Last-Minute 10-Q Sprint (${formatAcademicYear(academicYear)})`,
      }));

    return {
      id: `lmr-${Date.now()}`,
      academic_year: academicYear,
      chapterId,
      subjectId,
      durationMinutes,
      generatedAt: new Date().toISOString(),
      essential: parsed.essential,
      supplementary: parsed.supplementary,
      quickTest,
    };
  } catch (err) {
    handleGeminiFailure(err);
  }
}

export async function generateSimilarDoubtQuestionWithGemini(params: {
  academicYear: AcademicYear;
  subjectId: SubjectId;
  chapterId: string;
  chapterTitle: string;
  topic: string;
  originalQuestion: string;
  mistakeType: string;
}): Promise<McqQuestion> {
  const ai = getAiClient();
  const { academicYear, subjectId, chapterId, chapterTitle, topic, originalQuestion, mistakeType } = params;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Original missed question (${formatAcademicYear(academicYear)} · ${subjectId} - ${chapterTitle}, Topic: ${topic}, Mistake: ${mistakeType}):\n"${originalQuestion}"\n\nGenerate ONE fresh KCET-style MCQ that tests the exact same underlying concept with new numbers or framing so the student can verify they overcame this mistake.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
            relatedConcept: { type: Type.STRING },
          },
          required: ['question', 'options', 'correctIndex', 'explanation', 'relatedConcept'],
        },
      },
    });

    const q = JSON.parse((response.text ?? '{}').trim()) as {
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
      relatedConcept: string;
    };

    const opts: [string, string, string, string] =
      Array.isArray(q.options) && q.options.length === 4
        ? [q.options[0], q.options[1], q.options[2], q.options[3]]
        : ['Option A', 'Option B', 'Option C', 'Option D'];

    return {
      id: `sim-q-${Date.now()}`,
      academic_year: academicYear,
      subjectId,
      chapterId,
      chapterTitle,
      topic,
      difficulty: 'Medium',
      question: q.question,
      options: opts,
      correctIndex: Math.min(3, Math.max(0, q.correctIndex ?? 0)),
      explanation: q.explanation,
      relatedConcept: q.relatedConcept,
      sourceType: 'ai-generated',
      sourceLabel: `Similar Practice Question (${formatAcademicYear(academicYear)})`,
    };
  } catch (err) {
    handleGeminiFailure(err);
  }
}
