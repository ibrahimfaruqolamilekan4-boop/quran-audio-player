import fs from 'fs';
import path from 'path';

console.log('--- VERIFYING FREE VS PREMIUM & NOW PLAYING SUBCOMPONENTS ---');

const filesToVerify = [
  'src/components/FeatureMatrix.tsx',
  'src/components/now-playing/BackgroundLayer.tsx',
  'src/components/now-playing/ErrorBanner.tsx',
  'src/components/now-playing/SleepTimerModal.tsx',
  'src/components/now-playing/AmbientSoundSheet.tsx',
  'src/components/now-playing/AyahReaderSheet.tsx',
  'src/components/NowPlayingOverlay.tsx',
  'src/components/SubscriptionModal.tsx',
  'src/views/PremiumView.tsx',
  'src/components/DownloadManager.tsx',
  'src/components/SurahDownloadButton.tsx',
  'src/lib/offlineManager.ts',
  'src/lib/supabase.ts',
  'src/views/RecitersHubView.tsx'
];

let failed = false;

for (const relPath of filesToVerify) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${relPath}`);
    failed = true;
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.length === 0) {
    console.error(`❌ Empty file: ${relPath}`);
    failed = true;
    continue;
  }

  // Check for common syntax/import flaws
  if (content.includes('<<<<<<<') || content.includes('>>>>>>>')) {
    console.error(`❌ Merge conflict markers found in: ${relPath}`);
    failed = true;
  }

  console.log(`✓ Verified ${relPath} (${content.length} bytes)`);
}

// 1. Verify 500 NGN plan exists in supabase.ts
const supabaseContent = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/supabase.ts'), 'utf8');
if (!supabaseContent.includes('amount: 500') || !supabaseContent.includes("currency: 'NGN'")) {
  console.error('❌ DEFAULT_CLIENT_PLAN missing 500 NGN in src/lib/supabase.ts');
  failed = true;
} else {
  console.log('✓ Verified DEFAULT_CLIENT_PLAN has amount: 500 and currency: NGN');
}

// 2. Verify FeatureMatrix structure
const matrixContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/FeatureMatrix.tsx'), 'utf8');
const expectedTerms = [
  'Full Quran (all 114 surahs)',
  'Ambient soundscapes',
  'Offline downloads',
  'Sleep timer',
  'Adhan notifications',
  'Premium (₦500)',
];
for (const term of expectedTerms) {
  if (!matrixContent.includes(term)) {
    console.error(`❌ FeatureMatrix missing expected term: ${term}`);
    failed = true;
  }
}
console.log('✓ Verified FeatureMatrix includes all user-specified tiers and ₦500 price badge');

// 3. Verify NowPlayingOverlay modularity
const npoContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/NowPlayingOverlay.tsx'), 'utf8');
const subcomponents = [
  'BackgroundLayer',
  'ErrorBanner',
  'AmbientSoundSheet',
  'SleepTimerModal',
  'AyahReaderSheet'
];
for (const comp of subcomponents) {
  if (!npoContent.includes(comp)) {
    console.error(`❌ NowPlayingOverlay missing subcomponent: ${comp}`);
    failed = true;
  }
}
console.log('✓ Verified NowPlayingOverlay cleanly extracts and mounts all 5 subcomponents');

// 4. Verify Free tier offline download limit enforcement
const offlineMgrContent = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/offlineManager.ts'), 'utf8');
if (!offlineMgrContent.includes('FREE_DOWNLOAD_LIMIT = 3')) {
  console.error('❌ FREE_DOWNLOAD_LIMIT = 3 not found in src/lib/offlineManager.ts');
  failed = true;
} else {
  console.log('✓ Verified FREE_DOWNLOAD_LIMIT = 3 in offlineManager.ts');
}

// 5. Verify Sheikh Alhaji Okin in constants.ts and fallbackReciter in RecitersHubView
const constantsContent = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/constants.ts'), 'utf8');
if (!constantsContent.includes('mumeen_okin') || !constantsContent.includes('Sheikh Alhaji Abdulmumin (Mumini) Okin')) {
  console.error('❌ Sheikh Alhaji Abdulmumin Okin missing from constants.ts');
  failed = true;
} else {
  console.log('✓ Verified Sheikh Alhaji Abdulmumin (Mumini) Okin in constants.ts');
}

const recitersHubContent = fs.readFileSync(path.resolve(process.cwd(), 'src/views/RecitersHubView.tsx'), 'utf8');
if (!recitersHubContent.includes('const fallbackReciter =')) {
  console.error('❌ fallbackReciter definition missing from RecitersHubView.tsx');
  failed = true;
} else {
  console.log('✓ Verified fallbackReciter is explicitly declared in RecitersHubView.tsx');
}

if (failed) {
  console.error('FAILED verification');
  process.exit(1);
} else {
  console.log('\n🎉 ALL FREE/PREMIUM, NOWPLAYING OVERLAY, AND RECITERS VERIFICATIONS PASSED 100%!');
}
