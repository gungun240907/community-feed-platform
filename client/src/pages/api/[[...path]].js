export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

const app = require('../../server/app');

export default function handler(req, res) {
  return app(req, res);
}
