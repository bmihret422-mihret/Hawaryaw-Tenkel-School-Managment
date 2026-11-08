const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/classes
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT c.class_id, c.class_name, c.grade_level, c.section, c.room_number, c.capacity,
             y.year_name,
             (SELECT COUNT(*) FROM students s WHERE s.class_id = c.class_id AND s.status = 'ACTIVE') AS student_count
      FROM classes c
      LEFT JOIN academic_years y ON c.academic_year_id = y.year_id
      ORDER BY c.grade_level, c.class_name, c.section
    `;

    const result = await db.execute(sql);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/classes/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const classId = parseInt(req.params.id);

    const classRes = await db.execute(`
      SELECT c.*, y.year_name
      FROM classes c
      LEFT JOIN academic_years y ON c.academic_year_id = y.year_id
      WHERE c.class_id = :classId
    `, { classId });

    if (!classRes.rows || classRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    // Student roster
    const studentsRes = await db.execute(`
      SELECT s.student_id, s.admission_number, s.roll_number, s.gender,
             u.full_name, u.email, u.phone
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.class_id = :classId AND s.status = 'ACTIVE'
      ORDER BY s.roll_number, u.full_name
    `, { classId });

    // Assigned Subjects & Teachers
    const subjectsRes = await db.execute(`
      SELECT cs.class_subject_id, cs.schedule_time,
             s.subject_id, s.subject_code, s.subject_name, s.credits,
             t.teacher_id, t.employee_code, u.full_name AS teacher_name
      FROM class_subjects cs
      JOIN subjects s ON cs.subject_id = s.subject_id
      LEFT JOIN teachers t ON cs.teacher_id = t.teacher_id
      LEFT JOIN users u ON t.user_id = u.user_id
      WHERE cs.class_id = :classId
      ORDER BY s.subject_name
    `, { classId });

    res.json({
      success: true,
      classInfo: classRes.rows[0],
      students: studentsRes.rows,
      subjects: subjectsRes.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/classes
 */
router.post('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { className, gradeLevel, section, roomNumber, capacity, academicYearId } = req.body;

    if (!className || !gradeLevel || !section) {
      return res.status(400).json({ success: false, message: 'Class name, grade level, and section are required.' });
    }

    const resInsert = await db.execute(`
      INSERT INTO classes (class_name, grade_level, section, room_number, capacity, academic_year_id)
      VALUES (:cName, :gLevel, :sec, :room, :cap, :yId)
      RETURNING class_id INTO :newClassId
    `, {
      cName: className,
      gLevel: gradeLevel,
      sec: section.toUpperCase(),
      room: roomNumber || null,
      cap: capacity ? parseInt(capacity) : 40,
      yId: academicYearId ? parseInt(academicYearId) : 1,
      newClassId: { type: db.oracledb.NUMBER, dir: db.oracledb.BIND_OUT }
    });

    res.status(201).json({
      success: true,
      message: 'Class created successfully.',
      classId: resInsert.outBinds.newClassId[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/classes/:id
 */
router.put('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const classId = parseInt(req.params.id);
    const { className, gradeLevel, section, roomNumber, capacity } = req.body;

    await db.execute(`
      UPDATE classes
      SET class_name = NVL(:cName, class_name),
          grade_level = NVL(:gLevel, grade_level),
          section = NVL(:sec, section),
          room_number = NVL(:room, room_number),
          capacity = NVL(:cap, capacity)
      WHERE class_id = :classId
    `, {
      cName: className || null,
      gLevel: gradeLevel || null,
      sec: section ? section.toUpperCase() : null,
      room: roomNumber || null,
      cap: capacity ? parseInt(capacity) : null,
      classId
    });

    res.json({ success: true, message: 'Class updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/classes/:id
 */
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const classId = parseInt(req.params.id);
    await db.execute(`DELETE FROM classes WHERE class_id = :classId`, { classId });
    res.json({ success: true, message: 'Class deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/classes/:id/subjects
 * Assign subject & teacher to class
 */
router.post('/:id/subjects', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const classId = parseInt(req.params.id);
    const { subjectId, teacherId, scheduleTime } = req.body;

    if (!subjectId) {
      return res.status(400).json({ success: false, message: 'Subject ID is required.' });
    }

    await db.execute(`
      INSERT INTO class_subjects (class_id, subject_id, teacher_id, schedule_time)
      VALUES (:cId, :sId, :tId, :sTime)
    `, {
      cId: classId,
      sId: parseInt(subjectId),
      tId: teacherId ? parseInt(teacherId) : null,
      sTime: scheduleTime || null
    });

    res.status(201).json({ success: true, message: 'Subject assigned to class.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/classes/:id/subjects/:csId
 */
router.delete('/:id/subjects/:csId', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const csId = parseInt(req.params.csId);
    await db.execute(`DELETE FROM class_subjects WHERE class_subject_id = :csId`, { csId });
    res.json({ success: true, message: 'Subject assignment removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
