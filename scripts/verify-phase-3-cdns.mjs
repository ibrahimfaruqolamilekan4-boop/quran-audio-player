import https from 'https';

const recitersToTest = [
  { id: 'alzain', name: 'Al-Zain Muhammad Ahmad', cdn: 'https://cdn.mp3quran.net/audio/zain-ahmad/r1/', surahs: [1, 18, 114] },
  { id: 'kalbani', name: 'Adil Al-Kalbani', cdn: 'https://cdn.mp3quran.net/audio/adel-kalbani/r1/', surahs: [1, 18, 114] },
  { id: 'sufi', name: 'Abdur Rashid Sufi (As-Susi)', cdn: 'https://cdn.mp3quran.net/audio/abdulrasheed-sufi/r2/', surahs: [1, 18, 114] },
  { id: 'mousa_bilal', name: 'Mousa Bilal', cdn: 'https://cdn.mp3quran.net/audio/musa-bilal/r1/', surahs: [1, 18, 114] },
  { id: 'kameny', name: 'Okasha Kameny (Al-Bazzi)', cdn: 'https://cdn.mp3quran.net/audio/okasha-kameny/r2/', surahs: [1, 18, 114] },
  { id: 'ali_jaber', name: 'Ali Jaber', cdn: 'https://cdn.mp3quran.net/audio/ali-jaber/r1/', surahs: [1, 18, 114] },
  { id: 'qasim', name: 'Abdulmohsen Al-Qasim', cdn: 'https://cdn.mp3quran.net/audio/abdulmohsen-qasim/r1/', surahs: [1, 18, 114] },
  { id: 'husary_warsh', name: 'Mahmoud Khalil Al-Husary (Warsh)', cdn: 'https://cdn.mp3quran.net/audio/mahmoud-husary/r3/', surahs: [1, 18, 114] },
  { id: 'dokali', name: 'Dokali Mohammad Alalim (Qalun)', cdn: 'https://cdn.mp3quran.net/audio/dokali-alim/r1/', surahs: [1, 18, 114] },
  { id: 'raad_kurdi', name: 'Raad Al-Kurdi', cdn: 'https://cdn.mp3quran.net/audio/raad-kurdi/r1/', surahs: [1, 18, 114] },
  { id: 'muammar', name: 'Muammar ZA (Indonesia)', cdn: 'https://cdn.mp3quran.net/audio/muammar-za/r1/', surahs: [1, 36, 55] },
];

function check(url) {
  return new Promise(resolve => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    }, res => {
      resolve({ url, status: res.statusCode, ok: res.statusCode === 200 });
    });
    req.on('error', e => resolve({ url, status: 0, error: e.message, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, error: 'TIMEOUT', ok: false }); });
    req.end();
  });
}

async function run() {
  console.log('Verifying Phase 3 Reciter CDN endpoints...\n');
  let allPassed = true;
  for (const r of recitersToTest) {
    console.log(`Checking ${r.name} (${r.cdn}):`);
    for (const s of r.surahs) {
      const pad = String(s).padStart(3, '0');
      const url = `${r.cdn}${pad}.mp3`;
      const res = await check(url);
      const mark = res.ok ? '✓ 200' : `✗ [${res.status || res.error}]`;
      console.log(`   Surah ${pad}: ${mark}`);
      if (!res.ok) allPassed = false;
    }
  }
  console.log('\nResult:', allPassed ? 'ALL CANDIDATES FULLY VERIFIED (200 OK)!' : 'SOME ENDPOINTS FAILED');
}

run();
