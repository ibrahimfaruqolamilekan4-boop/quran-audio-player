// Shared Flutterwave configuration helper
// Resolves secret keys, public keys, and webhook hashes flexibly across various Vercel environment variable naming patterns.
// Sanitizes quotes, spaces, and newlines so user copy-paste issues never silently fail transactions.

export interface FlutterwaveEnvInfo {
  hasSecret: boolean;
  hasPublic: boolean;
  hasWebhookHash: boolean;
  secretKeyName: string | null;
  publicKeyName: string | null;
  secretPrefix: string;
  publicPrefix: string;
  secretMode: 'TEST' | 'LIVE' | 'UNKNOWN';
  publicMode: 'TEST' | 'LIVE' | 'UNKNOWN';
  warnings: string[];
}

const SECRET_KEY_VARS = [
  'FLW_SECRET_KEY',
  'FLUTTERWAVE_SECRET_KEY',
  'FLW_SECRET',
  'FLUTTERWAVE_SECRET',
  'VITE_FLW_SECRET_KEY',
  'VITE_FLUTTERWAVE_SECRET_KEY',
] as const;

const PUBLIC_KEY_VARS = [
  'FLW_PUBLIC_KEY',
  'FLUTTERWAVE_PUBLIC_KEY',
  'VITE_FLW_PUBLIC_KEY',
  'VITE_FLUTTERWAVE_PUBLIC_KEY',
  'FLW_PUB_KEY',
] as const;

const WEBHOOK_HASH_VARS = [
  'FLW_WEBHOOK_HASH',
  'FLUTTERWAVE_WEBHOOK_HASH',
  'FLW_SECRET_HASH',
  'FLUTTERWAVE_SECRET_HASH',
] as const;

function cleanKey(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^['"]|['"]$/g, '');
}

export function getFlutterwaveSecretKey(): string {
  for (const name of SECRET_KEY_VARS) {
    const val = process.env[name];
    if (typeof val === 'string' && val.trim()) {
      const cleaned = cleanKey(val);
      if (cleaned && !cleaned.includes('placeholder')) {
        return cleaned;
      }
    }
  }
  return '';
}

export function getFlutterwavePublicKey(): string {
  for (const name of PUBLIC_KEY_VARS) {
    const val = process.env[name];
    if (typeof val === 'string' && val.trim()) {
      const cleaned = cleanKey(val);
      if (cleaned && !cleaned.includes('placeholder')) {
        return cleaned;
      }
    }
  }
  return '';
}

export function getFlutterwaveWebhookHash(): string {
  for (const name of WEBHOOK_HASH_VARS) {
    const val = process.env[name];
    if (typeof val === 'string' && val.trim()) {
      const cleaned = cleanKey(val);
      if (cleaned && !cleaned.includes('placeholder')) {
        return cleaned;
      }
    }
  }
  return '';
}

export function getFlutterwaveEnvInfo(): FlutterwaveEnvInfo {
  let foundSecretVar: string | null = null;
  let rawSecretVal = '';
  for (const name of SECRET_KEY_VARS) {
    if (process.env[name]) {
      foundSecretVar = name;
      rawSecretVal = process.env[name] as string;
      break;
    }
  }

  let foundPublicVar: string | null = null;
  let rawPublicVal = '';
  for (const name of PUBLIC_KEY_VARS) {
    if (process.env[name]) {
      foundPublicVar = name;
      rawPublicVal = process.env[name] as string;
      break;
    }
  }

  let foundWebhookVar: string | null = null;
  for (const name of WEBHOOK_HASH_VARS) {
    if (process.env[name]) {
      foundWebhookVar = name;
      break;
    }
  }

  const cleanSecret = cleanKey(rawSecretVal);
  const cleanPublic = cleanKey(rawPublicVal);

  const warnings: string[] = [];

  if (!cleanSecret) {
    warnings.push('Flutterwave Secret Key is missing. Add FLW_SECRET_KEY or FLUTTERWAVE_SECRET_KEY in Vercel environment variables.');
  } else {
    if (rawSecretVal.startsWith('"') || rawSecretVal.startsWith("'")) {
      warnings.push(`Your secret key (${foundSecretVar}) has quotation marks in Vercel. In Vercel, paste only the raw key.`);
    }
    if (rawSecretVal !== rawSecretVal.trim()) {
      warnings.push(`Your secret key (${foundSecretVar}) has leading or trailing spaces. Trim the key in Vercel.`);
    }
    if (cleanSecret.startsWith('FLWPUBK')) {
      warnings.push(`CRITICAL: Your secret key variable (${foundSecretVar}) contains a Public Key (starts with FLWPUBK). It must be your Secret Key (starts with FLWSECK).`);
    }
  }

  const secretMode: 'TEST' | 'LIVE' | 'UNKNOWN' = cleanSecret.includes('TEST')
    ? 'TEST'
    : cleanSecret.startsWith('FLWSECK')
    ? 'LIVE'
    : 'UNKNOWN';

  const publicMode: 'TEST' | 'LIVE' | 'UNKNOWN' = cleanPublic.includes('TEST')
    ? 'TEST'
    : cleanPublic.startsWith('FLWPUBK')
    ? 'LIVE'
    : 'UNKNOWN';

  if (cleanSecret && cleanPublic && secretMode !== 'UNKNOWN' && publicMode !== 'UNKNOWN' && secretMode !== publicMode) {
    warnings.push(`Mode mismatch: Secret Key is in ${secretMode} mode, while Public Key is in ${publicMode} mode.`);
  }

  const secretPrefix = cleanSecret.length >= 10 ? `${cleanSecret.slice(0, 10)}...` : cleanSecret ? 'Configured' : 'Not Set';
  const publicPrefix = cleanPublic.length >= 10 ? `${cleanPublic.slice(0, 10)}...` : cleanPublic ? 'Configured' : 'Not Set';

  return {
    hasSecret: Boolean(cleanSecret),
    hasPublic: Boolean(cleanPublic),
    hasWebhookHash: Boolean(foundWebhookVar),
    secretKeyName: foundSecretVar,
    publicKeyName: foundPublicVar,
    secretPrefix,
    publicPrefix,
    secretMode,
    publicMode,
    warnings,
  };
}
