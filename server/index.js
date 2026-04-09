import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import giftSettingsRoutes from './routes/gift-settings.js';
import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database (creates tables + seeds data on first run)
initDb();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/gift-settings', giftSettingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);

// Serve frontend static files (production)
app.use(express.static(path.join(__dirname, '..', 'dist')));

// SPA fallback — all non-API routes serve index.html (Express 5 syntax)
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`3D Tech server running on http://localhost:${PORT}`);
});
