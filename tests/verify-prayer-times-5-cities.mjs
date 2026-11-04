import { calculatePrayerTimes, formatPrayerTime } from '../src/lib/prayer.ts';

const TEST_CITIES = [
  {
    name: 'Makkah',
    country: 'Saudi Arabia',
    latitude: 21.422487,
    longitude: 39.826206,
    timezone: 'Asia/Riyadh',
    method: 'UmmAlQura',
    aladhanMethodId: 4,
  },
  {
    name: 'Cairo',
    country: 'Egypt',
    latitude: 30.0444,
    longitude: 31.2357,
    timezone: 'Africa/Cairo',
    method: 'Egyptian',
    aladhanMethodId: 5,
  },
  {
    name: 'London',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    method: 'MuslimWorldLeague',
    aladhanMethodId: 3,
  },
  {
    name: 'New York',
    country: 'United States',
    latitude: 40.7128,
    longitude: -74.0060,
    timezone: 'America/New_York',
    method: 'NorthAmerica',
    aladhanMethodId: 2,
  },
  {
    name: 'Jakarta',
    country: 'Indonesia',
    latitude: -6.2088,
    longitude: 106.8456,
    timezone: 'Asia/Jakarta',
    method: 'Singapore',
    aladhanMethodId: 11,
  },
];

function toMinutes(hhmm) {
  const clean = String(hhmm).replace(/\s*\(.*\)/, '').trim();
  const [h, m] = clean.split(':').map(Number);
  return h * 60 + m;
}

async function runVerification() {
  const now = new Date();
  const results = [];

  for (const city of TEST_CITIES) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: city.timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(now);
    const dd = parts.find((p) => p.type === 'day')?.value;
    const mm = parts.find((p) => p.type === 'month')?.value;
    const yyyy = parts.find((p) => p.type === 'year')?.value;
    const dateParam = `${dd}-${mm}-${yyyy}`;

    const computed = calculatePrayerTimes(
      city.latitude,
      city.longitude,
      now,
      city.method,
      'shafi',
      'MiddleOfTheNight',
      { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      city.timezone
    );

    const localTimes = {
      Fajr: formatPrayerTime(computed.fajr, true, city.timezone),
      Sunrise: formatPrayerTime(computed.sunrise, true, city.timezone),
      Dhuhr: formatPrayerTime(computed.dhuhr, true, city.timezone),
      Asr: formatPrayerTime(computed.asr, true, city.timezone),
      Maghrib: formatPrayerTime(computed.maghrib, true, city.timezone),
      Isha: formatPrayerTime(computed.isha, true, city.timezone),
    };

    const url = `https://api.aladhan.com/v1/timings/${dateParam}?latitude=${city.latitude}&longitude=${city.longitude}&method=${city.aladhanMethodId}&school=0&timezonestring=${encodeURIComponent(city.timezone)}`;
    const res = await fetch(url);
    const json = await res.json();
    const apiTimings = json?.data?.timings;

    for (const prayer of ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      const ours = localTimes[prayer];
      const theirs = (apiTimings?.[prayer] || '').replace(/\s*\(.*\)/, '').trim();
      const diffMin = toMinutes(ours) - toMinutes(theirs);
      results.push({
        City: `${city.name} (${city.timezone})`,
        Method: city.method,
        Prayer: prayer,
        'On-Device (adhan-js)': ours,
        'Aladhan API': theirs,
        'Diff (mins)': diffMin === 0 ? '0 min' : `${diffMin > 0 ? '+' : ''}${diffMin} min`,
      });
    }
  }

  console.table(results);
}

runVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
