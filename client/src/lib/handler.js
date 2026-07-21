import dbConnect from './dbConnect.js';

export default function runHandler(handler) {
  return async (req, res) => {
    await dbConnect();

    req.params = req.query || {};

    req.app = {
      get: () => null,
    };

    const next = (err) => {
      if (err) {
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({ error: err.message || 'Internal server error' });
      }
    };

    try {
      await handler(req, res, next);
    } catch (err) {
      console.error('API Error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  };
}
