const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/attendance
 * Fetch attendance for a specific class on a date, or for a student
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { classId, date, studentId } = req.query;

    if (studentId) {
      const result = await db.execute(`
        SELECT a.attendance_id, a.attendance_date, a.status, a.remarks,
               c.class_name, c.section, u.full_name AS marked_by_name
        FROM attendance a
        JOIN classes c ON a.class_id = c.class_id
        LEFT JOIN users u ON a.marked_by = u.user_id
        WHERE a.student_id = :sId
        ORDER BY a.attendance_date DESC
      `, { sId: parseInt(studentId) });
      return res.json({ success: true, data: result.rows });
    }

    if (!classId) {
      return res.status(400).json({ success: false, message: 'Class ID is required.' });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Fetch all students of the class along with their attendance status on that date (if already recorded)
    const sql = `
      SELECT s.student_id, s.admission_number, s.roll_number, u.full_name,
             a.attendance_id, a.status, a.remarks, a.attendance_date
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN attendance a ON s.student_id = a.student_id 
                            AND TRUNC(a.attendance_date) = TO_DATE(:attDate, 'YYYY-MM-DD')
      WHERE s.class_id = :cId AND s.status = 'ACTIVE'
      ORDER BY s.roll_number, u.full_name
    `;

    const result = await db.execute(sql, {
      cId: parseInt(classId),
      attDate: targetDate
    });

    res.json({
      success: true,
      classId: parseInt(classId),
      date: targetDate,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('[Attendance Fetch Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/attendance/batch
 * Bulk upsert attendance for a class on a specific date using Oracle MERGE
 */
router.post('/batch', authenticateToken, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const { classId, date, records } = req.body;

    if (!classId || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Class ID, date, and array of records [{ studentId, status, remarks }] are required.'
      });
    }

    const markedBy = req.user.userId;

    await db.withTransaction(async (conn) => {
      for (const rec of records) {
        if (!rec.studentId || !rec.status) continue;

        const mergeSql = `
          MERGE INTO attendance tgt
          USING (
            SELECT :sId AS student_id,
                   TO_DATE(:attDate, 'YYYY-MM-DD') AS attendance_date
            FROM DUAL
          ) src
          ON (tgt.student_id = src.student_id AND TRUNC(tgt.attendance_date) = src.attendance_date)
          WHEN MATCHED THEN
            UPDATE SET tgt.status = :statusVal,
                       tgt.remarks = :remarksVal,
                       tgt.marked_by = :markedByVal,
                       tgt.recorded_at = SYSDATE
          WHEN NOT MATCHED THEN
            INSERT (student_id, class_id, attendance_date, status, remarks, marked_by)
            VALUES (:sId, :cId, TO_DATE(:attDate, 'YYYY-MM-DD'), :statusVal, :remarksVal, :markedByVal)
        `;

        await conn.execute(mergeSql, {
          sId: parseInt(rec.studentId),
          cId: parseInt(classId),
          attDate: date,
          statusVal: rec.status,
          remarksVal: rec.remarks || null,
          markedByVal: markedBy
        });
      }
    });

    res.json({
      success: true,
      message: `Successfully recorded attendance for ${records.length} students.`
    });
  } catch (err) {
    console.error('[Attendance Batch Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
