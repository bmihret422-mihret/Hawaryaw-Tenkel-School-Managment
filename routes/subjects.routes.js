const express = require('express');
const router = express.Router();
const db = require('../config/db.js');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/subjects
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT s.*,
             (SELECT COUNT(DISTINCT cs.class_id) FROM class_subjects cs WHERE cs.subject_id = s.subject_id) AS classes_count,
             (SELECT COUNT(DISTINCT cs.teacher_id) FROM class_subjects cs WHERE cs.subject_id = s.subject_id AND cs.teacher_id IS NOT NULL) AS teachers_count
      FROM subjects s
      ORDER BY s.subject_code
    `);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/subjects
 */
router.post('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { subjectCode, subjectName, credits, description } = req.body;
    if (!subjectCode || !subjectName) {
      return res.status(400).json({ success: false, message: 'Subject code and name are required.' });
    }

    const insertRes = await db.execute(`
      INSERT INTO subjects (subject_code, subject_name, credits, description)
      VALUES (:sCode, :sName, :cred, :sDesc)
      RETURNING subject_id INTO :newSubjectId
    `, {
      sCode: subjectCode.toUpperCase(),
      sName: subjectName,
      cred: credits ? parseInt(credits) : 3,
      sDesc: description || null,
      newSubjectId: { type: db.oracledb.NUMBER, dir: db.oracledb.BIND_OUT }
    });

    res.status(201).json({
      success: true,
      message: 'Subject created successfully.',
      subjectId: insertRes.outBinds.newSubjectId[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/subjects/:id
 */
router.put('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const subjectId = parseInt(req.params.id);
    const { subjectCode, subjectName, credits, description } = req.body;

    await db.execute(`
      UPDATE subjects
      SET subject_code = NVL(:sCode, subject_code),
          subject_name = NVL(:sName, subject_name),
          credits = NVL(:cred, credits),
          description = NVL(:sDesc, description)
      WHERE subject_id = :subjectId
    `, {
      sCode: subjectCode ? subjectCode.toUpperCase() : null,
      sName: subjectName || null,
      cred: credits ? parseInt(credits) : null,
      sDesc: description || null,
      subjectId
    });

    res.json({ success: true, message: 'Subject updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/subjects/:id
 */
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const subjectId = parseInt(req.params.id);
    await db.execute(`DELETE FROM subjects WHERE subject_id = :subjectId`, { subjectId });
    res.json({ success: true, message: 'Subject deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
