import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AcademicYear, AstraAppState, NavSection, SubjectId } from './types';
import { api } from './lib/api';
import { formatIsoDate, getDueFlashcards } from './lib/srs';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { SetupGuideModal } from './components/SetupGuideModal';
import { DashboardView } from './components/DashboardView';
import { SubjectsView } from './components/SubjectsView';
import { PdfAnalyserView } from './components/PdfAnalyserView';
import { AiTutorView } from './components/AiTutorView';
import { RevisionCenterView } from './components/RevisionCenterView';
import { MemoryLabView } from './components/MemoryLabView';
import { KcetPracticeView } from './components/KcetPracticeView';
import { WeaknessAnalyserView } from './components/WeaknessAnalyserView';
import { StudyPlannerView } from './components/StudyPlannerView';
import { FormulaBookView } from './components/FormulaBookView';
import { LastMinuteRevisionView } from './components/LastMinuteRevisionView';
import { DoubtNotebookView } from './components/DoubtNotebookView';
import { SearchView } from './components/SearchView';
import { ProgressAnalyticsView } from './components/ProgressAnalyticsView';

export default function App() {
  const [state, setState] = useState<AstraAppState | null>(null);
  const [health, setHealth] = useState({ geminiConfigured: false, storageMode: 'local-persistent-json' });
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear>('PUC_1');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('physics');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedPdfId, setSelectedPdfId] = useState<string | undefined>(undefined);
  const [tutorPrefillPrompt, setTutorPrefillPrompt] = useState<string | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const loadInitial = async () => {
    setLoadError(null);
    try {
      const [appState, healthInfo] = await Promise.all([api.getState(), api.getHealth()]);
      setState(appState);
      setHealth({
        geminiConfigured: healthInfo.geminiConfigured,
        storageMode: healthInfo.storageMode,
      });
      if (appState.settings.activeAcademicYear) {
        setSelectedAcademicYear(appState.settings.activeAcademicYear);
      }
      if (appState.settings.lastOpenedChapterId) {
        const ch = appState.chapters.find((c) => c.id === appState.settings.lastOpenedChapterId);
        if (ch) {
          setSelectedAcademicYear(ch.academic_year);
          setSelectedSubject(ch.subjectId);
          setSelectedChapterId(ch.id);
        }
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to connect to Astra Study AI backend.');
    }
  };

  useEffect(() => {
    void loadInitial();
  }, []);

  // Sync Tailwind .dark class on <html>
  useEffect(() => {
    const theme = state?.settings.theme ?? 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [state?.settings.theme]);

  const navigate = (
    section: NavSection,
    context?: {
      academic_year?: AcademicYear;
      subjectId?: SubjectId;
      chapterId?: string;
      pdfId?: string;
      tutorPrompt?: string;
    }
  ) => {
    if (context?.academic_year) {
      setSelectedAcademicYear(context.academic_year);
      if (state) {
        void api.updateSettings({ activeAcademicYear: context.academic_year }).then((settings) => {
          setState((prev) => (prev ? { ...prev, settings } : prev));
        });
      }
    }
    if (context?.subjectId) setSelectedSubject(context.subjectId);
    if (context?.chapterId) {
      setSelectedChapterId(context.chapterId);
      if (state) {
        void api.updateSettings({ lastOpenedChapterId: context.chapterId }).then((settings) => {
          setState((prev) => (prev ? { ...prev, settings } : prev));
        });
      }
    }
    if (context?.pdfId !== undefined) setSelectedPdfId(context.pdfId);
    setTutorPrefillPrompt(context?.tutorPrompt);
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#070B14]">
        <div className="max-w-md w-full rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-center">
          <h1 className="font-display font-bold text-lg text-slate-900 dark:text-white">
            Astra Study AI Connection Error
          </h1>
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadInitial()}
            className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070B14]">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
          <span>Loading Astra Study AI workspace...</span>
        </div>
      </div>
    );
  }

  const today = formatIsoDate(new Date());
  const dueRevisionCount = getDueFlashcards(state.flashcards, today).length;
  const unsolvedDoubtsCount = state.doubts.filter((d) => d.status !== 'solved').length;

  const refreshState = async () => {
    const fresh = await api.getState();
    setState(fresh);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => navigate(sec)}
        dueRevisionCount={dueRevisionCount}
        unsolvedDoubtsCount={unsolvedDoubtsCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          theme={state.settings.theme}
          onToggleTheme={async () => {
            const nextTheme = state.settings.theme === 'dark' ? 'light' : 'dark';
            const settings = await api.updateSettings({ theme: nextTheme });
            setState((prev) => (prev ? { ...prev, settings } : prev));
          }}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigate={(sec) => navigate(sec)}
          onOpenSetupGuide={() => setSetupOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeSection === 'dashboard' && (
            <DashboardView
              state={state}
              onNavigate={navigate}
              onToggleSession={async (id, completed) => {
                await api.toggleStudySession(id, completed);
                await refreshState();
              }}
              onImportSyllabus={async (academic_year) => {
                const res = await api.importSyllabus(academic_year);
                await refreshState();
                return res.addedCount;
              }}
            />
          )}

          {activeSection === 'subjects' && (
            <SubjectsView
              state={state}
              selectedAcademicYear={selectedAcademicYear}
              selectedSubject={selectedSubject}
              selectedChapterId={selectedChapterId}
              onSelectAcademicYear={async (yr) => {
                setSelectedAcademicYear(yr);
                const first = state.chapters
                  .filter((c) => c.academic_year === yr && c.subjectId === selectedSubject)
                  .sort((a, b) => a.order - b.order)[0];
                setSelectedChapterId(first?.id ?? '');
                const settings = await api.updateSettings({ activeAcademicYear: yr });
                setState((prev) => (prev ? { ...prev, settings } : prev));
              }}
              onSelectSubject={(subj) => {
                setSelectedSubject(subj);
                const first = state.chapters
                  .filter((c) => c.academic_year === selectedAcademicYear && c.subjectId === subj)
                  .sort((a, b) => a.order - b.order)[0];
                setSelectedChapterId(first?.id ?? '');
              }}
              onSelectChapter={async (id) => {
                setSelectedChapterId(id);
                const settings = await api.updateSettings({ lastOpenedChapterId: id });
                setState((prev) => (prev ? { ...prev, settings } : prev));
              }}
              onToggleSubject={async (subjId, enabled) => {
                const current = new Set(
                  state.settings.enabledSubjects ?? ['physics', 'chemistry', 'mathematics']
                );
                if (enabled) {
                  current.add(subjId);
                } else {
                  if (current.size <= 1) return;
                  current.delete(subjId);
                }
                const nextEnabled = Array.from(current);
                setState((prev) =>
                  prev
                    ? {
                        ...prev,
                        settings: {
                          ...prev.settings,
                          enabledSubjects: nextEnabled,
                          includeBiology: nextEnabled.includes('biology'),
                        },
                      }
                    : prev
                );
                if (!nextEnabled.includes(selectedSubject)) {
                  setSelectedSubject(nextEnabled[0]);
                }
                const settings = await api.updateSettings({ enabledSubjects: nextEnabled });
                setState((prev) => (prev ? { ...prev, settings } : prev));
              }}
              onAddChapter={async (academic_year, subj, title) => {
                const created = await api.addChapter(academic_year, subj, title);
                await refreshState();
                setSelectedChapterId(created.id);
              }}
              onImportSyllabus={async (academic_year, subjectIds) => {
                const res = await api.importSyllabus(academic_year, subjectIds);
                await refreshState();
                return res.addedCount;
              }}
              onUpdateChapter={async (id, patch) => {
                await api.updateChapter(id, patch);
                await refreshState();
              }}
              onReorderChapters={async (academic_year, subj, orderedIds) => {
                await api.reorderChapters(academic_year, subj, orderedIds);
                await refreshState();
              }}
              onDeleteChapter={async (id) => {
                await api.deleteChapter(id);
                await refreshState();
              }}
              onNavigate={navigate}
            />
          )}

          {activeSection === 'pdf-analyser' && (
            <PdfAnalyserView
              state={state}
              initialAcademicYear={selectedAcademicYear}
              initialSubject={selectedSubject}
              initialChapterId={selectedChapterId}
              initialPdfId={selectedPdfId}
              onUploadPdf={async (file, academic_year, subj, chId, docType) => {
                const pdf = await api.uploadPdf(file, academic_year, subj, chId, docType);
                await refreshState();
                return pdf;
              }}
              onAnalyzePdf={async (pdfId) => {
                const analysis = await api.analyzePdf(pdfId);
                await refreshState();
                return analysis;
              }}
              onSaveAnalysis={async (pdfId, analysis) => {
                await api.savePdfAnalysis(pdfId, analysis);
                await refreshState();
              }}
              onDeletePdf={async (pdfId) => {
                await api.deletePdf(pdfId);
                await refreshState();
              }}
              onSaveFlashcards={async (cards) => {
                await api.createFlashcards(cards);
                await refreshState();
              }}
              onSaveFormulas={async (formulas) => {
                await api.createFormulas(formulas);
                await refreshState();
              }}
            />
          )}

          {activeSection === 'tutor' && (
            <AiTutorView
              state={state}
              initialAcademicYear={selectedAcademicYear}
              initialSubject={selectedSubject}
              initialChapterId={selectedChapterId}
              initialTutorPrompt={tutorPrefillPrompt}
              onAskTutor={async (payload) => {
                await api.askTutor(payload);
                await refreshState();
              }}
              onClearChat={async () => {
                await api.clearTutorChat();
                await refreshState();
              }}
            />
          )}

          {activeSection === 'revision' && (
            <RevisionCenterView
              state={state}
              initialAcademicYear={selectedAcademicYear}
              initialSubject={selectedSubject}
              initialChapterId={selectedChapterId}
              onReviewCard={async (cardId, rating) => {
                await api.reviewFlashcard(cardId, rating);
                await refreshState();
              }}
              onCreateFlashcards={async (cards) => {
                await api.createFlashcards(cards);
                await refreshState();
              }}
              onDeleteFlashcard={async (cardId) => {
                await api.deleteFlashcard(cardId);
                await refreshState();
              }}
            />
          )}

          {activeSection === 'memory-lab' && (
            <MemoryLabView
              state={state}
              onRecordDrill={async (payload) => {
                await api.recordMemoryDrill(payload);
                await refreshState();
              }}
            />
          )}

          {activeSection === 'kcet' && (
            <KcetPracticeView
              state={state}
              initialAcademicYear={selectedAcademicYear}
              initialSubject={selectedSubject}
              initialChapterId={selectedChapterId}
              onGenerateMcqs={async (payload) => {
                const qs = await api.generateMcqs(payload);
                await refreshState();
                return qs;
              }}
              onSaveAttempt={async (attempt) => {
                await api.saveQuizAttempt(attempt);
                await refreshState();
              }}
              onSaveToDoubtNotebook={async (doubt) => {
                await api.createDoubt(doubt);
                await refreshState();
              }}
            />
          )}

          {activeSection === 'weakness' && (
            <WeaknessAnalyserView state={state} onNavigate={navigate} />
          )}

          {activeSection === 'planner' && (
            <StudyPlannerView
              state={state}
              onGeneratePlan={async (config) => {
                await api.generateStudyPlan(config);
                await refreshState();
              }}
              onSaveSessions={async (sessions) => {
                await api.saveStudySessions(sessions);
                await refreshState();
              }}
              onToggleSession={async (id, completed) => {
                await api.toggleStudySession(id, completed);
                await refreshState();
              }}
            />
          )}

          {activeSection === 'formula-book' && (
            <FormulaBookView
              state={state}
              onCreateFormula={async (formulas) => {
                await api.createFormulas(formulas);
                await refreshState();
              }}
              onUpdateFormula={async (id, patch) => {
                await api.updateFormula(id, patch);
                await refreshState();
              }}
            />
          )}

          {activeSection === 'last-minute' && (
            <LastMinuteRevisionView
              state={state}
              initialAcademicYear={selectedAcademicYear}
              initialSubject={selectedSubject}
              initialChapterId={selectedChapterId}
              onGenerateSheet={async (chId, duration) => {
                const sheet = await api.generateLastMinuteRevision(chId, duration);
                await refreshState();
                return sheet;
              }}
            />
          )}

          {activeSection === 'doubts' && (
            <DoubtNotebookView
              state={state}
              onCreateDoubt={async (doubt) => {
                await api.createDoubt(doubt);
                await refreshState();
              }}
              onUpdateDoubt={async (id, patch) => {
                await api.updateDoubt(id, patch);
                await refreshState();
              }}
              onDeleteDoubt={async (id) => {
                await api.deleteDoubt(id);
                await refreshState();
              }}
              onGenerateSimilar={async (id) => {
                const q = await api.generateSimilarDoubtQuestion(id);
                await refreshState();
                return q;
              }}
            />
          )}

          {activeSection === 'search' && <SearchView state={state} onNavigate={navigate} />}

          {activeSection === 'analytics' && <ProgressAnalyticsView state={state} />}
        </main>
      </div>

      <SetupGuideModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        geminiConfigured={health.geminiConfigured}
        storageMode={health.storageMode}
        onResetWorkspace={async () => {
          const clean = await api.resetWorkspace(false);
          setState(clean);
          setSelectedAcademicYear('PUC_1');
          setSelectedChapterId('');
          setSelectedPdfId(undefined);
        }}
      />
    </div>
  );
}
