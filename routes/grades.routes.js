const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

function calculateGrade(score, maxScore = 100) {
  const pct = (score / maxScore) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 85&&pct <= 90) return 'A';
  if (pct >= 80&&pct < 85) return 'A-';
  if (pct >= 75&&pct <80) return 'B+';
  if (pct >= 70&&pct >75) return 'B';
  if (pct >= 65&&pct <70) return 'B-';
  if (pct >= 60&&pct <65) return 'c+';
  if (pct >= 50&&pct <60) return 'c';
  if (pct >= 40&&pct <50) return 'D';
  return 'F';
}

/**
 * GET /api/grades/exams
 * List exams
 */
router.get('/exams', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT e.*, y.year_name
      FROM exams e
      LEFT JOIN academic_years y ON e.academic_year_id = y.year_id
      ORDER BY e.start_date DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/grades/exams
 */
router.post('/exams', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { examName, examType, startDate, endDate, status } = req.body;
    if (!examName || !examType) {
      return res.status(400).json({ success: false, message: 'Exam name and type are required.' });
    }

    const insRes = await db.execute(`
      INSERT INTO exams (exam_name, exam_type, academic_year_id, start_date, end_date, status)
      VALUES (
        :eName, :eType, 1,
        ${startDate ? `TO_DATE('${startDate}', 'YYYY-MM-DD')` : 'NULL'},
        ${endDate ? `TO_DATE('${endDate}', 'YYYY-MM-DD')` : 'NULL'},
        NVL(:st, 'UPCOMING')
      )
      RETURNING exam_id INTO :newExamId
    `, {
      eName: examName,
      eType: examType,
      st: status || 'UPCOMING',
      newExamId: { type: db.oracledb.NUMBER, dir: db.oracledb.BIND_OUT }
    });

    res.status(201).json({
      success: true,
      message: 'Exam created successfully.',
      examId: insRes.outBinds.newExamId[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/grades/sheet
 * Fetch class marksheet for a specific exam and subject
 */
router.get('/sheet', authenticateToken, async (req, res) => {
  try {
    const { examId, classId, subjectId } = req.query;

    if (!examId || !classId || !subjectId) {
      return res.status(400).json({ success: false, message: 'examId, classId, and subjectId are required.' });
    }

    const sql = `
      SELECT s.student_id, s.admission_number, s.roll_number, u.full_name,
             g.mark_id, g.score, g.max_score, g.grade_letter, g.remarks
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN grades g ON s.student_id = g.student_id 
                        AND g.exam_id = :eId 
                        AND g.subject_id = :subId
      WHERE s.class_id = :cId AND s.status = 'ACTIVE'
      ORDER BY s.roll_number, u.full_name
    `;

    const result = await db.execute(sql, {
      eId: parseInt(examId),
      subId: parseInt(subjectId),
      cId: parseInt(classId)
    });

    res.json({
      success: true,
      examId: parseInt(examId),
      classId: parseInt(classId),
      subjectId: parseInt(subjectId),
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/grades/bulk
 * Record or update grades for an exam + class + subject using Oracle MERGE
 */
router.post('/bulk', authenticateToken, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const { examId, subjectId, records } = req.body;

    if (!examId || !subjectId || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'examId, subjectId, and records array required.' });
    }

    const gradedBy = req.user.userId;

    await db.withTransaction(async (conn) => {
      for (const rec of records) {
        if (!rec.studentId || rec.score === undefined || rec.score === null || rec.score === '') continue;

        const score = parseFloat(rec.score);
        const maxScore = rec.maxScore ? parseFloat(rec.maxScore) : 100;
        const letter = calculateGrade(score, maxScore);

        const mergeSql = `
          MERGE INTO grades tgt
          USING (
            SELECT :eId AS exam_id, :sId AS student_id, :subId AS subject_id FROM DUAL
          ) src
          ON (tgt.exam_id = src.exam_id AND tgt.student_id = src.student_id AND tgt.subject_id = src.subject_id)
          WHEN MATCHED THEN
            UPDATE SET tgt.score = :scoreVal,
                       tgt.max_score = :maxVal,
                       tgt.grade_letter = :gLetter,
                       tgt.remarks = :rem,
                       tgt.graded_by = :gBy,
                       tgt.recorded_at = SYSDATE
          WHEN NOT MATCHED THEN
            INSERT (exam_id, student_id, subject_id, score, max_score, grade_letter, remarks, graded_by)
            VALUES (:eId, :sId, :subId, :scoreVal, :maxVal, :gLetter, :rem, :gBy)
        `;

        await conn.execute(mergeSql, {
          eId: parseInt(examId),
          sId: parseInt(rec.studentId),
          subId: parseInt(subjectId),
          scoreVal: score,
          maxVal: maxScore,
          gLetter: letter,
          rem: rec.remarks || null,
          gBy: gradedBy
        });
      }
    });

    res.json({ success: true, message: `Successfully updated ${records.length} grade entries.` });
  } catch (err) {
    console.error('[Grades Bulk Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/grades/report-card/:studentId
 * Generate full printable report card
 */
router.get('/report-card/:studentId', authenticateToken, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);

    const studRes = await db.execute(`
      SELECT s.*, u.full_name, u.email, c.class_name, c.section
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN classes c ON s.class_id = c.class_id
      WHERE s.student_id = :studentId
    `, { studentId });

    if (!studRes.rows || studRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const marksRes = await db.execute(`
      SELECT g.*, s.subject_name, s.subject_code, s.credits, e.exam_name, e.exam_type
      FROM grades g
      JOIN subjects s ON g.subject_id = s.subject_id
      JOIN exams e ON g.exam_id = e.exam_id
      WHERE g.student_id = :studentId
      ORDER BY e.start_date DESC, s.subject_name
    `, { studentId });

    // Calculate GPA / Average
    let totalScore = 0;
    let totalMax = 0;
    for (const m of marksRes.rows) {
      totalScore += m.SCORE;
      totalMax += m.MAX_SCORE;
    }
    const overallPercentage = totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(1) : 0;
    const overallGrade = calculateGrade(totalScore, totalMax || 100);

    res.json({
      success: true,
      student: studRes.rows[0],
      marks: marksRes.rows,
      summary: {
        totalSubjects: marksRes.rows.length,
        totalScore,
        totalMax,
        overallPercentage: parseFloat(overallPercentage),
        overallGrade
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
