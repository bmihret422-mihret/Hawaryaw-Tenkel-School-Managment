const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/students
 * List all students with filtering
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, classId, status } = req.query;

    let sql = `
      SELECT s.student_id, s.admission_number, s.roll_number, s.gender, s.dob,
             s.blood_group, s.status AS student_status, s.admission_date,
             s.guardian_name, s.guardian_phone, s.guardian_email,
             u.user_id, u.full_name, u.email, u.phone, u.status AS user_status,
             c.class_id, c.class_name, c.section, c.room_number
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN classes c ON s.class_id = c.class_id
      WHERE 1=1
    `;

    const binds = {};

    if (search) {
      sql += ` AND (LOWER(u.full_name) LIKE :search OR LOWER(s.admission_number) LIKE :search OR LOWER(s.roll_number) LIKE :search)`;
      binds.search = `%${search.toLowerCase().trim()}%`;
    }

    if (classId) {
      sql += ` AND s.class_id = :classId`;
      binds.classId = parseInt(classId);
    }

    if (status) {
      sql += ` AND s.status = :status`;
      binds.status = status;
    }

    sql += ` ORDER BY c.class_name, c.section, s.roll_number, u.full_name`;

    const result = await db.execute(sql, binds);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('[Students List Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/students/:id
 * Get single student profile with comprehensive relations
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);

    const studentRes = await db.execute(`
      SELECT s.*, u.username, u.full_name, u.email, u.phone,
             c.class_name, c.section, c.room_number
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN classes c ON s.class_id = c.class_id
      WHERE s.student_id = :studentId
    `, { studentId });

    if (!studentRes.rows || studentRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const student = studentRes.rows[0];

    // Attendance summary
    const attRes = await db.execute(`
      SELECT 
        COUNT(*) AS total_marked,
        NVL(SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END), 0) AS present_count,
        NVL(SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END), 0) AS absent_count,
        NVL(SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END), 0) AS late_count,
        NVL(SUM(CASE WHEN status = 'EXCUSED' THEN 1 ELSE 0 END), 0) AS excused_count
      FROM attendance
      WHERE student_id = :studentId
    `, { studentId });

    // Academic Grades
    const gradesRes = await db.execute(`
      SELECT g.mark_id, g.score, g.max_score, g.grade_letter, g.remarks, g.recorded_at,
             s.subject_name, s.subject_code, e.exam_name, e.exam_type
      FROM grades g
      JOIN subjects s ON g.subject_id = s.subject_id
      JOIN exams e ON g.exam_id = e.exam_id
      WHERE g.student_id = :studentId
      ORDER BY e.start_date DESC, s.subject_name
    `, { studentId });

    // Fees history
    const feesRes = await db.execute(`
      SELECT * FROM fees WHERE student_id = :studentId ORDER BY due_date DESC
    `, { studentId });

    res.json({
      success: true,
      student,
      attendance: attRes.rows[0] || {},
      grades: gradesRes.rows,
      fees: feesRes.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/students
 * Add new student (creates user + student record atomically)
 */
router.post('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const {
      username,
      password,
      fullName,
      email,
      phone,
      admissionNumber,
      rollNumber,
      classId,
      dob,
      gender,
      bloodGroup,
      address,
      guardianName,
      guardianPhone,
      guardianEmail,
      guardianRelation
    } = req.body;

    if (!fullName || !admissionNumber) {
      return res.status(400).json({ success: false, message: 'Full name and admission number are required.' });
    }

    const autoUsername = username || ('std_' + admissionNumber.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const defaultPassword = password || 'student123';
    const hash = await bcrypt.hash(defaultPassword, 10);

    const result = await db.withTransaction(async (conn) => {
      // 1. Insert into users
      const userRes = await conn.execute(`
        INSERT INTO users (username, password_hash, full_name, email, phone, role, status)
        VALUES (:uName, :pHash, :fName, :em, :ph, 'STUDENT', 'ACTIVE')
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

      // 2. Insert into students
      const studRes = await conn.execute(`
        INSERT INTO students (
          user_id, admission_number, roll_number, class_id, dob,
          gender, blood_group, address, guardian_name, guardian_phone,
          guardian_email, guardian_relation, status
        )
        VALUES (
          :userId, :admNum, :rollNum, :cId, ${dob ? `TO_DATE('${dob}', 'YYYY-MM-DD')` : 'NULL'},
          :gen, :blood, :addr, :gName, :gPhone,
          :gEmail, :gRel, 'ACTIVE'
        )
        RETURNING student_id INTO :newStudentId
      `, {
        userId: newUserId,
        admNum: admissionNumber,
        rollNum: rollNumber || null,
        cId: classId ? parseInt(classId) : null,
        gen: gender || 'Male',
        blood: bloodGroup || null,
        addr: address || null,
        gName: guardianName || null,
        gPhone: guardianPhone || null,
        gEmail: guardianEmail || null,
        gRel: guardianRelation || null,
        newStudentId: { type: db.oracledb.NUMBER, dir: db.oracledb.BIND_OUT }
      });

      return {
        userId: newUserId,
        studentId: studRes.outBinds.newStudentId[0]
      };
    });

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      data: result
    });
  } catch (err) {
    console.error('[Create Student Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/students/:id
 * Update student and associated user record
 */
router.put('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const {
      fullName,
      email,
      phone,
      classId,
      rollNumber,
      dob,
      gender,
      bloodGroup,
      address,
      guardianName,
      guardianPhone,
      guardianEmail,
      guardianRelation,
      status
    } = req.body;

    const studRes = await db.execute(`SELECT user_id FROM students WHERE student_id = :studentId`, { studentId });
    if (!studRes.rows || studRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const userId = studRes.rows[0].USER_ID;

    await db.withTransaction(async (conn) => {
      // Update users table
      if (fullName || email || phone) {
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
      }

      // Update students table
      await conn.execute(`
        UPDATE students
        SET class_id = :cId,
            roll_number = :rollNum,
            gender = NVL(:gen, gender),
            blood_group = NVL(:blood, blood_group),
            address = NVL(:addr, address),
            guardian_name = NVL(:gName, guardian_name),
            guardian_phone = NVL(:gPhone, guardian_phone),
            guardian_email = NVL(:gEmail, guardian_email),
            guardian_relation = NVL(:gRel, guardian_relation),
            status = NVL(:st, status)
            ${dob ? `, dob = TO_DATE('${dob}', 'YYYY-MM-DD')` : ''}
        WHERE student_id = :studentId
      `, {
        cId: classId ? parseInt(classId) : null,
        rollNum: rollNumber || null,
        gen: gender || null,
        blood: bloodGroup || null,
        addr: address || null,
        gName: guardianName || null,
        gPhone: guardianPhone || null,
        gEmail: guardianEmail || null,
        gRel: guardianRelation || null,
        st: status || null,
        studentId
      });
    });

    res.json({ success: true, message: 'Student updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/students/:id
 * Delete student and user account
 */
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const studRes = await db.execute(`SELECT user_id FROM students WHERE student_id = :studentId`, { studentId });
    if (!studRes.rows || studRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const userId = studRes.rows[0].USER_ID;

    // Deleting the user cascades to student, grades, attendance, fees due to foreign keys
    await db.execute(`DELETE FROM users WHERE user_id = :userId`, { userId });

    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
