import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('--- VERIFYING MODULAR REFACTORED VIEWS ---');

const requiredFiles = [
  // Settings view split
  'src/views/settings/SettingsView.tsx',
  'src/views/settings/ProfileSection.tsx',
  'src/views/settings/ReciterManager.tsx',
  'src/views/settings/SurahUploadManager.tsx',
  'src/views/settings/BackgroundManager.tsx',
  'src/views/settings/AdminUsersSection.tsx',
  'src/views/settings/components/AddReciterModal.tsx',
  'src/views/settings/components/BioEditor.tsx',
  'src/views/SettingsView.tsx',

  // Prayer times view split
  'src/views/prayer/PrayerTimesView.tsx',
  'src/views/prayer/PrayerHeader.tsx',
  'src/views/prayer/PrayerSettingsPanel.tsx',
  'src/views/prayer/AdhanVoiceSelector.tsx',
  'src/views/prayer/DailyPrayerList.tsx',
  'src/views/prayer/WeeklyPrayerGrid.tsx',
  'src/views/prayer/MonthlyPrayerGrid.tsx',
  'src/views/PrayerTimesView.tsx',
];

for (const rel of requiredFiles) {
  const fullPath = path.resolve(process.cwd(), rel);
  assert.equal(fs.existsSync(fullPath), true, `File missing: ${rel}`);
  const stat = fs.statSync(fullPath);
  assert.ok(stat.size > 20, `File is unexpectedly empty: ${rel} (${stat.size} bytes)`);
  console.log(`✓ Verified ${rel} (${stat.size} bytes)`);
}

// Verify zero oscillator code in prayer components
const prayerFiles = [
  'src/views/PrayerTimesView.tsx',
  'src/views/prayer/PrayerTimesView.tsx',
  'src/views/prayer/AdhanVoiceSelector.tsx',
  'src/views/prayer/DailyPrayerList.tsx',
];
for (const rel of prayerFiles) {
  const code = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
  assert.equal(code.includes('createOscillator'), false, `createOscillator found in ${rel}`);
  assert.equal(code.includes('OscillatorNode'), false, `OscillatorNode found in ${rel}`);
}
console.log('✓ All prayer files pass the zero-oscillator sound engine requirement!');

// Verify Sheikh Alhaji Abdulmumin Okin in constants
const constantsCode = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/constants.ts'), 'utf8');
assert.ok(constantsCode.includes('mumeen_okin'), 'mumeen_okin must exist in constants.ts');
assert.ok(constantsCode.includes('Sheikh Alhaji Abdulmumin (Mumini) Okin'), 'Searchable sheikh name must exist in constants.ts');
assert.ok(constantsCode.includes('/images/reciters/mumeen_okin.jpg'), 'Local bundled portrait must exist');
console.log('✓ Verified Sheikh Alhaji Abdulmumin (Mumini) Okin contract and metadata!');

// Verify AppErrorBoundary has cache-busting reload
const errorBoundaryCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AppErrorBoundary.tsx'), 'utf8');
assert.ok(errorBoundaryCode.includes('unregister'), 'AppErrorBoundary must unregister stale SW on reload');
assert.ok(errorBoundaryCode.includes('caches.delete'), 'AppErrorBoundary must delete stale cache on reload');
console.log('✓ Verified AppErrorBoundary mobile cache-busting reload recovery!');

console.log('ALL ARCHITECTURAL REFACTORING VERIFICATIONS PASSED SUCCESSFULLY!');
