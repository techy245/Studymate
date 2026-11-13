import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import {
  deletePdfBinary,
  loadState,
  mutateState,
  readPdfBinary,
  recordStudyActivity,
  savePdfBinary,
} from './src/server/storage.ts';
import { extractPdfPages } from './src/server/pdfExtractor.ts';
import {
  analyzePdfWithGemini,
  askTutorWithGemini,
  GeminiServiceError,
  generateLastMinuteSheetWithGemini,
  generateMcqsWithGemini,
  generateSimilarDoubtQuestionWithGemini,
} from './src/server/geminiService.ts';
import { computeNextReview, formatIsoDate } from './src/lib/srs.ts';
import { generateWeeklyStudyPlan } from './src/lib/studyPlanner.ts';
import { buildSyllabusChapters, createCleanAppState } from './src/data/pucSyllabus.ts';
import { findConceptConnectionsForChapter } from './src/lib/conceptConnections.ts';
import type {
  AcademicYear,
  Chapter,
  DifficultyLevel,
  DoubtItem,
  Flashcard,
  FormulaEntry,
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
} from './src/types.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

function sendApiError(res: express.Response, err: unknown) {
  if (err instanceof GeminiServiceError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  const message = err instanceof Error ? err.message : 'Unexpected server error';
  res.status(500).json({ error: message, code: 'SERVER_ERROR' });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  await loadState();

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
      storageMode: 'local-persistent-json',
    });
  });

  app.get('/api/state', async (_req, res) => {
    try {
      const state = await loadState();
      res.json(state);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Settings & Stream Configuration
  app.patch('/api/settings', async (req, res) => {
    try {
      const patch = req.body as Partial<UserSettings>;
      const updated = await mutateState((state) => {
        const nextSettings: UserSettings = { ...state.settings, ...patch };
        if (patch.enabledSubjects) {
          nextSettings.includeBiology = patch.enabledSubjects.includes('biology');
        } else if (patch.includeBiology !== undefined) {
          const currentSet = new Set(state.settings.enabledSubjects ?? ['physics', 'chemistry', 'mathematics']);
          if (patch.includeBiology) currentSet.add('biology');
          else currentSet.delete('biology');
          nextSettings.enabledSubjects = Array.from(currentSet);
        }
        state.settings = nextSettings;
      });
      res.json(updated.settings);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Explicit user-triggered Fresh Start reset (preserves binary PDFs if requested)
  app.post('/api/workspace/reset', async (req, res) => {
    try {
      const { preservePdfs = false } = (req.body ?? {}) as { preservePdfs?: boolean };
      const current = await loadState();
      if (!preservePdfs) {
        for (const pdf of current.pdfs) {
          await deletePdfBinary(pdf.id);
        }
      }
      const clean = createCleanAppState();
      clean.settings.theme = current.settings.theme;
      clean.settings.enabledSubjects = current.settings.enabledSubjects;
      clean.settings.includeBiology = current.settings.includeBiology;
      if (preservePdfs) {
        clean.pdfs = current.pdfs;
      }
      const saved = await mutateState(() => clean);
      res.json(saved);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Chapters CRUD & Karnataka PUC Syllabus Import
  app.post('/api/chapters', async (req, res) => {
    try {
      const { academic_year = 'PUC_1', subjectId, title } = req.body as {
        academic_year?: AcademicYear;
        subjectId: SubjectId;
        title: string;
      };
      if (!title?.trim()) {
        res.status(400).json({ error: 'Chapter title is required.' });
        return;
      }
      let created: Chapter | null = null;
      await mutateState((state) => {
        const subjectChapters = state.chapters.filter(
          (c) => c.academic_year === academic_year && c.subjectId === subjectId
        );
        const nextOrder = subjectChapters.length + 1;
        const prefix = academic_year === 'PUC_1' ? 'puc1' : 'puc2';
        created = {
          id: `${prefix}-${subjectId}-${Date.now()}`,
          academic_year,
          subjectId,
          order: nextOrder,
          title: title.trim(),
          status: 'Not Started',
          progressPercent: 0,
          confidence: 3,
          personalNotes: '',
        };
        state.chapters.push(created);
        state.settings.lastOpenedChapterId = created.id;
      });
      res.status(201).json(created);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.post('/api/chapters/import-syllabus', async (req, res) => {
    try {
      const { academic_year, subjectIds } = req.body as {
        academic_year: AcademicYear | 'BOTH';
        subjectIds?: SubjectId[];
      };

      const yearsToImport: AcademicYear[] =
        academic_year === 'BOTH' ? ['PUC_1', 'PUC_2'] : [academic_year || 'PUC_1'];

      let addedCount = 0;
      const updated = await mutateState((state) => {
        const subjectsToImport =
          subjectIds && subjectIds.length > 0 ? subjectIds : state.settings.enabledSubjects;

        for (const yr of yearsToImport) {
          const newChapters = buildSyllabusChapters(yr, subjectsToImport, state.chapters);
          state.chapters.push(...newChapters);
          addedCount += newChapters.length;
        }
        if (!state.settings.lastOpenedChapterId && state.chapters[0]) {
          state.settings.lastOpenedChapterId = state.chapters[0].id;
        }
      });

      res.status(201).json({ addedCount, chapters: updated.chapters });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.patch('/api/chapters/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const patch = req.body as Partial<Chapter>;
      let updatedChapter: Chapter | null = null;
      await mutateState((state) => {
        const idx = state.chapters.findIndex((c) => c.id === id);
        if (idx !== -1) {
          const next = {
            ...state.chapters[idx],
            ...patch,
            lastStudiedAt: new Date().toISOString(),
          };
          if (patch.status === 'Completed' && patch.progressPercent === undefined) {
            next.progressPercent = 100;
          } else if (patch.status === 'Not Started' && patch.progressPercent === undefined) {
            next.progressPercent = 0;
          }
          state.chapters[idx] = next;
          updatedChapter = next;
          state.settings.lastOpenedChapterId = id;
        }
      });
      if (!updatedChapter) {
        res.status(404).json({ error: 'Chapter not found' });
        return;
      }
      res.json(updatedChapter);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.post('/api/chapters/reorder', async (req, res) => {
    try {
      const { academic_year, subjectId, orderedIds } = req.body as {
        academic_year?: AcademicYear;
        subjectId: SubjectId;
        orderedIds: string[];
      };
      const state = await mutateState((s) => {
        const orderMap = new Map(orderedIds.map((id, idx) => [id, idx + 1]));
        s.chapters = s.chapters.map((c) =>
          c.subjectId === subjectId &&
          (!academic_year || c.academic_year === academic_year) &&
          orderMap.has(c.id)
            ? { ...c, order: orderMap.get(c.id)! }
            : c
        );
      });
      res.json(
        state.chapters
          .filter(
            (c) =>
              c.subjectId === subjectId && (!academic_year || c.academic_year === academic_year)
          )
          .sort((a, b) => a.order - b.order)
      );
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.delete('/api/chapters/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await mutateState((state) => {
        state.chapters = state.chapters.filter((c) => c.id !== id);
        if (state.settings.lastOpenedChapterId === id) {
          state.settings.lastOpenedChapterId = state.chapters[0]?.id ?? null;
        }
      });
      res.json({ ok: true });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // PDF Upload + Real Page-by-Page Text Extraction (strictly isolated per academic_year/subject/chapter)
  app.post('/api/pdfs/upload', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Please select a PDF file to upload.' });
        return;
      }
      const isPdf =
        file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        res.status(400).json({ error: 'Only PDF files (.pdf) are supported.' });
        return;
      }

      const academic_year = ((req.body.academic_year as AcademicYear) || 'PUC_1');
      const subjectId = (req.body.subjectId as SubjectId) || 'physics';
      let chapterId = (req.body.chapterId as string) || '';
      const docType = (req.body.docType as PdfDocType) || 'Chapter PDF';
      const pdfId = `pdf-${Date.now()}`;

      const stateBefore = await loadState();
      if (!chapterId) {
        // Auto-create a chapter from the PDF filename if user uploads directly into an empty subject
        const cleanTitle = file.originalname.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
        const existingMatch = stateBefore.chapters.find(
          (c) =>
            c.academic_year === academic_year &&
            c.subjectId === subjectId &&
            c.title.toLowerCase() === cleanTitle.toLowerCase()
        );
        if (existingMatch) {
          chapterId = existingMatch.id;
        } else {
          const prefix = academic_year === 'PUC_1' ? 'puc1' : 'puc2';
          const newChId = `${prefix}-${subjectId}-${Date.now()}`;
          const nextOrder =
            stateBefore.chapters.filter(
              (c) => c.academic_year === academic_year && c.subjectId === subjectId
            ).length + 1;
          await mutateState((s) => {
            s.chapters.push({
              id: newChId,
              academic_year,
              subjectId,
              order: nextOrder,
              title: cleanTitle || 'Uploaded Chapter Notes',
              status: 'Learning',
              progressPercent: 10,
              confidence: 3,
              personalNotes: '',
              lastStudiedAt: new Date().toISOString(),
            });
          });
          chapterId = newChId;
        }
      }

      await savePdfBinary(pdfId, file.buffer);
      const extracted = await extractPdfPages(pdfId, file.buffer);

      const uploadedPdf: UploadedPdf = {
        id: pdfId,
        fileName: file.originalname,
        academic_year,
        subjectId,
        chapterId,
        docType,
        uploadedAt: new Date().toISOString(),
        totalPages: extracted.totalPages,
        fileSizeBytes: file.size,
        extractionStatus: extracted.extractionStatus,
        extractionMessage: extracted.extractionMessage,
        pages: extracted.pages,
        chunks: extracted.chunks,
      };

      await mutateState((state) => {
        state.pdfs.unshift(uploadedPdf);
        state.settings.lastOpenedChapterId = chapterId;
        state.settings.activeAcademicYear = academic_year;
      });

      res.status(201).json(uploadedPdf);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.get('/api/pdfs/:id/file', async (req, res) => {
    try {
      const buf = await readPdfBinary(req.params.id);
      if (!buf) {
        res.status(404).json({ error: 'PDF binary not found' });
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.send(buf);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.delete('/api/pdfs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await deletePdfBinary(id);
      await mutateState((state) => {
        state.pdfs = state.pdfs.filter((p) => p.id !== id);
      });
      res.json({ ok: true });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // AI PDF Analyser (Gemini)
  app.post('/api/pdfs/:id/analyze', async (req, res) => {
    try {
      const { id } = req.params;
      const state = await loadState();
      const pdf = state.pdfs.find((p) => p.id === id);
      if (!pdf) {
        res.status(404).json({ error: 'Uploaded PDF not found.' });
        return;
      }
      const chapter = state.chapters.find((c) => c.id === pdf.chapterId);
      const bufferForOcr =
        pdf.extractionStatus === 'empty-or-scanned' ? await readPdfBinary(pdf.id) : null;

      const analysis = await analyzePdfWithGemini({
        pdfName: pdf.fileName,
        academicYear: pdf.academic_year,
        subjectId: pdf.subjectId,
        chapterTitle: chapter?.title ?? pdf.fileName.replace(/\.pdf$/i, ''),
        docType: pdf.docType,
        chunks: pdf.chunks,
        pdfBufferForOcr: bufferForOcr,
      });

      await mutateState((s) => {
        const target = s.pdfs.find((p) => p.id === id);
        if (target) {
          target.analysis = analysis;
        }
        recordStudyActivity(s, 10);
      });

      res.json(analysis);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.patch('/api/pdfs/:id/analysis', async (req, res) => {
    try {
      const { id } = req.params;
      const nextAnalysis = req.body as PdfAnalysisResult;
      await mutateState((state) => {
        const target = state.pdfs.find((p) => p.id === id);
        if (target) {
          target.analysis = nextAnalysis;
        }
      });
      res.json(nextAnalysis);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // AI Tutor
  app.post('/api/ai/tutor', async (req, res) => {
    try {
      const {
        question,
        mode,
        academic_year = 'PUC_2',
        subjectId,
        chapterId,
        pdfId,
        imageBase64,
        imageMimeType,
        didNotUnderstand,
      } = req.body as {
        question: string;
        mode: TutorMode;
        academic_year?: AcademicYear;
        subjectId: SubjectId;
        chapterId: string;
        pdfId?: string;
        imageBase64?: string;
        imageMimeType?: string;
        didNotUnderstand?: boolean;
      };

      if (!question?.trim() && !imageBase64) {
        res.status(400).json({ error: 'Please enter a question or attach an image.' });
        return;
      }

      const state = await loadState();
      const chapter = state.chapters.find((c) => c.id === chapterId);
      const resolvedYear: AcademicYear = chapter?.academic_year ?? academic_year;
      const pdf = pdfId
        ? state.pdfs.find((p) => p.id === pdfId)
        : state.pdfs.find((p) => p.chapterId === chapterId && p.academic_year === resolvedYear);

      const conns = chapter
        ? findConceptConnectionsForChapter(chapter.title, subjectId, resolvedYear, state.chapters)
        : [];
      const prerequisiteHint =
        conns.length > 0
          ? `${conns[0].prerequisiteChapterTitle} (${conns[0].prerequisiteConcepts.join(', ')})`
          : undefined;

      const userMsg: TutorMessage = {
        id: `t-user-${Date.now()}`,
        role: 'user',
        mode,
        academic_year: resolvedYear,
        subjectId,
        chapterId,
        pdfId: pdf?.id,
        content: question.trim() || 'Please solve the attached doubt image.',
        imagePreview:
          imageBase64 && imageMimeType ? `data:${imageMimeType};base64,${imageBase64}` : undefined,
        createdAt: new Date().toISOString(),
      };

      const reply = await askTutorWithGemini({
        question: userMsg.content,
        mode,
        academicYear: resolvedYear,
        subjectName: subjectId,
        chapterTitle: chapter?.title ?? `General ${resolvedYear === 'PUC_1' ? '1st PUC' : '2nd PUC'}`,
        history: state.tutorMessages,
        pdfChunks: pdf?.chunks ?? [],
        pdfName: pdf?.fileName,
        imageBase64,
        imageMimeType,
        didNotUnderstand,
        prerequisiteHint,
      });

      const assistantMsg: TutorMessage = {
        id: `t-ai-${Date.now() + 1}`,
        role: 'assistant',
        mode,
        academic_year: resolvedYear,
        subjectId,
        chapterId,
        pdfId: pdf?.id,
        content: reply.answer,
        understandingCheck: reply.understandingCheck,
        sources: reply.sources,
        createdAt: new Date().toISOString(),
      };

      await mutateState((s) => {
        s.tutorMessages.push(userMsg, assistantMsg);
        if (s.tutorMessages.length > 60) {
          s.tutorMessages = s.tutorMessages.slice(-60);
        }
        recordStudyActivity(s, 5);
        if (chapterId) s.settings.lastOpenedChapterId = chapterId;
      });

      res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.delete('/api/ai/tutor', async (_req, res) => {
    try {
      const state = await mutateState((s) => {
        s.tutorMessages = [];
      });
      res.json(state.tutorMessages);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Flashcards & Spaced Repetition
  app.post('/api/flashcards', async (req, res) => {
    try {
      const payload = req.body as Omit<
        Flashcard,
        'id' | 'intervalDays' | 'easeFactor' | 'repetitions' | 'nextReviewDate' | 'lapseCount' | 'createdAt'
      >[];
      const items = Array.isArray(payload) ? payload : [payload];
      const today = formatIsoDate(new Date());
      const state = await loadState();
      const created: Flashcard[] = items.map((item, idx) => {
        const ch = state.chapters.find((c) => c.id === item.chapterId);
        return {
          ...item,
          academic_year: item.academic_year ?? ch?.academic_year ?? state.settings.activeAcademicYear ?? 'PUC_1',
          id: `fc-${Date.now()}-${idx}`,
          intervalDays: 0,
          easeFactor: 2.5,
          repetitions: 0,
          nextReviewDate: today,
          lapseCount: 0,
          createdAt: new Date().toISOString(),
        };
      });
      await mutateState((s) => {
        s.flashcards.unshift(...created);
      });
      res.status(201).json(created);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.post('/api/flashcards/:id/review', async (req, res) => {
    try {
      const { id } = req.params;
      const { rating } = req.body as { rating: ReviewRating };
      let updatedCard: Flashcard | null = null;

      await mutateState((s) => {
        const idx = s.flashcards.findIndex((f) => f.id === id);
        if (idx !== -1) {
          const card = s.flashcards[idx];
          const schedule = computeNextReview(card, rating);
          updatedCard = {
            ...card,
            intervalDays: schedule.intervalDays,
            easeFactor: schedule.easeFactor,
            repetitions: schedule.repetitions,
            nextReviewDate: schedule.nextReviewDate,
            lastRating: schedule.lastRating,
            lapseCount: schedule.lapseCount,
          };
          s.flashcards[idx] = updatedCard;
          recordStudyActivity(s, 2);
        }
      });

      if (!updatedCard) {
        res.status(404).json({ error: 'Flashcard not found' });
        return;
      }
      res.json(updatedCard);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.delete('/api/flashcards/:id', async (req, res) => {
    try {
      await mutateState((s) => {
        s.flashcards = s.flashcards.filter((f) => f.id !== req.params.id);
      });
      res.json({ ok: true });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Formula Book
  app.post('/api/formulas', async (req, res) => {
    try {
      const incoming = req.body as Omit<FormulaEntry, 'id'> | Omit<FormulaEntry, 'id'>[];
      const list = Array.isArray(incoming) ? incoming : [incoming];
      const state = await loadState();
      const created: FormulaEntry[] = list.map((f, i) => {
        const ch = state.chapters.find((c) => c.id === f.chapterId);
        return {
          ...f,
          academic_year: f.academic_year ?? ch?.academic_year ?? state.settings.activeAcademicYear ?? 'PUC_1',
          id: `form-${Date.now()}-${i}`,
        };
      });
      await mutateState((s) => {
        s.formulas.unshift(...created);
      });
      res.status(201).json(created);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.patch('/api/formulas/:id', async (req, res) => {
    try {
      let updated: FormulaEntry | null = null;
      await mutateState((s) => {
        const idx = s.formulas.findIndex((f) => f.id === req.params.id);
        if (idx !== -1) {
          s.formulas[idx] = { ...s.formulas[idx], ...req.body };
          updated = s.formulas[idx];
        }
      });
      if (!updated) {
        res.status(404).json({ error: 'Formula not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Unified KCET Practice (1st PUC, 2nd PUC, or Combined)
  app.post('/api/kcet/generate', async (req, res) => {
    try {
      const {
        academic_year = 'COMBINED',
        subjectId = 'physics',
        chapterId = '',
        chapterTitle,
        topic,
        difficulty,
        count,
        pdfId,
        extractPyqOnly,
      } = req.body as {
        academic_year?: AcademicYear | 'COMBINED';
        subjectId: SubjectId | 'mixed';
        chapterId?: string;
        chapterTitle?: string;
        topic?: string;
        difficulty: DifficultyLevel;
        count: number;
        pdfId?: string;
        extractPyqOnly?: boolean;
      };

      const state = await loadState();
      const chapter = chapterId ? state.chapters.find((c) => c.id === chapterId) : undefined;
      const pdf = pdfId
        ? state.pdfs.find((p) => p.id === pdfId)
        : chapterId
          ? state.pdfs.find((p) => p.chapterId === chapterId)
          : undefined;

      if (extractPyqOnly && !pdf) {
        res.status(400).json({ error: 'Please select an uploaded Past Question Paper PDF first.' });
        return;
      }

      const resolvedYear: AcademicYear | 'COMBINED' = chapter?.academic_year ?? academic_year;
      const generated = await generateMcqsWithGemini({
        academicYear: resolvedYear,
        subjectId,
        chapterId: chapter?.id ?? chapterId ?? '',
        chapterTitle:
          chapter?.title ??
          chapterTitle ??
          (subjectId === 'mixed' ? 'Full KCET Mixed Syllabus' : `${subjectId} Syllabus`),
        topic: topic || '',
        difficulty: difficulty || 'Medium',
        count: Math.min(30, Math.max(1, count || 5)),
        chunks: pdf?.chunks ?? [],
        pdfName: pdf?.fileName,
        extractPyqOnly,
        allowedSubjects: state.settings.enabledSubjects,
      });

      await mutateState((s) => {
        s.questionsBank.unshift(...generated);
      });

      res.json(generated);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.post('/api/kcet/attempts', async (req, res) => {
    try {
      const attempt = req.body as QuizAttempt;
      await mutateState((s) => {
        s.quizAttempts.unshift(attempt);
        recordStudyActivity(s, Math.max(1, Math.round(attempt.timeTakenSeconds / 60)));
      });
      res.status(201).json(attempt);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Memory Lab Drill Recording
  app.post('/api/memory-drills', async (req, res) => {
    try {
      const record = req.body;
      const state = await loadState();
      const ch = state.chapters.find((c) => c.id === record.chapterId);
      await mutateState((s) => {
        s.memoryDrills.unshift({
          ...record,
          academic_year: record.academic_year ?? ch?.academic_year ?? 'PUC_2',
          id: `drill-${Date.now()}`,
          attemptedAt: new Date().toISOString(),
        });
        recordStudyActivity(s, 2);
      });
      res.status(201).json({ ok: true });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Last-Minute Revision Generator
  app.post('/api/ai/last-minute', async (req, res) => {
    try {
      const { chapterId, durationMinutes } = req.body as {
        chapterId: string;
        durationMinutes: 5 | 15 | 30;
      };
      const state = await loadState();
      const chapter = state.chapters.find((c) => c.id === chapterId);
      if (!chapter) {
        res.status(404).json({ error: 'Chapter not found' });
        return;
      }
      const pdf = state.pdfs.find(
        (p) => p.chapterId === chapterId && p.academic_year === chapter.academic_year
      );
      const sheet = await generateLastMinuteSheetWithGemini({
        academicYear: chapter.academic_year,
        subjectId: chapter.subjectId,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        durationMinutes: durationMinutes || 15,
        chunks: pdf?.chunks ?? [],
        personalNotes: chapter.personalNotes,
      });

      await mutateState((s) => {
        s.lastMinuteSheets.unshift(sheet);
        if (s.lastMinuteSheets.length > 20) s.lastMinuteSheets = s.lastMinuteSheets.slice(0, 20);
        recordStudyActivity(s, 5);
      });

      res.json(sheet);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Doubt Notebook
  app.post('/api/doubts', async (req, res) => {
    try {
      const body = req.body as Omit<DoubtItem, 'id' | 'createdAt'>;
      const state = await loadState();
      const ch = state.chapters.find((c) => c.id === body.chapterId);
      const created: DoubtItem = {
        ...body,
        academic_year: body.academic_year ?? ch?.academic_year ?? state.settings.activeAcademicYear ?? 'PUC_2',
        id: `doubt-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      await mutateState((s) => {
        s.doubts.unshift(created);
      });
      res.status(201).json(created);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.patch('/api/doubts/:id', async (req, res) => {
    try {
      let updated: DoubtItem | null = null;
      await mutateState((s) => {
        const idx = s.doubts.findIndex((d) => d.id === req.params.id);
        if (idx !== -1) {
          s.doubts[idx] = { ...s.doubts[idx], ...req.body };
          updated = s.doubts[idx];
        }
      });
      if (!updated) {
        res.status(404).json({ error: 'Doubt not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.post('/api/doubts/:id/similar', async (req, res) => {
    try {
      const state = await loadState();
      const doubt = state.doubts.find((d) => d.id === req.params.id);
      if (!doubt) {
        res.status(404).json({ error: 'Doubt not found' });
        return;
      }
      const chapter = state.chapters.find((c) => c.id === doubt.chapterId);
      const q = await generateSimilarDoubtQuestionWithGemini({
        academicYear: doubt.academic_year ?? chapter?.academic_year ?? 'PUC_2',
        subjectId: doubt.subjectId,
        chapterId: doubt.chapterId,
        chapterTitle: chapter?.title ?? doubt.chapterId,
        topic: doubt.topic,
        originalQuestion: doubt.question,
        mistakeType: doubt.mistakeType,
      });

      await mutateState((s) => {
        const d = s.doubts.find((x) => x.id === req.params.id);
        if (d) d.similarQuestion = q;
      });
      res.json(q);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.delete('/api/doubts/:id', async (req, res) => {
    try {
      await mutateState((s) => {
        s.doubts = s.doubts.filter((d) => d.id !== req.params.id);
      });
      res.json({ ok: true });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Study Planner
  app.post('/api/planner/generate', async (req, res) => {
    try {
      const config = req.body as StudyPlanConfig;
      const state = await mutateState((s) => {
        s.studyPlanConfig = config;
        s.studySessions = generateWeeklyStudyPlan(
          config,
          s.chapters,
          s.settings.includeBiology,
          undefined,
          s.settings.enabledSubjects
        );
      });
      res.json({
        studyPlanConfig: state.studyPlanConfig,
        studySessions: state.studySessions,
      });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.put('/api/planner/sessions', async (req, res) => {
    try {
      const sessions = req.body as StudySession[];
      const state = await mutateState((s) => {
        s.studySessions = sessions;
      });
      res.json(state.studySessions);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.patch('/api/planner/sessions/:id', async (req, res) => {
    try {
      let updated: StudySession | null = null;
      await mutateState((s) => {
        const idx = s.studySessions.findIndex((sess) => sess.id === req.params.id);
        if (idx !== -1) {
          const prevCompleted = s.studySessions[idx].completed;
          s.studySessions[idx] = { ...s.studySessions[idx], ...req.body };
          updated = s.studySessions[idx];
          if (!prevCompleted && updated.completed && updated.sessionType !== 'break') {
            recordStudyActivity(s, updated.durationMinutes);
          }
        }
      });
      if (!updated) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Frontend middleware or static dist
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Astra Study AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Astra Study AI server:', err);
  process.exit(1);
});
