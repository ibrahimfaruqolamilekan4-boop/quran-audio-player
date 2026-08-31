import React, { useState } from 'react';
import { getListeningLogs } from '../lib/storage';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { CURATED_RECITERS } from '../lib/constants';
import { Activity, Award, TrendingUp, Clock, Flame } from 'lucide-react';

export function InsightsView() {
  const [timeView, setTimeView] = useState<'day' | 'week' | 'month'>('week');
  const logs = getListeningLogs();

  const generateChartData = () => {
    const days = timeView === 'day' ? 1 : timeView === 'week' ? 7 : 30;
    const data = [];
    let totalMinutesPeriod = 0;

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date);
      const end = endOfDay(date);

      const dayLogs = logs.filter(l => isWithinInterval(new Date(l.loggedAt), { start, end }));
      const daySeconds = dayLogs.reduce((acc, log) => acc + log.durationSeconds, 0);
      const dayMinutes = Math.round(daySeconds / 60);

      totalMinutesPeriod += dayMinutes;
      data.push({
        name: format(date, timeView === 'month' ? 'MMM d' : 'EEE'),
        minutes: dayMinutes,
        date: date
      });
    }

    return { data, totalMinutesPeriod, daysCount: days };
  };

  const { data, totalMinutesPeriod, daysCount } = generateChartData();
  const avgMinutes = Math.round(totalMinutesPeriod / daysCount);

  // Reciter Stats Calculation
  const reciterStats = logs.reduce((acc, log) => {
    acc[log.reciterId] = (acc[log.reciterId] || 0) + log.durationSeconds;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(reciterStats)
    .map(([reciterId, seconds]) => {
      const reciter = CURATED_RECITERS.find(r => r.id === reciterId);
      return {
        name: reciter ? reciter.name : 'Unknown Reciter',
        value: Math.round(seconds / 60)
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const ACCENT_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-28 text-white max-w-7xl mx-auto px-4">
      {/* Header & Controls */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Your Insights
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-normal">
            Personalized metrics & recitation habits
          </p>
        </div>

        {/* Custom Segmented Control */}
        <div className="flex bg-white/5 backdrop-blur-md p-1 rounded-2xl border border-white/10 self-start sm:self-auto">
          {(['day', 'week', 'month'] as const).map(view => (
            <button
              key={view}
              onClick={() => setTimeView(view)}
              className={`px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                timeView === view
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Listening Chart (2 cols wide on large screens) */}
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all duration-700 pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Listening Time</span>
              </div>
              <h2 className="text-4xl font-black text-white mt-2 tracking-tight">
                {totalMinutesPeriod} <span className="text-lg font-normal text-slate-400">mins</span>
              </h2>
            </div>
            <div className="sm:text-right bg-white/5 px-4 py-2 rounded-2xl border border-white/5 self-start">
              <span className="text-xs text-slate-400 block">Average / Day</span>
              <span className="text-lg font-bold text-amber-400">{avgMinutes} mins</span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 12 }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 12 }} 
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '16px',
                    backdropFilter: 'blur(12px)',
                    color: '#FFF'
                  }}
                  itemStyle={{ color: '#F59E0B' }}
                />
                <Bar dataKey="minutes" radius={[8, 8, 2, 2]}>
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.minutes >= avgMinutes ? '#F59E0B' : '#334155'}
                      className="transition-all duration-300 hover:opacity-80"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Cards */}
        <div className="space-y-6 flex flex-col justify-between">
          {/* Habit Highlight Card */}
          <div className="bg-white/5 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 flex-1 relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <TrendingUp size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Habit Highlight</h3>
            <p className="text-sm text-slate-300 leading-relaxed font-light">
              {timeView === 'day'
                ? totalMinutesPeriod > 15
                  ? "Great effort today! You have met your focus listening goal."
                  : "You are on track. Take a short 10-minute session to stay connected."
                : totalMinutesPeriod > avgMinutes * daysCount
                ? "You're listening more than your usual average. Keep building this habit!"
                : "Consistency is key. Consider listening during your morning or evening routine."}
            </p>
          </div>

          {/* Top Reciter Feature Card */}
          <div className="bg-gradient-to-br from-amber-500/15 via-white/5 to-transparent backdrop-blur-2xl p-6 rounded-3xl border border-amber-500/20 flex-1 relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <Award size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Top Reciter</h3>
            <p className="text-sm text-slate-300 leading-relaxed font-light">
              Your most listened to reciter is{' '}
              <span className="text-amber-400 font-semibold underline decoration-amber-500/40">
                {pieData[0]?.name || 'No reciter logged yet'}
              </span>.
            </p>
          </div>
        </div>
      </div>

      {/* Top Reciters Breakdown (Pie / Donut) */}
      {pieData.length > 0 && (
        <section className="bg-white/5 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-white/10">
          <h3 className="text-xl font-bold text-white mb-6">Reciter Breakdown</h3>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="h-64 w-64 shrink-0 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={ACCENT_COLORS[index % ACCENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      color: '#FFF'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <Flame className="w-6 h-6 text-amber-400 mb-1" />
                <span className="text-xs text-slate-400 font-medium">Top 5</span>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {pieData.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-300"
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0 shadow-lg"
                    style={{ backgroundColor: ACCENT_COLORS[idx % ACCENT_COLORS.length] }}
                  />
                  <div className="overflow-hidden">
                    <p className="text-sm text-white font-medium truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-light">{item.value} mins listened</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
