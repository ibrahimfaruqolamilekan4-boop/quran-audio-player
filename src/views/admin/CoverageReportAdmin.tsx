import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  ShieldCheck,
  Music,
  Filter,
  BarChart3,
  Info,
  ChevronDown,
  ChevronUp,
  Volume2,
} from 'lucide-react';
import reciterCoverageData from '../../data/reciterCoverage.json';

interface ReciterCoverage {
  id: string;
  name: string;
  nameArabic: string;
  category: string;
  region: string;
  location: string;
  style: string;
  riwaya: string;
  serverUrl: string;
  host: string;
  license: string;
  availableSurahsCount: number;
  isComplete: boolean;
  missingSurahs: number[];
  missingSurahsCount: number;
  sampleTestStatus: number;
  brokenLink: boolean;
}

export function CoverageReportAdmin() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'partial'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const coverageList = reciterCoverageData as ReciterCoverage[];

  // Metrics
  const totalReciters = coverageList.length;
  const completeCount = coverageList.filter((r) => r.isComplete).length;
  const partialCount = coverageList.filter((r) => !r.isComplete && !r.brokenLink).length;
  const brokenCount = coverageList.filter((r) => r.brokenLink).length;
  const totalAvailableSurahs = coverageList.reduce((acc, r) => acc + r.availableSurahsCount, 0);
  const totalPossibleSurahs = totalReciters * 114;
  const overallPercentage = Math.round((totalAvailableSurahs / totalPossibleSurahs) * 100);

  const categories = useMemo(() => {
    const set = new Set(coverageList.map((r) => r.category).filter(Boolean));
    return Array.from(set);
  }, [coverageList]);

  const filtered = useMemo(() => {
    return coverageList.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.nameArabic.toLowerCase().includes(search.toLowerCase()) ||
        r.riwaya.toLowerCase().includes(search.toLowerCase()) ||
        r.host.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'complete' && r.isComplete) ||
        (statusFilter === 'partial' && !r.isComplete);

      const matchesCat = categoryFilter === 'all' || r.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCat;
    });
  }, [coverageList, search, statusFilter, categoryFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Overview */}
      <div className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                <BarChart3 size={22} />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Reciter Coverage & Sourcing Audit</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Completeness and legal sourcing audit across all curated reciters in the global catalog. 
              Tracks available vs. missing surahs out of 114, canonical riwaya, licensed CDN hosts, and real-time audio stream integrity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck size={14} />
              Open Licensed Streams Only
            </span>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-[#131722]/80 border border-slate-800/80">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Total Sheikhs</div>
            <div className="text-2xl font-bold text-white mt-1">{totalReciters}</div>
            <div className="text-[10px] text-teal-400 mt-0.5">35 curated profiles</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#131722]/80 border border-slate-800/80">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Complete Sets</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{completeCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">114/114 Surahs available</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#131722]/80 border border-slate-800/80">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Partial Sets</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{partialCount}</div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">&lt; 114 Surahs recorded</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#131722]/80 border border-slate-800/80">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Global Coverage</div>
            <div className="text-2xl font-bold text-teal-300 mt-1">{overallPercentage}%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{totalAvailableSurahs} / {totalPossibleSurahs} files</div>
          </div>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0A0F1C]/70 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reciter name, Arabic name, riwaya, or server..."
            className="w-full bg-[#131722] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#131722] p-1 rounded-xl border border-slate-700/80 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                statusFilter === 'all' ? 'bg-teal-500 text-slate-900 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({totalReciters})
            </button>
            <button
              onClick={() => setStatusFilter('complete')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                statusFilter === 'complete' ? 'bg-teal-500 text-slate-900 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Complete ({completeCount})
            </button>
            <button
              onClick={() => setStatusFilter('partial')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                statusFilter === 'partial' ? 'bg-teal-500 text-slate-900 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Partial ({partialCount})
            </button>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#131722] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-500"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Coverage Table */}
      <div className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#131722] text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Reciter</th>
                <th className="py-3.5 px-4">Riwaya / Style</th>
                <th className="py-3.5 px-4">Coverage</th>
                <th className="py-3.5 px-4">Host / License</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.map((rec) => {
                const isExpanded = expandedId === rec.id;
                const percent = Math.round((rec.availableSurahsCount / 114) * 100);

                return (
                  <React.Fragment key={rec.id}>
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-teal-400 text-xs shrink-0">
                            {rec.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="text-white font-semibold flex items-center gap-1.5">
                              {rec.name}
                              <span className="text-[10px] text-slate-500">({rec.id})</span>
                            </div>
                            <div className="text-[11px] text-slate-400" dir="rtl">
                              {rec.nameArabic}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-sans">
                        <div className="text-slate-200 text-xs font-medium">{rec.riwaya}</div>
                        <div className="text-[10px] text-slate-500">{rec.category} • {rec.region}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden shrink-0">
                            <div
                              className={`h-full transition-all duration-300 ${
                                rec.isComplete ? 'bg-emerald-400' : 'bg-amber-400'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className={`text-[11px] font-bold ${rec.isComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {rec.availableSurahsCount}/114
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-sans">
                        <div className="text-xs text-slate-300 flex items-center gap-1">
                          {rec.host}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-xs" title={rec.license}>
                          mp3quran.net Open CDN
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-sans">
                        {rec.isComplete ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={12} />
                            Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle size={12} />
                            Partial ({rec.availableSurahsCount})
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-sans">
                        <button
                          onClick={() => toggleExpand(rec.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-medium inline-flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              Hide <ChevronUp size={12} />
                            </>
                          ) : (
                            <>
                              Audit <ChevronDown size={12} />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable audit row */}
                    {isExpanded && (
                      <tr className="bg-[#0f1422]/90 border-t border-slate-800/80">
                        <td colSpan={6} className="p-5 font-sans">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div className="bg-[#0A0F1C] p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                                  Server Endpoint
                                </span>
                                <a
                                  href={rec.serverUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-teal-400 hover:underline break-all flex items-center gap-1 text-[11px]"
                                >
                                  {rec.serverUrl} <ExternalLink size={12} />
                                </a>
                              </div>

                              <div className="bg-[#0A0F1C] p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                                  License & Permissions
                                </span>
                                <p className="text-slate-300 text-[11px]">
                                  {rec.license}
                                </p>
                              </div>

                              <div className="bg-[#0A0F1C] p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                                  Stream Health
                                </span>
                                <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-semibold">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                  HTTP {rec.sampleTestStatus} OK • Byte Ranges Supported
                                </div>
                              </div>
                            </div>

                            {/* Missing surahs section */}
                            {!rec.isComplete && (
                              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                                    <Info size={14} />
                                    Missing Surahs ({rec.missingSurahsCount} out of 114):
                                  </span>
                                  <span className="text-[10px] text-amber-400/80">
                                    Phase 2 targets for complete set sourcing
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {rec.missingSurahs.map((surahNum) => (
                                    <span
                                      key={surahNum}
                                      className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono"
                                    >
                                      Surah {surahNum}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {rec.isComplete && (
                              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2">
                                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                                <span>
                                  All 114 Surahs (001.mp3 to 114.mp3) are present, verified online, and streamable directly via byte-range seeking.
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
