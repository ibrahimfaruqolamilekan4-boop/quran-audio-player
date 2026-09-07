// DELETE /api/me/reciters/<id>
import { type Handler, q, requireAuth, sendJson, apiPath } from '../../_lib';

const handler: Handler = async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (req.method !== 'DELETE') return sendJson(res, 405, { error: 'Method not allowed' });

    const id = apiPath(req)[2]; // ['me','reciters','<id>']
    if (!id) return sendJson(res, 400, { error: 'Missing reciter id' });

    await q('DELETE FROM custom_reciters WHERE id = $1 AND user_uid = $2', [id, user.uid]);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('delete reciter failed:', err);
    return sendJson(res, 500, { error: 'Could not delete reciter.' });
  }
};

export default handler;
