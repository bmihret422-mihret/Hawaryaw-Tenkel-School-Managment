const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/fees
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, studentId, classId } = req.query;

    let sql = `
      SELECT f.*,
             s.admission_number, s.roll_number,
             u.full_name AS student_name,
             c.class_name, c.section
      FROM fees f
      JOIN students s ON f.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN classes c ON s.class_id = c.class_id
      WHERE 1=1
    `;

    const binds = {};

    if (status) {
      sql += ` AND f.status = :statusVal`;
      binds.statusVal = status;
    }

    if (studentId) {
      sql += ` AND f.student_id = :studentId`;
      binds.studentId = parseInt(studentId);
    }

    if (classId) {
      sql += ` AND s.class_id = :classId`;
      binds.classId = parseInt(classId);
    }

    sql += ` ORDER BY f.due_date DESC, f.fee_id DESC`;

    const result = await db.execute(sql, binds);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/fees
 * Create fee for single student or entire class
 */
router.post('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { studentId, classId, title, feeType, amount, dueDate } = req.body;

    if (!title || !amount || !dueDate) {
      return res.status(400).json({ success: false, message: 'Title, amount, and due date are required.' });
    }

    const amt = parseFloat(amount);

    if (studentId) {
      // Single student
      await db.execute(`
        INSERT INTO fees (student_id, title, fee_type, amount, due_date, status, paid_amount)
        VALUES (:sId, :title, :fType, :amt, TO_DATE(:dDate, 'YYYY-MM-DD'), 'PENDING', 0)
      `, {
        sId: parseInt(studentId),
        title,
        fType: feeType || 'TUITION',
        amt,
        dDate: dueDate
      });

      return res.status(201).json({ success: true, message: 'Fee invoice generated.' });
    } else if (classId) {
      // Entire class
      const students = await db.execute(`SELECT student_id FROM students WHERE class_id = :cId AND status = 'ACTIVE'`, {
        cId: parseInt(classId)
      });

      await db.withTransaction(async (conn) => {
        for (const s of students.rows) {
          await conn.execute(`
            INSERT INTO fees (student_id, title, fee_type, amount, due_date, status, paid_amount)
            VALUES (:sId, :title, :fType, :amt, TO_DATE(:dDate, 'YYYY-MM-DD'), 'PENDING', 0)
          `, {
            sId: s.STUDENT_ID,
            title,
            fType: feeType || 'TUITION',
            amt,
            dDate: dueDate
          });
        }
      });

      return res.status(201).json({
        success: true,
        message: `Generated fee invoices for ${students.rows.length} students in class.`
      });
    } else {
      return res.status(400).json({ success: false, message: 'Must provide either studentId or classId.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/fees/:id/pay
 * Record fee payment
 */
router.put('/:id/pay', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const feeId = parseInt(req.params.id);
    const { paymentAmount, paymentMethod, transactionRef } = req.body;

    if (!paymentAmount) {
      return res.status(400).json({ success: false, message: 'Payment amount is required.' });
    }

    const payAmt = parseFloat(paymentAmount);

    const feeRes = await db.execute(`SELECT * FROM fees WHERE fee_id = :feeId`, { feeId });
    if (!feeRes.rows || feeRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fee record not found.' });
    }

    const currentFee = feeRes.rows[0];
    const newPaidAmount = (currentFee.PAID_AMOUNT || 0) + payAmt;
    const newStatus = newPaidAmount >= currentFee.AMOUNT ? 'PAID' : 'PARTIALLY_PAID';
    const ref = transactionRef || ('TXN-' + Math.floor(100000 + Math.random() * 900000));

    await db.execute(`
      UPDATE fees
      SET paid_amount = :paidAmt,
          status = :st,
          payment_date = SYSDATE,
          payment_method = :pMethod,
          transaction_ref = :txRef
      WHERE fee_id = :feeId
    `, {
      paidAmt: newPaidAmount,
      st: newStatus,
      pMethod: paymentMethod || 'CASH',
      txRef: ref,
      feeId
    });

    res.json({
      success: true,
      message: 'Payment recorded successfully.',
      status: newStatus,
      paidAmount: newPaidAmount,
      transactionRef: ref
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/fees/receipt/:id
 * Retrieve printable receipt data
 */
router.get('/receipt/:id', authenticateToken, async (req, res) => {
  try {
    const feeId = parseInt(req.params.id);

    const resFee = await db.execute(`
      SELECT f.*,
             s.admission_number, s.roll_number,
             u.full_name AS student_name, u.email AS student_email,
             c.class_name, c.section
      FROM fees f
      JOIN students s ON f.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN classes c ON s.class_id = c.class_id
      WHERE f.fee_id = :feeId
    `, { feeId });

    if (!resFee.rows || resFee.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fee receipt not found.' });
    }

    res.json({ success: true, receipt: resFee.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/fees/:id
 */
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const feeId = parseInt(req.params.id);
    await db.execute(`DELETE FROM fees WHERE fee_id = :feeId`, { feeId });
    res.json({ success: true, message: 'Fee record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
