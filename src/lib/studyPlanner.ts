import type { Chapter, StudyPlanConfig, StudySession, SubjectId } from '../types.ts';
import { addDaysToIsoDate, formatIsoDate } from './srs.ts';

function formatMinutesAsTime(totalMinutes: number): string {
  const clamped = totalMinutes % (24 * 60);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Generates a realistic, sustainable 7-day study schedule across enabled subjects
 * and academic years with built-in short breaks, spaced revision, KCET MCQ slots,
 * and backlog management. Returns [] if no chapters exist yet.
 */
export function generateWeeklyStudyPlan(
  config: StudyPlanConfig,
  chapters: Chapter[],
  includeBiology: boolean,
  startDateIso: string = formatIsoDate(new Date()),
  enabledSubjects?: SubjectId[]
): StudySession[] {
  const allowedSubjects: SubjectId[] =
    enabledSubjects && enabledSubjects.length > 0
      ? enabledSubjects
      : includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'];

  const candidateChapters = chapters
    .filter((c) => allowedSubjects.includes(c.subjectId))
    .sort((a, b) => {
      const aWeak = config.weakSubjects.includes(a.subjectId) ? 0 : 1;
      const bWeak = config.weakSubjects.includes(b.subjectId) ? 0 : 1;
      if (aWeak !== bWeak) return aWeak - bWeak;

      const statusWeight = (s: Chapter['status']) =>
        s === 'Learning' ? 0 : s === 'Revision' ? 1 : s === 'Not Started' ? 2 : 3;
      const diff = statusWeight(a.status) - statusWeight(b.status);
      if (diff !== 0) return diff;

      return a.confidence - b.confidence;
    });

  if (candidateChapters.length === 0) {
    return [];
  }

  const safeDailyHours = Math.max(1, Math.min(8, config.dailyHours));
  const totalDailyMinutes = Math.round(safeDailyHours * 60);

  const sessions: StudySession[] = [];
  let chapterCursor = 0;

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = addDaysToIsoDate(startDateIso, dayOffset);
    let remainingMinutes = totalDailyMinutes;
    let currentClockMinutes = 17 * 60;
    if (dayOffset === 5 || dayOffset === 6) {
      currentClockMinutes = 9 * 60 + 30;
    }

    if (dayOffset === 6) {
      const reviewDuration = Math.min(45, remainingMinutes);
      sessions.push({
        id: `plan-${date}-review`,
        date,
        startTime: formatMinutesAsTime(currentClockMinutes),
        durationMinutes: reviewDuration,
        subjectId: allowedSubjects[0],
        title: 'Weekly Progress Review & Error Log Audit',
        sessionType: 'revision',
        completed: false,
      });
      currentClockMinutes += reviewDuration + 10;
      remainingMinutes -= reviewDuration;
    }

    let blockCount = 0;
    while (remainingMinutes >= 35 && blockCount < 5) {
      const chapter = candidateChapters[chapterCursor % candidateChapters.length];
      chapterCursor += 1;

      const isKcetSlot = blockCount === 1 || (dayOffset % 2 === 1 && blockCount === 2);
      const isRevisionSlot = blockCount === 2 && !isKcetSlot;
      const isBacklogSlot =
        config.includeBacklog && blockCount === 3 && chapter.status === 'Not Started';

      const blockMins = Math.min(50, remainingMinutes);
      const subjectId: SubjectId = chapter.subjectId;
      const yearTag = chapter.academic_year === 'PUC_1' ? '1st PUC' : '2nd PUC';

      let sessionType: StudySession['sessionType'] = 'study';
      let title = `Concept Mastery (${yearTag}): ${chapter.title}`;

      if (isKcetSlot) {
        sessionType = 'kcet-practice';
        title = `KCET Timed MCQs (${yearTag}): ${chapter.title}`;
      } else if (isRevisionSlot) {
        sessionType = 'revision';
        title = `Active Recall & Flashcards (${yearTag}): ${chapter.title}`;
      } else if (isBacklogSlot) {
        sessionType = 'backlog';
        title = `Backlog Catch-up (${yearTag}): ${chapter.title}`;
      }

      sessions.push({
        id: `plan-${date}-${blockCount}`,
        date,
        startTime: formatMinutesAsTime(currentClockMinutes),
        durationMinutes: blockMins,
        academic_year: chapter.academic_year,
        subjectId,
        chapterId: chapter.id,
        title,
        sessionType,
        completed: false,
      });

      currentClockMinutes += blockMins;
      remainingMinutes -= blockMins;
      blockCount += 1;

      if (remainingMinutes >= 35 && blockCount < 5) {
        sessions.push({
          id: `plan-${date}-break-${blockCount}`,
          date,
          startTime: formatMinutesAsTime(currentClockMinutes),
          durationMinutes: 10,
          subjectId: 'break',
          title: 'Short Restorative Break (Hydrate & Stretch)',
          sessionType: 'break',
          completed: false,
        });
        currentClockMinutes += 10;
      }
    }
  }

  return sessions;
}
