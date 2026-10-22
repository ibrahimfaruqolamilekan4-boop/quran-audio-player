// GET /api/me/preferences   -> { preferences }
// PUT /api/me/preferences   { theme?, activeBackgroundVideoId?, ambientVideoMapping? }
import { type Handler, q, requireAuth, sendJson, readJson } from '../_lib.mjs';

interface PrefRow {
  theme?: string;
  active_background_video_id?: string | null;
  ambient_video_mapping?: Record<string, string> | string;
}

const DEFAULT_PREFERENCES = {
  theme: 'midnight-scholar',
  activeBackgroundVideoId: null,
  ambientVideoMapping: {} as Record<string, string>,
};

function parseMapping(raw: any): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'object' && raw !== null) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return {};
}

const handler: Handler = async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (req.method === 'GET') {
      let r: PrefRow | undefined;
      try {
        const { rows } = await q<PrefRow>(
          `INSERT INTO user_preferences (user_uid) VALUES ($1)
           ON CONFLICT (user_uid) DO UPDATE SET user_uid = EXCLUDED.user_uid
           RETURNING theme, active_background_video_id, ambient_video_mapping`,
          [user.uid]
        );
        r = rows?.[0];
      } catch (dbErr) {
        console.warn('Could not query user_preferences with INSERT RETURNING, trying SELECT:', dbErr);
        try {
          const { rows } = await q<PrefRow>(
            'SELECT theme, active_background_video_id, ambient_video_mapping FROM user_preferences WHERE user_uid = $1',
            [user.uid]
          );
          r = rows?.[0];
        } catch {}
      }

      const theme = r?.theme || DEFAULT_PREFERENCES.theme;
      const activeBackgroundVideoId = r?.active_background_video_id ?? DEFAULT_PREFERENCES.activeBackgroundVideoId;
      const ambientVideoMapping = parseMapping(r?.ambient_video_mapping);

      return sendJson(res, 200, {
        preferences: {
          theme,
          activeBackgroundVideoId,
          ambientVideoMapping,
        },
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = (await readJson(req)) || {};
      let base: PrefRow = {};
      try {
        const { rows: current } = await q<PrefRow>(
          'SELECT theme, active_background_video_id, ambient_video_mapping FROM user_preferences WHERE user_uid = $1',
          [user.uid]
        );
        base = current?.[0] || {};
      } catch {}

      const theme = typeof body.theme === 'string' ? body.theme : (base.theme || DEFAULT_PREFERENCES.theme);
      const activeVideoId = 'activeBackgroundVideoId' in body
        ? (typeof body.activeBackgroundVideoId === 'string' ? body.activeBackgroundVideoId : null)
        : (base.active_background_video_id ?? null);
      const mapping = 'ambientVideoMapping' in body && typeof body.ambientVideoMapping === 'object' && body.ambientVideoMapping
        ? body.ambientVideoMapping
        : parseMapping(base.ambient_video_mapping);

      try {
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
      } catch (saveErr) {
        console.warn('Failed to persist preferences to db:', saveErr);
      }

      return sendJson(res, 200, {
        preferences: {
          theme,
          activeBackgroundVideoId: activeVideoId,
          ambientVideoMapping: mapping,
        },
      });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('preferences handler error:', err);
    return sendJson(res, 200, { preferences: DEFAULT_PREFERENCES });
  }
};

export default handler;
