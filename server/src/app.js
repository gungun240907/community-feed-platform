require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
  console.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
let mongod = null;
let dbReady = false;

async function connectDB() {
  mongoose.set('bufferCommands', false);
  mongoose.set('bufferTimeoutMS', 30000);
  if (MONGO_URI) {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
    console.log('Connected to MongoDB');
  } else {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, {
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

const dbPromise = connectDB().catch((err) => {
  console.error('MongoDB connection error:', err);
  throw err;
});

if (require.main === module) {
  dbPromise.then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}

module.exports = app;
