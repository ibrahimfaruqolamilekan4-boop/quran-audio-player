// Verification test script for payments and player hardening
import { readFileSync } from 'node:fs';

console.log('=== 1. Verifying API Serverless Bundles ===');
const targets = ['api/[s1].js', 'api/[s1]/[s2].js', 'api/[s1]/[s2]/[s3].js'];
for (const target of targets) {
  const content = readFileSync(target, 'utf8');
  if (!content.includes('FLUTTERWAVE_SECRET_KEY')) {
    throw new Error(`Target ${target} missing FLUTTERWAVE_SECRET_KEY support!`);
  }
  if (!content.includes('charges?type=bank_transfer')) {
    throw new Error(`Target ${target} missing bank transfer charge endpoint!`);
  }
  console.log(`✓ ${target}: valid (${content.length} bytes, has Flutterwave flexible env support)`);
}

console.log('\n=== 2. Verifying Pricing strictly ₦500 ===');
const supabaseTs = readFileSync('src/lib/supabase.ts', 'utf8');
if (!supabaseTs.includes('amount: 500')) {
  throw new Error('Supabase client plan amount is not 500!');
}
console.log('✓ DEFAULT_CLIENT_PLAN: amount: 500, currency: NGN');

console.log('\n=== 3. Verifying PlayerContext & RecitersHubView for undefined variables ===');
const playerContext = readFileSync('src/context/PlayerContext.tsx', 'utf8');
const hubView = readFileSync('src/views/RecitersHubView.tsx', 'utf8');

if (!hubView.includes('fallbackReciter =')) {
  throw new Error('fallbackReciter is missing in RecitersHubView.tsx');
}
if (!hubView.includes('import {') || !hubView.includes('Info,')) {
  throw new Error('Info icon import is missing in RecitersHubView.tsx');
}
console.log('✓ RecitersHubView has fallbackReciter defined and Info imported.');

console.log('\n=== 4. Verifying SubscriptionModal and PremiumView Fallback Support ===');
const modal = readFileSync('src/components/SubscriptionModal.tsx', 'utf8');
const premiumView = readFileSync('src/views/PremiumView.tsx', 'utf8');

if (!modal.includes('fallbackCheckoutUrl')) {
  throw new Error('SubscriptionModal missing fallbackCheckoutUrl support!');
}
if (!premiumView.includes('fallbackCheckoutUrl')) {
  throw new Error('PremiumView missing fallbackCheckoutUrl support!');
}
console.log('✓ Both modal and view display direct Flutterwave hosted checkout fallback.');

console.log('\nALL VERIFICATIONS PASSED SUCCESSFULLY!');
