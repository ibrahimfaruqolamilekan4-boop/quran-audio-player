import fs from 'fs';
import path from 'path';

const lucideIcons = new Set();
// Extract all lucide-react imports from files
function scanDir(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name !== 'node_modules' && f.name !== '.git' && f.name !== 'dist') {
        scanDir(full);
      }
    } else if (f.name.endsWith('.tsx') || f.name.endsWith('.ts')) {
      checkFile(full);
    }
  }
}

let foundErrors = 0;

function checkFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  
  // Find all imports from 'lucide-react'
  const importMatch = code.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g);
  const importedIcons = new Set();
  if (importMatch) {
    for (const m of importMatch) {
      const inside = m.replace(/import\s*\{/, '').replace(/\}\s*from.*/, '');
      inside.split(',').forEach(i => {
        const clean = i.trim().split(/\s+as\s+/)[0].trim();
        if (clean) importedIcons.add(clean);
      });
    }
  }

  // Look for JSX tags <PascalCase ... /> or <PascalCase>
  const jsxTags = code.match(/<([A-Z][a-zA-Z0-9]+)(\s|>|\/)/g) || [];
  for (const rawTag of jsxTags) {
    const tagName = rawTag.slice(1).replace(/[\s>\/]/, '');
    // If it's a known Lucide icon name but not imported and not declared in file
    const commonLucideIcons = [
      'Info', 'Check', 'AlertCircle', 'AlertTriangle', 'Play', 'Pause', 'Square',
      'Search', 'X', 'Camera', 'Upload', 'Trash2', 'Sparkles', 'Sparkle',
      'Settings', 'Settings2', 'Sun', 'Sunrise', 'Sunset', 'Moon', 'Clock',
      'MapPin', 'LocateFixed', 'Volume2', 'VolumeX', 'Bell', 'BellOff', 'Shield',
      'ShieldCheck', 'ShieldAlert', 'Users', 'User', 'UserCheck', 'ExternalLink',
      'Mail', 'Calendar', 'Pencil', 'Video', 'RefreshCw', 'FileAudio', 'BookOpen',
      'WifiOff', 'CheckCircle2', 'Filter', 'ChevronUp', 'ChevronDown', 'ChevronRight',
      'ChevronLeft', 'Sliders', 'Plus', 'Minus', 'RotateCcw', 'Radio', 'ImageOff',
      'SkipBack', 'SkipForward'
    ];
    if (commonLucideIcons.includes(tagName)) {
      if (!importedIcons.has(tagName) && !code.includes(`function ${tagName}`) && !code.includes(`const ${tagName}`) && !code.includes(`class ${tagName}`)) {
        console.error(`ERROR: Icon <${tagName}> used in ${filePath} but NOT imported!`);
        foundErrors++;
      }
    }
  }
}

scanDir(path.resolve(process.cwd(), 'src'));

if (foundErrors === 0) {
  console.log('✓ All common Lucide icons used in JSX are properly imported across src/!');
} else {
  console.error(`Found ${foundErrors} missing icon imports!`);
  process.exit(1);
}
