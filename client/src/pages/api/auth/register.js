import runHandler from '../../../lib/handler.js';
import User from '../../../lib/models/User.js';
import { generateToken } from '../../../lib/middleware/auth.js';

async function register(req, res, next) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    return res.status(409).json({ error: 'User with this email or username already exists' });
  }

  const user = await User.create({ username, email, password });
  const token = generateToken(user._id);

  res.status(201).json({ user, token });
}

export default runHandler(register);
