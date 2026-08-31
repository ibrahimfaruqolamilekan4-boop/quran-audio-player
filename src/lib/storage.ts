export interface UserData {
  goalMinutes: number;
  currentStreak: number;
  lastActive: string;
}

export interface ListeningLog {
  id: string;
  surahId: number;
  reciterId: string;
  durationSeconds: number;
  loggedAt: string;
}

const USER_KEY = 'nooraya_user_data';
const LOGS_KEY = 'nooraya_listening_logs';

export function getUserData(): UserData {
  const data = localStorage.getItem(USER_KEY);
  if (data) {
    const parsed = JSON.parse(data);
    // Check streak
    const today = new Date().toDateString();
    if (parsed.lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (parsed.lastActive === yesterday.toDateString()) {
        parsed.currentStreak += 1;
      } else {
        parsed.currentStreak = 0; // Reset
      }
      parsed.lastActive = today;
      saveUserData(parsed);
    }
    return parsed;
  }
  
  const defaultData: UserData = {
    goalMinutes: 15,
    currentStreak: 0,
    lastActive: new Date().toDateString(),
  };
  saveUserData(defaultData);
  return defaultData;
}

export function saveUserData(data: UserData) {
  localStorage.setItem(USER_KEY, JSON.stringify(data));
}

export function getListeningLogs(): ListeningLog[] {
  const data = localStorage.getItem(LOGS_KEY);
  return data ? JSON.parse(data) : [];
}

export function addListeningLog(surahId: number, reciterId: string, durationSeconds: number) {
  const logs = getListeningLogs();
  const newLog: ListeningLog = {
    id: Date.now().toString(),
    surahId,
    reciterId,
    durationSeconds,
    loggedAt: new Date().toISOString(),
  };
  logs.push(newLog);
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}
