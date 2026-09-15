// Pass 2 (ayah mode) — PlayerContext patches. Run: node patch-pass2-ctx.cjs
const fs = require('fs');
const path = 'src/context/PlayerContext.tsx';
let s = fs.readFileSync(path, 'utf8');
if (s.includes("from '../lib/ayah'")) { console.log('already patched'); process.exit(0); }
const R = (from, to) => {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.error(`ABORT: anchor x${n}: ${JSON.stringify(from.slice(0, 70))}`); process.exit(1); }
  s = s.replace(from, to);
};

// 1. import (before the first interface/export)
R('\nexport interface', `\nimport { ayahStreamUrl, cdnVoiceFor, versesInSurah } from '../lib/ayah';\n\nexport interface`);

// 2. interface
R('  setNowPlayingOpen: (open: boolean) => void;',
`  setNowPlayingOpen: (open: boolean) => void;
  playMode: 'surah' | 'ayah';
  setPlayMode: (mode: 'surah' | 'ayah') => void;
  currentAyah: { surah: number; ayah: number } | null;`);

// 3. state + refs
R('  const [isNowPlayingOpen, setNowPlayingOpen] = useState(false);',
`  const [isNowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [playMode, setPlayModeState] = useState<'surah' | 'ayah'>(() => {
    try { return localStorage.getItem('quran-garden:playMode') === 'ayah' ? 'ayah' : 'surah'; } catch { return 'surah'; }
  });
  const [currentAyah, setCurrentAyah] = useState<{ surah: number; ayah: number } | null>(null);
  const playModeRef = useRef(playMode);
  playModeRef.current = playMode;
  const currentAyahRef = useRef(currentAyah);
  currentAyahRef.current = currentAyah;`);

// 4. startChapter: ayah option
R('    options: { resumeAt?: number; autoplay?: boolean } = {}',
'    options: { resumeAt?: number; autoplay?: boolean; ayah?: number | null } = {}');

// 5. resolve which stream this attempt should use
R('    const { resumeAt = 0, autoplay = true } = options;\n\n    setIsLoading(true);',
`    const { resumeAt = 0, autoplay = true } = options;
    const voice = cdnVoiceFor(reciter);
    const ayahNumber =
      options.ayah !== undefined
        ? options.ayah
        : playModeRef.current === 'ayah' && voice
          ? currentAyahRef.current && currentAyahRef.current.surah === chapter.id
            ? currentAyahRef.current.ayah
            : 1
          : null;
    const useAyahStream = ayahNumber !== null && ayahNumber !== undefined && voice !== null;
    setCurrentAyah(useAyahStream ? { surah: chapter.id, ayah: ayahNumber as number } : null);

    setIsLoading(true);`);

// 6. urls / cacheKey branch
R('    const urls = candidateUrls(reciter, chapter.id);\n    const cacheKey = `quran_audio_${reciter.id}_${chapter.id}`;',
`    const urls = useAyahStream
      ? [ayahStreamUrl(voice as { voice: string; bitrate: number }, chapter.id, ayahNumber as number)]
      : candidateUrls(reciter, chapter.id);
    const cacheKey = useAyahStream
      ? \`quran_ayah_\${(voice as { voice: string }).voice}_\${chapter.id}_\${ayahNumber}\`
      : \`quran_audio_\${reciter.id}_\${chapter.id}\`;`);

// 7. attempt ref: ayah clips always start from zero
R('      cacheKey,\n      resumeAt,\n      autoplay,',
`      cacheKey,
      resumeAt: useAyahStream ? 0 : resumeAt,
      autoplay,`);

// 8. playChapter sets the user-facing context state too
R('      const reciter = currentReciter ?? allReciters[0];\n      setNowPlayingOpen(true);',
'      const reciter = currentReciter ?? allReciters[0];\n      setNowPlayingOpen(true);');

// 9. next = next ayah when in ayah mode
R(`    const currentIndex = list.findIndex(c => c.id === chapter.id);
    if (currentIndex > -1 && currentIndex < list.length - 1) {
      void startChapter(list[currentIndex + 1], reciter);
    }
  };`,
`    const ayah = currentAyahRef.current;
    if (ayah && cdnVoiceFor(reciter) && ayah.ayah < versesInSurah(ayah.surah)) {
      void startChapter(chapter, reciter, { ayah: ayah.ayah + 1 });
      return;
    }
    const currentIndex = list.findIndex(c => c.id === chapter.id);
    if (currentIndex > -1 && currentIndex < list.length - 1) {
      void startChapter(list[currentIndex + 1], reciter);
    }
  };`);

// 10. previous = previous ayah (at ayah 1, the normal surah-rewind takes over)
R(`    const currentIndex = list.findIndex(c => c.id === chapter.id);
    if (currentIndex > 0) {
      void startChapter(list[currentIndex - 1], reciter);
    }
  };`,
`    const ayah = currentAyahRef.current;
    if (ayah && cdnVoiceFor(reciter) && ayah.ayah > 1) {
      void startChapter(chapter, reciter, { ayah: ayah.ayah - 1 });
      return;
    }
    const currentIndex = list.findIndex(c => c.id === chapter.id);
    if (currentIndex > 0) {
      void startChapter(list[currentIndex - 1], reciter);
    }
  };`);

// 11. setPlayMode wrapper (restart current chapter under the new rule)
R('  const togglePlayPause = () => {',
`  const setPlayMode = (mode: 'surah' | 'ayah') => {
    if (mode === playMode) return;
    setPlayModeState(mode);
    playModeRef.current = mode;
    try { localStorage.setItem('quran-garden:playMode', mode); } catch { /* private mode */ }
    const chapter = currentChapterRef.current;
    const reciter = currentReciterRef.current;
    if (chapter && reciter) {
      void startChapter(chapter, reciter, { ayah: mode === 'ayah' && cdnVoiceFor(reciter) ? 1 : null });
    }
  };

  const togglePlayPause = () => {`);

// 12. value surface
R('      isNowPlayingOpen,\n      setNowPlayingOpen\n    }}>',
`      isNowPlayingOpen,
      setNowPlayingOpen,
      playMode,
      setPlayMode,
      currentAyah
    }}>`);

fs.writeFileSync(path, s);
console.log('PlayerContext patched');
