import React, { useState } from 'react';
import { Database, KeyRound, Loader2, RotateCcw, Server, X } from 'lucide-react';

interface SetupGuideModalProps {
  open: boolean;
  onClose: () => void;
  geminiConfigured: boolean;
  storageMode: string;
  onResetWorkspace?: () => Promise<void>;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({
  open,
  onClose,
  geminiConfigured,
  storageMode,
  onResetWorkspace,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-modal-title"
        className="w-full max-w-xl rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="setup-modal-title" className="font-display font-semibold text-lg text-slate-900 dark:text-white">
            Backend, Persistence &amp; Workspace Controls
          </h2>
          <button
            type="button"
            onClick={() => {
              setConfirmReset(false);
              onClose();
            }}
            aria-label="Close setup details"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111A2E] space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
              <Server className="w-4 h-4 text-cyan-500" />
              <span>Local Persistent Storage Active ({storageMode})</span>
            </div>
            <p>
              All 1st PUC and 2nd PUC chapters, notes, uploaded PDFs, extracted page chunks, spaced-repetition schedules, KCET attempts, doubts, and study plans are saved persistently on the Express backend so your progress survives reloads.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111A2E] space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
              <KeyRound className="w-4 h-4 text-indigo-500" />
              <span>Gemini AI Integration ({geminiConfigured ? 'Configured on Server' : 'Needs GEMINI_API_KEY'})</span>
            </div>
            <p>
              AI calls execute exclusively on the Express backend via <code className="font-mono text-xs">/api/*</code> routes. If AI generation reports a missing key, add <code className="font-mono text-xs">GEMINI_API_KEY</code> in the environment Secrets panel.
            </p>
          </div>

          {onResetWorkspace && (
            <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2.5">
              <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                <RotateCcw className="w-4 h-4 text-amber-500" />
                <span>Fresh Start Workspace Reset</span>
              </div>
              <p className="text-xs">
                Clear all chapters, notes, flashcards, formulas, quiz attempts, doubts, and study sessions to return to a blank 1st &amp; 2nd PUC starting state.
              </p>
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-500/10"
                >
                  Reset Academic Workspace
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={async () => {
                      setResetting(true);
                      try {
                        await onResetWorkspace();
                        setConfirmReset(false);
                        onClose();
                      } finally {
                        setResetting(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium"
                  >
                    {resetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Fresh Start Reset</span>
                  </button>
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => setConfirmReset(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111A2E] space-y-2">
            <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
              <Database className="w-4 h-4 text-emerald-500" />
              <span>Optional Cloud Sync Architecture</span>
            </div>
            <p className="text-xs">
              To extend this local workspace to multi-device cloud storage later, map collections per academic year under <code className="font-mono">users/&#123;uid&#125;/chapters</code>, <code className="font-mono">pdfs</code>, <code className="font-mono">flashcards</code>, and <code className="font-mono">attempts</code>.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setConfirmReset(false);
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-cyan-600 text-white text-sm font-medium hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
