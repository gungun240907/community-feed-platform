import runHandler from '../../../../../lib/handler.js';
import { authenticate } from '../../../../../lib/middleware/auth.js';
import { requireAdmin } from '../../../../../lib/middleware/admin.js';
import Report from '../../../../../lib/models/Report.js';

async function dismissReport(req, res, next) {
  try {
    const { reportId } = req.params;
    const report = await Report.findByIdAndUpdate(
      reportId,
      { status: 'dismissed', actionedBy: req.user._id, actionedAt: new Date() },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report dismissed', report });
  } catch (error) {
    next(error);
  }
}

export default runHandler((req, res, next) => {
  if (req.method === 'PUT') {
    return authenticate(req, res, () => {
      requireAdmin(req, res, () => dismissReport(req, res, next));
    });
  }
  res.status(405).json({ error: 'Method not allowed' });
});
