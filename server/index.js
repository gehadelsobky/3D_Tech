import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import giftSettingsRoutes from './routes/gift-settings.js';
import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';
import pageRoutes from './routes/pages.js';
import formRoutes from './routes/forms.js';
import settingsRoutes from './routes/settings.js';
import categoryRoutes from './routes/categories.js';
import uploadRoutes from './routes/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ---------- Security Middleware ----------

// Helmet — sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: false,       // disable CSP so inline styles/scripts from React work
  crossOriginEmbedderPolicy: false,   // allow loading external images
}));

// CORS — restrict origins in production
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : null; // null = allow all (development mode)

app.use(cors(allowedOrigins ? {
  origin(origin, callback) {
    // Allow requests with no origin (mobile apps, server-to-server, same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
} : undefined));

// Request size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// General API rate limiter — 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// Strict login rate limiter — 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});
app.use('/api/auth/login', loginLimiter);

// Strict form submission rate limiter — 10 submissions per 15 minutes per IP
const formSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});
app.use('/api/forms/:slug/submit', formSubmitLimiter);

// Initialize database (creates tables + seeds data on first run)
initDb();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/gift-settings', giftSettingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', uploadRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files (production)
app.use(express.static(path.join(__dirname, '..', 'dist')));

// SPA fallback — all non-API routes serve index.html (Express 5 syntax)
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// ---------- JWT Secret Warning ----------
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET is not set. Using default secret — NOT SAFE for production!');
}

app.listen(PORT, () => {
  console.log(`3D Tech server running on http://localhost:${PORT}`);
});
