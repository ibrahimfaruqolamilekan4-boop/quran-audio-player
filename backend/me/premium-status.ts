// GET /api/me/premium-status -> { authenticated, is_premium, subscription_plan, premium_expires_at, can_download }
import { type Handler, getAuthUser, sendJson } from '../_lib.mjs';

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return sendJson(res, 200, {
        authenticated: false,
        is_premium: false,
        subscription_plan: 'free',
        premium_expires_at: null,
        can_download: false,
      });
    }

    const isExpired = user.premium_expires_at
      ? new Date(user.premium_expires_at).getTime() < Date.now()
      : false;
    const isPremium = Boolean((user.is_premium || user.role === 'admin' || user.subscription_plan === 'lifetime') && !isExpired);

    return sendJson(res, 200, {
      authenticated: true,
      uid: user.uid,
      is_premium: isPremium,
      subscription_plan: user.subscription_plan || (user.role === 'admin' ? 'lifetime' : 'free'),
      premium_expires_at: user.premium_expires_at || null,
      can_download: isPremium,
    });
  } catch (err: any) {
    console.error('premium-status check failed:', err);
    return sendJson(res, 500, { error: 'Failed to verify premium status.' });
  }
};

export default handler;
