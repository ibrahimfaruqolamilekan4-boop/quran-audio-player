// GET /api/me/preferences   -> { preferences }
// PUT /api/me/preferences   { theme?, activeBackgroundVideoId?, ambientVideoMapping? }
import { type Handler, q, requireAuth, sendJson, readJson } from '../_lib';

interface PrefRow {
  theme: string;
  active_background_video_id: string | null;
  ambient_video_mapping: Record<string, string>;
}

const handler: Handler = async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (req.method === 'GET') {
      const { rows } = await q<PrefRow>(
        `INSERT INTO user_preferences (user_uid) VALUES ($1)
         ON CONFLICT (user_uid) DO UPDATE SET user_uid = EXCLUDED.user_uid
         RETURNING theme, active_background_video_id, ambient_video_mapping`,
        [user.uid]
      );
      const r = rows[0];
      return sendJson(res, 200, {
        preferences: {
          theme: r.theme,
          activeBackgroundVideoId: r.active_background_video_id,
          ambientVideoMapping: r.ambient_video_mapping ?? {},
        },
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readJson(req);
      const { rows: current } = await q<PrefRow>(
        'SELECT theme, active_background_video_id, ambient_video_mapping FROM user_preferences WHERE user_uid = $1',
        [user.uid]
      );
      const base = current[0] ?? { theme: 'midnight-scholar', active_background_video_id: null, ambient_video_mapping: {} };

      const theme = typeof body.theme === 'string' ? body.theme : base.theme;
      const activeVideoId = 'activeBackgroundVideoId' in body
        ? (typeof body.activeBackgroundVideoId === 'string' ? body.activeBackgroundVideoId : null)
        : base.active_background_video_id;
      const mapping = 'ambientVideoMapping' in body && typeof body.ambientVideoMapping === 'object' && body.ambientVideoMapping
        ? body.ambientVideoMapping
        : base.ambient_video_mapping;

      await q(
        `INSERT INTO user_preferences (user_uid, theme, active_background_video_id, ambient_video_mapping, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (user_uid)
         DO UPDATE SET theme = EXCLUDED.theme,
                       active_background_video_id = EXCLUDED.active_background_video_id,
                       ambient_video_mapping = EXCLUDED.ambient_video_mapping,
                       updated_at = now()`,
        [user.uid, theme, activeVideoId, JSON.stringify(mapping)]
      );
      return sendJson(res, 200, { preferences: { theme, activeBackgroundVideoId: activeVideoId, ambientVideoMapping: mapping } });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('preferences failed:', err);
    return sendJson(res, 500, { error: 'Could not load preferences.' });
  }
};

export default handler;
