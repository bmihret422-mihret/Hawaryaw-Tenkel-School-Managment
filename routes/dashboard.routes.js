const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/dashboard/stats
 * Aggregated dashboard metrics tailored to the user's role
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.userId;

    if (userRole === 'ADMIN') {
      // 1. Total counts
      const countsRes = await db.execute(`
        SELECT 
          (SELECT COUNT(*) FROM students WHERE status = 'ACTIVE') AS total_students,
          (SELECT COUNT(*) FROM teachers WHERE status = 'ACTIVE') AS total_teachers,
          (SELECT COUNT(*) FROM classes) AS total_classes,
          (SELECT COUNT(*) FROM subjects) AS total_subjects
        FROM DUAL
      `);

      // 2. Financial Overview
      const feesRes = await db.execute(`
        SELECT 
          NVL(SUM(amount), 0) AS total_invoiced,
          NVL(SUM(paid_amount), 0) AS total_collected,
          NVL(SUM(CASE WHEN status IN ('PENDING', 'OVERDUE', 'PARTIALLY_PAID') THEN (amount - paid_amount) ELSE 0 END), 0) AS total_pending
        FROM fees
      `);

      // 3. Attendance Overview (latest date)
      const attRes = await db.execute(`
        SELECT 
          COUNT(*) AS total_marked,
          NVL(SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END), 0) AS present_count,
          NVL(SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END), 0) AS absent_count,
          NVL(SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END), 0) AS late_count
        FROM attendance
        WHERE attendance_date = (SELECT MAX(attendance_date) FROM attendance)
      `);

      // 4. Students distribution by Class
      const classDistRes = await db.execute(`
        SELECT c.class_name, c.section, COUNT(s.student_id) AS student_count
        FROM classes c
        LEFT JOIN students s ON c.class_id = s.class_id AND s.status = 'ACTIVE'
        GROUP BY c.class_name, c.section
        ORDER BY c.class_name, c.section
      `);

      // 5. Recent Announcements
      const annRes = await db.execute(`
        SELECT a.announcement_id, a.title, a.content, a.priority, a.created_at, u.full_name AS author_name
        FROM announcements a
        LEFT JOIN users u ON a.author_id = u.user_id
        ORDER BY a.created_at DESC
      `);

      // 6. Recent Fee Transactions
      const recentFeesRes = await db.execute(`
        SELECT f.fee_id, f.title, f.amount, f.paid_amount, f.status, f.payment_date,
               u.full_name AS student_name, c.class_name, c.section
        FROM fees f
        JOIN students s ON f.student_id = s.student_id
        JOIN users u ON s.user_id = u.user_id
        LEFT JOIN classes c ON s.class_id = c.class_id
        ORDER BY f.created_at DESC
      `);

      return res.json({
        success: true,
        role: 'ADMIN',
        summary: {
          ...countsRes.rows[0],
          ...feesRes.rows[0],
          attendance: attRes.rows[0] || {}
        },
        classDistribution: classDistRes.rows,
        announcements: annRes.rows,
        recentFees: recentFeesRes.rows.slice(0, 5)
      });

    } else if (userRole === 'TEACHER') {
      // Find teacher_id
      const teachRes = await db.execute(`SELECT teacher_id FROM teachers WHERE user_id = :userId`, { userId });
      const teacherId = teachRes.rows[0]?.TEACHER_ID;

      // Classes taught by this teacher
      const myClassesRes = await db.execute(`
        SELECT DISTINCT c.class_id, c.class_name, c.section, c.room_number, s.subject_name, cs.schedule_time
        FROM class_subjects cs
        JOIN classes c ON cs.class_id = c.class_id
        JOIN subjects s ON cs.subject_id = s.subject_id
        WHERE cs.teacher_id = :teacherId
      `, { teacherId });

      // Total students in teacher's classes
      const studentCountRes = await db.execute(`
        SELECT COUNT(DISTINCT s.student_id) AS total_my_students
        FROM students s
        WHERE s.class_id IN (
          SELECT DISTINCT class_id FROM class_subjects WHERE teacher_id = :teacherId
        )
      `, { teacherId });

      // Announcements for teachers or all
      const annRes = await db.execute(`
        SELECT a.*, u.full_name AS author_name
        FROM announcements a
        LEFT JOIN users u ON a.author_id = u.user_id
        WHERE a.target_role IN ('ALL', 'TEACHER')
        ORDER BY a.created_at DESC
      `);

      return res.json({
        success: true,
        role: 'TEACHER',
        summary: {
          totalClasses: myClassesRes.rows.length,
          totalStudents: studentCountRes.rows[0]?.TOTAL_MY_STUDENTS || 0
        },
        myClasses: myClassesRes.rows,
        announcements: annRes.rows
      });

    } else if (userRole === 'STUDENT') {
      // Find student_id
      const studRes = await db.execute(`
        SELECT s.student_id, s.admission_number, s.roll_number, s.class_id, c.class_name, c.section
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.class_id
        WHERE s.user_id = :userId
      `, { userId });

      const student = studRes.rows[0];
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      // Attendance metrics
      const attRes = await db.execute(`
        SELECT 
          COUNT(*) AS total_days,
          NVL(SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END), 0) AS days_present,
          NVL(SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END), 0) AS days_absent,
          NVL(SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END), 0) AS days_late
        FROM attendance
        WHERE student_id = :studentId
      `, { studentId: student.STUDENT_ID });

      // Grades and GPA
      const gradesRes = await db.execute(`
        SELECT g.score, g.max_score, g.grade_letter, g.remarks, s.subject_name, e.exam_name
        FROM grades g
        JOIN subjects s ON g.subject_id = s.subject_id
        JOIN exams e ON g.exam_id = e.exam_id
        WHERE g.student_id = :studentId
        ORDER BY g.recorded_at DESC
      `, { studentId: student.STUDENT_ID });

      // Pending and paid fees
      const feesRes = await db.execute(`
        SELECT fee_id, title, fee_type, amount, paid_amount, due_date, status, payment_date
        FROM fees
        WHERE student_id = :studentId
        ORDER BY due_date DESC
      `, { studentId: student.STUDENT_ID });

      // Enrolled subjects & teachers
      const enrolledRes = await db.execute(`
        SELECT cs.class_subject_id, s.subject_code, s.subject_name, s.credits,
               u.full_name AS teacher_name, cs.schedule_time
        FROM class_subjects cs
        JOIN subjects s ON cs.subject_id = s.subject_id
        LEFT JOIN teachers t ON cs.teacher_id = t.teacher_id
        LEFT JOIN users u ON t.user_id = u.user_id
        WHERE cs.class_id = :classId
      `, { classId: student.CLASS_ID });

      // Announcements
      const annRes = await db.execute(`
        SELECT a.*, u.full_name AS author_name
        FROM announcements a
        LEFT JOIN users u ON a.author_id = u.user_id
        WHERE a.target_role IN ('ALL', 'STUDENT')
        ORDER BY a.created_at DESC
      `);

      return res.json({
        success: true,
        role: 'STUDENT',
        studentProfile: student,
        attendanceStats: attRes.rows[0],
        grades: gradesRes.rows,
        fees: feesRes.rows,
        enrolledSubjects: enrolledRes.rows,
        announcements: annRes.rows
      });
    }

  } catch (err) {
    console.error('[Dashboard Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
