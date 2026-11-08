const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');

// Route Imports
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const studentsRoutes = require('./routes/students.routes');
const teachersRoutes = require('./routes/teachers.routes');
const classesRoutes = require('./routes/classes.routes');
const subjectsRoutes = require('./routes/subjects.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const gradesRoutes = require('./routes/grades.routes');
const feesRoutes = require('./routes/fees.routes');
const announcementsRoutes = require('./routes/announcements.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/announcements', announcementsRoutes);

// Fallback for SPA routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Startup Function
async function startServer() {
  try {
    console.log('------------------------------------------------------------');
    console.log(' Starting School Management System Server...');
    console.log('------------------------------------------------------------');

    // Initialize Oracle Database Pool
    try {
      await db.initializePool();
      const health = await db.checkHealth();
      console.log(`[Database] Connected to Oracle DB: ${health.database} (${health.version})`);
      console.log(`[Database] DB Time: ${health.currentTime} | User: ${health.user}`);
    } catch (dbErr) {
      console.error('[Database Warning] Failed to connect to Oracle DB:', dbErr.message);
      console.error('[Database Warning] Please ensure Oracle XE service is running and credentials in .env are correct.');
    }

    const activeServers = [];

    // Listen on Port 80 (Standard HTTP - enables http://hawaryawtenkelschool.com directly)
    try {
      const server80 = app.listen(80, '0.0.0.0', () => {
        console.log('============================================================');
        console.log(' HAWARYAW TENKEL SCHOOL MANAGEMENT SYSTEM');
        console.log(' Primary URL:  http://hawaryawtenkelschool.com');
        console.log(' Direct URL:   http://localhost (Port 80)');
        console.log(' LAN URL:      http://10.139.218.92');
      });


      
      server80.on('error', (e) => {
        console.warn('[Port 80 Note]:', e.message);
      });
      activeServers.push(server80);
    } catch (e) {
      console.warn('[Port 80 Note]:', e.message);
    }

    // Also listen on Port 3000 as secondary
    const server3000 = app.listen(3000, '0.0.0.0', () => {
      console.log(' Secondary URL: http://localhost:3000');
      console.log('============================================================');
      console.log(' Demo Login Accounts:');
      console.log('   👑 Administrator:  admin           / admin123');
      console.log('   👨‍🏫 Teacher:        teacher.roberts / teacher123');
      console.log('   🎓 Student:        student.liam    / student123');
      console.log('============================================================');
    });
    activeServers.push(server3000);

    // Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      for (const s of activeServers) {
        try { s.close(); } catch (_) {}
      }
      await db.closePool();
      console.log('[Server] Shutdown complete.');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

startServer();
