const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/announcements
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;

    let sql = `
      SELECT a.*, u.full_name AS author_name, u.role AS author_role
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.user_id
    `;

    const binds = {};

    if (userRole !== 'ADMIN') {
      sql += ` WHERE a.target_role IN ('ALL', :userRole)`;
      binds.userRole = userRole;
    }

    sql += ` ORDER BY a.created_at DESC`;

    const result = await db.execute(sql, binds);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/announcements
 */
router.post('/', authenticateToken, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const { title, content, targetRole, priority } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const insRes = await db.execute(`
      INSERT INTO announcements (title, content, target_role, priority, author_id)
      VALUES (:title, :content, :tRole, :prio, :authorId)
      RETURNING announcement_id INTO :newAnnId
    `, {
      title,
      content,
      tRole: targetRole || 'ALL',
      prio: priority || 'NORMAL',
      authorId: req.user.userId,
      newAnnId: { type: db.oracledb.NUMBER, dir: db.oracledb.BIND_OUT }
    });

    res.status(201).json({
      success: true,
      message: 'Announcement published successfully.',
      announcementId: insRes.outBinds.newAnnId[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/announcements/:id
 */
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    await db.execute(`DELETE FROM announcements WHERE announcement_id = :annId`, {
      annId: announcementId
    });
    res.json({ success: true, message: 'Announcement deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
