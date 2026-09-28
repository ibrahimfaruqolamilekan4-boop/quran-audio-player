import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-full bg-amber-500/90 backdrop-blur-md px-4 py-2 text-xs font-semibold text-slate-950 shadow-2xl border border-amber-400/40 animate-bounce">
      <WifiOff size={15} className="text-slate-950 animate-pulse" />
      <span>Offline Mode — Playing cached Quran audio & saved preferences</span>
    </div>
  );
};
