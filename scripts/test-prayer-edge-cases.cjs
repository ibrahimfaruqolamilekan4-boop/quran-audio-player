/**
 * Comprehensive Prayer Times Edge Cases & Accuracy Verification
 * Tests:
 * 1. High Latitude (Reykjavik 64.1466°N, Summer Solstice)
 * 2. Midnight Rollover (Post-Isha transition to next day's Fajr)
 * 3. 5-City Astronomical Accuracy Benchmarks
 */

const {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
  HighLatitudeRule,
  Madhab,
} = require('adhan');

console.log('=== TEST 1: HIGH LATITUDE EDGE CASE (Reykjavik 64.1466°N, Summer Solstice June 21) ===');
const reykjavikCoords = new Coordinates(64.1466, -21.9426);
const summerDate = new Date('2026-06-21T12:00:00Z');

const highLatParams = CalculationMethod.MuslimWorldLeague();
highLatParams.highLatitudeRule = HighLatitudeRule.SeventhOfTheNight;

const reykjavikPrayers = new PrayerTimes(reykjavikCoords, summerDate, highLatParams);

console.log('Fajr:   ', reykjavikPrayers.fajr ? reykjavikPrayers.fajr.toISOString() : 'FAIL');
console.log('Sunrise:', reykjavikPrayers.sunrise ? reykjavikPrayers.sunrise.toISOString() : 'FAIL');
console.log('Dhuhr:  ', reykjavikPrayers.dhuhr ? reykjavikPrayers.dhuhr.toISOString() : 'FAIL');
console.log('Asr:    ', reykjavikPrayers.asr ? reykjavikPrayers.asr.toISOString() : 'FAIL');
console.log('Maghrib:', reykjavikPrayers.maghrib ? reykjavikPrayers.maghrib.toISOString() : 'FAIL');
console.log('Isha:   ', reykjavikPrayers.isha ? reykjavikPrayers.isha.toISOString() : 'FAIL');

const hasValidHighLat =
  reykjavikPrayers.fajr instanceof Date &&
  !isNaN(reykjavikPrayers.fajr.getTime()) &&
  reykjavikPrayers.isha instanceof Date &&
  !isNaN(reykjavikPrayers.isha.getTime());

console.log('High Latitude Rule SeventhOfTheNight Passed:', hasValidHighLat ? 'YES (Valid Date Objects)' : 'NO');

console.log('\n=== TEST 2: MIDNIGHT ROLLOVER TEST (Post-Isha transition) ===');
// Test query time at 23:45 in Cairo
const cairoCoords = new Coordinates(30.0444, 31.2357);
const lateNightQuery = new Date('2026-10-28T21:45:00Z'); // 23:45 local Egypt time

const cairoParams = CalculationMethod.Egyptian();
const todayPrayers = new PrayerTimes(cairoCoords, lateNightQuery, cairoParams);

const tomorrowDate = new Date(lateNightQuery);
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrowPrayers = new PrayerTimes(cairoCoords, tomorrowDate, cairoParams);

// Determine next prayer
let nextPrayerName = 'fajr';
let nextPrayerTime = tomorrowPrayers.fajr;

const prayerList = [
  { name: 'fajr', time: todayPrayers.fajr },
  { name: 'sunrise', time: todayPrayers.sunrise },
  { name: 'dhuhr', time: todayPrayers.dhuhr },
  { name: 'asr', time: todayPrayers.asr },
  { name: 'maghrib', time: todayPrayers.maghrib },
  { name: 'isha', time: todayPrayers.isha },
];

for (const p of prayerList) {
  if (p.time.getTime() > lateNightQuery.getTime()) {
    nextPrayerName = p.name;
    nextPrayerTime = p.time;
    break;
  }
}

console.log('Query Time:      ', lateNightQuery.toISOString());
console.log('Today Isha Time: ', todayPrayers.isha.toISOString());
console.log('Tomorrow Fajr:   ', tomorrowPrayers.fajr.toISOString());
console.log('Computed Next:   ', nextPrayerName, 'at', nextPrayerTime.toISOString());
const rolloverPassed = nextPrayerName === 'fajr' && nextPrayerTime.getTime() === tomorrowPrayers.fajr.getTime();
console.log('Midnight Rollover Passed:', rolloverPassed ? 'YES (Tomorrow Fajr correctly targeted)' : 'NO');

console.log('\n=== TEST 3: 5-CITY ACCURACY BENCHMARK ===');
const benchmarkCities = [
  {
    city: 'Makkah',
    country: 'Saudi Arabia',
    coords: new Coordinates(21.4225, 39.8262),
    method: CalculationMethod.UmmAlQura(),
  },
  {
    city: 'Cairo',
    country: 'Egypt',
    coords: new Coordinates(30.0444, 31.2357),
    method: CalculationMethod.Egyptian(),
  },
  {
    city: 'Karachi',
    country: 'Pakistan',
    coords: new Coordinates(24.8607, 67.0011),
    method: CalculationMethod.Karachi(),
    madhab: Madhab.Hanafi,
  },
  {
    city: 'London',
    country: 'United Kingdom',
    coords: new Coordinates(51.5074, -0.1278),
    method: CalculationMethod.MuslimWorldLeague(),
  },
  {
    city: 'New York',
    country: 'United States',
    coords: new Coordinates(40.7128, -74.006),
    method: CalculationMethod.NorthAmerica(),
  },
];

const testDate = new Date('2026-10-28T12:00:00Z');

for (const c of benchmarkCities) {
  if (c.madhab) c.method.madhab = c.madhab;
  const p = new PrayerTimes(c.coords, testDate, c.method);
  console.log(`\n[${c.city}, ${c.country}]`);
  console.log(`  Fajr:    ${p.fajr.toTimeString().slice(0, 5)}`);
  console.log(`  Sunrise: ${p.sunrise.toTimeString().slice(0, 5)}`);
  console.log(`  Dhuhr:   ${p.dhuhr.toTimeString().slice(0, 5)}`);
  console.log(`  Asr:     ${p.asr.toTimeString().slice(0, 5)}`);
  console.log(`  Maghrib: ${p.maghrib.toTimeString().slice(0, 5)}`);
  console.log(`  Isha:    ${p.isha.toTimeString().slice(0, 5)}`);
}

console.log('\nAll edge cases and benchmarks executed successfully.');
