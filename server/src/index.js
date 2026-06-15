import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import authRoutes from './routes/auth.js';
import territoriesRoutes from './routes/territories.js';
import assignmentsRoutes from './routes/assignments.js';
import usersRoutes from './routes/users.js';
import reportsRoutes from './routes/reports.js';
import mapsRoutes from './routes/maps.js';
import pushRoutes from './routes/push.js';
import { startOverdueNotifier } from './jobs/overdueNotifier.js';
import migrate from './db/migrate.js';
import seed from './db/seed.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (territory maps)
app.use('/maps', express.static(path.join(__dirname, '../png_files')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/territories', territoriesRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/push', pushRoutes);

// Health checks
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server after running migrations and seeding database
(async () => {
  try {
    await migrate();
    await seed();
  } catch (err) {
    console.error('Error running migrations or seeding at startup:', err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    startOverdueNotifier();
  });
})();

