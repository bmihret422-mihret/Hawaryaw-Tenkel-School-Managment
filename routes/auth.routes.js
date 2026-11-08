const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * User login with username/email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    const query = `
      SELECT user_id, username, password_hash, full_name, email, phone, role, status
      FROM users
      WHERE LOWER(username) = LOWER(:u) OR LOWER(email) = LOWER(:u)
    `;

    const result = await db.execute(query, { u: username.trim() });
    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    const user = result.rows[0];

    if (user.STATUS !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.STATUS.toLowerCase()}. Please contact the administrator.`
      });
    }

    const isMatch = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.'
      });
    }

    // Fetch role-specific details if applicable
    let extraDetails = {};
    if (user.ROLE === 'STUDENT') {
      const studRes = await db.execute(`
        SELECT s.student_id, s.admission_number, s.roll_number, s.class_id,
               c.class_name, c.section
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.class_id
        WHERE s.user_id = :userId
      `, { userId: user.USER_ID });
      if (studRes.rows && studRes.rows.length > 0) {
        extraDetails = studRes.rows[0];
      }
    } else if (user.ROLE === 'TEACHER') {
      const teachRes = await db.execute(`
        SELECT teacher_id, employee_code, qualification, specialization
        FROM teachers
        WHERE user_id = :userId
      `, { userId: user.USER_ID });
      if (teachRes.rows && teachRes.rows.length > 0) {
        extraDetails = teachRes.rows[0];
      }
    }

    const payload = {
      userId: user.USER_ID,
      username: user.USERNAME,
      fullName: user.FULL_NAME,
      email: user.EMAIL,
      role: user.ROLE,
      ...extraDetails
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: payload
    });

  } catch (err) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ success: false, message: 'Server error during authentication: ' + err.message });
  }
});

/**
 * GET /api/auth/me
 * Get currently authenticated user details
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userRes = await db.execute(`
      SELECT user_id, username, full_name, email, phone, role, status, created_at
      FROM users
      WHERE user_id = :userId
    `, { userId: req.user.userId });

    if (!userRes.rows || userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = userRes.rows[0];
    let extra = {};

    if (user.ROLE === 'STUDENT') {
      const s = await db.execute(`
        SELECT s.*, c.class_name, c.section, c.room_number
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.class_id
        WHERE s.user_id = :userId
      `, { userId: user.USER_ID });
      extra = s.rows[0] || {};
    } else if (user.ROLE === 'TEACHER') {
      const t = await db.execute(`
        SELECT * FROM teachers WHERE user_id = :userId
      `, { userId: user.USER_ID });
      extra = t.rows[0] || {};
    }

    res.json({
      success: true,
      user: {
        ...user,
        details: extra
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const userRes = await db.execute(`
      SELECT password_hash FROM users WHERE user_id = :userId
    `, { userId: req.user.userId });

    const currentHash = userRes.rows[0]?.PASSWORD_HASH;
    const isMatch = await bcrypt.compare(currentPassword, currentHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.execute(`
      UPDATE users SET password_hash = :newHash WHERE user_id = :userId
    `, { newHash, userId: req.user.userId });

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/auth/health
 * Database & server health probe
 */
router.get('/health', async (req, res) => {
  const health = await db.checkHealth();
  res.json({
    success: health.status === 'UP',
    ...health
  });
});

module.exports = router;
