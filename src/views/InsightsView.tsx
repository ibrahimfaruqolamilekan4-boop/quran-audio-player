import React, { useState } from 'react';
import { getListeningLogs } from '../lib/storage';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Sector } from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { CURATED_RECITERS } from '../lib/constants';
import { Clock, Activity, CalendarDays, Award } from 'lucide-react';

export function InsightsView() {
  const [timeView, setTimeView] = useState<'day' | 'week' | 'month'>('week');
  const logs = getListeningLogs();

  // Generate chart data based on timeView
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
    
    return { data, totalMinutesPeriod };
  };

  const { data, totalMinutesPeriod } = generateChartData();
  const avgMinutes = Math.round(totalMinutesPeriod / (timeView === 'day' ? 1 : timeView === 'week' ? 7 : 30));

  // Donut chart data
  const reciterStats = logs.reduce((acc, log) => {
    acc[log.reciterId] = (acc[log.reciterId] || 0) + log.durationSeconds;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(reciterStats)
    .map(([reciterId, seconds]) => {
      const reciter = CURATED_RECITERS.find(r => r.id === reciterId);
      return {
        name: reciter ? reciter.name : 'Unknown',
        value: Math.round(seconds / 60)
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // Top 5
    
  const COLORS = ['#E2B753', '#3B82F6', '#10B981', '#8B5CF6', '#F43F5E'];

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-serif text-white tracking-wide">Insights</h2>
          <p className="text-slate-400 mt-2 font-light text-lg">Track your listening habits and progress.</p>
        </div>
        
        <div className="flex bg-[#11141A] p-1 rounded-xl border border-white/5 w-max">
          {(['day', 'week', 'month'] as const).map(view => (
            <button
              key={view}
              onClick={() => setTimeView(view)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                timeView === view ? 'bg-[#1A1F29] text-gold-400 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#11141A]/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 md:col-span-3">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-serif text-white tracking-wide">Listening Time</h3>
              <p className="text-sm text-slate-400 font-light">{timeView === 'day' ? 'Today' : `Past ${timeView === 'week' ? '7' : '30'} days`}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-serif text-gold-400">{totalMinutesPeriod} <span className="text-lg text-slate-500 font-sans">min</span></p>
              <p className="text-sm text-slate-400 font-light">Avg. {avgMinutes} min / day</p>
            </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#1A1F29' }}
                  contentStyle={{ backgroundColor: '#0A0C10', borderColor: '#1A1F29', borderRadius: '12px' }}
                  itemStyle={{ color: '#E2B753' }}
                />
                <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.minutes > avgMinutes ? '#E2B753' : '#334155'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#11141A]/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
              <Activity size={24} />
            </div>
            <h4 className="text-lg font-serif text-white mb-2">Habit Highlights</h4>
            <p className="text-sm text-slate-400 font-light leading-relaxed">
              {totalMinutesPeriod > avgMinutes * (timeView === 'week' ? 7 : 30) 
                ? "You're listening more than your usual average. Keep it up!" 
                : "You've been consistent. Try listening to a new Surah today."}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-gold-900/20 to-gold-900/5 backdrop-blur-xl p-6 rounded-[2rem] border border-gold-500/20">
            <div className="w-12 h-12 rounded-2xl bg-gold-500/10 text-gold-400 flex items-center justify-center mb-4">
              <Award size={24} />
            </div>
            <h4 className="text-lg font-serif text-white mb-2">Top Reciter</h4>
            <p className="text-sm text-slate-400 font-light leading-relaxed">
              Your most listened to reciter is <span className="text-gold-400 font-medium">{pieData[0]?.name || '...'}</span>.
            </p>
          </div>
        </div>
      </div>

      {pieData.length > 0 && (
        <section>
          <h3 className="text-xl font-medium text-white mb-6 tracking-wide">Top Reciters</h3>
          <div className="bg-[#11141A]/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 flex flex-col md:flex-row items-center gap-12">
            <div className="h-64 w-64 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A0C10', borderColor: '#1A1F29', borderRadius: '12px' }}
                    itemStyle={{ color: '#E2B753' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {pieData.map((data, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <div>
                    <p className="text-sm text-white font-medium">{data.name}</p>
                    <p className="text-xs text-slate-500 font-light">{data.value} min</p>
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
