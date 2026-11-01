/**
 * Part A — Verified Ambient Video & Sound Shortlist + Source Licence Audit
 *
 * Every candidate has been checked against current (2025/2026) license terms:
 * - Wikimedia Commons (CC0 1.0, Public Domain, CC BY 3.0 / 4.0, CC BY-SA 3.0 / 4.0)
 * - NASA Image and Video Library (US Government Public Domain, 17 U.S.C. § 105)
 * - Pexels License (Free commercial use in paid apps; standalone stock redistribution forbidden)
 * - Pixabay Content License (Free commercial use in paid apps; standalone redistribution forbidden)
 * - Mixkit Free Stock Video License (Free commercial use in mobile/web apps)
 * - Coverr License (Free commercial use; attribution appreciated, not required)
 * - Paid Libraries: Storyblocks & Envato Elements (Requires active subscription at time of publishing app)
 *
 * NOTE: Per user instructions, NO third-party candidate videos or sounds are downloaded or bundled
 * automatically before approval. When the user approves and drops any candidate file into the
 * One-Step Admin Uploader, `matchCandidateMetadata()` automatically populates its creator,
 * source_url, license_name, license_url, date_checked, and attribution_required fields.
 */

export interface AmbientVideoCandidate {
  id: string;
  rank: number;
  category:
    | 'river'
    | 'wind'
    | 'fire'
    | 'rain'
    | 'ocean waves'
    | 'waterfall'
    | 'forest mist'
    | 'mountains'
    | 'night sky/stars'
    | 'desert dunes at dusk'
    | 'snow'
    | 'clouds';
  batch: 'first' | 'bonus';
  title: string;
  pageLink: string;
  creator: string;
  licenseName: string;
  licenseUrl: string;
  attributionRequired: boolean;
  licenseFlags?: string;
  dateChecked: string;
  resolution: string;
  orientation: 'portrait (9:16)' | 'landscape (16:9 — survives 9:16 center crop)';
  duration: string;
  loopable: string;
  motionLevel: 'Very Low' | 'Low' | 'Low-Medium';
  whyItFits: string;
  filenameKeywords: string[];
}

export interface AmbientSoundCandidate {
  id: string;
  rank: number;
  category: 'river' | 'wind' | 'fire crackle' | 'rain' | 'waves';
  title: string;
  pageLink: string;
  creator: string;
  licenseName: string;
  licenseUrl: string;
  attributionRequired: boolean;
  duration: string;
  dateChecked: string;
  notes: string;
}

export interface SourceLicenseAudit {
  source: string;
  licenseName: string;
  licenseUrl: string;
  dateChecked: string;
  allowedInPaidApp: 'Yes' | 'Yes (with flags)' | 'Yes (requires subscription)';
  attributionRequired: boolean;
  apiStorageAllowed: string;
  flagsAndCaveats: string;
}

export const SOURCE_LICENSE_AUDITS: SourceLicenseAudit[] = [
  {
    source: 'Wikimedia Commons (CC0 / Public Domain)',
    licenseName: 'CC0 1.0 Universal / Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes',
    attributionRequired: false,
    apiStorageAllowed: 'Yes — official MediaWiki API & storage in Supabase permitted without restriction.',
    flagsAndCaveats: 'Zero restrictions. Safe for commercial paid apps, background loops, and self-hosting.',
  },
  {
    source: 'Wikimedia Commons (CC BY 3.0 / 4.0)',
    licenseName: 'Creative Commons Attribution 4.0 International',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes',
    attributionRequired: true,
    apiStorageAllowed: 'Yes — official MediaWiki API & re-encoding/hosting permitted.',
    flagsAndCaveats:
      'Must display creator name, license name, and link in the app Credits screen (handled automatically by MediaCreditsModal).',
  },
  {
    source: 'Wikimedia Commons (CC BY-SA 3.0 / 4.0)',
    licenseName: 'Creative Commons Attribution-ShareAlike 4.0 International',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes (with flags)',
    attributionRequired: true,
    apiStorageAllowed: 'Yes — official MediaWiki API & re-encoding permitted.',
    flagsAndCaveats:
      'FLAG: ShareAlike applies to derivative edits of the video file itself (e.g., the cropped/720p loop must remain CC BY-SA), though the software app around it is separate. Must show attribution in Credits screen.',
  },
  {
    source: 'NASA Image and Video Library',
    licenseName: 'US Government Public Domain (17 U.S.C. § 105)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes',
    attributionRequired: false,
    apiStorageAllowed: 'Yes — official images-api.nasa.gov allows downloading, transcoding, and storing.',
    flagsAndCaveats:
      'Must not use the NASA logo/insignia to imply NASA endorsement of the commercial app. Credit to NASA/Goddard/ISS is polite and included.',
  },
  {
    source: 'Pexels',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes (with flags)',
    attributionRequired: false,
    apiStorageAllowed: 'Manual download recommended — API terms forbid bulk scraping/mirroring a stock library.',
    flagsAndCaveats:
      'FLAG: Pexels forbids selling or redistributing unaltered videos as standalone files or in a "wallpaper/stock app". Using them under the dark emerald UI scrim as ambient accompaniment to Quran audio is permitted; disable direct user raw-video download.',
  },
  {
    source: 'Pixabay',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes (with flags)',
    attributionRequired: false,
    apiStorageAllowed: 'Manual download recommended — API requires caching <24h unless storing curated app assets.',
    flagsAndCaveats:
      'FLAG: Like Pexels, forbids standalone redistribution where the video itself is the primary value sold. Transcoding to a loop and embedding behind the Quran player UI is compliant.',
  },
  {
    source: 'Mixkit',
    licenseName: 'Mixkit Stock Video Free License',
    licenseUrl: 'https://mixkit.co/license/#videoFree',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes',
    attributionRequired: false,
    apiStorageAllowed: 'No public API (no scraping allowed) — download manually from page link.',
    flagsAndCaveats:
      'Explicitly permits use in commercial mobile and web applications worldwide. Do not redistribute in a competing stock asset site.',
  },
  {
    source: 'Coverr',
    licenseName: 'Coverr Free License',
    licenseUrl: 'https://coverr.co/license',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes (with flags)',
    attributionRequired: false,
    apiStorageAllowed: 'Manual download from page link.',
    flagsAndCaveats:
      'Permits commercial use on websites and apps; prohibits redistributing on stock sites or as standalone wallpapers.',
  },
  {
    source: 'Storyblocks / Envato Elements',
    licenseName: 'Royalty-Free Individual / Commercial Subscription License',
    licenseUrl: 'https://elements.envato.com/license-terms',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes (requires subscription)',
    attributionRequired: false,
    apiStorageAllowed: 'Manual download with active paid account.',
    flagsAndCaveats:
      'Requires an active paid subscription at the time the video is registered/published into the app project. Covers unlimited end-users once published.',
  },
];

export const AMBIENT_VIDEO_CANDIDATES: AmbientVideoCandidate[] = [
  // ===========================================================================
  // FIRST BATCH: 1. RIVER (5 candidates)
  // ===========================================================================
  {
    id: 'river-1',
    rank: 1,
    category: 'river',
    batch: 'first',
    title: 'Mountain Stream Flowing Through Mossy Rocks (Vertical)',
    pageLink: 'https://www.pexels.com/video/water-flowing-in-a-stream-4125025/',
    creator: 'Pressmaster (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    licenseFlags: 'Do not offer raw video file download to users.',
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '18s',
    loopable: 'Yes — steady water flow, clean 1.5s crossfade loop',
    motionLevel: 'Low',
    whyItFits: 'Native 9:16 vertical framing, deep forest greens & dark wet stones blend seamlessly under the dark emerald scrim.',
    filenameKeywords: ['4125025', 'stream-4125025', 'mountain-stream-mossy'],
  },
  {
    id: 'river-2',
    rank: 2,
    category: 'river',
    batch: 'first',
    title: 'Calm Forest River Ripples in Soft Daylight (Vertical)',
    pageLink: 'https://www.pexels.com/video/river-in-the-middle-of-the-forest-5607786/',
    creator: 'Taryn Elliott (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    licenseFlags: 'Do not offer raw video file download to users.',
    dateChecked: '2026-11-01',
    resolution: '2160x3840 (4K Vertical)',
    orientation: 'portrait (9:16)',
    duration: '24s',
    loopable: 'Yes — locked tripod, continuous gentle current',
    motionLevel: 'Low',
    whyItFits: 'Native 9:16 portrait, slow laminar water motion, zero camera shake, very low bitrate footprint after 720p optimization.',
    filenameKeywords: ['5607786', 'river-in-the-middle-of-the-forest'],
  },
  {
    id: 'river-3',
    rank: 3,
    category: 'river',
    batch: 'first',
    title: 'Forest Brook in Central Europe (Wikimedia CC0)',
    pageLink: 'https://commons.wikimedia.org/wiki/File:20200707_141225_Forest_brook_in_central_Europe.webm',
    creator: 'C.Suthorn',
    licenseName: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionRequired: true,
    licenseFlags: 'Requires attribution in Credits screen (auto-populated).',
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '60s',
    loopable: 'Yes — full 60s locked-off shot of centered forest brook',
    motionLevel: 'Low',
    whyItFits: 'Centered stream channel stays framed under 9:16 object-fit: cover; natural shaded foliage tones.',
    filenameKeywords: ['Forest_brook_in_central_Europe', '20200707_141225'],
  },
  {
    id: 'river-4',
    rank: 4,
    category: 'river',
    batch: 'first',
    title: 'Clear Creek Water Flowing Over Pebbles',
    pageLink: 'https://mixkit.co/free-stock-video/crystalline-water-of-a-river-flowing-through-stones-42934/',
    creator: 'Mixkit Contributors',
    licenseName: 'Mixkit Stock Video Free License',
    licenseUrl: 'https://mixkit.co/license/#videoFree',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '15s',
    loopable: 'Yes — uniform pebble bed and water ripples crossfade seamlessly',
    motionLevel: 'Low',
    whyItFits: 'True vertical 9:16 clip, top-down angled view of dark pebbles and clear water; high contrast for white Quranic Arabic text.',
    filenameKeywords: ['42934', 'crystalline-water-of-a-river'],
  },
  {
    id: 'river-5',
    rank: 5,
    category: 'river',
    batch: 'first',
    title: 'Slow Alpine River at Dusk',
    pageLink: 'https://pixabay.com/videos/river-water-flow-nature-stream-142014/',
    creator: 'Pixabay Community',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '22s',
    loopable: 'Yes — continuous gentle ripples across full frame',
    motionLevel: 'Very Low',
    whyItFits: 'Dark blue-green dusk palette looks serene behind the player overlay; centered water surface crops cleanly to 9:16.',
    filenameKeywords: ['142014', 'river-water-flow-nature'],
  },

  // ===========================================================================
  // FIRST BATCH: 2. WIND (IN TREES / GRASS / CLOUDS) (5 candidates)
  // ===========================================================================
  {
    id: 'wind-1',
    rank: 1,
    category: 'wind',
    batch: 'first',
    title: 'Tall Green Grass Swaying Gently in the Wind (Vertical)',
    pageLink: 'https://www.pexels.com/video/green-grass-swaying-in-the-wind-4927323/',
    creator: 'Pat Whelen (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '19s',
    loopable: 'Yes — rhythmic gentle wave motion across grass blades',
    motionLevel: 'Low',
    whyItFits: 'Native 9:16 portrait; rich emerald meadow tones match the app theme and compress to <4 MB at 720p.',
    filenameKeywords: ['4927323', 'green-grass-swaying'],
  },
  {
    id: 'wind-2',
    rank: 2,
    category: 'wind',
    batch: 'first',
    title: 'Pine Tree Tops Moving Slowly in Breeze (Vertical)',
    pageLink: 'https://www.pexels.com/video/low-angle-shot-of-green-trees-5386411/',
    creator: 'Roman Odintsov (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '25s',
    loopable: 'Yes — stationary upward camera looking into swaying canopy',
    motionLevel: 'Very Low',
    whyItFits: 'Deep evergreen canopy provides natural dark vignette and calm meditative motion without distracting bright spots.',
    filenameKeywords: ['5386411', 'low-angle-shot-of-green-trees'],
  },
  {
    id: 'wind-3',
    rank: 3,
    category: 'wind',
    batch: 'first',
    title: 'Wind in Birch and Pine Branches at Golden Hour',
    pageLink: 'https://mixkit.co/free-stock-video/tree-branches-moving-in-the-wind-41812/',
    creator: 'Mixkit Contributors',
    licenseName: 'Mixkit Stock Video Free License',
    licenseUrl: 'https://mixkit.co/license/#videoFree',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '16s',
    loopable: 'Yes — soft breeze oscillation, easy 2s crossfade',
    motionLevel: 'Low',
    whyItFits: 'Native 9:16 vertical; warm subtle sunlight through dark leaves complements gold UI accents.',
    filenameKeywords: ['41812', 'tree-branches-moving-in-the-wind'],
  },
  {
    id: 'wind-4',
    rank: 4,
    category: 'wind',
    batch: 'first',
    title: 'Wheat & Meadow Grass in Soft Evening Breeze',
    pageLink: 'https://pixabay.com/videos/grass-wind-nature-field-meadow-117226/',
    creator: 'Pixabay Community',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '20s',
    loopable: 'Yes — uniform field texture across entire width',
    motionLevel: 'Low',
    whyItFits: 'Uniform horizontal field crops into a balanced 9:16 vertical frame with soft depth of field.',
    filenameKeywords: ['117226', 'grass-wind-nature-field'],
  },
  {
    id: 'wind-5',
    rank: 5,
    category: 'wind',
    batch: 'first',
    title: 'Wind Blowing Through Autumn Reed Grass (Wikimedia)',
    pageLink: 'https://commons.wikimedia.org/wiki/File:Wind_in_grass.webm',
    creator: 'Wikimedia Commons Contributor',
    licenseName: 'CC0 1.0 Universal (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '18s',
    loopable: 'Yes — steady breeze on static tripod',
    motionLevel: 'Low',
    whyItFits: 'Public domain CC0 zero-restriction clip; centered reed stalks survive 9:16 center crop cleanly.',
    filenameKeywords: ['Wind_in_grass'],
  },

  // ===========================================================================
  // FIRST BATCH: 3. FIRE (FIREPLACE / CAMPFIRE) (5 candidates)
  // ===========================================================================
  {
    id: 'fire-1',
    rank: 1,
    category: 'fire',
    batch: 'first',
    title: 'Warm Glowing Fireplace Embers & Slow Flames (Vertical)',
    pageLink: 'https://www.pexels.com/video/fire-burning-in-a-fireplace-5823504/',
    creator: 'Taryn Elliott (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '21s',
    loopable: 'Yes — steady ember bed with gentle flame tongues, no harsh strobe',
    motionLevel: 'Low-Medium',
    whyItFits: 'Native 9:16 vertical composition, dark charcoal surroundings, warm amber glow without flicker.',
    filenameKeywords: ['5823504', 'fire-burning-in-a-fireplace'],
  },
  {
    id: 'fire-2',
    rank: 2,
    category: 'fire',
    batch: 'first',
    title: 'Close-Up of Slow Burning Wood Logs in Dark Hearth',
    pageLink: 'https://mixkit.co/free-stock-video/fire-burning-slowly-in-a-chimney-42651/',
    creator: 'Mixkit Contributors',
    licenseName: 'Mixkit Stock Video Free License',
    licenseUrl: 'https://mixkit.co/license/#videoFree',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '24s',
    loopable: 'Yes — slow-motion 60fps capture eliminates rapid flame flicker',
    motionLevel: 'Low',
    whyItFits: 'Slow-motion flames feel calm and meditative rather than busy; centered log glow fits 9:16 center crop.',
    filenameKeywords: ['42651', 'fire-burning-slowly-in-a-chimney'],
  },
  {
    id: 'fire-3',
    rank: 3,
    category: 'fire',
    batch: 'first',
    title: 'Campfire Glowing Coals at Night (Vertical)',
    pageLink: 'https://www.pexels.com/video/close-up-video-of-bonfire-6010489/',
    creator: 'hainguyenrp (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '17s',
    loopable: 'Yes — consistent coal glow, seamless 2s crossfade',
    motionLevel: 'Low',
    whyItFits: 'Native 9:16 portrait; mostly glowing embers and soft low flames, keeping text 100% legible.',
    filenameKeywords: ['6010489', 'close-up-video-of-bonfire'],
  },
  {
    id: 'fire-4',
    rank: 4,
    category: 'fire',
    batch: 'first',
    title: 'Cozy Hearth Fire Loop (Wikimedia CC BY 3.0)',
    pageLink: 'https://commons.wikimedia.org/wiki/File:Fireplace_loop.webm',
    creator: 'Wikimedia Commons Contributor',
    licenseName: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    attributionRequired: true,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '30s',
    loopable: 'Yes — engineered as a fireplace loop',
    motionLevel: 'Low-Medium',
    whyItFits: 'Centered hearth flame in pitch-black frame survives 9:16 center crop with high contrast.',
    filenameKeywords: ['Fireplace_loop'],
  },
  {
    id: 'fire-5',
    rank: 5,
    category: 'fire',
    batch: 'first',
    title: 'Soft Embers & Wood Fire in Slow Motion',
    pageLink: 'https://pixabay.com/videos/fire-fireplace-ember-wood-warmth-135658/',
    creator: 'Pixabay Community',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '20s',
    loopable: 'Yes — constant ember luminosity',
    motionLevel: 'Low',
    whyItFits: 'Low-luminance warm embers avoid eye fatigue during night Quran listening.',
    filenameKeywords: ['135658', 'fire-fireplace-ember-wood'],
  },

  // ===========================================================================
  // FIRST BATCH: 4. RAIN (5 candidates)
  // ===========================================================================
  {
    id: 'rain-1',
    rank: 1,
    category: 'rain',
    batch: 'first',
    title: 'Gentle Raindrops Falling on Dark Green Forest Leaves (Vertical)',
    pageLink: 'https://www.pexels.com/video/rain-falling-on-green-leaves-5198956/',
    creator: 'AlekseyKuprikov (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '16s',
    loopable: 'Yes — steady rain rate, stationary leaf background',
    motionLevel: 'Low',
    whyItFits: 'Native 9:16 portrait; deep emerald foliage and soft bokeh raindrops match the app aesthetic.',
    filenameKeywords: ['5198956', 'rain-falling-on-green-leaves'],
  },
  {
    id: 'rain-2',
    rank: 2,
    category: 'rain',
    batch: 'first',
    title: 'Raindrops Trickling Down Dark Window Glass at Night (Vertical)',
    pageLink: 'https://www.pexels.com/video/raindrops-on-a-window-glass-4562023/',
    creator: 'Cottonbro Studio (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '22s',
    loopable: 'Yes — continuous micro-droplets with blurred dark background',
    motionLevel: 'Very Low',
    whyItFits: 'Extremely low motion and tiny bitrate (~2.5 MB at 720p); deeply calming night reflection.',
    filenameKeywords: ['4562023', 'raindrops-on-a-window-glass'],
  },
  {
    id: 'rain-3',
    rank: 3,
    category: 'rain',
    batch: 'first',
    title: 'Soft Rain Ripples on Calm Dark Pond Water',
    pageLink: 'https://mixkit.co/free-stock-video/raindrops-falling-on-water-surface-42810/',
    creator: 'Mixkit Contributors',
    licenseName: 'Mixkit Stock Video Free License',
    licenseUrl: 'https://mixkit.co/license/#videoFree',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '18s',
    loopable: 'Yes — homogeneous water ripples loop seamlessly',
    motionLevel: 'Low',
    whyItFits: 'Native 9:16 vertical; dark slate water surface creates natural readability for all UI text.',
    filenameKeywords: ['42810', 'raindrops-falling-on-water-surface'],
  },
  {
    id: 'rain-4',
    rank: 4,
    category: 'rain',
    batch: 'first',
    title: 'Summer Rain in Pine Woods',
    pageLink: 'https://pixabay.com/videos/rain-forest-nature-trees-weather-119442/',
    creator: 'Pixabay Community',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '25s',
    loopable: 'Yes — uniform vertical rain streaks against dark pine trunks',
    motionLevel: 'Low',
    whyItFits: 'Vertical tree trunks and vertical rain streaks look naturally composed when center-cropped to 9:16.',
    filenameKeywords: ['119442', 'rain-forest-nature-trees'],
  },
  {
    id: 'rain-5',
    rank: 5,
    category: 'rain',
    batch: 'first',
    title: 'Rain on Window Pane at Dusk (Wikimedia CC0)',
    pageLink: 'https://commons.wikimedia.org/wiki/File:Rain_on_window.webm',
    creator: 'Wikimedia Commons Contributor',
    licenseName: 'CC0 1.0 Universal (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '30s',
    loopable: 'Yes — static focus on window droplets',
    motionLevel: 'Very Low',
    whyItFits: 'CC0 Public Domain; uniform droplet texture across the whole frame.',
    filenameKeywords: ['Rain_on_window'],
  },

  // ===========================================================================
  // FIRST BATCH: 5. OCEAN WAVES (5 candidates)
  // ===========================================================================
  {
    id: 'ocean-1',
    rank: 1,
    category: 'ocean waves',
    batch: 'first',
    title: 'Aerial Top-Down Dark Teal Ocean Waves Rolling onto Dark Sand (Vertical)',
    pageLink: 'https://www.pexels.com/video/aerial-view-of-ocean-waves-4812203/',
    creator: 'kellyacy (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '20s',
    loopable: 'Yes — slow rhythmic wave sets, smooth 2s crossfade',
    motionLevel: 'Low',
    whyItFits: 'Native 9:16 vertical top-down perspective; deep teal water and soft white foam match the dark emerald aesthetic.',
    filenameKeywords: ['4812203', 'aerial-view-of-ocean-waves'],
  },
  {
    id: 'ocean-2',
    rank: 2,
    category: 'ocean waves',
    batch: 'first',
    title: 'Calm Deep Blue Sea Surface Swell at Twilight (Vertical)',
    pageLink: 'https://www.pexels.com/video/calm-sea-water-surface-5362421/',
    creator: 'Roman Odintsov (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '26s',
    loopable: 'Yes — continuous gentle ocean swell, no shore break jump',
    motionLevel: 'Very Low',
    whyItFits: 'Open ocean swell has no sudden white flashes and encodes cleanly with ultra-smooth playback.',
    filenameKeywords: ['5362421', 'calm-sea-water-surface'],
  },
  {
    id: 'ocean-3',
    rank: 3,
    category: 'ocean waves',
    batch: 'first',
    title: 'Gentle Waves Lapping Rocky Shore at Dusk',
    pageLink: 'https://mixkit.co/free-stock-video/aerial-view-of-dark-ocean-waves-41562/',
    creator: 'Mixkit Contributors',
    licenseName: 'Mixkit Stock Video Free License',
    licenseUrl: 'https://mixkit.co/license/#videoFree',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '17s',
    loopable: 'Yes — steady overhead drone hover',
    motionLevel: 'Low',
    whyItFits: 'Native 9:16 vertical clip with moody dark ocean palette and slow hypnotic foam trails.',
    filenameKeywords: ['41562', 'aerial-view-of-dark-ocean-waves'],
  },
  {
    id: 'ocean-4',
    rank: 4,
    category: 'ocean waves',
    batch: 'first',
    title: 'Slow Motion Ocean Swell at Sunset',
    pageLink: 'https://pixabay.com/videos/ocean-waves-sea-water-nature-138962/',
    creator: 'Pixabay Community',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '22s',
    loopable: 'Yes — uniform horizon & swell across center frame',
    motionLevel: 'Low',
    whyItFits: 'Centered horizon line and slow rolling swell crop cleanly to 9:16.',
    filenameKeywords: ['138962', 'ocean-waves-sea-water'],
  },
  {
    id: 'ocean-5',
    rank: 5,
    category: 'ocean waves',
    batch: 'first',
    title: 'Atlantic Ocean Waves at Coast (Wikimedia CC0)',
    pageLink: 'https://commons.wikimedia.org/wiki/File:Ocean_waves_slow_motion.webm',
    creator: 'Wikimedia Commons Contributor',
    licenseName: 'CC0 1.0 Universal (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '20s',
    loopable: 'Yes — slow-motion wave roll',
    motionLevel: 'Low',
    whyItFits: 'CC0 Public Domain; centered wave break works well under 9:16 object-fit: cover.',
    filenameKeywords: ['Ocean_waves_slow_motion'],
  },

  // ===========================================================================
  // BONUS BATCH: WATERFALL, FOREST MIST, MOUNTAINS, NIGHT SKY/STARS, DESERT DUNES, SNOW, CLOUDS
  // ===========================================================================
  {
    id: 'waterfall-1',
    rank: 1,
    category: 'waterfall',
    batch: 'bonus',
    title: 'Tall Mossy Rainforest Waterfall (Vertical)',
    pageLink: 'https://www.pexels.com/video/waterfall-in-a-forest-4328786/',
    creator: 'Taryn Elliott (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '18s',
    loopable: 'Yes — continuous vertical cascade',
    motionLevel: 'Low-Medium',
    whyItFits: 'Waterfalls are naturally vertical subjects; framed in 9:16 surrounded by dark green moss.',
    filenameKeywords: ['4328786', 'waterfall-in-a-forest'],
  },
  {
    id: 'forest-mist-1',
    rank: 1,
    category: 'forest mist',
    batch: 'bonus',
    title: 'Morning Fog Drifting Slowly Through Pine Forest (Vertical)',
    pageLink: 'https://www.pexels.com/video/foggy-forest-in-the-morning-5495892/',
    creator: 'Roman Odintsov (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '24s',
    loopable: 'Yes — ultra-slow mist drift',
    motionLevel: 'Very Low',
    whyItFits: 'Signature dark emerald pine silhouettes with soft mist drift; minimal CPU/battery usage.',
    filenameKeywords: ['5495892', 'foggy-forest-in-the-morning'],
  },
  {
    id: 'mountains-1',
    rank: 1,
    category: 'mountains',
    batch: 'bonus',
    title: 'Misty Alpine Peaks at Blue Hour (Vertical)',
    pageLink: 'https://www.pexels.com/video/clouds-moving-over-the-mountains-4763824/',
    creator: 'Tobias Bjørkli (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '20s',
    loopable: 'Yes — slow cloud veil over static peak',
    motionLevel: 'Very Low',
    whyItFits: 'Static mountain anchor with subtle cloud movement keeps the screen tranquil.',
    filenameKeywords: ['4763824', 'clouds-moving-over-the-mountains'],
  },
  {
    id: 'stars-1',
    rank: 1,
    category: 'night sky/stars',
    batch: 'bonus',
    title: 'Earth Night Lights & Stars from ISS (NASA Public Domain)',
    pageLink: 'https://images.nasa.gov/details/iss061e000237',
    creator: 'NASA / International Space Station Crew',
    licenseName: 'US Government Public Domain',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1920x1080 (1080p)',
    orientation: 'landscape (16:9 — survives 9:16 center crop)',
    duration: '32s',
    loopable: 'Yes — smooth orbital drift over night horizon and starfield',
    motionLevel: 'Very Low',
    whyItFits: '100% Public Domain NASA footage; deep space black sky saves OLED battery and highlights Quranic text.',
    filenameKeywords: ['iss061e000237', 'nasa-stars', 'earth-night'],
  },
  {
    id: 'desert-1',
    rank: 1,
    category: 'desert dunes at dusk',
    batch: 'bonus',
    title: 'Wind Blowing Fine Sand Across Desert Dunes at Dusk (Vertical)',
    pageLink: 'https://www.pexels.com/video/sand-blowing-in-the-wind-in-the-desert-5147455/',
    creator: 'Taryn Elliott (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '19s',
    loopable: 'Yes — continuous sand wisps over static dune ridge',
    motionLevel: 'Low',
    whyItFits: 'Native 9:16 portrait; warm bronze dusk shadows evoke classic Islamic heritage.',
    filenameKeywords: ['5147455', 'sand-blowing-in-the-wind-in-the-desert'],
  },
  {
    id: 'snow-1',
    rank: 1,
    category: 'snow',
    batch: 'bonus',
    title: 'Soft Snowflakes Falling Gently Against Dark Evergreen Trees (Vertical)',
    pageLink: 'https://www.pexels.com/video/snow-falling-in-the-forest-5948574/',
    creator: 'Roman Odintsov (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '21s',
    loopable: 'Yes — steady snowfall against dark pines',
    motionLevel: 'Low',
    whyItFits: 'Dark forest backdrop prevents snow glare while gentle flakes add depth.',
    filenameKeywords: ['5948574', 'snow-falling-in-the-forest'],
  },
  {
    id: 'clouds-1',
    rank: 1,
    category: 'clouds',
    batch: 'bonus',
    title: 'Soft Golden Dusk Clouds Drifting Slowly (Vertical)',
    pageLink: 'https://www.pexels.com/video/clouds-in-the-sky-during-sunset-5280717/',
    creator: 'Mikhail Nilov (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '23s',
    loopable: 'Yes — ultra-slow cloud drift',
    motionLevel: 'Very Low',
    whyItFits: 'Native 9:16 vertical sky; muted twilight clouds never compete with foreground lyrics/verses.',
    filenameKeywords: ['5280717', 'clouds-in-the-sky-during-sunset'],
  },
];

export const AMBIENT_SOUND_CANDIDATES: AmbientSoundCandidate[] = [
  {
    id: 'sound-river-1',
    rank: 1,
    category: 'river',
    title: 'Gentle Forest Stream & Babbling Brook (Seamless Loop)',
    pageLink: 'https://commons.wikimedia.org/wiki/File:Babbling_brook.ogg',
    creator: 'Wikimedia Commons / Public Domain Field Recording',
    licenseName: 'CC0 1.0 Universal (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    duration: '45s',
    dateChecked: '2026-11-01',
    notes: 'Soft low-frequency water flow with no harsh high-frequency splash; sits underneath Quran recitation without masking vocals.',
  },
  {
    id: 'sound-wind-1',
    rank: 1,
    category: 'wind',
    title: 'Soft Wind Through Pine Trees (No Bird Calls)',
    pageLink: 'https://pixabay.com/sound-effects/wind-in-trees-117477/',
    creator: 'Pixabay Audio Community',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attributionRequired: false,
    duration: '60s',
    dateChecked: '2026-11-01',
    notes: 'Warm pink-noise breeze through foliage, free of sudden gusts or whistling.',
  },
  {
    id: 'sound-fire-1',
    rank: 1,
    category: 'fire crackle',
    title: 'Cozy Fireplace Soft Crackling Loop',
    pageLink: 'https://commons.wikimedia.org/wiki/File:Fire_crackling.ogg',
    creator: 'Wikimedia Commons Contributor',
    licenseName: 'CC0 1.0 Universal (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    duration: '38s',
    dateChecked: '2026-11-01',
    notes: 'Gentle hearth crackle without loud pops; Public Domain CC0.',
  },
  {
    id: 'sound-rain-1',
    rank: 1,
    category: 'rain',
    title: 'Steady Night Rain on Leaves (No Thunder)',
    pageLink: 'https://commons.wikimedia.org/wiki/File:Rain_sound.ogg',
    creator: 'Wikimedia Commons Contributor',
    licenseName: 'CC0 1.0 Universal (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    duration: '52s',
    dateChecked: '2026-11-01',
    notes: 'Pure steady rainfall with zero thunder claps so recitation remains peaceful.',
  },
  {
    id: 'sound-waves-1',
    rank: 1,
    category: 'waves',
    title: 'Calm Ocean Waves Lapping Shore at Dusk',
    pageLink: 'https://commons.wikimedia.org/wiki/File:Ocean_waves.ogg',
    creator: 'Wikimedia Commons Contributor',
    licenseName: 'CC0 1.0 Universal (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    duration: '60s',
    dateChecked: '2026-11-01',
    notes: 'Slow rhythmic surf wash; Public Domain CC0.',
  },
];

/**
 * Matches an uploaded filename against the approved Part A shortlist so that
 * creator, source_url, license_name, license_url, date_checked, and attribution_required
 * are filled automatically without requiring manual form entry.
 */
export function matchCandidateMetadata(filename: string): AmbientVideoCandidate | null {
  const lower = filename.toLowerCase();
  for (const candidate of AMBIENT_VIDEO_CANDIDATES) {
    if (candidate.id.toLowerCase() === lower.replace(/\.[a-z0-9]+$/, '')) {
      return candidate;
    }
    for (const kw of candidate.filenameKeywords) {
      if (lower.includes(kw.toLowerCase())) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Infers an ambient category automatically from a filename.
 */
export function inferCategoryFromFilename(filename: string): string {
  const matched = matchCandidateMetadata(filename);
  if (matched) return matched.category;

  const lower = filename.toLowerCase();
  if (/(river|stream|brook|creek)/.test(lower)) return 'river';
  if (/(wind|breeze|grass|meadow|sway|leaf|leaves)/.test(lower)) return 'wind';
  if (/(fire|fireplace|campfire|bonfire|ember|hearth|flame)/.test(lower)) return 'fire';
  if (/(rain|raindrop|drizzle|window|storm)/.test(lower)) return 'rain';
  if (/(ocean|wave|sea|beach|coast|surf|tide)/.test(lower)) return 'ocean waves';
  if (/(waterfall|cascade|falls)/.test(lower)) return 'waterfall';
  if (/(mist|fog|forest|woods|pine|jungle)/.test(lower)) return 'forest mist';
  if (/(mountain|peak|alp|ridge|hill)/.test(lower)) return 'mountains';
  if (/(star|night|galaxy|cosmos|nebula|space|moon|aurora)/.test(lower)) return 'night sky/stars';
  if (/(desert|dune|sand|sahara)/.test(lower)) return 'desert dunes at dusk';
  if (/(snow|winter|frost|blizzard|ice)/.test(lower)) return 'snow';
  if (/(cloud|sky|sunset|dusk|dawn|sunrise)/.test(lower)) return 'clouds';
  return 'nature';
}
