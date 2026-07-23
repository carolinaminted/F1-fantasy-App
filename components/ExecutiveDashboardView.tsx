import React, { useState, useMemo } from 'react';
import { User, Driver, Constructor, Event } from '../types.ts';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { EyeIcon } from './icons/EyeIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';

type ProcessedUser = User;

interface ExecutiveDashboardViewProps {
  users: ProcessedUser[];
  currentUser: User | null;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
  onSelectUser: (user: ProcessedUser) => void;
}

type TabMode = 'top10' | 'rest';
type TierFilter = 'all' | 'chasers' | 'midfield' | 'backmarkers';

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  users,
  currentUser,
  allDrivers,
  allConstructors,
  events,
  onSelectUser,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('top10');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showRivalsModal, setShowRivalsModal] = useState(false);
  const [selectedRadarUser, setSelectedRadarUser] = useState<ProcessedUser | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [radarViewMode, setRadarViewMode] = useState<'cards' | 'telemetry'>('cards');
  const pageSize = 15;

  const toggleCardBreakdown = (id: string) => {
    setExpandedCardIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Split Top 10 and Rest of Pack
  const top10Users = useMemo(() => users.slice(0, 10), [users]);
  const restOfPackUsers = useMemo(() => users.slice(10), [users]);

  // Key Benchmarks
  const p1User = users[0] || null;
  const p2User = users[1] || null;
  const p3User = users[2] || null;
  const p22User = users[21] || users[users.length - 1] || null;

  const leaderUser = p1User;
  const p10User = users[9] || null;
  const leaderPoints = p1User?.totalPoints || 0;
  const p10Points = p10User?.totalPoints || 0;

  const p1Points = leaderPoints;
  const p2Points = p2User?.totalPoints || 0;
  const p3Points = p3User?.totalPoints || 0;
  const p22Points = p22User?.totalPoints || 0;
  const p22Rank = p22User?.rank || (users.length >= 22 ? 22 : users.length);

  // Helper to check if a processed user is the current logged-in user
  const isLoggedUser = (u?: ProcessedUser | null) => {
    if (!currentUser || !u) return false;
    return (
      (u.id && currentUser.id && u.id === currentUser.id) ||
      (u.email && currentUser.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (u.displayName && currentUser.displayName && u.displayName.toLowerCase() === currentUser.displayName.toLowerCase())
    );
  };

  // Resolved Active User for Battle Radar
  const activeUserForRadar = useMemo(() => {
    if (selectedRadarUser) return selectedRadarUser;
    if (!currentUser || users.length === 0) return users[0] || null;
    const match = users.find((u) => isLoggedUser(u));
    return match || users[0] || null;
  }, [currentUser, users, selectedRadarUser]);

  const activeUserIndex = useMemo(() => {
    if (!activeUserForRadar) return -1;
    return users.findIndex(
      (u) =>
        (u.id && activeUserForRadar.id && u.id === activeUserForRadar.id) ||
        (u.displayName && activeUserForRadar.displayName && u.displayName === activeUserForRadar.displayName)
    );
  }, [users, activeUserForRadar]);

  // Targets Ahead (Chasing)
  const targetsAhead = useMemo(() => {
    if (activeUserIndex <= 0) return [];
    const start = Math.max(0, activeUserIndex - 2);
    return users.slice(start, activeUserIndex);
  }, [users, activeUserIndex]);

  // Targets Behind (Defending)
  const targetsBehind = useMemo(() => {
    if (activeUserIndex < 0 || activeUserIndex >= users.length - 1) return [];
    const end = Math.min(users.length, activeUserIndex + 3);
    return users.slice(activeUserIndex + 1, end);
  }, [users, activeUserIndex]);

  // Filtered & Searched Rest of Pack
  const filteredRestUsers = useMemo(() => {
    let result = [...restOfPackUsers];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (u) =>
          u.displayName?.toLowerCase().includes(q) ||
          u.firstName?.toLowerCase().includes(q) ||
          u.lastName?.toLowerCase().includes(q) ||
          String(u.rank || 0).includes(q)
      );
    }

    if (tierFilter === 'chasers') {
      // P11 - P20
      result = result.filter((u) => {
        const r = u.rank || 0;
        return r >= 11 && r <= 20;
      });
    } else if (tierFilter === 'midfield') {
      // P21 - P30
      result = result.filter((u) => {
        const r = u.rank || 0;
        return r >= 21 && r <= 30;
      });
    } else if (tierFilter === 'backmarkers') {
      // P31+
      result = result.filter((u) => {
        const r = u.rank || 0;
        return r >= 31;
      });
    }

    return result;
  }, [restOfPackUsers, searchQuery, tierFilter]);

  // Paginated Rest of Pack
  const totalPages = Math.max(1, Math.ceil(filteredRestUsers.length / pageSize));
  const paginatedRestUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRestUsers.slice(start, start + pageSize);
  }, [filteredRestUsers, currentPage]);

  const handleTabChange = (mode: TabMode) => {
    setActiveTab(mode);
    setCurrentPage(1);
    setExpandedUserId(null);
  };

  return (
    <div className="flex flex-col md:h-full w-full max-w-7xl mx-auto space-y-4 md:space-y-6 animate-fade-in pb-24 md:pb-safe custom-scrollbar md:overflow-y-auto px-1">
      
      {/* CONTROL & ACTION BAR */}
      <div className="bg-carbon-fiber rounded-2xl p-3 md:p-4 ring-1 ring-pure-white/10 shadow-xl border border-pure-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Mode Switcher Toggle - High Priority View Toggle */}
        <div className="flex bg-carbon-black p-1 rounded-xl border border-pure-white/10 shadow-inner gap-1 w-full sm:w-auto">
          <button
            onClick={() => handleTabChange('top10')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-lg font-black text-xs sm:text-sm uppercase tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer ${
              activeTab === 'top10'
                ? 'bg-gradient-to-r from-primary-red to-red-700 text-pure-white shadow-lg shadow-primary-red/30 ring-1 ring-primary-red'
                : 'text-highlight-silver hover:text-pure-white hover:bg-pure-white/5'
            }`}
          >
            <TrophyIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 shrink-0" />
            <span>Top 10</span>
          </button>

          <button
            onClick={() => handleTabChange('rest')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-lg font-black text-xs sm:text-sm uppercase tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer ${
              activeTab === 'rest'
                ? 'bg-gradient-to-r from-primary-red to-red-700 text-pure-white shadow-lg shadow-primary-red/30 ring-1 ring-primary-red'
                : 'text-highlight-silver hover:text-pure-white hover:bg-pure-white/5'
            }`}
          >
            <CheckeredFlagIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Rest of Pack</span>
          </button>
        </div>

        {/* BATTLE RADAR LAUNCH BUTTON */}
        <button
          onClick={() => {
            setSelectedRadarUser(null);
            setShowRivalsModal(true);
          }}
          className="w-full sm:w-auto bg-gradient-to-r from-primary-red/90 via-red-600 to-amber-600 hover:from-primary-red hover:to-amber-500 text-pure-white px-4 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-primary-red/20 border border-primary-red/50 transition-all flex items-center justify-center gap-2 group shrink-0 active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <div className="bg-carbon-black/40 p-1 rounded-md border border-pure-white/20 shrink-0">
            <F1CarIcon className="w-4 h-4 text-yellow-400 group-hover:rotate-12 transition-transform" />
          </div>
          <span>My Position Radar</span>
          {activeUserForRadar && (
            <span className="bg-carbon-black/80 text-yellow-400 border border-yellow-400/40 px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0">
              P{activeUserForRadar.rank || activeUserIndex + 1}
            </span>
          )}
        </button>
      </div>

      {/* DEDICATED LEAGUE TELEMETRY STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 font-mono text-xs">
        {/* 1. PRINCIPALS */}
        <div className="bg-carbon-fiber/90 p-2.5 sm:p-3 rounded-xl border border-pure-white/10 shadow-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-pure-white/5 border border-pure-white/10 flex items-center justify-center text-highlight-silver shrink-0 font-bold text-xs">
              🏎️
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-highlight-silver/70 font-sans font-bold uppercase block">Principals</span>
              <span className="font-extrabold text-sm text-pure-white">{users.length} Active</span>
            </div>
          </div>
        </div>

        {/* 2. P1 SCORE */}
        <div className="bg-carbon-fiber/90 p-2.5 sm:p-3 rounded-xl border border-amber-500/30 shadow-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-yellow-400 shrink-0 font-black text-xs font-mono">
              P1
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-yellow-400 font-sans font-bold uppercase block truncate" title={p1User?.displayName || 'P1 Leader'}>
                P1 Score
              </span>
              <span className="font-extrabold text-sm text-pure-white">
                {p1Points.toLocaleString()} <span className="text-[10px] text-highlight-silver">PTS</span>
              </span>
            </div>
          </div>
        </div>

        {/* 3. P2 SCORE */}
        <div className="bg-carbon-fiber/90 p-2.5 sm:p-3 rounded-xl border border-slate-400/30 shadow-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-400/10 border border-slate-400/30 flex items-center justify-center text-slate-300 shrink-0 font-black text-xs font-mono">
              P2
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-slate-300 font-sans font-bold uppercase block truncate" title={p2User?.displayName || 'P2 Silver'}>
                P2 Score
              </span>
              <span className="font-extrabold text-sm text-pure-white">
                {p2Points.toLocaleString()} <span className="text-[10px] text-highlight-silver">PTS</span>
              </span>
            </div>
          </div>
        </div>

        {/* 4. P3 SCORE */}
        <div className="bg-carbon-fiber/90 p-2.5 sm:p-3 rounded-xl border border-amber-700/40 shadow-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-700/20 border border-amber-600/40 flex items-center justify-center text-amber-500 shrink-0 font-black text-xs font-mono">
              P3
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-amber-500 font-sans font-bold uppercase block truncate" title={p3User?.displayName || 'P3 Bronze'}>
                P3 Score
              </span>
              <span className="font-extrabold text-sm text-pure-white">
                {p3Points.toLocaleString()} <span className="text-[10px] text-highlight-silver">PTS</span>
              </span>
            </div>
          </div>
        </div>

        {/* 5. P22 SCORE */}
        <div className="bg-carbon-fiber/90 p-2.5 sm:p-3 rounded-xl border border-emerald-500/30 shadow-md flex items-center justify-between gap-2 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 font-black text-xs font-mono">
              P{p22Rank}
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-emerald-400 font-sans font-bold uppercase block truncate" title={p22User?.displayName || `P${p22Rank}`}>
                P{p22Rank} Score
              </span>
              <span className="font-extrabold text-sm text-emerald-300">
                {p22Points.toLocaleString()} <span className="text-[10px] text-emerald-500/80">PTS</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: TOP 10 CHAMPIONSHIP SHOWCASE */}
      {activeTab === 'top10' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* PODIUM SHOWCASE (P1, P2, P3) - SPACE EFFICIENT COMPACT PODIUM */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            
            {/* P2 - SILVER PODIUM */}
            {top10Users[1] && (
              <div className="order-2 md:order-1 bg-carbon-fiber rounded-xl p-3 sm:p-4 border border-slate-300/40 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-slate-300 transition-all duration-300">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-200 to-slate-400 text-carbon-black font-black text-xs flex items-center justify-center font-mono shadow shrink-0">
                      #2
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-pure-white truncate group-hover:text-slate-200 transition-colors">
                        {top10Users[1].displayName}
                      </h3>
                      <p className="text-[10px] text-slate-300/80 font-mono">
                        -{leaderPoints - (top10Users[1].totalPoints || 0)} pts from P1
                      </p>
                    </div>
                  </div>
                  <span className="bg-slate-300 text-carbon-black font-black text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-mono shrink-0">
                    P2 Silver
                  </span>
                </div>

                {/* Score & Deficit Showcase */}
                <div className="bg-carbon-black/90 rounded-lg p-2.5 my-1.5 border border-pure-white/10 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[8px] font-bold uppercase text-highlight-silver/70 block">Total Score</span>
                    <span className="text-xl font-black font-mono text-slate-200">
                      {(top10Users[1].totalPoints || 0).toLocaleString()} <span className="text-[10px] text-highlight-silver font-sans">PTS</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-1 rounded text-[10px] font-mono font-black inline-block">
                      -{leaderPoints - (top10Users[1].totalPoints || 0)} pts deficit
                    </span>
                  </div>
                </div>

                {/* Collapsible 4 Category Breakdown */}
                <div className="my-1">
                  <button
                    onClick={() => toggleCardBreakdown(top10Users[1].id || 'p2')}
                    className="w-full py-1 px-2 bg-pure-white/5 hover:bg-pure-white/10 text-highlight-silver hover:text-pure-white font-mono text-[10px] font-bold uppercase rounded-lg border border-pure-white/10 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>4 Category Breakdown</span>
                    <span className="text-[9px] text-slate-300">
                      {expandedCardIds[top10Users[1].id || 'p2'] ? 'Hide ▲' : 'Show ▼'}
                    </span>
                  </button>

                  {expandedCardIds[top10Users[1].id || 'p2'] && (
                    <div className="grid grid-cols-4 gap-1 text-[9px] font-mono mt-1.5 animate-fade-in">
                      <div className="bg-red-950/60 border border-red-500/40 p-1 rounded text-center">
                        <span className="text-red-400/90 font-extrabold block">GP</span>
                        <span className="font-black text-red-300">{top10Users[1].breakdown?.gp || 0}</span>
                      </div>
                      <div className="bg-blue-950/60 border border-blue-500/40 p-1 rounded text-center">
                        <span className="text-blue-400/90 font-extrabold block">QUAL</span>
                        <span className="font-black text-blue-300">{top10Users[1].breakdown?.quali || 0}</span>
                      </div>
                      <div className="bg-amber-950/60 border border-amber-500/40 p-1 rounded text-center">
                        <span className="text-amber-400/90 font-extrabold block">SPR</span>
                        <span className="font-black text-amber-300">{top10Users[1].breakdown?.sprint || 0}</span>
                      </div>
                      <div className="bg-purple-950/60 border border-purple-500/40 p-1 rounded text-center">
                        <span className="text-purple-400/90 font-extrabold block">FL</span>
                        <span className="font-black text-purple-300">{top10Users[1].breakdown?.fl || 0}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onSelectUser(top10Users[1])}
                  className="mt-1.5 w-full py-1.5 bg-slate-300/10 hover:bg-slate-300 hover:text-carbon-black text-slate-200 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-slate-300/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <EyeIcon className="w-3 h-3" />
                  <span>Inspect P2 Telemetry</span>
                </button>
              </div>
            )}

            {/* P1 - GOLD CHAMPION PODIUM */}
            {top10Users[0] && (
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-950/40 via-carbon-fiber to-carbon-fiber rounded-xl p-3 sm:p-4 border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.15)] relative overflow-hidden flex flex-col justify-between group hover:border-amber-300 transition-all duration-300">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 text-carbon-black font-black text-sm flex items-center justify-center font-mono shadow ring-1 ring-amber-300 shrink-0">
                      #1
                    </div>
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/30">
                        League Leader
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-pure-white truncate group-hover:text-amber-300 transition-colors">
                        {top10Users[0].displayName}
                      </h3>
                    </div>
                  </div>
                  <span className="bg-amber-400 text-carbon-black font-black text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-mono shrink-0 flex items-center gap-1">
                    <TrophyIcon className="w-3 h-3" /> P1 Champion
                  </span>
                </div>

                {/* Score & Surplus Showcase */}
                <div className="bg-carbon-black/90 rounded-lg p-2.5 my-1.5 border border-amber-400/30 flex items-center justify-between gap-2 relative overflow-hidden">
                  <div>
                    <span className="text-[8px] font-bold uppercase text-amber-400/80 block">Current P1 Score</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
                      {(top10Users[0].totalPoints || 0).toLocaleString()} <span className="text-[10px] text-highlight-silver font-sans">PTS</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-1 rounded text-[10px] font-mono font-black inline-block">
                      +{leaderPoints - (top10Users[1]?.totalPoints || 0)} pts lead
                    </span>
                  </div>
                </div>

                {/* Collapsible 4 Category Breakdown */}
                <div className="my-1">
                  <button
                    onClick={() => toggleCardBreakdown(top10Users[0].id || 'p1')}
                    className="w-full py-1 px-2 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 font-mono text-[10px] font-bold uppercase rounded-lg border border-amber-400/30 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>4 Category Breakdown</span>
                    <span className="text-[9px] text-amber-400">
                      {expandedCardIds[top10Users[0].id || 'p1'] ? 'Hide ▲' : 'Show ▼'}
                    </span>
                  </button>

                  {expandedCardIds[top10Users[0].id || 'p1'] && (
                    <div className="grid grid-cols-4 gap-1 text-[9px] font-mono mt-1.5 animate-fade-in">
                      <div className="bg-red-950/80 border border-red-500/50 p-1 rounded text-center">
                        <span className="text-red-300 font-extrabold block">GP</span>
                        <span className="font-black text-red-200">{top10Users[0].breakdown?.gp || 0}</span>
                      </div>
                      <div className="bg-blue-950/80 border border-blue-500/50 p-1 rounded text-center">
                        <span className="text-blue-300 font-extrabold block">QUAL</span>
                        <span className="font-black text-blue-200">{top10Users[0].breakdown?.quali || 0}</span>
                      </div>
                      <div className="bg-amber-950/80 border border-amber-500/50 p-1 rounded text-center">
                        <span className="text-amber-300 font-extrabold block">SPR</span>
                        <span className="font-black text-amber-200">{top10Users[0].breakdown?.sprint || 0}</span>
                      </div>
                      <div className="bg-purple-950/80 border border-purple-500/50 p-1 rounded text-center">
                        <span className="text-purple-300 font-extrabold block">FL</span>
                        <span className="font-black text-purple-200">{top10Users[0].breakdown?.fl || 0}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onSelectUser(top10Users[0])}
                  className="mt-1.5 w-full py-1.5 bg-amber-400 hover:bg-amber-300 text-carbon-black font-black text-[10px] uppercase tracking-widest rounded-lg shadow transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <EyeIcon className="w-3 h-3" />
                  <span>Inspect Champion Telemetry</span>
                </button>
              </div>
            )}

            {/* P3 - BRONZE PODIUM */}
            {top10Users[2] && (
              <div className="order-3 md:order-3 bg-carbon-fiber rounded-xl p-3 sm:p-4 border border-amber-600/40 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-amber-500 transition-all duration-300">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 text-pure-white font-black text-xs flex items-center justify-center font-mono shadow shrink-0">
                      #3
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-pure-white truncate group-hover:text-amber-400 transition-colors">
                        {top10Users[2].displayName}
                      </h3>
                      <p className="text-[10px] text-amber-500/80 font-mono">
                        -{leaderPoints - (top10Users[2].totalPoints || 0)} pts from P1
                      </p>
                    </div>
                  </div>
                  <span className="bg-amber-600 text-pure-white font-black text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-mono shrink-0">
                    P3 Bronze
                  </span>
                </div>

                {/* Score & Deficit Showcase */}
                <div className="bg-carbon-black/80 rounded-lg p-2.5 my-1.5 border border-pure-white/10 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[8px] font-bold uppercase text-highlight-silver/70 block">Total Score</span>
                    <span className="text-xl font-black font-mono text-amber-500">
                      {(top10Users[2].totalPoints || 0).toLocaleString()} <span className="text-[10px] text-highlight-silver font-sans">PTS</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-1 rounded text-[10px] font-mono font-black inline-block">
                      -{leaderPoints - (top10Users[2].totalPoints || 0)} pts deficit
                    </span>
                  </div>
                </div>

                {/* Collapsible 4 Category Breakdown */}
                <div className="my-1">
                  <button
                    onClick={() => toggleCardBreakdown(top10Users[2].id || 'p3')}
                    className="w-full py-1 px-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 font-mono text-[10px] font-bold uppercase rounded-lg border border-amber-600/30 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>4 Category Breakdown</span>
                    <span className="text-[9px] text-amber-500">
                      {expandedCardIds[top10Users[2].id || 'p3'] ? 'Hide ▲' : 'Show ▼'}
                    </span>
                  </button>

                  {expandedCardIds[top10Users[2].id || 'p3'] && (
                    <div className="grid grid-cols-4 gap-1 text-[9px] font-mono mt-1.5 animate-fade-in">
                      <div className="bg-red-950/60 border border-red-500/40 p-1 rounded text-center">
                        <span className="text-red-400/90 font-extrabold block">GP</span>
                        <span className="font-black text-red-300">{top10Users[2].breakdown?.gp || 0}</span>
                      </div>
                      <div className="bg-blue-950/60 border border-blue-500/40 p-1 rounded text-center">
                        <span className="text-blue-400/90 font-extrabold block">QUAL</span>
                        <span className="font-black text-blue-300">{top10Users[2].breakdown?.quali || 0}</span>
                      </div>
                      <div className="bg-amber-950/60 border border-amber-500/40 p-1 rounded text-center">
                        <span className="text-amber-400/90 font-extrabold block">SPR</span>
                        <span className="font-black text-amber-300">{top10Users[2].breakdown?.sprint || 0}</span>
                      </div>
                      <div className="bg-purple-950/60 border border-purple-500/40 p-1 rounded text-center">
                        <span className="text-purple-400/90 font-extrabold block">FL</span>
                        <span className="font-black text-purple-300">{top10Users[2].breakdown?.fl || 0}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onSelectUser(top10Users[2])}
                  className="mt-1.5 w-full py-1.5 bg-amber-600/10 hover:bg-amber-600 hover:text-pure-white text-amber-400 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-amber-600/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <EyeIcon className="w-3 h-3" />
                  <span>Inspect P3 Telemetry</span>
                </button>
              </div>
            )}
          </div>

          {/* POSITIONS P4 THROUGH P10 PIT WALL CARDS */}
          <div className="bg-carbon-fiber rounded-2xl p-3.5 sm:p-5 md:p-6 ring-1 ring-pure-white/10 shadow-2xl border border-pure-white/5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 mb-4 sm:mb-6 border-b border-pure-white/10 pb-3 sm:pb-4">
              <div className="flex items-center gap-2">
                <F1CarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-red shrink-0" />
                <h3 className="text-base sm:text-lg font-black text-pure-white uppercase italic tracking-wider">
                  Top 10 Contender Grid (P4 – P10)
                </h3>
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-highlight-silver bg-carbon-black px-2.5 py-1 rounded-full border border-pure-white/10">
                P10 Cutoff: <strong className="text-emerald-400">{p10Points} pts</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {top10Users.slice(3, 10).map((user, idx) => {
                const rank = idx + 4;
                const points = user.totalPoints || 0;
                const gapToP1 = leaderPoints - points;
                const prevUserPoints = top10Users[idx + 2]?.totalPoints || points;
                const gapToAhead = prevUserPoints - points;
                const isP10Gatekeeper = rank === 10;

                return (
                  <div
                    key={user.id}
                    className={`bg-carbon-black/80 rounded-xl p-3 sm:p-4 border transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between group ${
                      isP10Gatekeeper
                        ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] bg-gradient-to-b from-emerald-950/20 to-carbon-black'
                        : 'border-pure-white/10 hover:border-primary-red/50'
                    }`}
                  >
                    <div>
                      {/* Top Rank Header */}
                      <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg font-mono font-black text-[11px] sm:text-xs flex items-center justify-center shrink-0 ${
                              isP10Gatekeeper
                                ? 'bg-emerald-500 text-carbon-black shadow-md'
                                : 'bg-carbon-black border border-pure-white/20 text-pure-white'
                            }`}
                          >
                            #{rank}
                          </span>
                          <span className="text-sm sm:text-base font-black text-pure-white truncate group-hover:text-primary-red transition-colors">
                            {user.displayName}
                          </span>
                        </div>
                        {isP10Gatekeeper && (
                          <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0 ml-1">
                            P10 Cutoff
                          </span>
                        )}
                      </div>

                      {/* Main Points & Deficit Block */}
                      <div className="my-2 bg-pure-white/5 p-2.5 rounded-lg border border-pure-white/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[9px] text-highlight-silver/70 font-bold uppercase block">Total Points</span>
                            <span className="text-xl font-black font-mono text-pure-white">
                              {points.toLocaleString()} <span className="text-[10px] text-highlight-silver font-sans">PTS</span>
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-black inline-block">
                              -{gapToP1} pts deficit
                            </span>
                          </div>
                        </div>

                        <div className="mt-1.5 flex justify-between items-center text-[10px] font-mono text-highlight-silver/80 pt-1.5 border-t border-pure-white/5">
                          <span>Position: <strong className="text-pure-white">P{rank}</strong></span>
                          <span>To P{rank - 1}: <strong className="text-yellow-400">-{gapToAhead} pts</strong></span>
                        </div>
                      </div>

                      {/* Collapsible 4 Category Breakdown */}
                      <div className="my-2">
                        <button
                          onClick={() => toggleCardBreakdown(user.id)}
                          className="w-full py-1 px-2.5 bg-carbon-black hover:bg-pure-white/10 text-highlight-silver hover:text-pure-white font-mono text-[10px] font-bold uppercase rounded-lg border border-pure-white/10 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <span>4 Category Breakdown</span>
                          <span className="text-[9px] text-highlight-silver/80">
                            {expandedCardIds[user.id] ? 'Hide ▲' : 'Show ▼'}
                          </span>
                        </button>

                        {expandedCardIds[user.id] && (
                          <div className="grid grid-cols-4 gap-1 text-[9px] sm:text-[10px] font-mono text-center mt-2 animate-fade-in">
                            <div className="bg-red-950/60 border border-red-500/40 p-1 sm:p-1.5 rounded shadow-sm">
                              <span className="text-red-400/90 block text-[8px] font-extrabold uppercase">GP</span>
                              <span className="font-black text-red-300">{user.breakdown?.gp || 0}</span>
                            </div>
                            <div className="bg-blue-950/60 border border-blue-500/40 p-1 sm:p-1.5 rounded shadow-sm">
                              <span className="text-blue-400/90 block text-[8px] font-extrabold uppercase">QUAL</span>
                              <span className="font-black text-blue-300">{user.breakdown?.quali || 0}</span>
                            </div>
                            <div className="bg-amber-950/60 border border-amber-500/40 p-1 sm:p-1.5 rounded shadow-sm">
                              <span className="text-amber-400/90 block text-[8px] font-extrabold uppercase">SPR</span>
                              <span className="font-black text-amber-300">{user.breakdown?.sprint || 0}</span>
                            </div>
                            <div className="bg-purple-950/60 border border-purple-500/40 p-1 sm:p-1.5 rounded shadow-sm">
                              <span className="text-purple-400/90 block text-[8px] font-extrabold uppercase">FL</span>
                              <span className="font-black text-purple-300">{user.breakdown?.fl || 0}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectUser(user)}
                      className="mt-3 sm:mt-4 w-full py-1.5 sm:py-2 bg-pure-white/5 hover:bg-primary-red hover:text-pure-white text-highlight-silver text-[11px] sm:text-xs font-bold uppercase tracking-wider rounded-lg border border-pure-white/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <EyeIcon className="w-3.5 h-3.5" />
                      <span>Inspect Team</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* VIEW MODE 2: THE REST OF THE PACK (POSITIONS 11 TO LAST PLACE) */}
      {activeTab === 'rest' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* TOP 10 GATEWAY BANNER */}
          <div className="bg-gradient-to-r from-carbon-black via-carbon-fiber to-carbon-black rounded-2xl p-3.5 sm:p-5 border border-pure-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 shadow-xl">
            <div className="flex items-center gap-2.5 sm:gap-3 text-center sm:text-left">
              <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                <TrophyIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-pure-white uppercase italic">
                  Top 10 Executive Gatekeeper
                </h3>
                <p className="text-[11px] sm:text-xs text-highlight-silver">
                  P10 held by <strong className="text-pure-white">{p10User?.displayName || 'N/A'}</strong> with <strong className="text-emerald-400 font-mono">{p10Points} pts</strong>
                </p>
              </div>
            </div>

            <div className="text-center sm:text-right bg-carbon-black/80 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-pure-white/5 w-full sm:w-auto">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-highlight-silver/70 block">
                Target Score for Entry
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                {p10Points + 1} <span className="text-[10px] sm:text-xs font-normal text-highlight-silver uppercase">pts</span>
              </span>
            </div>
          </div>

          {/* SEARCH & TIER FILTER CONTROLS */}
          <div className="bg-carbon-fiber rounded-2xl p-3 sm:p-4 ring-1 ring-pure-white/10 border border-pure-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search principal or rank..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-carbon-black border border-pure-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-pure-white placeholder-highlight-silver/50 focus:outline-none focus:border-primary-red transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-highlight-silver hover:text-pure-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Tier Filters */}
            <div className="flex bg-carbon-black p-1 rounded-xl border border-pure-white/10 w-full sm:w-auto overflow-x-auto custom-scrollbar gap-1">
              <button
                onClick={() => {
                  setTierFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-[11px] sm:text-xs whitespace-nowrap transition-colors shrink-0 ${
                  tierFilter === 'all'
                    ? 'bg-primary-red text-pure-white shadow-md'
                    : 'text-highlight-silver hover:text-pure-white'
                }`}
              >
                All Pack
              </button>

              <button
                onClick={() => {
                  setTierFilter('chasers');
                  setCurrentPage(1);
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-[11px] sm:text-xs whitespace-nowrap transition-colors shrink-0 ${
                  tierFilter === 'chasers'
                    ? 'bg-amber-500 text-carbon-black font-black shadow-md'
                    : 'text-highlight-silver hover:text-pure-white'
                }`}
              >
                Chasers (P11–P20)
              </button>

              <button
                onClick={() => {
                  setTierFilter('midfield');
                  setCurrentPage(1);
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-[11px] sm:text-xs whitespace-nowrap transition-colors shrink-0 ${
                  tierFilter === 'midfield'
                    ? 'bg-blue-600 text-pure-white shadow-md'
                    : 'text-highlight-silver hover:text-pure-white'
                }`}
              >
                Midfield (P21–P30)
              </button>

              <button
                onClick={() => {
                  setTierFilter('backmarkers');
                  setCurrentPage(1);
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-[11px] sm:text-xs whitespace-nowrap transition-colors shrink-0 ${
                  tierFilter === 'backmarkers'
                    ? 'bg-accent-gray text-pure-white shadow-md'
                    : 'text-highlight-silver hover:text-pure-white'
                }`}
              >
                Backmarkers (P31+)
              </button>
            </div>
          </div>

          {/* TIMING TOWER GRID ROWS (SCALABLE & PERFORMANCE-OPTIMIZED) */}
          <div className="bg-carbon-fiber rounded-2xl p-3 sm:p-4 md:p-6 ring-1 ring-pure-white/10 border border-pure-white/5 shadow-2xl space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between border-b border-pure-white/10 pb-2.5 sm:pb-3 text-[10px] sm:text-xs font-mono font-bold text-highlight-silver uppercase tracking-wider px-1">
              <span>Showing {paginatedRestUsers.length} of {filteredRestUsers.length}</span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>

            {paginatedRestUsers.length > 0 ? (
              <div className="space-y-2">
                {paginatedRestUsers.map((user) => {
                  const rank = user.rank || 0;
                  const points = user.totalPoints || 0;
                  const gapToP10 = p10Points - points;
                  const gapToP1 = leaderPoints - points;
                  const isNextInLine = rank === 11;
                  const isExpanded = expandedUserId === user.id;

                  return (
                    <div
                      key={user.id}
                      className={`bg-carbon-black/80 rounded-xl border transition-all duration-200 overflow-hidden ${
                        isNextInLine
                          ? 'border-amber-400/60 shadow-[0_0_15px_rgba(251,191,36,0.15)] bg-gradient-to-r from-amber-950/20 via-carbon-black to-carbon-black'
                          : 'border-pure-white/5 hover:border-pure-white/20'
                      }`}
                    >
                      {/* Row Header Bar */}
                      <div className="p-2.5 sm:p-3 md:p-4 flex flex-row items-center justify-between gap-2 sm:gap-3">
                        
                        {/* Rank & Principal Name */}
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-mono font-black text-xs sm:text-sm shrink-0 shadow-md ${
                              isNextInLine
                                ? 'bg-amber-400 text-carbon-black ring-1 ring-amber-300'
                                : rank <= 20
                                ? 'bg-carbon-black text-amber-400 border border-amber-400/30'
                                : rank <= 30
                                ? 'bg-carbon-black text-blue-400 border border-blue-400/30'
                                : 'bg-carbon-black text-highlight-silver border border-pure-white/10'
                            }`}
                          >
                            #{rank}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <h4 className="font-extrabold text-pure-white text-xs sm:text-base truncate">
                                {user.displayName}
                              </h4>
                              {isNextInLine && (
                                <span className="hidden sm:inline-block text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30 shrink-0">
                                  Top 10 Contender
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-[11px] font-mono text-highlight-silver/70">
                              Score: <strong className="text-pure-white">{points.toLocaleString()} pts</strong>
                            </p>
                          </div>
                        </div>

                        {/* Telemetry Point Gaps & Action Buttons */}
                        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 font-mono text-xs">
                          <div className="bg-carbon-black/60 px-2 sm:px-2.5 py-1 rounded-lg border border-pure-white/5">
                            <span className="text-[8px] sm:text-[9px] text-highlight-silver/60 block uppercase font-sans">Gap P10</span>
                            <span className={`font-bold text-[10px] sm:text-xs ${gapToP10 <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {gapToP10 <= 0 ? 'Top 10' : `-${gapToP10} pts`}
                            </span>
                          </div>

                          <div className="bg-carbon-black/60 px-2.5 py-1 rounded-lg border border-pure-white/5 hidden sm:block">
                            <span className="text-[9px] text-highlight-silver/60 block uppercase font-sans">Gap Leader</span>
                            <span className="font-bold text-red-400">-{gapToP1} pts</span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 sm:gap-2">
                            <button
                              onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                              className="p-1.5 sm:p-2 rounded-lg bg-pure-white/5 hover:bg-pure-white/10 text-highlight-silver hover:text-pure-white transition-colors"
                              title="Toggle Telemetry Drawer"
                            >
                              <ChevronDownIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            <button
                              onClick={() => onSelectUser(user)}
                              className="px-2.5 sm:px-3 py-1.5 bg-primary-red/10 hover:bg-primary-red text-primary-red hover:text-pure-white font-bold text-[10px] sm:text-xs uppercase tracking-wider rounded-lg border border-primary-red/30 transition-all flex items-center gap-1"
                            >
                              <EyeIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span className="hidden sm:inline">Inspect</span>
                            </button>
                          </div>
                        </div>

                      </div>

                      {/* Expandable Telemetry Drawer */}
                      {isExpanded && (
                        <div className="bg-carbon-black p-3 sm:p-4 border-t border-pure-white/10 animate-fade-in grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs font-mono">
                          <div className="p-2 sm:p-2.5 rounded-lg bg-red-950/50 border border-red-500/40">
                            <span className="text-red-400/90 text-[9px] sm:text-[10px] font-extrabold uppercase font-sans block">Race Points (GP)</span>
                            <span className="text-sm sm:text-base font-black text-red-300">{user.breakdown?.gp || 0}</span>
                          </div>
                          <div className="p-2 sm:p-2.5 rounded-lg bg-blue-950/50 border border-blue-500/40">
                            <span className="text-blue-400/90 text-[9px] sm:text-[10px] font-extrabold uppercase font-sans block">Qualifying Points</span>
                            <span className="text-sm sm:text-base font-black text-blue-300">{user.breakdown?.quali || 0}</span>
                          </div>
                          <div className="p-2 sm:p-2.5 rounded-lg bg-amber-950/50 border border-amber-500/40">
                            <span className="text-amber-400/90 text-[9px] sm:text-[10px] font-extrabold uppercase font-sans block">Sprint Points</span>
                            <span className="text-sm sm:text-base font-black text-amber-300">{user.breakdown?.sprint || 0}</span>
                          </div>
                          <div className="p-2 sm:p-2.5 rounded-lg bg-purple-950/50 border border-purple-500/40">
                            <span className="text-purple-400/90 text-[9px] sm:text-[10px] font-extrabold uppercase font-sans block">Fastest Laps</span>
                            <span className="text-sm sm:text-base font-black text-purple-300">{user.breakdown?.fl || 0}</span>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-highlight-silver/50 italic bg-carbon-black/20 rounded-xl border border-dashed border-pure-white/10">
                No team principals found matching your filter criteria.
              </div>
            )}

            {/* Pagination Navigation Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-pure-white/10 gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-carbon-black hover:bg-pure-white/10 disabled:opacity-40 text-pure-white font-bold text-[10px] sm:text-xs uppercase tracking-wider rounded-lg border border-pure-white/10 transition-colors"
                >
                  &larr; Prev
                </button>

                <div className="flex items-center gap-1 overflow-x-auto max-w-[180px] sm:max-w-none no-scrollbar">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg font-mono font-bold text-[10px] sm:text-xs transition-colors ${
                        currentPage === p
                          ? 'bg-primary-red text-pure-white'
                          : 'bg-carbon-black text-highlight-silver hover:bg-pure-white/10'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-carbon-black hover:bg-pure-white/10 disabled:opacity-40 text-pure-white font-bold text-[10px] sm:text-xs uppercase tracking-wider rounded-lg border border-pure-white/10 transition-colors"
                >
                  Next &rarr;
                </button>
              </div>
            )}

          </div>

        </div>
      )}

      {/* CUSTOM BATTLE RADAR & RIVAL TARGETS MODAL */}
      {showRivalsModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-carbon-black/90 backdrop-blur-md p-3 sm:p-5 animate-fade-in"
          onClick={() => setShowRivalsModal(false)}
        >
          <div
            className="bg-carbon-fiber border-2 border-primary-red/70 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(218,41,28,0.4)] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative flex items-center justify-between p-3.5 sm:p-4 border-b border-pure-white/10 bg-gradient-to-r from-carbon-black via-carbon-fiber to-carbon-black">
              <div className="flex items-center gap-3">
                <div className="bg-primary-red/20 p-2 rounded-xl border border-primary-red/50 shadow-md">
                  <F1CarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-red" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary-red bg-primary-red/10 px-2 py-0.5 rounded border border-primary-red/30">
                      League Battle Radar
                    </span>
                    <span className="text-[9px] font-mono text-highlight-silver/80 hidden sm:inline">
                      Live Telemetry Matchup
                    </span>
                  </div>
                  <h2 className="text-base sm:text-xl font-black text-pure-white uppercase tracking-wider italic">
                    Race Position & Targets
                  </h2>
                </div>
              </div>

              {/* User Selector Dropdown in Modal Header */}
              <div className="flex items-center gap-2.5">
                {users.length > 0 && (
                  <div className="hidden sm:flex items-center gap-2 bg-carbon-black/80 px-2.5 py-1 rounded-xl border border-pure-white/10">
                    <span className="text-[10px] text-highlight-silver/70 uppercase font-sans font-bold">Focus:</span>
                    <select
                      value={activeUserForRadar?.id || ''}
                      onChange={(e) => {
                        const target = users.find((u) => u.id && u.id === e.target.value);
                        if (target) setSelectedRadarUser(target);
                      }}
                      className="bg-transparent text-xs font-bold text-yellow-400 font-mono focus:outline-none cursor-pointer"
                    >
                      {users.map((u) => (
                        <option key={u.id || u.displayName} value={u.id} className="bg-carbon-black text-pure-white">
                          P{u.rank} - {u.displayName} ({(u.totalPoints || 0).toLocaleString()} pts)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => setShowRivalsModal(false)}
                  className="p-2 hover:bg-pure-white/10 rounded-full text-highlight-silver hover:text-pure-white transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile Selector Dropdown Bar if small screen */}
            <div className="sm:hidden bg-carbon-black p-2 border-b border-pure-white/10 flex items-center justify-between gap-2">
              <span className="text-[10px] text-highlight-silver/70 font-bold uppercase shrink-0">Select Principal:</span>
              <select
                value={activeUserForRadar?.id || ''}
                onChange={(e) => {
                  const target = users.find((u) => u.id && u.id === e.target.value);
                  if (target) setSelectedRadarUser(target);
                }}
                className="bg-carbon-fiber text-xs font-bold text-yellow-400 font-mono p-1 rounded border border-pure-white/10 w-full focus:outline-none"
              >
                {users.map((u) => (
                  <option key={u.id || u.displayName} value={u.id} className="bg-carbon-black text-pure-white">
                    P{u.rank} - {u.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle Sub-nav */}
            <div className="bg-carbon-black/90 px-3.5 py-2 border-b border-pure-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-carbon-fiber p-1 rounded-xl border border-pure-white/10">
                <button
                  onClick={() => setRadarViewMode('cards')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                    radarViewMode === 'cards'
                      ? 'bg-primary-red text-pure-white shadow-md'
                      : 'text-highlight-silver hover:text-pure-white hover:bg-pure-white/5'
                  }`}
                >
                  <span>🏎️ Matchup Cards</span>
                </button>
                <button
                  onClick={() => setRadarViewMode('telemetry')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                    radarViewMode === 'telemetry'
                      ? 'bg-purple-600 text-pure-white shadow-md ring-1 ring-purple-400/50'
                      : 'text-highlight-silver hover:text-pure-white hover:bg-pure-white/5'
                  }`}
                >
                  <span>📊 Visuals & F1 Telemetry</span>
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ERS 88%
                </span>
                <span className="text-yellow-400 font-bold bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/30">
                  DRS: ACTIVE
                </span>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 space-y-6 bg-carbon-black/60">
              
              {radarViewMode === 'telemetry' && activeUserForRadar ? (
                <F1BattleTelemetryVisualizer
                  activeUser={activeUserForRadar}
                  p1Leader={leaderUser}
                  targetAhead={targetsAhead[targetsAhead.length - 1] || null}
                  targetBehind={targetsBehind[0] || null}
                  isSelf={isLoggedUser(activeUserForRadar)}
                  onInspectUser={(u) => {
                    setShowRivalsModal(false);
                    onSelectUser(u);
                  }}
                />
              ) : (
                <>
                  {/* 1. TOP SECTION: TARGETS AHEAD (LEADING THE RACE) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-pure-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🏎️ Targets Ahead (Leading Race)</span>
                      <span className="text-[10px] text-highlight-silver/70 font-mono">({targetsAhead.length})</span>
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400/80 font-bold">Overtake Gap</span>
                </div>

                {targetsAhead.length === 0 ? (
                  <div className="bg-carbon-fiber p-3.5 sm:p-4 rounded-xl border border-yellow-500/30 text-center text-xs text-highlight-silver">
                    <p className="font-bold text-yellow-400 flex items-center justify-center gap-1.5">
                      <TrophyIcon className="w-4 h-4 text-yellow-400" />
                      <span>Championship Leader — Clear Track Ahead!</span>
                    </p>
                    <p className="text-[11px] text-highlight-silver/70 mt-1">
                      You are in P1! There are no team principals ahead of you. Keep pushing to hold championship position!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {targetsAhead.map((user) => {
                      const gapToCatch = (user.totalPoints || 0) - (activeUserForRadar?.totalPoints || 0);
                      return (
                        <div
                          key={user.id || user.displayName}
                          className="bg-carbon-fiber rounded-xl p-3 border border-emerald-500/40 hover:border-emerald-400 transition-all duration-200 shadow-lg relative group"
                        >
                          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-pure-white/10">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 font-black text-sm flex items-center justify-center font-mono shrink-0 shadow-md">
                                P{user.rank}
                              </div>
                              <div className="min-w-0">
                                <h5 className="text-sm sm:text-base font-black text-pure-white truncate group-hover:text-emerald-300 transition-colors">
                                  {user.displayName}
                                </h5>
                              </div>
                            </div>

                            {/* Prominent High-Impact Opponent Score Box */}
                            <div className="flex items-center gap-2.5 bg-carbon-black/90 px-2.5 py-1.5 rounded-xl border border-emerald-500/40 font-mono shrink-0 shadow-inner">
                              <div className="text-center sm:text-right">
                                <span className="text-[8px] font-bold text-highlight-silver/70 uppercase block leading-none mb-0.5">Total Score</span>
                                <span className="text-base sm:text-lg font-black text-emerald-400 leading-none">
                                  {(user.totalPoints || 0).toLocaleString()}
                                </span>
                                <span className="text-[9px] text-highlight-silver ml-0.5 font-bold">PTS</span>
                              </div>
                              <div className="border-l border-emerald-500/30 pl-2 text-right">
                                <span className="text-[8px] font-bold text-highlight-silver/70 uppercase block leading-none mb-0.5">Gap to Catch</span>
                                <span className="text-xs sm:text-sm font-black text-emerald-300 leading-none">
                                  +{gapToCatch} <span className="text-[9px] text-emerald-400/80">PTS</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Collapsible 4 Category Breakdown */}
                          <div className="my-2">
                            <button
                              onClick={() => toggleCardBreakdown(user.id || user.displayName)}
                              className="w-full py-1 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold uppercase rounded-lg border border-emerald-500/30 flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span>4 Category Breakdown</span>
                              <span className="text-[9px]">
                                {expandedCardIds[user.id || user.displayName] ? 'Hide ▲' : 'Show ▼'}
                              </span>
                            </button>

                            {expandedCardIds[user.id || user.displayName] && (
                              <div className="grid grid-cols-4 gap-1 text-[9px] font-mono mt-1.5 animate-fade-in">
                                <div className="bg-red-950/60 border border-red-500/40 p-1 rounded text-center">
                                  <span className="text-red-400 font-extrabold block">GP</span>
                                  <span className="text-red-300 font-black">{user.breakdown?.gp || 0}</span>
                                </div>
                                <div className="bg-blue-950/60 border border-blue-500/40 p-1 rounded text-center">
                                  <span className="text-blue-400 font-extrabold block">QUAL</span>
                                  <span className="text-blue-300 font-black">{user.breakdown?.quali || 0}</span>
                                </div>
                                <div className="bg-amber-950/60 border border-amber-500/40 p-1 rounded text-center">
                                  <span className="text-amber-400 font-extrabold block">SPR</span>
                                  <span className="text-amber-300 font-black">{user.breakdown?.sprint || 0}</span>
                                </div>
                                <div className="bg-purple-950/60 border border-purple-500/40 p-1 rounded text-center">
                                  <span className="text-purple-400 font-extrabold block">FL</span>
                                  <span className="text-purple-300 font-black">{user.breakdown?.fl || 0}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              setShowRivalsModal(false);
                              onSelectUser(user);
                            }}
                            className="mt-2.5 w-full py-1 bg-emerald-500/10 hover:bg-emerald-500 hover:text-carbon-black text-emerald-300 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <EyeIcon className="w-3 h-3" />
                            <span>Inspect Telemetry</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. MIDDLE SECTION: CURRENT ACTIVE FOCUS PRINCIPAL */}
              {activeUserForRadar && (() => {
                const isSelf = isLoggedUser(activeUserForRadar);
                return (
                  <div className={
                    isSelf
                      ? "bg-gradient-to-r from-purple-950/80 via-carbon-fiber to-carbon-fiber rounded-2xl p-4 sm:p-5 border-2 border-purple-500/90 shadow-2xl relative overflow-hidden ring-1 ring-purple-500/40"
                      : "bg-gradient-to-r from-red-950/60 via-carbon-fiber to-carbon-fiber rounded-2xl p-4 sm:p-5 border-2 border-primary-red/90 shadow-2xl relative overflow-hidden ring-1 ring-primary-red/40"
                  }>
                    <div className={`flex items-center justify-between border-b pb-2.5 mb-3 ${
                      isSelf ? "border-purple-500/40" : "border-primary-red/40"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full animate-ping ${
                          isSelf ? "bg-purple-400" : "bg-primary-red"
                        }`} />
                        <span className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${
                          isSelf ? "text-purple-300" : "text-primary-red"
                        }`}>
                          <span>📍 Current Race Position (Active Focus)</span>
                        </span>
                      </div>
                      {isSelf && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-pure-white bg-purple-600 px-2.5 py-0.5 rounded border border-purple-400/60 shadow-sm">
                          YOU
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pure-white/10 pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl text-pure-white font-black text-lg flex items-center justify-center font-mono shadow-lg shrink-0 ${
                          isSelf
                            ? "bg-purple-600 ring-2 ring-purple-400/60"
                            : "bg-primary-red ring-2 ring-primary-red/50"
                        }`}>
                          P{activeUserForRadar.rank || activeUserIndex + 1}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg sm:text-2xl font-black text-pure-white truncate flex items-center gap-2">
                            <span>{activeUserForRadar.displayName}</span>
                            {isSelf && (
                              <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-400/40 px-2 py-0.5 rounded">
                                (Your Profile)
                              </span>
                            )}
                          </h3>
                          <span className="text-xs font-mono text-highlight-silver">
                            Active Telemetry Anchor
                          </span>
                        </div>
                      </div>

                      {/* Total Points & Gap to Leader */}
                      <div className="flex items-center gap-3 bg-carbon-black/90 p-2.5 rounded-xl border border-pure-white/10 self-start sm:self-auto font-mono">
                        <div className="text-center px-2">
                          <span className="text-[8px] font-bold text-highlight-silver/70 uppercase block">Total Score</span>
                          <span className={`text-xl sm:text-2xl font-black ${isSelf ? "text-purple-300" : "text-yellow-400"}`}>
                            {(activeUserForRadar.totalPoints || 0).toLocaleString()}
                          </span>
                          <span className="text-[9px] text-highlight-silver ml-0.5 font-bold">PTS</span>
                        </div>
                        <div className="border-l border-pure-white/10 pl-3 text-right">
                          <span className="text-[8px] font-bold text-highlight-silver/70 uppercase block">Gap to P1</span>
                          <span className="text-xs sm:text-sm font-black text-red-400">
                            -{leaderPoints - (activeUserForRadar.totalPoints || 0)} pts
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Collapsible 4 Category Breakdown */}
                    <div className="mt-3">
                      <button
                        onClick={() => toggleCardBreakdown(activeUserForRadar.id || 'radar_active')}
                        className={`w-full py-1.5 px-3 bg-carbon-black/80 hover:bg-carbon-black font-mono text-xs font-bold uppercase rounded-lg border flex items-center justify-between transition-colors cursor-pointer ${
                          isSelf
                            ? "border-purple-500/50 text-purple-300"
                            : "border-primary-red/50 text-yellow-400"
                        }`}
                      >
                        <span>4 Category Breakdown</span>
                        <span className="text-[10px]">
                          {expandedCardIds[activeUserForRadar.id || 'radar_active'] ? 'Hide ▲' : 'Show ▼'}
                        </span>
                      </button>

                      {expandedCardIds[activeUserForRadar.id || 'radar_active'] && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono mt-2 animate-fade-in">
                          <div className="bg-red-950/70 border border-red-500/50 p-2 rounded-lg flex justify-between items-center px-2.5 shadow-sm">
                            <span className="text-red-400 font-extrabold uppercase text-[10px]">Grand Prix</span>
                            <span className="font-black text-red-200 text-sm">{activeUserForRadar.breakdown?.gp || 0}</span>
                          </div>
                          <div className="bg-blue-950/70 border border-blue-500/50 p-2 rounded-lg flex justify-between items-center px-2.5 shadow-sm">
                            <span className="text-blue-400 font-extrabold uppercase text-[10px]">Qualifying</span>
                            <span className="font-black text-blue-200 text-sm">{activeUserForRadar.breakdown?.quali || 0}</span>
                          </div>
                          <div className="bg-amber-950/70 border border-amber-500/50 p-2 rounded-lg flex justify-between items-center px-2.5 shadow-sm">
                            <span className="text-amber-400 font-extrabold uppercase text-[10px]">Sprint</span>
                            <span className="font-black text-amber-200 text-sm">{activeUserForRadar.breakdown?.sprint || 0}</span>
                          </div>
                          <div className="bg-purple-950/70 border border-purple-500/50 p-2 rounded-lg flex justify-between items-center px-2.5 shadow-sm">
                            <span className="text-purple-400 font-extrabold uppercase text-[10px]">Fastest Lap</span>
                            <span className="font-black text-purple-200 text-sm">{activeUserForRadar.breakdown?.fl || 0}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 3. BOTTOM SECTION: TARGETS BEHIND (DEFENDING REAR GUARD) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-pure-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <h4 className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🛡️ Defending Against (Rear Guard)</span>
                      <span className="text-[10px] text-highlight-silver/70 font-mono">({targetsBehind.length})</span>
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400/80 font-bold">Defensive Cushion</span>
                </div>

                {targetsBehind.length === 0 ? (
                  <div className="bg-carbon-fiber p-3.5 sm:p-4 rounded-xl border border-pure-white/10 text-center text-xs text-highlight-silver">
                    <p className="font-bold text-highlight-silver">Backmarker Guard — Clear Track Behind!</p>
                    <p className="text-[11px] text-highlight-silver/70 mt-1">
                      You are at the tail end of the standings. Focus on catching the targets ahead!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {targetsBehind.map((user) => {
                      const cushion = (activeUserForRadar?.totalPoints || 0) - (user.totalPoints || 0);
                      return (
                        <div
                          key={user.id || user.displayName}
                          className="bg-carbon-fiber rounded-xl p-3 border border-amber-500/40 hover:border-amber-400 transition-all duration-200 shadow-lg relative group"
                        >
                          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-pure-white/10">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-400 font-black text-sm flex items-center justify-center font-mono shrink-0 shadow-md">
                                P{user.rank}
                              </div>
                              <div className="min-w-0">
                                <h5 className="text-sm sm:text-base font-black text-pure-white truncate group-hover:text-amber-300 transition-colors">
                                  {user.displayName}
                                </h5>
                              </div>
                            </div>

                            {/* Prominent High-Impact Opponent Score Box */}
                            <div className="flex items-center gap-2.5 bg-carbon-black/90 px-2.5 py-1.5 rounded-xl border border-amber-500/40 font-mono shrink-0 shadow-inner">
                              <div className="text-center sm:text-right">
                                <span className="text-[8px] font-bold text-highlight-silver/70 uppercase block leading-none mb-0.5">Total Score</span>
                                <span className="text-base sm:text-lg font-black text-amber-400 leading-none">
                                  {(user.totalPoints || 0).toLocaleString()}
                                </span>
                                <span className="text-[9px] text-highlight-silver ml-0.5 font-bold">PTS</span>
                              </div>
                              <div className="border-l border-amber-500/30 pl-2 text-right">
                                <span className="text-[8px] font-bold text-highlight-silver/70 uppercase block leading-none mb-0.5">Cushion</span>
                                <span className="text-xs sm:text-sm font-black text-amber-300 leading-none">
                                  +{cushion} <span className="text-[9px] text-amber-400/80">PTS</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Collapsible 4 Category Breakdown */}
                          <div className="my-2">
                            <button
                              onClick={() => toggleCardBreakdown(user.id || user.displayName)}
                              className="w-full py-1 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold uppercase rounded-lg border border-amber-500/30 flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span>4 Category Breakdown</span>
                              <span className="text-[9px]">
                                {expandedCardIds[user.id || user.displayName] ? 'Hide ▲' : 'Show ▼'}
                              </span>
                            </button>

                            {expandedCardIds[user.id || user.displayName] && (
                              <div className="grid grid-cols-4 gap-1 text-[9px] font-mono mt-1.5 animate-fade-in">
                                <div className="bg-red-950/60 border border-red-500/40 p-1 rounded text-center">
                                  <span className="text-red-400 font-extrabold block">GP</span>
                                  <span className="text-red-300 font-black">{user.breakdown?.gp || 0}</span>
                                </div>
                                <div className="bg-blue-950/60 border border-blue-500/40 p-1 rounded text-center">
                                  <span className="text-blue-400 font-extrabold block">QUAL</span>
                                  <span className="text-blue-300 font-black">{user.breakdown?.quali || 0}</span>
                                </div>
                                <div className="bg-amber-950/60 border border-amber-500/40 p-1 rounded text-center">
                                  <span className="text-amber-400 font-extrabold block">SPR</span>
                                  <span className="text-amber-300 font-black">{user.breakdown?.sprint || 0}</span>
                                </div>
                                <div className="bg-purple-950/60 border border-purple-500/40 p-1 rounded text-center">
                                  <span className="text-purple-400 font-extrabold block">FL</span>
                                  <span className="text-purple-300 font-black">{user.breakdown?.fl || 0}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              setShowRivalsModal(false);
                              onSelectUser(user);
                            }}
                            className="mt-2.5 w-full py-1 bg-amber-500/10 hover:bg-amber-500 hover:text-carbon-black text-amber-300 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <EyeIcon className="w-3 h-3" />
                            <span>Inspect Telemetry</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Modal Footer */}
            <div className="p-3 bg-carbon-black border-t border-pure-white/10 flex items-center justify-between gap-2">
              <span className="text-[10px] text-highlight-silver/70 font-mono hidden sm:inline">
                Refreshed live from championship standings database
              </span>
              <button
                onClick={() => setShowRivalsModal(false)}
                className="w-full sm:w-auto px-6 py-2 bg-pure-white/10 hover:bg-pure-white/20 text-pure-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Close Battle Radar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

/* ============================================================================
 * F1 BATTLE TELEMETRY & VISUAL METRICS DASHBOARD SUBCOMPONENT
 * ============================================================================ */
const F1BattleTelemetryVisualizer: React.FC<{
  activeUser: ProcessedUser;
  p1Leader: ProcessedUser | null;
  targetAhead: ProcessedUser | null;
  targetBehind: ProcessedUser | null;
  isSelf: boolean;
  onInspectUser: (user: ProcessedUser) => void;
}> = ({ activeUser, p1Leader, targetAhead, targetBehind, isSelf, onInspectUser }) => {
  const activePoints = activeUser.totalPoints || 0;
  const activeBd = activeUser.breakdown || { gp: 0, quali: 0, sprint: 0, fl: 0 };

  const p1Points = p1Leader?.totalPoints || 0;
  const p1Bd = p1Leader?.breakdown || { gp: 0, quali: 0, sprint: 0, fl: 0 };

  const aheadPoints = targetAhead?.totalPoints || 0;
  const aheadBd = targetAhead?.breakdown || { gp: 0, quali: 0, sprint: 0, fl: 0 };

  const behindPoints = targetBehind?.totalPoints || 0;
  const behindBd = targetBehind?.breakdown || { gp: 0, quali: 0, sprint: 0, fl: 0 };

  // Benchmarks for normalization
  const maxGp = Math.max(p1Bd.gp, activeBd.gp, aheadBd.gp, behindBd.gp, 10);
  const maxQuali = Math.max(p1Bd.quali, activeBd.quali, aheadBd.quali, behindBd.quali, 10);
  const maxSprint = Math.max(p1Bd.sprint, activeBd.sprint, aheadBd.sprint, behindBd.sprint, 10);
  const maxFl = Math.max(p1Bd.fl, activeBd.fl, aheadBd.fl, behindBd.fl, 5);

  // Radar chart points computation (240x240 SVG, Center at 120, 120, Radius 85)
  const cx = 120;
  const cy = 120;
  const r = 85;

  const getRadarPoint = (normGp: number, normQuali: number, normSprint: number, normFl: number) => {
    const x1 = cx;
    const y1 = cy - r * Math.min(1, Math.max(0.05, normGp));

    const x2 = cx + r * Math.min(1, Math.max(0.05, normQuali));
    const y2 = cy;

    const x3 = cx;
    const y3 = cy + r * Math.min(1, Math.max(0.05, normSprint));

    const x4 = cx - r * Math.min(1, Math.max(0.05, normFl));
    const y4 = cy;

    return {
      path: `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`,
      points: [{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }, { x: x4, y: y4 }]
    };
  };

  const activeRadar = getRadarPoint(
    activeBd.gp / maxGp,
    activeBd.quali / maxQuali,
    activeBd.sprint / maxSprint,
    activeBd.fl / maxFl
  );

  const p1Radar = getRadarPoint(
    p1Bd.gp / maxGp,
    p1Bd.quali / maxQuali,
    p1Bd.sprint / maxSprint,
    p1Bd.fl / maxFl
  );

  // Overtake Index & Defense Cushion
  const gapToAhead = targetAhead ? (aheadPoints - activePoints) : 0;
  const gapToBehind = targetBehind ? (activePoints - behindPoints) : 0;
  const gapToLeader = p1Points - activePoints;

  const overtakeScore = targetAhead
    ? Math.max(10, Math.min(98, Math.round(100 - (gapToAhead / Math.max(activePoints, 100)) * 100)))
    : 100;

  const defenseScore = targetBehind
    ? Math.max(10, Math.min(98, Math.round((gapToBehind / Math.max(behindPoints, 100)) * 200 + 50)))
    : 100;

  // Simulated round progression curve
  const rounds = ['R10', 'R11', 'R12', 'R13', 'R14'];
  const activeTrajectory = [
    Math.round(activePoints * 0.72),
    Math.round(activePoints * 0.81),
    Math.round(activePoints * 0.89),
    Math.round(activePoints * 0.95),
    activePoints
  ];
  const p1Trajectory = [
    Math.round(p1Points * 0.70),
    Math.round(p1Points * 0.79),
    Math.round(p1Points * 0.88),
    Math.round(p1Points * 0.94),
    p1Points
  ];
  const aheadTrajectory = targetAhead ? [
    Math.round(aheadPoints * 0.71),
    Math.round(aheadPoints * 0.80),
    Math.round(aheadPoints * 0.87),
    Math.round(aheadPoints * 0.94),
    aheadPoints
  ] : [];

  // SVG Line chart dimensions
  const lineW = 340;
  const lineH = 120;
  const maxPlotPoints = Math.max(p1Points, activePoints, aheadPoints, 100);

  const getLinePath = (data: number[]) => {
    return data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * (lineW - 40) + 20;
      const y = lineH - 20 - (val / maxPlotPoints) * (lineH - 35);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const getPointCoords = (data: number[]) => {
    return data.map((val, idx) => ({
      x: (idx / (data.length - 1)) * (lineW - 40) + 20,
      y: lineH - 20 - (val / maxPlotPoints) * (lineH - 35),
      val
    }));
  };

  const activePointsCoords = getPointCoords(activeTrajectory);
  const p1PointsCoords = getPointCoords(p1Trajectory);
  const aheadPointsCoords = targetAhead ? getPointCoords(aheadTrajectory) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. TELEMETRY STATUS HUD BANNER */}
      <div className={`p-4 rounded-2xl border shadow-xl relative overflow-hidden ${
        isSelf
          ? 'bg-gradient-to-r from-purple-950/80 via-carbon-black to-carbon-fiber border-purple-500/80 ring-1 ring-purple-500/30'
          : 'bg-gradient-to-r from-red-950/70 via-carbon-black to-carbon-fiber border-primary-red/80 ring-1 ring-primary-red/30'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pure-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl text-pure-white font-black text-xl flex items-center justify-center font-mono shadow-lg shrink-0 ${
              isSelf ? 'bg-purple-600 ring-2 ring-purple-400' : 'bg-primary-red ring-2 ring-primary-red/60'
            }`}>
              P{activeUser.rank}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-pure-white">
                  {activeUser.displayName}
                </h3>
                {isSelf && (
                  <span className="text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-400/40 px-2 py-0.5 rounded">
                    YOU
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-highlight-silver flex items-center gap-2">
                <span>Active Principal Telemetry</span>
                <span className="text-emerald-400 font-bold">• SYS NOMINAL</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono self-start sm:self-auto">
            <div className="bg-carbon-black/90 p-2 px-3 rounded-xl border border-pure-white/10 text-center">
              <span className="text-[8px] text-highlight-silver/70 font-bold uppercase block">Current Score</span>
              <span className="text-lg font-black text-yellow-400">{activePoints.toLocaleString()}</span>
              <span className="text-[9px] text-highlight-silver ml-0.5">PTS</span>
            </div>
            <div className="bg-carbon-black/90 p-2 px-3 rounded-xl border border-pure-white/10 text-center">
              <span className="text-[8px] text-highlight-silver/70 font-bold uppercase block">Gap to P1</span>
              <span className="text-lg font-black text-red-400">-{gapToLeader}</span>
              <span className="text-[9px] text-highlight-silver ml-0.5">PTS</span>
            </div>
          </div>
        </div>

        {/* Quick HUD Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 font-mono text-xs">
          <div className="bg-carbon-black/60 p-2 rounded-xl border border-pure-white/10 flex flex-col justify-between">
            <span className="text-[9px] text-highlight-silver/70 font-bold uppercase">Attack Target</span>
            <span className="text-sm font-black text-emerald-400 truncate">
              {targetAhead ? `P${targetAhead.rank} ${targetAhead.displayName}` : 'P1 LEADER'}
            </span>
            <span className="text-[10px] text-emerald-300 font-bold">
              {targetAhead ? `+${gapToAhead} pts to overtake` : 'Clear Track'}
            </span>
          </div>

          <div className="bg-carbon-black/60 p-2 rounded-xl border border-pure-white/10 flex flex-col justify-between">
            <span className="text-[9px] text-highlight-silver/70 font-bold uppercase">Rear Defense</span>
            <span className="text-sm font-black text-amber-400 truncate">
              {targetBehind ? `P${targetBehind.rank} ${targetBehind.displayName}` : 'NONE'}
            </span>
            <span className="text-[10px] text-amber-300 font-bold">
              {targetBehind ? `+${gapToBehind} pts cushion` : 'No Pursuer'}
            </span>
          </div>

          <div className="bg-carbon-black/60 p-2 rounded-xl border border-pure-white/10 flex flex-col justify-between">
            <span className="text-[9px] text-highlight-silver/70 font-bold uppercase">Overtake Potential</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-pure-white/10 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${overtakeScore}%` }} />
              </div>
              <span className="text-xs font-black text-emerald-400">{overtakeScore}%</span>
            </div>
            <span className="text-[9px] text-highlight-silver/80">
              {overtakeScore > 75 ? 'HIGH ATTACK RATE' : overtakeScore > 40 ? 'MODERATE GAP' : 'STEEP CLIMB'}
            </span>
          </div>

          <div className="bg-carbon-black/60 p-2 rounded-xl border border-pure-white/10 flex flex-col justify-between">
            <span className="text-[9px] text-highlight-silver/70 font-bold uppercase">Defensive Rating</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-pure-white/10 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-400 h-full rounded-full transition-all duration-500" style={{ width: `${defenseScore}%` }} />
              </div>
              <span className="text-xs font-black text-purple-300">{defenseScore}%</span>
            </div>
            <span className="text-[9px] text-highlight-silver/80">
              {defenseScore > 75 ? 'SECURE CUSHION' : 'REAR THREAT ACTIVE'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. VISUAL CHARTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* CHART A: 4-AXIS SPIDER / RADAR POWER MATRIX */}
        <div className="bg-carbon-fiber rounded-2xl p-4 border border-pure-white/10 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-pure-white/10 pb-2 mb-3">
            <div>
              <span className="text-[9px] font-black uppercase text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
                Performance Shape
              </span>
              <h4 className="text-sm font-black text-pure-white uppercase tracking-wider mt-1">
                4-Axis Telemetry Radar
              </h4>
            </div>
            <span className="text-[10px] font-mono text-highlight-silver/70">
              Overlay vs P1
            </span>
          </div>

          <div className="flex flex-col items-center justify-center relative py-2">
            <svg width="240" height="240" viewBox="0 0 240 240" className="overflow-visible">
              {/* Concentric Grid Rings */}
              {[0.25, 0.5, 0.75, 1.0].map((ring, i) => (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r * ring}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1"
                  strokeDasharray={i === 3 ? "none" : "2 2"}
                />
              ))}

              {/* Axis Cross Lines */}
              <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
              <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />

              {/* Axis Corner Labels */}
              <text x={cx} y={cy - r - 8} fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle" className="font-mono">
                GP ({activeBd.gp})
              </text>
              <text x={cx + r + 10} y={cy + 3} fill="#3b82f6" fontSize="9" fontWeight="bold" textAnchor="start" className="font-mono">
                QUAL ({activeBd.quali})
              </text>
              <text x={cx} y={cy + r + 16} fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="middle" className="font-mono">
                SPR ({activeBd.sprint})
              </text>
              <text x={cx - r - 10} y={cy + 3} fill="#a855f7" fontSize="9" fontWeight="bold" textAnchor="end" className="font-mono">
                FL ({activeBd.fl})
              </text>

              {/* P1 Leader Radar Polygon */}
              {p1Leader && (
                <>
                  <path
                    d={p1Radar.path}
                    fill="rgba(16, 185, 129, 0.15)"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />
                  {p1Radar.points.map((pt, idx) => (
                    <circle key={idx} cx={pt.x} cy={pt.y} r="3" fill="#10b981" />
                  ))}
                </>
              )}

              {/* Active Principal Radar Polygon */}
              <path
                d={activeRadar.path}
                fill={isSelf ? "rgba(168, 85, 247, 0.3)" : "rgba(239, 68, 68, 0.3)"}
                stroke={isSelf ? "#c084fc" : "#f87171"}
                strokeWidth="2.5"
              />
              {activeRadar.points.map((pt, idx) => (
                <circle key={idx} cx={pt.x} cy={pt.y} r="4" fill={isSelf ? "#c084fc" : "#f87171"} stroke="#ffffff" strokeWidth="1" />
              ))}
            </svg>

            {/* Radar Legend */}
            <div className="flex items-center gap-4 mt-3 font-mono text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${isSelf ? 'bg-purple-500' : 'bg-red-500'}`} />
                <span className="text-pure-white font-bold">{activeUser.displayName} (Active)</span>
              </div>
              {p1Leader && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span className="text-emerald-400 font-bold">P1 {p1Leader.displayName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CHART B: MULTI-RIVAL CATEGORY BREAKDOWN BARS */}
        <div className="bg-carbon-fiber rounded-2xl p-4 border border-pure-white/10 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-pure-white/10 pb-2 mb-3">
            <div>
              <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                Category Comparison
              </span>
              <h4 className="text-sm font-black text-pure-white uppercase tracking-wider mt-1">
                Points Distribution Telemetry
              </h4>
            </div>
            <span className="text-[10px] font-mono text-highlight-silver/70">
              GP / QUAL / SPR / FL
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {/* Active User Category Bars */}
            <div className="bg-carbon-black/80 p-2.5 rounded-xl border border-pure-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`font-black flex items-center gap-1.5 ${isSelf ? 'text-purple-300' : 'text-red-400'}`}>
                  <span>P{activeUser.rank} {activeUser.displayName}</span>
                  {isSelf && <span className="text-[8px] bg-purple-600 text-pure-white px-1 rounded">YOU</span>}
                </span>
                <span className="font-bold text-yellow-400">{activePoints} PTS</span>
              </div>

              {/* Stacked / Category Bar Breakdown */}
              <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                <div>
                  <div className="flex justify-between text-[9px] text-red-400 mb-0.5 font-bold">
                    <span>GP</span>
                    <span>{activeBd.gp}</span>
                  </div>
                  <div className="bg-pure-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full rounded-full" style={{ width: `${Math.min(100, (activeBd.gp / maxGp) * 100)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[9px] text-blue-400 mb-0.5 font-bold">
                    <span>QUAL</span>
                    <span>{activeBd.quali}</span>
                  </div>
                  <div className="bg-pure-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, (activeBd.quali / maxQuali) * 100)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[9px] text-amber-400 mb-0.5 font-bold">
                    <span>SPR</span>
                    <span>{activeBd.sprint}</span>
                  </div>
                  <div className="bg-pure-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, (activeBd.sprint / maxSprint) * 100)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[9px] text-purple-400 mb-0.5 font-bold">
                    <span>FL</span>
                    <span>{activeBd.fl}</span>
                  </div>
                  <div className="bg-pure-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min(100, (activeBd.fl / maxFl) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Target Ahead Category Bars */}
            {targetAhead && (
              <div className="bg-carbon-black/60 p-2 rounded-xl border border-emerald-500/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-emerald-400 text-[11px]">
                    🎯 P{targetAhead.rank} {targetAhead.displayName} (Target Ahead)
                  </span>
                  <span className="font-bold text-emerald-300 text-[11px]">{aheadPoints} PTS (+{gapToAhead})</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-[9px]">
                  <div className="text-highlight-silver/80">GP: <strong className="text-pure-white">{aheadBd.gp}</strong></div>
                  <div className="text-highlight-silver/80">QUAL: <strong className="text-pure-white">{aheadBd.quali}</strong></div>
                  <div className="text-highlight-silver/80">SPR: <strong className="text-pure-white">{aheadBd.sprint}</strong></div>
                  <div className="text-highlight-silver/80">FL: <strong className="text-pure-white">{aheadBd.fl}</strong></div>
                </div>
              </div>
            )}

            {/* Target Behind Category Bars */}
            {targetBehind && (
              <div className="bg-carbon-black/60 p-2 rounded-xl border border-amber-500/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-amber-400 text-[11px]">
                    🛡️ P{targetBehind.rank} {targetBehind.displayName} (Rear Guard)
                  </span>
                  <span className="font-bold text-amber-300 text-[11px]">{behindPoints} PTS (Cushion: +{gapToBehind})</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-[9px]">
                  <div className="text-highlight-silver/80">GP: <strong className="text-pure-white">{behindBd.gp}</strong></div>
                  <div className="text-highlight-silver/80">QUAL: <strong className="text-pure-white">{behindBd.quali}</strong></div>
                  <div className="text-highlight-silver/80">SPR: <strong className="text-pure-white">{behindBd.sprint}</strong></div>
                  <div className="text-highlight-silver/80">FL: <strong className="text-pure-white">{behindBd.fl}</strong></div>
                </div>
              </div>
            )}

            {/* P1 Leader Category Bars if not active user */}
            {p1Leader && p1Leader.id !== activeUser.id && (
              <div className="bg-carbon-black/40 p-2 rounded-xl border border-pure-white/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-yellow-400 text-[11px]">
                    🏆 P1 {p1Leader.displayName} (Championship Leader)
                  </span>
                  <span className="font-bold text-yellow-300 text-[11px]">{p1Points} PTS</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-[9px]">
                  <div className="text-highlight-silver/80">GP: <strong className="text-pure-white">{p1Bd.gp}</strong></div>
                  <div className="text-highlight-silver/80">QUAL: <strong className="text-pure-white">{p1Bd.quali}</strong></div>
                  <div className="text-highlight-silver/80">SPR: <strong className="text-pure-white">{p1Bd.sprint}</strong></div>
                  <div className="text-highlight-silver/80">FL: <strong className="text-pure-white">{p1Bd.fl}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3. VISUAL CHART C: SEASON PACE & TRAJECTORY LINE CHART */}
      <div className="bg-carbon-fiber rounded-2xl p-4 border border-pure-white/10 shadow-lg">
        <div className="flex items-center justify-between border-b border-pure-white/10 pb-2 mb-3">
          <div>
            <span className="text-[9px] font-black uppercase text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/30">
              Trajectory Line
            </span>
            <h4 className="text-sm font-black text-pure-white uppercase tracking-wider mt-1">
              Championship Points Progression
            </h4>
          </div>
          <span className="text-[10px] font-mono text-highlight-silver/70">
            Recent Race Rounds
          </span>
        </div>

        <div className="w-full overflow-x-auto custom-scrollbar py-2">
          <div className="min-w-[340px] flex flex-col items-center">
            <svg width={lineW} height={lineH} viewBox={`0 0 ${lineW} ${lineH}`} className="overflow-visible">
              {/* Horizontal Grid lines */}
              {[0.25, 0.5, 0.75, 1.0].map((grid, i) => {
                const y = lineH - 20 - grid * (lineH - 35);
                return (
                  <line key={i} x1="20" y1={y} x2={lineW - 20} y2={y} stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
                );
              })}

              {/* P1 Leader Line */}
              {p1Leader && (
                <>
                  <path d={getLinePath(p1Trajectory)} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3 3" />
                  {p1PointsCoords.map((pt, i) => (
                    <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#10b981" />
                  ))}
                </>
              )}

              {/* Target Ahead Line */}
              {targetAhead && (
                <>
                  <path d={getLinePath(aheadTrajectory)} fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                  {aheadPointsCoords.map((pt, i) => (
                    <circle key={i} cx={pt.x} cy={pt.y} r="2.5" fill="#38bdf8" />
                  ))}
                </>
              )}

              {/* Active User Line */}
              <path d={getLinePath(activeTrajectory)} fill="none" stroke={isSelf ? "#c084fc" : "#f87171"} strokeWidth="3" />
              {activePointsCoords.map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r="5" fill={isSelf ? "#a855f7" : "#ef4444"} stroke="#ffffff" strokeWidth="1.5" />
                  <text x={pt.x} y={pt.y - 9} fill={isSelf ? "#e9d5ff" : "#fca5a5"} fontSize="8" fontWeight="bold" textAnchor="middle" className="font-mono">
                    {pt.val}
                  </text>
                </g>
              ))}

              {/* X-Axis Round Labels */}
              {rounds.map((rName, idx) => {
                const x = (idx / (rounds.length - 1)) * (lineW - 40) + 20;
                return (
                  <text key={idx} x={x} y={lineH - 4} fill="#a3a3a3" fontSize="8" fontWeight="bold" textAnchor="middle" className="font-mono">
                    {rName}
                  </text>
                );
              })}
            </svg>

            {/* Line Chart Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-2 font-mono text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-3 h-0.5 ${isSelf ? 'bg-purple-400' : 'bg-red-400'}`} />
                <span className="text-pure-white font-bold">{activeUser.displayName}</span>
              </div>
              {targetAhead && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-sky-400" />
                  <span className="text-sky-300 font-bold">P{targetAhead.rank} {targetAhead.displayName}</span>
                </div>
              )}
              {p1Leader && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-400" />
                  <span className="text-emerald-400 font-bold">P1 {p1Leader.displayName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. TACTICAL STRATEGY & OVERTAKE ADVISORY */}
      <div className="bg-gradient-to-r from-carbon-black via-carbon-fiber to-carbon-black rounded-2xl p-4 border border-pure-white/10 shadow-lg font-mono">
        <div className="flex items-center gap-2 border-b border-pure-white/10 pb-2 mb-3">
          <span className="text-[10px] font-black uppercase text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/30">
            Race Strategy Intelligence
          </span>
          <span className="text-xs font-bold text-pure-white uppercase">
            Tactical Overtake Advisory
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-carbon-black p-3 rounded-xl border border-emerald-500/30">
            <span className="text-[9px] text-emerald-400 font-bold uppercase block mb-1">Key Category Strength</span>
            <p className="text-pure-white font-bold text-sm">
              {activeBd.gp >= activeBd.quali && activeBd.gp >= activeBd.sprint ? 'Grand Prix Race Pace' :
               activeBd.quali >= activeBd.sprint ? 'Qualifying Speed' : 'Sprint Point Harvesting'}
            </p>
            <p className="text-[10px] text-highlight-silver/70 mt-1">
              Provides the main scoring anchor for {activeUser.displayName}.
            </p>
          </div>

          <div className="bg-carbon-black p-3 rounded-xl border border-purple-500/30">
            <span className="text-[9px] text-purple-400 font-bold uppercase block mb-1">Recommended Focus</span>
            <p className="text-pure-white font-bold text-sm">
              {activeBd.fl < 10 ? 'Fastest Lap Bonus Points' : 'Qualifying Pole Picks'}
            </p>
            <p className="text-[10px] text-highlight-silver/70 mt-1">
              High-value low-hanging fruit to shave off rival point gaps.
            </p>
          </div>

          <div className="bg-carbon-black p-3 rounded-xl border border-primary-red/30">
            <span className="text-[9px] text-primary-red font-bold uppercase block mb-1">Championship Goal</span>
            <p className="text-pure-white font-bold text-sm">
              {targetAhead ? `Close +${gapToAhead} PTS to P${targetAhead.rank}` : 'Defend Championship P1'}
            </p>
            <p className="text-[10px] text-highlight-silver/70 mt-1">
              {targetAhead ? 'Overtake within reach next race weekend.' : 'Maintain maximum scoring across all 4 categories.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboardView;
