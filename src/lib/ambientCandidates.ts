/**
 * Part A — Approved Ambient Video & Sound Catalog (Pexels, Pixabay & NASA Image and Video Library)
 *
 * Per user approval, all candidates and bundled/seeded backgrounds are exclusively sourced from:
 * 1. Pexels (https://www.pexels.com/license/) — Free commercial use in paid apps; no standalone raw file redistribution.
 * 2. Pixabay (https://pixabay.com/service/license-summary/) — Free commercial use in paid apps; no standalone raw file redistribution.
 * 3. NASA Image and Video Library (https://www.nasa.gov/nasa-brand-center/images-and-media/) — US Government Public Domain (17 U.S.C. § 105); official API download, transcoding, and storage permitted.
 */

export type ApprovedSourceName = 'Pexels' | 'Pixabay' | 'NASA Image and Video Library';

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
  source: ApprovedSourceName;
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
  /** Present when already processed (720p + 480p + poster, muted, faststart) and bundled from official NASA API */
  bundledAssets?: {
    videoUrl720p: string;
    videoUrl480p: string;
    posterUrl: string;
    sizeBytes: number;
    durationSeconds: number;
  };
}

export interface AmbientSoundCandidate {
  id: string;
  rank: number;
  category: 'river' | 'wind' | 'fire crackle' | 'rain' | 'waves';
  source: ApprovedSourceName;
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
  allowedInPaidApp: 'Yes' | 'Yes (with flags)';
  attributionRequired: boolean;
  apiStorageAllowed: string;
  flagsAndCaveats: string;
}

export const SOURCE_LICENSE_AUDITS: SourceLicenseAudit[] = [
  {
    source: 'NASA Image and Video Library (Approved ✓)',
    licenseName: 'US Government Public Domain (17 U.S.C. § 105)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes',
    attributionRequired: false,
    apiStorageAllowed:
      'Yes — official images-api.nasa.gov permits automated download, 720p/480p re-encoding, and permanent storage.',
    flagsAndCaveats:
      'Do not use the NASA insignia/logo to imply official NASA endorsement. Credit to NASA / ISS / Goddard is included in Media Credits.',
  },
  {
    source: 'Pexels (Approved ✓)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes (with flags)',
    attributionRequired: false,
    apiStorageAllowed:
      'Download from page link and drop into One-Step Uploader (or fetch via official Pexels API when PEXELS_API_KEY is set).',
    flagsAndCaveats:
      'Permits commercial use in paid apps as ambient background under UI scrim. Do not redistribute unaltered files as standalone stock/wallpapers.',
  },
  {
    source: 'Pixabay (Approved ✓)',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    dateChecked: '2026-11-01',
    allowedInPaidApp: 'Yes (with flags)',
    attributionRequired: false,
    apiStorageAllowed:
      'Download from page link and drop into One-Step Uploader (or fetch via official Pixabay API when PIXABAY_API_KEY is set).',
    flagsAndCaveats:
      'Permits commercial use in web/mobile apps when transcoded and integrated behind the Quran player UI. Standalone file resale is prohibited.',
  },
];

export const AMBIENT_VIDEO_CANDIDATES: AmbientVideoCandidate[] = [
  // ===========================================================================
  // FIRST BATCH: 1. RIVER (Pexels, Pixabay & NASA)
  // ===========================================================================
  {
    id: 'nasa-alpine-river',
    rank: 1,
    category: 'river',
    batch: 'first',
    source: 'NASA Image and Video Library',
    title: 'Alpine River Flowing Past Snowy Mountain Cliffs (NASA Earth Science)',
    pageLink: 'https://images.nasa.gov/details/GSFC_20170213_SnowEx_m12490_GroundMesa2',
    creator: 'NASA Goddard Space Flight Center / SnowEx Field Team',
    licenseName: 'US Government Public Domain (17 U.S.C. § 105)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '720x1280 (720p) + 480x854 (480p)',
    orientation: 'portrait (9:16)',
    duration: '12s',
    loopable: 'Yes — seamless crossfade loop encoded with -movflags +faststart',
    motionLevel: 'Low',
    whyItFits:
      'Official NASA Earth Science ground footage of a tranquil alpine river flowing past dark canyon rock and snow; 100% Public Domain.',
    filenameKeywords: ['nasa-alpine-river', 'GSFC_20170213_SnowEx', 'alpine-river'],
    bundledAssets: {
      videoUrl720p: '/videos/nasa-alpine-river-720p.mp4',
      videoUrl480p: '/videos/nasa-alpine-river-480p.mp4',
      posterUrl: '/videos/nasa-alpine-river-poster.jpg',
      sizeBytes: 1450000,
      durationSeconds: 12,
    },
  },
  {
    id: 'river-1',
    rank: 2,
    category: 'river',
    batch: 'first',
    source: 'Pexels',
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
    whyItFits:
      'Native 9:16 vertical framing, deep forest greens & dark wet stones blend seamlessly under the dark emerald scrim.',
    filenameKeywords: ['4125025', 'stream-4125025', 'mountain-stream-mossy'],
  },
  {
    id: 'river-2',
    rank: 3,
    category: 'river',
    batch: 'first',
    source: 'Pexels',
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
    whyItFits:
      'Native 9:16 portrait, slow laminar water motion, zero camera shake, very low bitrate footprint after 720p optimization.',
    filenameKeywords: ['5607786', 'river-in-the-middle-of-the-forest'],
  },
  {
    id: 'river-3',
    rank: 4,
    category: 'river',
    batch: 'first',
    source: 'Pexels',
    title: 'Dark Woodland Creek Flowing Over Smooth Stones (Vertical)',
    pageLink: 'https://www.pexels.com/video/river-water-flowing-over-rocks-5548032/',
    creator: 'Pat Whelen (Pexels)',
    licenseName: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '1080x1920 (Full HD)',
    orientation: 'portrait (9:16)',
    duration: '19s',
    loopable: 'Yes — static tripod over dark pebble bed',
    motionLevel: 'Low',
    whyItFits: 'True 9:16 vertical clip with shaded emerald water tones.',
    filenameKeywords: ['5548032', 'river-water-flowing-over-rocks'],
  },
  {
    id: 'river-5',
    rank: 5,
    category: 'river',
    batch: 'first',
    source: 'Pixabay',
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
    whyItFits:
      'Dark blue-green dusk palette looks serene behind the player overlay; centered water surface crops cleanly to 9:16.',
    filenameKeywords: ['142014', 'river-water-flow-nature'],
  },

  // ===========================================================================
  // FIRST BATCH: 2. WIND (IN TREES / GRASS / CLOUDS) (Pexels, Pixabay & NASA)
  // ===========================================================================
  {
    id: 'nasa-evergreen-snow',
    rank: 1,
    category: 'wind',
    batch: 'first',
    source: 'NASA Image and Video Library',
    title: 'Evergreen Pine Forest in Gentle Winter Breeze (NASA Grand Mesa)',
    pageLink: 'https://images.nasa.gov/details/GSFC_20170213_SnowEx_m12490_GroundMesa2',
    creator: 'NASA Goddard Space Flight Center / SnowEx',
    licenseName: 'US Government Public Domain (17 U.S.C. § 105)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '720x1280 (720p) + 480x854 (480p)',
    orientation: 'portrait (9:16)',
    duration: '15s',
    loopable: 'Yes — 15s seamless crossfade loop encoded at 720p & 480p',
    motionLevel: 'Very Low',
    whyItFits:
      'Tall evergreen conifers swaying gently in calm mountain air; 100% NASA Public Domain, pre-encoded and live.',
    filenameKeywords: ['nasa-evergreen-snow', 'evergreen-snow'],
    bundledAssets: {
      videoUrl720p: '/videos/nasa-evergreen-snow-720p.mp4',
      videoUrl480p: '/videos/nasa-evergreen-snow-480p.mp4',
      posterUrl: '/videos/nasa-evergreen-snow-poster.jpg',
      sizeBytes: 1850000,
      durationSeconds: 15,
    },
  },
  {
    id: 'wind-1',
    rank: 2,
    category: 'wind',
    batch: 'first',
    source: 'Pexels',
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
    whyItFits:
      'Native 9:16 portrait; rich emerald meadow tones match the app theme and compress to <4 MB at 720p.',
    filenameKeywords: ['4927323', 'green-grass-swaying'],
  },
  {
    id: 'wind-2',
    rank: 3,
    category: 'wind',
    batch: 'first',
    source: 'Pexels',
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
    whyItFits:
      'Deep evergreen canopy provides natural dark vignette and calm meditative motion without distracting bright spots.',
    filenameKeywords: ['5386411', 'low-angle-shot-of-green-trees'],
  },
  {
    id: 'wind-4',
    rank: 4,
    category: 'wind',
    batch: 'first',
    source: 'Pixabay',
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
    whyItFits:
      'Uniform horizontal field crops into a balanced 9:16 vertical frame with soft depth of field.',
    filenameKeywords: ['117226', 'grass-wind-nature-field'],
  },

  // ===========================================================================
  // FIRST BATCH: 3. FIRE (FIREPLACE / CAMPFIRE) (Pexels & Pixabay)
  // ===========================================================================
  {
    id: 'fire-1',
    rank: 1,
    category: 'fire',
    batch: 'first',
    source: 'Pexels',
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
    whyItFits:
      'Native 9:16 vertical composition, dark charcoal surroundings, warm amber glow without flicker.',
    filenameKeywords: ['5823504', 'fire-burning-in-a-fireplace'],
  },
  {
    id: 'fire-3',
    rank: 2,
    category: 'fire',
    batch: 'first',
    source: 'Pexels',
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
    whyItFits:
      'Native 9:16 portrait; mostly glowing embers and soft low flames, keeping text 100% legible.',
    filenameKeywords: ['6010489', 'close-up-video-of-bonfire'],
  },
  {
    id: 'fire-5',
    rank: 3,
    category: 'fire',
    batch: 'first',
    source: 'Pixabay',
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
    whyItFits:
      'Low-luminance warm embers avoid eye fatigue during night Quran listening.',
    filenameKeywords: ['135658', 'fire-fireplace-ember-wood'],
  },

  // ===========================================================================
  // FIRST BATCH: 4. RAIN (Pexels & Pixabay)
  // ===========================================================================
  {
    id: 'rain-1',
    rank: 1,
    category: 'rain',
    batch: 'first',
    source: 'Pexels',
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
    whyItFits:
      'Native 9:16 portrait; deep emerald foliage and soft bokeh raindrops match the app aesthetic.',
    filenameKeywords: ['5198956', 'rain-falling-on-green-leaves'],
  },
  {
    id: 'rain-2',
    rank: 2,
    category: 'rain',
    batch: 'first',
    source: 'Pexels',
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
    whyItFits:
      'Extremely low motion and tiny bitrate (~2.5 MB at 720p); deeply calming night reflection.',
    filenameKeywords: ['4562023', 'raindrops-on-a-window-glass'],
  },
  {
    id: 'rain-4',
    rank: 3,
    category: 'rain',
    batch: 'first',
    source: 'Pixabay',
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
    whyItFits:
      'Vertical tree trunks and vertical rain streaks look naturally composed when center-cropped to 9:16.',
    filenameKeywords: ['119442', 'rain-forest-nature-trees'],
  },

  // ===========================================================================
  // FIRST BATCH: 5. OCEAN WAVES (NASA, Pexels & Pixabay)
  // ===========================================================================
  {
    id: 'nasa-orbital-clouds',
    rank: 1,
    category: 'ocean waves',
    batch: 'first',
    source: 'NASA Image and Video Library',
    title: 'Deep Sapphire Ocean & Soft Cloud Swell from Space (NASA 4K)',
    pageLink: 'https://images.nasa.gov/details/jsc2022m000172_Earth_in_4K_Expedition_65_Edition',
    creator: 'NASA / International Space Station Expedition 65 Crew',
    licenseName: 'US Government Public Domain (17 U.S.C. § 105)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '720x1280 (720p) + 480x854 (480p)',
    orientation: 'portrait (9:16)',
    duration: '15s',
    loopable: 'Yes — 15s seamless crossfade loop encoded at 720p & 480p',
    motionLevel: 'Very Low',
    whyItFits:
      'Ultra-calm orbital drift over Earth’s deep blue ocean and curved horizon; 100% NASA Public Domain, pre-encoded and live.',
    filenameKeywords: ['nasa-orbital-clouds', 'orbital-clouds'],
    bundledAssets: {
      videoUrl720p: '/videos/nasa-orbital-clouds-720p.mp4',
      videoUrl480p: '/videos/nasa-orbital-clouds-480p.mp4',
      posterUrl: '/videos/nasa-orbital-clouds-poster.jpg',
      sizeBytes: 1750000,
      durationSeconds: 15,
    },
  },
  {
    id: 'ocean-1',
    rank: 2,
    category: 'ocean waves',
    batch: 'first',
    source: 'Pexels',
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
    whyItFits:
      'Native 9:16 vertical top-down perspective; deep teal water and soft white foam match the dark emerald aesthetic.',
    filenameKeywords: ['4812203', 'aerial-view-of-ocean-waves'],
  },
  {
    id: 'ocean-2',
    rank: 3,
    category: 'ocean waves',
    batch: 'first',
    source: 'Pexels',
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
    whyItFits:
      'Open ocean swell has no sudden white flashes and encodes cleanly with ultra-smooth playback.',
    filenameKeywords: ['5362421', 'calm-sea-water-surface'],
  },
  {
    id: 'ocean-4',
    rank: 4,
    category: 'ocean waves',
    batch: 'first',
    source: 'Pixabay',
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

  // ===========================================================================
  // BONUS BATCH: NIGHT SKY/STARS, DESERT DUNES, SNOW, CLOUDS, WATERFALL, FOREST MIST, MOUNTAINS
  // ===========================================================================
  {
    id: 'nasa-stars-airglow',
    rank: 1,
    category: 'night sky/stars',
    batch: 'bonus',
    source: 'NASA Image and Video Library',
    title: 'Deep Space Starfield & Golden Atmospheric Airglow (NASA 4K)',
    pageLink: 'https://images.nasa.gov/details/jsc2022m000172_Earth_in_4K_Expedition_65_Edition',
    creator: 'NASA / International Space Station Expedition 65 Crew',
    licenseName: 'US Government Public Domain (17 U.S.C. § 105)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '720x1280 (720p) + 480x854 (480p)',
    orientation: 'portrait (9:16)',
    duration: '15s',
    loopable: 'Yes — 15s seamless crossfade loop encoded at 720p & 480p',
    motionLevel: 'Very Low',
    whyItFits:
      'Pure unobstructed starfield rising toward Earth’s golden horizon airglow; saves OLED battery and makes white Arabic text shine.',
    filenameKeywords: ['nasa-stars-airglow', 'stars-airglow', 'iss061e000237'],
    bundledAssets: {
      videoUrl720p: '/videos/nasa-stars-airglow-720p.mp4',
      videoUrl480p: '/videos/nasa-stars-airglow-480p.mp4',
      posterUrl: '/videos/nasa-stars-airglow-poster.jpg',
      sizeBytes: 1650000,
      durationSeconds: 15,
    },
  },
  {
    id: 'nasa-emerald-aurora',
    rank: 2,
    category: 'night sky/stars',
    batch: 'bonus',
    source: 'NASA Image and Video Library',
    title: 'Emerald Aurora Borealis & Starry Night Horizon (NASA 4K)',
    pageLink: 'https://images.nasa.gov/details/jsc2022m000172_Earth_in_4K_Expedition_65_Edition',
    creator: 'NASA / International Space Station Expedition 65 Crew',
    licenseName: 'US Government Public Domain (17 U.S.C. § 105)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '720x1280 (720p) + 480x854 (480p)',
    orientation: 'portrait (9:16)',
    duration: '15s',
    loopable: 'Yes — 15s seamless crossfade loop encoded at 720p & 480p',
    motionLevel: 'Low',
    whyItFits:
      'Natural emerald green aurora ribbons dancing over deep space stars — matches the app’s emerald & gold palette.',
    filenameKeywords: ['nasa-emerald-aurora', 'emerald-aurora'],
    bundledAssets: {
      videoUrl720p: '/videos/nasa-emerald-aurora-720p.mp4',
      videoUrl480p: '/videos/nasa-emerald-aurora-480p.mp4',
      posterUrl: '/videos/nasa-emerald-aurora-poster.jpg',
      sizeBytes: 1400000,
      durationSeconds: 15,
    },
  },
  {
    id: 'nasa-sahara-dunes',
    rank: 1,
    category: 'desert dunes at dusk',
    batch: 'bonus',
    source: 'NASA Image and Video Library',
    title: 'Warm Sahara Desert Dunes & Gentle Clouds from Orbit (NASA 4K)',
    pageLink: 'https://images.nasa.gov/details/jsc2022m000172_Earth_in_4K_Expedition_65_Edition',
    creator: 'NASA / International Space Station Expedition 65 Crew',
    licenseName: 'US Government Public Domain (17 U.S.C. § 105)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    attributionRequired: false,
    dateChecked: '2026-11-01',
    resolution: '720x1280 (720p) + 480x854 (480p)',
    orientation: 'portrait (9:16)',
    duration: '15s',
    loopable: 'Yes — 15s seamless crossfade loop encoded at 720p & 480p',
    motionLevel: 'Very Low',
    whyItFits:
      'Warm bronze desert sands and soft white cloud wisps drifting smoothly in 9:16 portrait.',
    filenameKeywords: ['nasa-sahara-dunes', 'sahara-dunes'],
    bundledAssets: {
      videoUrl720p: '/videos/nasa-sahara-dunes-720p.mp4',
      videoUrl480p: '/videos/nasa-sahara-dunes-480p.mp4',
      posterUrl: '/videos/nasa-sahara-dunes-poster.jpg',
      sizeBytes: 1550000,
      durationSeconds: 15,
    },
  },
  {
    id: 'desert-1',
    rank: 2,
    category: 'desert dunes at dusk',
    batch: 'bonus',
    source: 'Pexels',
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
    id: 'waterfall-1',
    rank: 1,
    category: 'waterfall',
    batch: 'bonus',
    source: 'Pexels',
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
    source: 'Pexels',
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
    source: 'Pexels',
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
    id: 'snow-1',
    rank: 1,
    category: 'snow',
    batch: 'bonus',
    source: 'Pexels',
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
    source: 'Pexels',
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
    whyItFits: 'Native 9:16 vertical sky; muted twilight clouds never compete with foreground verses.',
    filenameKeywords: ['5280717', 'clouds-in-the-sky-during-sunset'],
  },
];

export const AMBIENT_SOUND_CANDIDATES: AmbientSoundCandidate[] = [
  {
    id: 'sound-river-1',
    rank: 1,
    category: 'river',
    source: 'Pixabay',
    title: 'Gentle Forest Stream & Babbling Brook (Seamless Loop)',
    pageLink: 'https://pixabay.com/sound-effects/river-stream-water-nature-141988/',
    creator: 'Pixabay Audio Community',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attributionRequired: false,
    duration: '45s',
    dateChecked: '2026-11-01',
    notes: 'Soft low-frequency water flow with no harsh high-frequency splash; sits underneath Quran recitation without masking vocals.',
  },
  {
    id: 'sound-wind-1',
    rank: 1,
    category: 'wind',
    source: 'Pixabay',
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
    source: 'Pixabay',
    title: 'Cozy Fireplace Soft Crackling Loop',
    pageLink: 'https://pixabay.com/sound-effects/fireplace-crackling-loop-124560/',
    creator: 'Pixabay Audio Community',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attributionRequired: false,
    duration: '38s',
    dateChecked: '2026-11-01',
    notes: 'Gentle hearth crackle without loud pops; commercial Pixabay license.',
  },
  {
    id: 'sound-rain-1',
    rank: 1,
    category: 'rain',
    source: 'Pixabay',
    title: 'Steady Night Rain on Leaves (No Thunder)',
    pageLink: 'https://pixabay.com/sound-effects/soft-rain-ambient-111154/',
    creator: 'Pixabay Audio Community',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attributionRequired: false,
    duration: '52s',
    dateChecked: '2026-11-01',
    notes: 'Pure steady rainfall with zero thunder claps so recitation remains peaceful.',
  },
  {
    id: 'sound-waves-1',
    rank: 1,
    category: 'waves',
    source: 'Pixabay',
    title: 'Calm Ocean Waves Lapping Shore at Dusk',
    pageLink: 'https://pixabay.com/sound-effects/ocean-waves-112906/',
    creator: 'Pixabay Audio Community',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attributionRequired: false,
    duration: '60s',
    dateChecked: '2026-11-01',
    notes: 'Slow rhythmic surf wash; commercial Pixabay license.',
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
