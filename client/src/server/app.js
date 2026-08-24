require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const feedRoutes = require('./routes/feed');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const subscriptionRoutes = require('./routes/subscriptions');
const supportRoutes = require('./routes/support');
const searchRoutes = require('./routes/search');
const reputationRoutes = require('./routes/reputation');
const languageRoutes = require('./routes/language');
const webhookRoutes = require('./routes/webhook');
const sessionRoutes = require('./routes/sessions');
const loginLogRoutes = require('./routes/loginLogs');
const otpRoutes = require('./routes/otp');
const whatsappService = require('./utils/whatsappService');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || origin.startsWith('http://localhost') || origin.endsWith('.vercel.app')) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.set('io', io);

// Webhook route must be before global express.json() to preserve raw body for Razorpay signature verification
app.use('/api/webhook', webhookRoutes);

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.endsWith('.vercel.app')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Security headers. CSP is disabled because Next.js injects inline scripts and
// the API already only serves JSON. The rest of Helmet's headers
// (X-Frame-Options, nosniff, HSTS, etc.) apply.
app.use(helmet({ contentSecurityPolicy: false }));

// Parse httpOnly auth cookies (df_token) for cookie-based authentication.
app.use(cookieParser());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  if (!dbReady) {
    return dbPromise.then(() => next()).catch(() =>
      res.status(503).json({ error: 'Database not ready' })
    );
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

app.use('/api/search', searchRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/reputation', reputationRoutes);
app.use('/api/language', languageRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/login-logs', loginLogRoutes);
app.use('/api/otp', otpRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    whatsapp: whatsappService.isConfigured(),
  });
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-in-production');
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);

  socket.join(socket.userId);

  socket.on('joinPost', (postId) => {
    socket.join(`post:${postId}`);
  });

  socket.on('leavePost', (postId) => {
    socket.leave(`post:${postId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

app.use((err, req, res, next) => {
  let statusCode = err.statusCode || 500;

  // Malformed ObjectIds (e.g. an invalid id in a URL) are a client input error,
  // never a server fault. Normalize Mongoose's CastError into a 400.
  if (err.name === 'CastError') {
    statusCode = 400;
    err.message = 'Invalid ID format';
    err.expose = true;
  }

  if (statusCode === 429) {
    res.setHeader('Retry-After', String(Math.ceil((err.retryAfterMs || 60) / 1000)));
  }

  // Never leak internal error details for unhandled 5xx errors.
  const message = err.expose || statusCode < 500
    ? err.message
    : 'Internal server error';

  const body = { error: message };
  if (err.code) body.code = err.code;
  if (err.retryAfterMs) body.retryAfterMs = err.retryAfterMs;
  if (process.env.NODE_ENV === 'development') body.stack = err.stack;

  if (statusCode >= 500) console.error('Unhandled error:', err);
  res.status(statusCode).json(body);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
let mongod = null;
let dbReady = false;

/**
 * Fail fast in production when security-critical configuration is missing.
 * Prevents silent deployment with placeholder secrets or a missing DB URI.
 */
function assertProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const required = ['JWT_SECRET', 'OTP_PEPPER_SECRET'];
  if (!process.env.ALLOW_IN_MEMORY_DB) required.push('MONGO_URI');
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  if (String(process.env.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET must be a strong random secret of at least 32 characters');
  }
}

assertProductionConfig();

async function connectDB() {
  mongoose.set('bufferCommands', false);
  mongoose.set('bufferTimeoutMS', 30000);

  // Idempotent: Next.js dev re-evaluates this module on hot reload, which would
  // otherwise call mongoose.connect() twice (once per in-memory server) and blow
  // up with "Can't call openUri() on an active connection with different
  // connection strings". If we are already connected/connecting, reuse it.
  const state = mongoose.connection.readyState;
  if (state === 1 || state === 2) {
    dbReady = true;
    return;
  }

  if (MONGO_URI) {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
    console.log('Connected to MongoDB');
  } else {
    if (process.env.VERCEL) {
      throw new Error('MONGO_URI is required on Vercel');
    }
    if (!mongod) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
    }
    await mongoose.connect(mongod.getUri(), {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log('Connected to MongoDB (in-memory)');
  }
  dbReady = true;
}

mongoose.connection.on('error', (err) => {
  console.error('MongoDB runtime connection error:', err);
  dbReady = false;
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
  dbReady = false;
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
  dbReady = true;
});

const dbPromise = process.env.NEXT_PHASE === 'phase-production-build'
  ? Promise.resolve()
  : connectDB().catch((err) => {
      console.error('MongoDB connection error:', err);
      throw err;
    });

if (require.main === module) {
  dbPromise.then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      if (whatsappService.isConfigured()) {
        console.log('[whatsapp] Configured — phone OTPs will be delivered via WhatsApp when a recipient number is available.');
      } else {
        console.log('[whatsapp] NOT configured — phone OTPs will fall back to email. Set WHATSAPP_* env vars to enable WhatsApp delivery.');
      }
    });
  });
}

module.exports = app;
