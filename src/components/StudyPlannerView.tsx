import React, { useState } from 'react';
import { CalendarClock, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type { AcademicYear, AstraAppState, StudyPlanConfig, StudySession, SubjectId } from '../types';
import { ACADEMIC_YEARS, SUBJECTS } from '../data/pucSyllabus';
import { formatAcademicYear } from '../lib/conceptConnections';
import { formatIsoDate } from '../lib/srs';

interface StudyPlannerViewProps {
  state: AstraAppState;
  onGeneratePlan: (config: StudyPlanConfig) => Promise<void>;
  onSaveSessions: (sessions: StudySession[]) => Promise<void>;
  onToggleSession: (id: string, completed: boolean) => Promise<void>;
}

export const StudyPlannerView: React.FC<StudyPlannerViewProps> = ({
  state,
  onGeneratePlan,
  onSaveSessions,
  onToggleSession,
}) => {
  const [config, setConfig] = useState<StudyPlanConfig>(state.studyPlanConfig);
  const [selectedDate, setSelectedDate] = useState<string>(formatIsoDate(new Date()));
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('7:30 PM');
  const [newDuration, setNewDuration] = useState(45);
  const [newYear, setNewYear] = useState<AcademicYear>(state.settings.activeAcademicYear ?? 'PUC_1');
  const [newSubject, setNewSubject] = useState<SubjectId>('physics');
  const [newType, setNewType] = useState<StudySession['sessionType']>('study');
  const [saving, setSaving] = useState(false);

  const enabledSet = new Set(
    state.settings.enabledSubjects ??
      (state.settings.includeBiology
        ? ['physics', 'chemistry', 'mathematics', 'biology']
        : ['physics', 'chemistry', 'mathematics'])
  );
  const visibleSubjects = SUBJECTS.filter((s) => enabledSet.has(s.id));

  const availableDates = Array.from(new Set(state.studySessions.map((s) => s.date))).sort();
  const activeDate = availableDates.includes(selectedDate) ? selectedDate : availableDates[0] ?? selectedDate;
  const daySessions = state.studySessions.filter((s) => s.date === activeDate);

  const toggleWeakSubject = (id: SubjectId) => {
    setConfig((prev) => ({
      ...prev,
      weakSubjects: prev.weakSubjects.includes(id)
        ? prev.weakSubjects.filter((s) => s !== id)
        : [...prev.weakSubjects, id],
    }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onGeneratePlan(config);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const added: StudySession = {
      id: `manual-${Date.now()}`,
      date: activeDate,
      startTime: newTime,
      durationMinutes: Math.max(10, Math.min(180, newDuration)),
      academic_year: newType === 'break' ? undefined : newYear,
      subjectId: newType === 'break' ? 'break' : newSubject,
      title: newTitle.trim(),
      sessionType: newType,
      completed: false,
    };
    await onSaveSessions([...state.studySessions, added]);
    setNewTitle('');
  };

  const handleDeleteSession = async (id: string) => {
    await onSaveSessions(state.studySessions.filter((s) => s.id !== id));
  };

  const completedTotal = state.studySessions.filter((s) => s.completed && s.sessionType !== 'break').length;
  const plannedTotal = state.studySessions.filter((s) => s.sessionType !== 'break').length;

  return (
    <div className="space-y-6">
      {/* Configuration Form */}
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
              AI Study Planner
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Builds a balanced 7-day schedule across your 1st &amp; 2nd PUC chapters with breaks, revision slots, KCET MCQs, and backlog catch-up.
            </p>
          </div>
          <div className="font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
            Weekly Progress: <strong>{completedTotal}/{plannedTotal}</strong> sessions
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="board-date" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                2nd PUC Board Exam Date
              </label>
              <input
                id="board-date"
                type="date"
                value={config.boardExamDate}
                onChange={(e) => setConfig({ ...config, boardExamDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div>
              <label htmlFor="kcet-date" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                KCET Exam Date
              </label>
              <input
                id="kcet-date"
                type="date"
                value={config.kcetExamDate}
                onChange={(e) => setConfig({ ...config, kcetExamDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div>
              <label htmlFor="daily-hours" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Daily Study Hours ({config.dailyHours}h / day max 8h)
              </label>
              <input
                id="daily-hours"
                type="range"
                min={1}
                max={8}
                step={0.5}
                value={config.dailyHours}
                onChange={(e) => setConfig({ ...config, dailyHours: Number(e.target.value) })}
                className="w-full accent-cyan-600 mt-2"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={config.includeBacklog}
                  onChange={(e) => setConfig({ ...config, includeBacklog: e.target.checked })}
                  className="w-4 h-4 rounded accent-cyan-600"
                />
                <span>Include Backlog Slots</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Weak Subjects:</span>
              {visibleSubjects.map((s) => {
                const active = config.weakSubjects.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleWeakSubject(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                        : 'bg-slate-50 dark:bg-[#131D33] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={saving || state.chapters.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium whitespace-nowrap"
            >
              <CalendarClock className="w-4 h-4" />
              <span>{saving ? 'Generating...' : 'Regenerate Weekly Timetable'}</span>
            </button>
          </div>
          {state.chapters.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add or import 1st/2nd PUC chapters in Subjects &amp; Chapters to auto-generate a 7-day plan, or add custom study blocks below.
            </p>
          )}
        </form>
      </section>

      {/* Weekly Day Tabs + Manual Timetable Editor */}
      <section className="rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800/80 p-6 space-y-5">
        {availableDates.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {availableDates.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`px-3.5 py-2 rounded-lg text-xs font-mono whitespace-nowrap shrink-0 transition-colors ${
                  activeDate === date
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 dark:bg-[#131D33] text-slate-700 dark:text-slate-300'
                }`}
              >
                {date}
              </button>
            ))}
          </div>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-800/70">
          {daySessions.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              No sessions scheduled for {activeDate}. Add a custom block below or generate a weekly timetable after adding chapters.
            </p>
          ) : (
            daySessions.map((sess) => (
              <div key={sess.id} className="py-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onToggleSession(sess.id, !sess.completed)}
                  className="flex items-center gap-3 text-left min-w-0 flex-1"
                >
                  <CheckCircle2
                    className={`w-5 h-5 shrink-0 ${
                      sess.completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-medium truncate ${
                        sess.completed
                          ? 'line-through text-slate-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {sess.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {sess.startTime} · {sess.durationMinutes} min · {sess.sessionType} ·{' '}
                      {sess.academic_year ? `${formatAcademicYear(sess.academic_year)} · ` : ''}
                      {sess.subjectId.toUpperCase()}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSession(sess.id)}
                  aria-label={`Remove ${sess.title}`}
                  className="p-1.5 text-slate-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Manual Session Addition */}
        <form
          onSubmit={handleAddSession}
          className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add custom session (e.g., Solve 30 Laws of Motion MCQs)"
            aria-label="Custom session title"
            className="sm:col-span-4 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
          />
          <input
            type="text"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            aria-label="Start time"
            className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
          />
          <select
            aria-label="Session academic year"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value as AcademicYear)}
            className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
          >
            {ACADEMIC_YEARS.map((y) => (
              <option key={y.id} value={y.id}>
                {y.shortLabel}
              </option>
            ))}
          </select>
          <select
            aria-label="Session subject"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value as SubjectId)}
            className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-sm"
          >
            {visibleSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Session type"
            value={newType}
            onChange={(e) => setNewType(e.target.value as StudySession['sessionType'])}
            className="sm:col-span-1 px-2 py-2 rounded-lg bg-slate-50 dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 text-xs"
          >
            <option value="study">Study</option>
            <option value="revision">Revision</option>
            <option value="kcet-practice">KCET</option>
            <option value="backlog">Backlog</option>
            <option value="break">Break</option>
          </select>
          <button
            type="submit"
            aria-label="Add custom session"
            className="sm:col-span-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </section>
    </div>
  );
};
