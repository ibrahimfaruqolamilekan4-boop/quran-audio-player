import React from 'react';
import { formatPrayerTime } from '../../lib/prayer';

interface WeeklyPrayerGridProps {
  weekPrayerTimes: Array<{
    date: Date;
    dayName: string;
    dateFormatted: string;
    prayers: any;
  }>;
  is24Hour: boolean;
  timezone: string;
}

export function WeeklyPrayerGrid({
  weekPrayerTimes,
  is24Hour,
  timezone,
}: WeeklyPrayerGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-emerald-900/80 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <th className="pb-3 px-3">Date</th>
            <th className="pb-3 px-3">Fajr</th>
            <th className="pb-3 px-3 text-emerald-400/60">Sunrise</th>
            <th className="pb-3 px-3">Dhuhr</th>
            <th className="pb-3 px-3">Asr</th>
            <th className="pb-3 px-3">Maghrib</th>
            <th className="pb-3 px-3">Isha</th>
          </tr>
        </thead>
        <tbody className="text-xs sm:text-sm divide-y divide-emerald-950/60 font-mono">
          {weekPrayerTimes.map((day, idx) => {
            const isToday = idx === 0;
            return (
              <tr
                key={day.dayName + idx}
                className={
                  isToday
                    ? 'bg-emerald-500/15 text-emerald-200 font-semibold'
                    : 'text-emerald-100/90 hover:bg-emerald-950/30'
                }
              >
                <td className="py-3 px-3 font-sans font-medium flex items-center gap-2">
                  <span>{day.dayName}</span>
                  <span className="text-xs text-emerald-400/60">({day.dateFormatted})</span>
                  {isToday && (
                    <span className="text-[9px] uppercase font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-md">
                      Today
                    </span>
                  )}
                </td>
                <td className="py-3 px-3">{formatPrayerTime(day.prayers.fajr, is24Hour, timezone)}</td>
                <td className="py-3 px-3 text-emerald-400/50">{formatPrayerTime(day.prayers.sunrise, is24Hour, timezone)}</td>
                <td className="py-3 px-3">{formatPrayerTime(day.prayers.dhuhr, is24Hour, timezone)}</td>
                <td className="py-3 px-3">{formatPrayerTime(day.prayers.asr, is24Hour, timezone)}</td>
                <td className="py-3 px-3">{formatPrayerTime(day.prayers.maghrib, is24Hour, timezone)}</td>
                <td className="py-3 px-3">{formatPrayerTime(day.prayers.isha, is24Hour, timezone)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
