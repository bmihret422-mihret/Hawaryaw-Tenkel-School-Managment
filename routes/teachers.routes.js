const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/teachers
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT t.teacher_id, t.employee_code, t.qualification, t.specialization,
             t.hire_date, t.salary, t.status AS teacher_status,
             u.user_id, u.full_name, u.email, u.phone, u.status AS user_status
      FROM teachers t
      JOIN users u ON t.user_id = u.user_id
      ORDER BY u.full_name
    `;

    const result = await db.execute(sql);
    
    // Also fetch assigned classes for each teacher
    const assignmentsRes = await db.execute(`
      SELECT cs.teacher_id, c.class_name, c.section, s.subject_name, cs.schedule_time
      FROM class_subjects cs
      JOIN classes c ON cs.class_id = c.class_id
      JOIN subjects s ON cs.subject_id = s.subject_id
      WHERE cs.teacher_id IS NOT NULL
    `);

    const assignmentsByTeacher = {};
    for (const a of assignmentsRes.rows) {
      if (!assignmentsByTeacher[a.TEACHER_ID]) assignmentsByTeacher[a.TEACHER_ID] = [];
      assignmentsByTeacher[a.TEACHER_ID].push(a);
    }

    const enriched = result.rows.map(t => ({
      ...t,
      assignments: assignmentsByTeacher[t.TEACHER_ID] || []
    }));

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/teachers/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id);

    const result = await db.execute(`
      SELECT t.*, u.username, u.full_name, u.email, u.phone
      FROM teachers t
      JOIN users u ON t.user_id = u.user_id
      WHERE t.teacher_id = :teacherId
    `, { teacherId });

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }

    const assignments = await db.execute(`
      SELECT cs.class_subject_id, c.class_id, c.class_name, c.section, c.room_number,
             s.subject_id, s.subject_name, s.subject_code, cs.schedule_time
      FROM class_subjects cs
      JOIN classes c ON cs.class_id = c.class_id
      JOIN subjects s ON cs.subject_id = s.subject_id
      WHERE cs.teacher_id = :teacherId
    `, { teacherId });

    res.json({
      success: true,
      teacher: result.rows[0],
      assignments: assignments.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/teachers
 */
router.post('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const {
      username,
      password,
      fullName,
      email,
      phone,
      employeeCode,
      qualification,
      specialization,
      salary
    } = req.body;

    if (!fullName || !employeeCode) {
      return res.status(400).json({ success: false, message: 'Full name and employee code are required.' });
    }

    const autoUsername = username || ('tch_' + employeeCode.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const defaultPassword = password || 'teacher123';
    const hash = await bcrypt.hash(defaultPassword, 10);

    const result = await db.withTransaction(async (conn) => {
      const userRes = await conn.execute(`
        INSERT INTO users (username, password_hash, full_name, email, phone, role, status)
        VALUES (:uName, :pHash, :fName, :em, :ph, 'TEACHER', 'ACTIVE')
        RETURNING user_id INTO :newUserId
      `, {
        uName: autoUsername,
        pHash: hash,
        fName: fullName,
        em: email || null,
        ph: phone || null,
        newUserId: { type: db.oracledb.NUMBER, dir: db.oracledb.BIND_OUT }
      });

      const newUserId = userRes.outBinds.newUserId[0];

      const teacherRes = await conn.execute(`
        INSERT INTO teachers (user_id, employee_code, qualification, specialization, salary, status)
        VALUES (:userId, :empCode, :qual, :spec, :sal, 'ACTIVE')
        RETURNING teacher_id INTO :newTeacherId
      `, {
        userId: newUserId,
        empCode: employeeCode,
        qual: qualification || null,
        spec: specialization || null,
        sal: salary ? parseFloat(salary) : 0,
        newTeacherId: { type: db.oracledb.NUMBER, dir: db.oracledb.BIND_OUT }
      });

      return {
        userId: newUserId,
        teacherId: teacherRes.outBinds.newTeacherId[0]
      };
    });

    res.status(201).json({ success: true, message: 'Teacher added successfully.', data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/teachers/:id
 */
router.put('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id);
    const { fullName, email, phone, qualification, specialization, salary, status } = req.body;

    const tRes = await db.execute(`SELECT user_id FROM teachers WHERE teacher_id = :teacherId`, { teacherId });
    if (!tRes.rows || tRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }
    const userId = tRes.rows[0].USER_ID;

    await db.withTransaction(async (conn) => {
      await conn.execute(`
        UPDATE users
        SET full_name = NVL(:fName, full_name),
            email = NVL(:em, email),
            phone = NVL(:ph, phone)
        WHERE user_id = :userId
      `, {
        fName: fullName || null,
        em: email || null,
        ph: phone || null,
        userId
      });

      await conn.execute(`
        UPDATE teachers
        SET qualification = NVL(:qual, qualification),
            specialization = NVL(:spec, specialization),
            salary = NVL(:sal, salary),
            status = NVL(:st, status)
        WHERE teacher_id = :teacherId
      `, {
        qual: qualification || null,
        spec: specialization || null,
        sal: salary ? parseFloat(salary) : null,
        st: status || null,
        teacherId
      });
    });

    res.json({ success: true, message: 'Teacher updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/teachers/:id
 */
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id);
    const tRes = await db.execute(`SELECT user_id FROM teachers WHERE teacher_id = :teacherId`, { teacherId });
    if (!tRes.rows || tRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }
    const userId = tRes.rows[0].USER_ID;

    await db.execute(`DELETE FROM users WHERE user_id = :userId`, { userId });
    res.json({ success: true, message: 'Teacher deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
