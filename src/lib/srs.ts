import type { Flashcard, ReviewRating } from '../types.ts';

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatIsoDate(dt);
}

export interface SrsScheduleUpdate {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  nextReviewDate: string;
  lastRating: ReviewRating;
  lapseCount: number;
  humanLabel: string;
}

/**
 * Adaptive spaced repetition matching student-requested intervals:
 * - Again -> Same day (0 days, resets repetitions, increments lapses)
 * - Difficult -> Next day (1 day)
 * - Good -> 3 days -> 7 days -> 14 days -> scaled by easeFactor
 * - Easy -> 7 days -> 14 days -> 30 days -> scaled
 */
export function computeNextReview(
  card: Pick<Flashcard, 'intervalDays' | 'easeFactor' | 'repetitions' | 'lapseCount'>,
  rating: ReviewRating,
  todayIso: string = formatIsoDate(new Date())
): SrsScheduleUpdate {
  let easeFactor = card.easeFactor || 2.5;
  let repetitions = card.repetitions || 0;
  let lapseCount = card.lapseCount || 0;
  let intervalDays = 0;
  let humanLabel = 'Same day';

  if (rating === 'Again') {
    intervalDays = 0;
    repetitions = 0;
    lapseCount += 1;
    easeFactor = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)));
    humanLabel = 'Same day';
  } else if (rating === 'Difficult') {
    intervalDays = 1;
    repetitions = Math.max(1, repetitions);
    easeFactor = Math.max(1.3, Number((easeFactor - 0.1).toFixed(2)));
    humanLabel = 'Next day (1d)';
  } else if (rating === 'Good') {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 3;
    } else if (repetitions === 2) {
      intervalDays = 7;
    } else if (repetitions === 3) {
      intervalDays = 14;
    } else {
      intervalDays = Math.min(60, Math.round(Math.max(14, card.intervalDays) * easeFactor));
    }
    humanLabel = `After ${intervalDays} days`;
  } else {
    // Easy
    repetitions += 1;
    easeFactor = Math.min(3.0, Number((easeFactor + 0.15).toFixed(2)));
    if (repetitions === 1) {
      intervalDays = 7;
    } else if (repetitions === 2) {
      intervalDays = 14;
    } else {
      intervalDays = Math.min(90, Math.round(Math.max(14, card.intervalDays) * (easeFactor + 0.2)));
    }
    humanLabel = `After ${intervalDays} days`;
  }

  return {
    intervalDays,
    easeFactor,
    repetitions,
    nextReviewDate: addDaysToIsoDate(todayIso, intervalDays),
    lastRating: rating,
    lapseCount,
    humanLabel,
  };
}

export function isCardDueToday(card: Flashcard, todayIso: string = formatIsoDate(new Date())): boolean {
  return card.nextReviewDate <= todayIso;
}

export function getDueFlashcards(cards: Flashcard[], todayIso: string = formatIsoDate(new Date())): Flashcard[] {
  return cards
    .filter((c) => isCardDueToday(c, todayIso))
    .sort((a, b) => {
      if (a.nextReviewDate !== b.nextReviewDate) {
        return a.nextReviewDate.localeCompare(b.nextReviewDate);
      }
      return b.lapseCount - a.lapseCount;
    });
}
