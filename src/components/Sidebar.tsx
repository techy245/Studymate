import React from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  CalendarClock,
  FileSearch,
  FlaskConical,
  HelpCircle,
  LayoutDashboard,
  Layers,
  Search,
  Sigma,
  X,
  Zap,
} from 'lucide-react';
import type { NavSection } from '../types';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  dueRevisionCount: number;
  unsolvedDoubtsCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavGroup {
  label: string;
  items: {
    id: NavSection;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  dueRevisionCount,
  unsolvedDoubtsCount,
  mobileOpen,
  onCloseMobile,
}) => {
  const groups: NavGroup[] = [
    {
      label: 'Study Core',
      items: [
        { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard },
        { id: 'subjects', title: 'Subjects & Chapters', icon: BookOpen },
        { id: 'pdf-analyser', title: 'AI PDF Analyser', icon: FileSearch },
        { id: 'tutor', title: 'Astra AI Tutor', icon: Bot },
      ],
    },
    {
      label: 'Memory & Revision',
      items: [
        { id: 'revision', title: 'Smart Revision', icon: Layers, count: dueRevisionCount },
        { id: 'memory-lab', title: 'Memory Lab', icon: Brain },
        { id: 'last-minute', title: 'Last-Minute Revision', icon: Zap },
        { id: 'formula-book', title: 'Formula Book', icon: Sigma },
      ],
    },
    {
      label: 'KCET & Diagnostics',
      items: [
        { id: 'kcet', title: 'KCET Practice Arena', icon: FlaskConical },
        { id: 'weakness', title: 'Weakness Analyser', icon: Activity },
        { id: 'doubts', title: 'Doubt Notebook', icon: HelpCircle, count: unsolvedDoubtsCount },
      ],
    },
    {
      label: 'Planning & Insights',
      items: [
        { id: 'planner', title: 'AI Study Planner', icon: CalendarClock },
        { id: 'analytics', title: 'Progress Analytics', icon: BarChart3 },
        { id: 'search', title: 'Search Everything', icon: Search },
      ],
    },
  ];

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800/80">
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
            A
          </div>
          <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap truncate">
            Astra Study AI
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="Main Navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNav(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : ''}`} />
                      <span className="truncate">{item.title}</span>
                    </span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="text-xs font-mono tabular-nums text-cyan-700 dark:text-cyan-300 shrink-0">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{navContent}</aside>
        </div>
      )}
    </>
  );
};
