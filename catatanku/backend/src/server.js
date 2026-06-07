require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const connectDB = require('./config/database');

const app = express();
connectDB();

// ── Middleware ────────────────────────────────────────
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin, cb) => {
        // allow server-to-server (no origin) or whitelisted domains
        if (!origin || ALLOWED.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
      }
    : '*',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Serve frontend static files ───────────────────────
const FRONTEND = path.join(__dirname, '../../frontend');
app.use(express.static(FRONTEND));

// ── API Routes ────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/notes',        require('./routes/notes'));
app.use('/api/reminders',    require('./routes/reminders'));
app.use('/api/transactions', require('./routes/transactions'));

// ── Health check ──────────────────────────────────────
app.get('/api/health', (_, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV, ts: new Date().toISOString() })
);

// ── SPA fallback (serve frontend for all other routes) ─
app.get('*', (_, res) =>
  res.sendFile(path.join(FRONTEND, 'index.html'))
);

// ── Start ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server  →  http://localhost:${PORT}`);
  console.log(`📂 Frontend →  http://localhost:${PORT}`);
  console.log(`🔌 API      →  http://localhost:${PORT}/api\n`);
});
