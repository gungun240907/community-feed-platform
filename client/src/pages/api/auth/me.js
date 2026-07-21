import runHandler from '../../../lib/handler.js';
import { authenticate } from '../../../lib/middleware/auth.js';

async function me(req, res, next) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await authenticate(req, res, next);

  if (res.headersSent) return;

  res.status(200).json({ user: req.user });
}

export default runHandler(me);
