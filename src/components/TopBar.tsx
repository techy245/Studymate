import React from 'react';
import { Menu, Moon, Search, Settings2, Sun, Upload } from 'lucide-react';
import type { NavSection } from '../types';

interface TopBarProps {
  activeSection: NavSection;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenMobileMenu: () => void;
  onNavigate: (section: NavSection) => void;
  onOpenSetupGuide: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'Study Dashboard',
  subjects: 'Subjects & Chapters',
  'pdf-analyser': 'AI PDF Analyser',
  tutor: 'Astra AI Tutor',
  revision: 'Smart Revision Centre',
  'memory-lab': 'Memory Lab',
  kcet: 'KCET Practice Arena',
  weakness: 'Weakness Analyser',
  planner: 'AI Study Planner',
  'formula-book': 'Formula Book',
  'last-minute': 'Last-Minute Revision',
  doubts: 'Doubt Notebook',
  search: 'Search Everything',
  analytics: 'Progress Analytics',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  theme,
  onToggleTheme,
  onOpenMobileMenu,
  onNavigate,
  onOpenSetupGuide,
}) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-[#070B14]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white truncate">
          {SECTION_TITLES[activeSection]}
        </h1>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onNavigate('search')}
          aria-label="Search everything"
          className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap shrink-0"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span>Search</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors shrink-0"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenSetupGuide}
          aria-label="Storage and setup details"
          className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors shrink-0"
        >
          <Settings2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('pdf-analyser')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Upload PDF</span>
        </button>
      </div>
    </header>
  );
};
