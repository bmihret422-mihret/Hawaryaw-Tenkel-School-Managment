const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seed() {
  console.log('[Seed] Starting database seeding...');
  await db.initializePool();

  try {
    // 1. Password hashes
    const adminPassHash = await bcrypt.hash('admin123', 10);
    const teacherPassHash = await bcrypt.hash('teacher123', 10);
    const studentPassHash = await bcrypt.hash('student123', 10);

    // 2. Clear existing data
    console.log('[Seed] Cleaning old data...');
    const tables = [
      'announcements', 'fees', 'grades', 'exams', 'attendance', 
      'class_subjects', 'subjects', 'students', 'teachers', 'classes', 
      'academic_years', 'users'
    ];
    for (const t of tables) {
      await db.execute(`DELETE FROM ${t}`);
    }

    // 3. Academic Years
    console.log('[Seed] Inserting academic years...');
    await db.execute(`
      INSERT INTO academic_years (year_id, year_name, start_date, end_date, is_current)
      VALUES (1, '2026-2027', TO_DATE('2026-09-01', 'YYYY-MM-DD'), TO_DATE('2027-06-30', 'YYYY-MM-DD'), 1)
    `);
    await db.execute(`
      INSERT INTO academic_years (year_id, year_name, start_date, end_date, is_current)
      VALUES (2, '2025-2026', TO_DATE('2025-09-01', 'YYYY-MM-DD'), TO_DATE('2026-06-30', 'YYYY-MM-DD'), 0)
    `);

    // 4. Users (Admin, Teachers, Students)
    console.log('[Seed] Inserting users...');
    // Admin user
    await db.execute(`
      INSERT INTO users (user_id, username, password_hash, full_name, email, phone, role, status)
      VALUES (1, 'admin', :hash, 'Dr. Eleanor Vance', 'admin@hawaryawtenkelschool.com', '+1-555-0100', 'ADMIN', 'ACTIVE')
    `, { hash: adminPassHash });

    // Teachers users (IDs 2 - 5)
    const teachersData = [
      { id: 2, u: 'teacher.roberts', name: 'Marcus Roberts', email: 'm.roberts@hawaryawtenkelschool.com', phone: '+1-555-0201', code: 'EMP-2020-001', qual: 'M.Sc. Mathematics, Stanford', spec: 'Mathematics & Advanced Calculus', sal: 65000 },
      { id: 3, u: 'teacher.adams', name: 'Sarah Adams', email: 's.adams@hawaryawtenkelschool.com', phone: '+1-555-0202', code: 'EMP-2021-002', qual: 'M.A. English Literature, Oxford', spec: 'English & World Literature', sal: 62000 },
      { id: 4, u: 'teacher.chen', name: 'David Chen', email: 'd.chen@hawaryawtenkelschool.com', phone: '+1-555-0203', code: 'EMP-2022-003', qual: 'B.S. Software Engineering, MIT', spec: 'Computer Science & Robotics', sal: 68000 },
      { id: 5, u: 'teacher.alvarez', name: 'Elena Alvarez', email: 'e.alvarez@hawaryawtenkelschool.com', phone: '+1-555-0204', code: 'EMP-2023-004', qual: 'Ph.D. Biochemistry, Berkeley', spec: 'Biology & Chemistry', sal: 70000 }
    ];

    for (const t of teachersData) {
      await db.execute(`
        INSERT INTO users (user_id, username, password_hash, full_name, email, phone, role, status)
        VALUES (:userId, :uName, :hash, :fullName, :email, :phone, 'TEACHER', 'ACTIVE')
      `, { userId: t.id, uName: t.u, hash: teacherPassHash, fullName: t.name, email: t.email, phone: t.phone });

      await db.execute(`
        INSERT INTO teachers (teacher_id, user_id, employee_code, qualification, specialization, hire_date, salary, status)
        VALUES (:teacherId, :userId, :code, :qual, :spec, TO_DATE('2022-08-15', 'YYYY-MM-DD'), :sal, 'ACTIVE')
      `, { teacherId: t.id - 1, userId: t.id, code: t.code, qual: t.qual, spec: t.spec, sal: t.sal });
    }

    // 5. Classes
    console.log('[Seed] Inserting classes...');
    const classesData = [
      { id: 1, name: 'Grade 10', grade: '10', sec: 'A', room: 'Building A - Room 101', cap: 35 },
      { id: 2, name: 'Grade 10', grade: '10', sec: 'B', room: 'Building A - Room 102', cap: 35 },
      { id: 3, name: 'Grade 11', grade: '11', sec: 'A', room: 'Building B - Room 201', cap: 30 },
      { id: 4, name: 'Grade 12', grade: '12', sec: 'A', room: 'Building B - Room 301', cap: 30 }
    ];

    for (const c of classesData) {
      await db.execute(`
        INSERT INTO classes (class_id, class_name, grade_level, section, room_number, capacity, academic_year_id)
        VALUES (:classId, :name, :grade, :sec, :room, :cap, 1)
      `, { classId: c.id, name: c.name, grade: c.grade, sec: c.sec, room: c.room, cap: c.cap });
    }

    // 6. Subjects
    console.log('[Seed] Inserting subjects...');
    const subjectsData = [
      { id: 1, code: 'MATH101', name: 'Advanced Mathematics', credits: 4, desc: 'Algebra, Geometry, Trigonometry, and pre-calculus fundamentals.' },
      { id: 2, code: 'ENG101', name: 'English Literature & Composition', credits: 3, desc: 'Critical analysis, essay writing, and classic world literature.' },
      { id: 3, code: 'CS101', name: 'Computer Science & Coding', credits: 4, desc: 'Intro to Python, web technologies, algorithms, and logic systems.' },
      { id: 4, code: 'SCI101', name: 'Physics & Chemistry Lab', credits: 4, desc: 'Mechanics, thermodynamics, chemical reactions and lab practices.' },
      { id: 5, code: 'BIO101', name: 'General Biology', credits: 3, desc: 'Cell biology, genetics, ecosystems and physiology.' },
      { id: 6, code: 'HIS101', name: 'World History & Civics', credits: 3, desc: 'Modern global historical events, government systems and economics.' }
    ];

    for (const s of subjectsData) {
      await db.execute(`
        INSERT INTO subjects (subject_id, subject_code, subject_name, credits, description)
        VALUES (:subId, :subCode, :subName, :credits, :subDescription)
      `, { subId: s.id, subCode: s.code, subName: s.name, credits: s.credits, subDescription: s.desc });
    }

    // 7. Class Subjects (Map teachers to classes)
    console.log('[Seed] Mapping class subjects...');
    let csId = 1;
    const classSubjectMappings = [
      { classId: 1, subId: 1, teacherId: 1, time: 'Mon/Wed 08:30 - 10:00' },
      { classId: 1, subId: 2, teacherId: 2, time: 'Mon/Wed 10:15 - 11:45' },
      { classId: 1, subId: 3, teacherId: 3, time: 'Tue/Thu 08:30 - 10:00' },
      { classId: 1, subId: 4, teacherId: 4, time: 'Tue/Thu 10:15 - 11:45' },
      { classId: 2, subId: 1, teacherId: 1, time: 'Mon/Wed 12:30 - 14:00' },
      { classId: 2, subId: 2, teacherId: 2, time: 'Mon/Wed 14:15 - 15:45' },
      { classId: 2, subId: 3, teacherId: 3, time: 'Tue/Thu 12:30 - 14:00' },
      { classId: 3, subId: 1, teacherId: 1, time: 'Fri 08:30 - 10:30' },
      { classId: 3, subId: 3, teacherId: 3, time: 'Fri 10:45 - 12:45' },
      { classId: 3, subId: 5, teacherId: 4, time: 'Fri 13:30 - 15:30' }
    ];

    for (const m of classSubjectMappings) {
      await db.execute(`
        INSERT INTO class_subjects (class_subject_id, class_id, subject_id, teacher_id, schedule_time)
        VALUES (:csId, :classId, :subId, :teacherId, :tm)
      `, { csId: csId++, classId: m.classId, subId: m.subId, teacherId: m.teacherId, tm: m.time });
    }

    // 8. Students Data
    console.log('[Seed] Inserting students...');
    const studentsData = [
      { id: 10, u: 'student.liam', name: 'Liam Miller', email: 'liam.miller@hawaryawtenkelschool.com', phone: '+1-555-0301', adm: 'ADM-2024-001', roll: '10A-01', classId: 1, gender: 'Male', dob: '2010-04-12', blood: 'O+', gName: 'Robert Miller', gPhone: '+1-555-0401', gRel: 'Father' },
      { id: 11, u: 'student.sophia', name: 'Sophia Johnson', email: 'sophia.j@hawaryawtenkelschool.com', phone: '+1-555-0302', adm: 'ADM-2024-002', roll: '10A-02', classId: 1, gender: 'Female', dob: '2010-07-23', blood: 'A+', gName: 'Karen Johnson', gPhone: '+1-555-0402', gRel: 'Mother' },
      { id: 12, u: 'student.ethan', name: 'Ethan Davis', email: 'ethan.d@hawaryawtenkelschool.com', phone: '+1-555-0303', adm: 'ADM-2024-003', roll: '10A-03', classId: 1, gender: 'Male', dob: '2010-01-15', blood: 'B+', gName: 'William Davis', gPhone: '+1-555-0403', gRel: 'Father' },
      { id: 13, u: 'student.olivia', name: 'Olivia Martinez', email: 'olivia.m@hawaryawtenkelschool.com', phone: '+1-555-0304', adm: 'ADM-2024-004', roll: '10B-01', classId: 2, gender: 'Female', dob: '2010-11-05', blood: 'AB+', gName: 'Maria Martinez', gPhone: '+1-555-0404', gRel: 'Mother' },
      { id: 14, u: 'student.noah', name: 'Noah Wilson', email: 'noah.w@hawaryawtenkelschool.com', phone: '+1-555-0305', adm: 'ADM-2024-005', roll: '10B-02', classId: 2, gender: 'Male', dob: '2010-09-18', blood: 'O-', gName: 'James Wilson', gPhone: '+1-555-0405', gRel: 'Father' },
      { id: 15, u: 'student.ava', name: 'Ava Anderson', email: 'ava.a@hawaryawtenkelschool.com', phone: '+1-555-0306', adm: 'ADM-2023-010', roll: '11A-01', classId: 3, gender: 'Female', dob: '2009-03-30', blood: 'A-', gName: 'Patricia Anderson', gPhone: '+1-555-0406', gRel: 'Mother' },
      { id: 16, u: 'student.lucas', name: 'Lucas Taylor', email: 'lucas.t@hawaryawtenkelschool.com', phone: '+1-555-0307', adm: 'ADM-2023-011', roll: '11A-02', classId: 3, gender: 'Male', dob: '2009-08-14', blood: 'B-', gName: 'Edward Taylor', gPhone: '+1-555-0407', gRel: 'Father' },
      { id: 17, u: 'student.mia', name: 'Mia Thomas', email: 'mia.t@hawaryawtenkelschool.com', phone: '+1-555-0308', adm: 'ADM-2022-021', roll: '12A-01', classId: 4, gender: 'Female', dob: '2008-05-19', blood: 'O+', gName: 'Helen Thomas', gPhone: '+1-555-0408', gRel: 'Mother' }
    ];

    let studIdx = 1;
    for (const s of studentsData) {
      await db.execute(`
        INSERT INTO users (user_id, username, password_hash, full_name, email, phone, role, status)
        VALUES (:userId, :uName, :hash, :fullName, :email, :phone, 'STUDENT', 'ACTIVE')
      `, { userId: s.id, uName: s.u, hash: studentPassHash, fullName: s.name, email: s.email, phone: s.phone });

      await db.execute(`
        INSERT INTO students (
          student_id, user_id, admission_number, roll_number, class_id, 
          dob, gender, blood_group, address, guardian_name, guardian_phone, 
          guardian_email, guardian_relation, admission_date, status
        )
        VALUES (
          :studentId, :userId, :adm, :roll, :classId, 
          TO_DATE(:dob, 'YYYY-MM-DD'), :gender, :bloodGroup, '742 Evergreen Terrace, Springfield',
          :guardianName, :guardianPhone, 'parent@family.com', :guardianRel, TO_DATE('2024-09-01', 'YYYY-MM-DD'), 'ACTIVE'
        )
      `, {
        studentId: studIdx++,
        userId: s.id,
        adm: s.adm,
        roll: s.roll,
        classId: s.classId,
        dob: s.dob,
        gender: s.gender,
        bloodGroup: s.blood,
        guardianName: s.gName,
        guardianPhone: s.gPhone,
        guardianRel: s.gRel
      });
    }

    // 9. Exams
    console.log('[Seed] Inserting exams...');
    await db.execute(`
      INSERT INTO exams (exam_id, exam_name, exam_type, academic_year_id, start_date, end_date, status)
      VALUES (1, 'Midterm Examination Fall 2026', 'MIDTERM', 1, TO_DATE('2026-10-10', 'YYYY-MM-DD'), TO_DATE('2026-10-20', 'YYYY-MM-DD'), 'PUBLISHED')
    `);
    await db.execute(`
      INSERT INTO exams (exam_id, exam_name, exam_type, academic_year_id, start_date, end_date, status)
      VALUES (2, 'Unit Test 1 - Foundations', 'QUIZ', 1, TO_DATE('2026-09-25', 'YYYY-MM-DD'), TO_DATE('2026-09-28', 'YYYY-MM-DD'), 'COMPLETED')
    `);
    await db.execute(`
      INSERT INTO exams (exam_id, exam_name, exam_type, academic_year_id, start_date, end_date, status)
      VALUES (3, 'Final Term Examination Spring 2027', 'FINAL', 1, TO_DATE('2027-05-15', 'YYYY-MM-DD'), TO_DATE('2027-05-28', 'YYYY-MM-DD'), 'UPCOMING')
    `);

    // 10. Grades / Marks
    console.log('[Seed] Inserting grades...');
    const gradesList = [
      // Liam Miller (student 1)
      { examId: 1, studId: 1, subId: 1, score: 94, grade: 'A+', rem: 'Exceptional problem solving' },
      { examId: 1, studId: 1, subId: 2, score: 88, grade: 'A', rem: 'Very strong essay writing' },
      { examId: 1, studId: 1, subId: 3, score: 96, grade: 'A+', rem: 'Top programming logic in class' },
      { examId: 1, studId: 1, subId: 4, score: 85, grade: 'B+', rem: 'Solid lab experiment performance' },
      // Sophia Johnson (student 2)
      { examId: 1, studId: 2, subId: 1, score: 91, grade: 'A', rem: 'Great analytical thinking' },
      { examId: 1, studId: 2, subId: 2, score: 98, grade: 'A+', rem: 'Outstanding literature analysis' },
      { examId: 1, studId: 2, subId: 3, score: 89, grade: 'A', rem: 'Clean code & project delivery' },
      { examId: 1, studId: 2, subId: 4, score: 92, grade: 'A', rem: 'Excellent lab reports' },
      // Ethan Davis (student 3)
      { examId: 1, studId: 3, subId: 1, score: 76, grade: 'B', rem: 'Good effort, needs practice in algebra' },
      { examId: 1, studId: 3, subId: 2, score: 82, grade: 'B+', rem: 'Active participation in class' },
      { examId: 1, studId: 3, subId: 3, score: 80, grade: 'B', rem: 'Good understanding of core concepts' },
      { examId: 1, studId: 3, subId: 4, score: 74, grade: 'C+', rem: 'Needs revision on chemistry equations' },
      // Olivia Martinez (student 4)
      { examId: 1, studId: 4, subId: 1, score: 88, grade: 'A', rem: 'Well rounded work' },
      { examId: 1, studId: 4, subId: 2, score: 90, grade: 'A', rem: 'Thoughtful interpretations' },
      { examId: 1, studId: 4, subId: 3, score: 85, grade: 'B+', rem: 'Good programming assignments' }
    ];

    let markId = 1;
    for (const g of gradesList) {
      await db.execute(`
        INSERT INTO grades (mark_id, exam_id, student_id, subject_id, score, max_score, grade_letter, remarks, graded_by)
        VALUES (:markId, :examId, :studentId, :subjectId, :score, 100, :gradeLetter, :rem, 2)
      `, { markId: markId++, examId: g.examId, studentId: g.studId, subjectId: g.subId, score: g.score, gradeLetter: g.grade, rem: g.rem });
    }

    // 11. Attendance (last 5 business days for students 1..3 in Class 1)
    console.log('[Seed] Inserting attendance records...');
    let attId = 1;
    const dates = ['2026-10-23', '2026-10-24', '2026-10-27', '2026-10-28', '2026-10-29'];
    for (const d of dates) {
      await db.execute(`
        INSERT INTO attendance (attendance_id, student_id, class_id, attendance_date, status, remarks, marked_by)
        VALUES (:attId, 1, 1, TO_DATE(:attDate, 'YYYY-MM-DD'), 'PRESENT', 'On time', 2)
      `, { attId: attId++, attDate: d });

      const sophiaStatus = d === '2026-10-28' ? 'LATE' : 'PRESENT';
      await db.execute(`
        INSERT INTO attendance (attendance_id, student_id, class_id, attendance_date, status, remarks, marked_by)
        VALUES (:attId, 2, 1, TO_DATE(:attDate, 'YYYY-MM-DD'), :attStatus, 'In attendance', 2)
      `, { attId: attId++, attDate: d, attStatus: sophiaStatus });

      const ethanStatus = d === '2026-10-27' ? 'EXCUSED' : 'PRESENT';
      await db.execute(`
        INSERT INTO attendance (attendance_id, student_id, class_id, attendance_date, status, remarks, marked_by)
        VALUES (:attId, 3, 1, TO_DATE(:attDate, 'YYYY-MM-DD'), :attStatus, :rem, 2)
      `, { attId: attId++, attDate: d, attStatus: ethanStatus, rem: ethanStatus === 'EXCUSED' ? 'Medical appointment' : 'On time' });
    }

    // 12. Fees & Invoices
    console.log('[Seed] Inserting fees & invoices...');
    const feesData = [
      { id: 1, sid: 1, title: 'Fall Semester 2026 Tuition', type: 'TUITION', amt: 2500, due: '2026-10-15', status: 'PAID', paidAmt: 2500, payDate: '2026-10-10', method: 'ONLINE', ref: 'TXN-908234-ONL' },
      { id: 2, sid: 1, title: 'STEM & Robotics Lab Fee', type: 'LABORATORY', amt: 350, due: '2026-11-01', status: 'PAID', paidAmt: 350, payDate: '2026-10-20', method: 'CREDIT_CARD', ref: 'CC-552190-VISA' },
      { id: 3, sid: 2, title: 'Fall Semester 2026 Tuition', type: 'TUITION', amt: 2500, due: '2026-10-15', status: 'PAID', paidAmt: 2500, payDate: '2026-10-12', method: 'BANK_TRANSFER', ref: 'WIRE-889102' },
      { id: 4, sid: 2, title: 'Annual Library & Digital Pass', type: 'LIBRARY', amt: 150, due: '2026-11-15', status: 'PENDING', paidAmt: 0, payDate: null, method: null, ref: null },
      { id: 5, sid: 3, title: 'Fall Semester 2026 Tuition', type: 'TUITION', amt: 2500, due: '2026-10-15', status: 'PARTIALLY_PAID', paidAmt: 1500, payDate: '2026-10-14', method: 'CASH', ref: 'RCP-10293' },
      { id: 6, sid: 4, title: 'Fall Semester 2026 Tuition', type: 'TUITION', amt: 2500, due: '2026-10-01', status: 'OVERDUE', paidAmt: 0, payDate: null, method: null, ref: null },
      { id: 7, sid: 5, title: 'School Bus Transport Term 1', type: 'TRANSPORT', amt: 450, due: '2026-11-05', status: 'PAID', paidAmt: 450, payDate: '2026-10-25', method: 'ONLINE', ref: 'TXN-982103-BUS' }
    ];

    for (const f of feesData) {
      await db.execute(`
        INSERT INTO fees (
          fee_id, student_id, title, fee_type, amount, due_date, 
          status, paid_amount, payment_date, payment_method, transaction_ref
        )
        VALUES (
          :feeId, :studentId, :title, :feeType, :amt, TO_DATE(:dueDate, 'YYYY-MM-DD'), 
          :feeStatus, :paidAmt, ${f.payDate ? `TO_DATE('${f.payDate}', 'YYYY-MM-DD')` : 'NULL'}, 
          :payMethod, :txnRef
        )
      `, {
        feeId: f.id,
        studentId: f.sid,
        title: f.title,
        feeType: f.type,
        amt: f.amt,
        dueDate: f.due,
        feeStatus: f.status,
        paidAmt: f.paidAmt,
        payMethod: f.method,
        txnRef: f.ref
      });
    }

    // 13. Announcements
    console.log('[Seed] Inserting announcements...');
    const announcementsData = [
      { id: 1, title: 'Annual Science & Tech Fair 2026', content: 'We are thrilled to announce the Annual Science & Technology Exhibition will take place in the Main Auditorium on November 18. All students working on STEM and robotics projects must register their entries by November 10.', role: 'ALL', prio: 'HIGH' },
      { id: 2, title: 'Midterm Grade Reports Published', content: 'Midterm examination grades for Fall 2026 have been reviewed and published. Students and guardians can view complete subject breakdowns and download official digital grade cards from the portal.', role: 'ALL', prio: 'NORMAL' },
      { id: 3, title: 'Staff Faculty Meeting & Curriculum Review', content: 'Mandatory faculty briefing scheduled for this Friday at 3:30 PM in Conference Room B. Please ensure all student attendance logs and coursework assessments are synchronized prior to the meeting.', role: 'TEACHER', prio: 'URGENT' },
      { id: 4, title: 'Campus Wi-Fi Maintenance Notice', content: 'Routine maintenance on campus IT servers and wireless access points will occur on Saturday from 10:00 PM to 2:00 AM. Student portal access might experience brief intermittent restarts.', role: 'ALL', prio: 'LOW' }
    ];

    for (const a of announcementsData) {
      await db.execute(`
        INSERT INTO announcements (announcement_id, title, content, target_role, priority, author_id)
        VALUES (:annId, :title, :content, :targetRole, :prio, 1)
      `, { annId: a.id, title: a.title, content: a.content, targetRole: a.role, prio: a.prio });
    }

    // Update sequence values so that subsequent inserts don't collide
    console.log('[Seed] Synchronizing sequence counters...');
    const seqUpdates = [
      { seq: 'seq_users', val: 50 },
      { seq: 'seq_classes', val: 10 },
      { seq: 'seq_teachers', val: 20 },
      { seq: 'seq_students', val: 50 },
      { seq: 'seq_subjects', val: 20 },
      { seq: 'seq_class_subjects', val: 30 },
      { seq: 'seq_attendance', val: 50 },
      { seq: 'seq_exams', val: 10 },
      { seq: 'seq_grades', val: 50 },
      { seq: 'seq_fees', val: 50 },
      { seq: 'seq_announcements', val: 20 }
    ];

    for (const su of seqUpdates) {
      try {
        await db.execute(`DROP SEQUENCE ${su.seq}`);
        await db.execute(`CREATE SEQUENCE ${su.seq} START WITH ${su.val} INCREMENT BY 1 NOCACHE NOCYCLE`);
      } catch (innerErr) {
        // ignore
      }
    }

    console.log('====================================================');
    console.log(' Database seeded successfully with realistic data!');
    console.log(' Demo Accounts:');
    console.log('   Admin:    admin            / admin123');
    console.log('   Teacher:  teacher.roberts  / teacher123');
    console.log('   Student:  student.liam     / student123');
    console.log('====================================================');

  } catch (err) {
    console.error('[Seed Error]:', err);
    throw err;
  } finally {
    await db.closePool();
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = seed;
