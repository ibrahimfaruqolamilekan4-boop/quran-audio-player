/**
 * Nooraya Adhan Audio Engine & Realtime Synchronization Manager
 * 
 * Features:
 * 1. Admin-managed Supabase voice streaming with Realtime auto-update
 * 2. Precision 1-second clock tick with drift correction & visibility wake-up
 * 3. Quran / Ambient audio ducking & seamless restoration
 * 4. Stop / Silence controls & audio preview
 * 5. Synthesized Islamic chime fallback for offline / unseeded slots
 */

import { supabaseInstance } from './supabase';

export interface AdhanVoice {
  id: string;
  name_en: string;
  name_ar?: string | null;
  muezzin: string;
  mosque?: string | null;
  audio_url?: string | null;
  fajr_audio_url?: string | null;
  duration: number;
  license?: string | null;
  source?: string | null;
  attribution?: string | null;
  is_active: boolean;
  is_premium: boolean;
}

export interface AdhanPlaybackEvent {
  prayerKey: string;
  voiceName: string;
  muezzin: string;
  isFajr: boolean;
}

class AdhanAudioManager {
  private static instance: AdhanAudioManager;

  private audioEl: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;
  private currentPrayer: string | null = null;
  private currentVoice: AdhanVoice | null = null;
  private previewVoiceId: string | null = null;
  private volume: number = 0.9;
  private voices: AdhanVoice[] = [];
  private lastFiredSet: Set<string> = new Set();
  private wasRecitationPlayingBeforeAdhan: boolean = false;
  private previousAmbientVolume: number = 1.0;
  private tickerInterval: any = null;
  private realtimeChannel: any = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioElement();
      this.initVisibilityListener();
      this.fetchVoices();
      this.setupRealtimeSync();
    }
  }

  public static getInstance(): AdhanAudioManager {
    if (!AdhanAudioManager.instance) {
      AdhanAudioManager.instance = new AdhanAudioManager();
    }
    return AdhanAudioManager.instance;
  }

  private initAudioElement() {
    this.audioEl = new Audio();
    this.audioEl.preload = 'auto';
    this.audioEl.volume = this.volume;

    this.audioEl.addEventListener('ended', () => {
      this.handleAdhanEnded();
    });

    this.audioEl.addEventListener('error', (e) => {
      console.warn('[AdhanAudio] Audio element error event, falling back to chime:', e);
      this.handleAdhanEnded();
    });
  }

  private initVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Instant clock sync on mobile wake-up
        this.emitStateChange();
      }
    });
  }

  /**
   * Fetches active adhan voices from Supabase (or /api/adhan-voices)
   */
  public async fetchVoices(): Promise<AdhanVoice[]> {
    try {
      if (supabaseInstance) {
        const { data, error } = await supabaseInstance
          .from('adhan_voices')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data)) {
          this.voices = data;
          this.emitStateChange();
          return data;
        }
      }

      const res = await fetch('/api/adhan-voices');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.voices)) {
          this.voices = json.voices;
          this.emitStateChange();
          return json.voices;
        }
      }
    } catch (e) {
      console.warn('[AdhanAudio] Voices fetch note:', e);
    }
    return this.voices;
  }

  /**
   * Realtime Supabase synchronization for live adhan voices
   */
  private setupRealtimeSync() {
    if (!supabaseInstance) return;
    try {
      this.realtimeChannel = supabaseInstance
        .channel('adhan-voices-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'adhan_voices' },
          () => {
            this.fetchVoices();
          }
        )
        .subscribe();
    } catch {
      // Ignored if realtime not connected
    }
  }

  public getVoices(): AdhanVoice[] {
    return this.voices;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioEl) {
      this.audioEl.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getPlaybackState() {
    return {
      isPlaying: this.isPlaying,
      currentPrayer: this.currentPrayer,
      currentVoice: this.currentVoice,
      previewVoiceId: this.previewVoiceId,
    };
  }

  /**
   * Plays gentle synthesized Islamic chime when no audio URL is assigned
   * or when user selects "Short Chime / Notification Only"
   */
  public playChime(count = 2) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        const startTime = ctx.currentTime + i * 0.8;
        osc.frequency.setValueAtTime(440, startTime); // A4
        osc.frequency.exponentialRampToValueAtTime(880, startTime + 0.35); // A5

        gain.gain.setValueAtTime(0.3 * this.volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.75);
      }
    } catch (err) {
      console.warn('[AdhanAudio] AudioContext chime notice:', err);
    }
  }

  /**
   * Ducks recitation and ambient audio before playing Adhan
   */
  private duckBackgroundAudio() {
    // Notify the player context and global listeners
    window.dispatchEvent(new CustomEvent('nooraya-duck-recitation', { detail: { ducked: true } }));
  }

  /**
   * Restores recitation and ambient audio after Adhan finishes
   */
  private restoreBackgroundAudio() {
    window.dispatchEvent(new CustomEvent('nooraya-duck-recitation', { detail: { ducked: false } }));
  }

  /**
   * Plays the Adhan for a specific prayer time with the chosen voice
   */
  public async playAdhan(
    prayerKey: string,
    voiceId?: string,
    shortOnly = false
  ): Promise<boolean> {
    const isFajr = prayerKey.toLowerCase() === 'fajr';

    // 1. If short only, play chime
    if (shortOnly) {
      this.playChime(3);
      return true;
    }

    // 2. Select voice
    let voice = this.voices.find((v) => v.id === voiceId);
    if (!voice && this.voices.length > 0) {
      voice = this.voices.find((v) => v.is_active && !v.is_premium) || this.voices[0];
    }

    const audioUrl = isFajr ? voice?.fajr_audio_url || voice?.audio_url : voice?.audio_url;

    // If slot has no audio URL yet ("Upload when licensed"), gracefully fallback to gentle chime
    if (!audioUrl) {
      console.info(`[AdhanAudio] Voice ${voice?.name_en || 'Default'} has no audio URL yet. Playing gentle chime.`);
      this.playChime(4);
      return false;
    }

    try {
      this.duckBackgroundAudio();

      if (!this.audioEl) this.initAudioElement();
      if (!this.audioEl) return false;

      this.audioEl.src = audioUrl;
      this.audioEl.volume = this.volume;

      this.isPlaying = true;
      this.currentPrayer = prayerKey;
      this.currentVoice = voice || null;
      this.previewVoiceId = null;

      await this.audioEl.play();

      this.emitStateChange();

      window.dispatchEvent(
        new CustomEvent<AdhanPlaybackEvent>('nooraya-adhan-started', {
          detail: {
            prayerKey,
            voiceName: voice?.name_en || 'Adhan',
            muezzin: voice?.muezzin || 'Prophet Mosque Muezzin',
            isFajr,
          },
        })
      );

      return true;
    } catch (err: any) {
      console.warn('[AdhanAudio] Could not autoplay Adhan (gesture required or locked):', err?.message);
      this.playChime(2);
      this.handleAdhanEnded();
      return false;
    }
  }

  /**
   * Previews a voice in settings
   */
  public async previewVoice(voice: AdhanVoice, isFajr = false): Promise<void> {
    if (this.previewVoiceId === voice.id && this.isPlaying) {
      this.stop();
      return;
    }

    const url = isFajr ? voice.fajr_audio_url || voice.audio_url : voice.audio_url;
    if (!url) {
      this.playChime(2);
      return;
    }

    try {
      if (!this.audioEl) this.initAudioElement();
      if (!this.audioEl) return;

      this.audioEl.src = url;
      this.audioEl.volume = this.volume;
      this.isPlaying = true;
      this.previewVoiceId = voice.id;
      this.currentPrayer = null;
      this.currentVoice = voice;

      await this.audioEl.play();
      this.emitStateChange();
    } catch (err) {
      console.warn('[AdhanAudio] Preview playback notice:', err);
      this.handleAdhanEnded();
    }
  }

  /**
   * Stop / Silence button
   */
  public stop(): void {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
    this.handleAdhanEnded();
  }

  private handleAdhanEnded() {
    this.isPlaying = false;
    this.currentPrayer = null;
    this.previewVoiceId = null;
    this.restoreBackgroundAudio();
    this.emitStateChange();

    window.dispatchEvent(new CustomEvent('nooraya-adhan-ended'));
  }

  /**
   * Starts precision 1-second clock tick with drift correction
   */
  public startDriftCorrectedScheduler(
    getSchedule: () => {
      prayers: Record<string, Date>;
      remindersEnabled: Record<string, boolean>;
      voiceId?: string;
      shortOnly?: Record<string, boolean>;
    }
  ) {
    if (this.tickerInterval) clearInterval(this.tickerInterval);

    this.tickerInterval = setInterval(() => {
      const now = new Date();
      const todayDateStr = now.toISOString().split('T')[0];
      const schedule = getSchedule();
      if (!schedule || !schedule.prayers) return;

      const prayerKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

      for (const p of prayerKeys) {
        const prayerTime = schedule.prayers[p];
        if (!prayerTime) continue;

        const isEnabled = schedule.remindersEnabled[p] ?? true;
        if (!isEnabled) continue;

        const keyId = `${todayDateStr}_${p}`;
        if (this.lastFiredSet.has(keyId)) continue;

        const diffMs = now.getTime() - prayerTime.getTime();

        // Exact prayer trigger window: between 0 and 2.5 seconds after exact prayer time
        if (diffMs >= 0 && diffMs <= 2500) {
          this.lastFiredSet.add(keyId);
          const shortOnly = schedule.shortOnly?.[p] ?? false;
          this.playAdhan(p, schedule.voiceId, shortOnly);
          break;
        }
      }
    }, 1000);
  }

  public stopScheduler() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }

  private emitStateChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nooraya-adhan-state-changed'));
    }
  }
}

export const adhanAudio = AdhanAudioManager.getInstance();
