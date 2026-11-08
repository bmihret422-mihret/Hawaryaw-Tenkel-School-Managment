-- ==========================================================
-- REAL SCHOOL MANAGEMENT SYSTEM (SMS)
-- ORACLE DATABASE SCHEMA DDL
-- ==========================================================

-- Clean up existing tables and sequences safely
BEGIN
  FOR cur_rec IN (SELECT object_name FROM user_objects WHERE object_type = 'TABLE') LOOP
    BEGIN
      EXECUTE IMMEDIATE 'DROP TABLE "' || cur_rec.object_name || '" CASCADE CONSTRAINTS PURGE';
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  FOR cur_rec IN (SELECT object_name FROM user_objects WHERE object_type = 'SEQUENCE') LOOP
    BEGIN
      EXECUTE IMMEDIATE 'DROP SEQUENCE "' || cur_rec.object_name || '"';
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
/

-- ----------------------------------------------------------
-- 1. SEQUENCES
-- ----------------------------------------------------------
CREATE SEQUENCE seq_users START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_academic_years START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_classes START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_teachers START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_students START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_subjects START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_class_subjects START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_attendance START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_exams START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_grades START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_fees START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_announcements START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;

-- ----------------------------------------------------------
-- 2. USERS TABLE
-- ----------------------------------------------------------
CREATE TABLE users (
  user_id NUMBER PRIMARY KEY,
  username VARCHAR2(50) NOT NULL UNIQUE,
  password_hash VARCHAR2(255) NOT NULL,
  full_name VARCHAR2(100) NOT NULL,
  email VARCHAR2(100) UNIQUE,
  phone VARCHAR2(25),
  role VARCHAR2(20) NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT')),
  status VARCHAR2(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  avatar_url VARCHAR2(255),
  created_at DATE DEFAULT SYSDATE
);

CREATE OR REPLACE TRIGGER trg_users_pk
BEFORE INSERT ON users FOR EACH ROW
BEGIN
  IF :NEW.user_id IS NULL THEN
    SELECT seq_users.NEXTVAL INTO :NEW.user_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 3. ACADEMIC YEARS TABLE
-- ----------------------------------------------------------
CREATE TABLE academic_years (
  year_id NUMBER PRIMARY KEY,
  year_name VARCHAR2(50) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current NUMBER(1) DEFAULT 1 CHECK (is_current IN (0, 1))
);

CREATE OR REPLACE TRIGGER trg_academic_years_pk
BEFORE INSERT ON academic_years FOR EACH ROW
BEGIN
  IF :NEW.year_id IS NULL THEN
    SELECT seq_academic_years.NEXTVAL INTO :NEW.year_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 4. CLASSES TABLE
-- ----------------------------------------------------------
CREATE TABLE classes (
  class_id NUMBER PRIMARY KEY,
  class_name VARCHAR2(50) NOT NULL,
  grade_level VARCHAR2(20) NOT NULL,
  section VARCHAR2(10) NOT NULL,
  room_number VARCHAR2(30),
  capacity NUMBER DEFAULT 40,
  academic_year_id NUMBER REFERENCES academic_years(year_id) ON DELETE SET NULL,
  created_at DATE DEFAULT SYSDATE,
  CONSTRAINT uq_class_sec UNIQUE (class_name, section)
);

CREATE OR REPLACE TRIGGER trg_classes_pk
BEFORE INSERT ON classes FOR EACH ROW
BEGIN
  IF :NEW.class_id IS NULL THEN
    SELECT seq_classes.NEXTVAL INTO :NEW.class_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 5. TEACHERS TABLE
-- ----------------------------------------------------------
CREATE TABLE teachers (
  teacher_id NUMBER PRIMARY KEY,
  user_id NUMBER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  employee_code VARCHAR2(30) UNIQUE NOT NULL,
  qualification VARCHAR2(100),
  specialization VARCHAR2(100),
  hire_date DATE DEFAULT SYSDATE,
  salary NUMBER(10, 2) DEFAULT 0,
  status VARCHAR2(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'RESIGNED'))
);

CREATE OR REPLACE TRIGGER trg_teachers_pk
BEFORE INSERT ON teachers FOR EACH ROW
BEGIN
  IF :NEW.teacher_id IS NULL THEN
    SELECT seq_teachers.NEXTVAL INTO :NEW.teacher_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 6. STUDENTS TABLE
-- ----------------------------------------------------------
CREATE TABLE students (
  student_id NUMBER PRIMARY KEY,
  user_id NUMBER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  admission_number VARCHAR2(30) UNIQUE NOT NULL,
  roll_number VARCHAR2(20),
  class_id NUMBER REFERENCES classes(class_id) ON DELETE SET NULL,
  dob DATE,
  gender VARCHAR2(10) CHECK (gender IN ('Male', 'Female', 'Other')),
  blood_group VARCHAR2(10),
  address VARCHAR2(255),
  guardian_name VARCHAR2(100),
  guardian_phone VARCHAR2(25),
  guardian_email VARCHAR2(100),
  guardian_relation VARCHAR2(50),
  admission_date DATE DEFAULT SYSDATE,
  status VARCHAR2(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ALUMNI', 'TRANSFERRED', 'EXPELLED'))
);

CREATE OR REPLACE TRIGGER trg_students_pk
BEFORE INSERT ON students FOR EACH ROW
BEGIN
  IF :NEW.student_id IS NULL THEN
    SELECT seq_students.NEXTVAL INTO :NEW.student_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 7. SUBJECTS TABLE
-- ----------------------------------------------------------
CREATE TABLE subjects (
  subject_id NUMBER PRIMARY KEY,
  subject_code VARCHAR2(20) UNIQUE NOT NULL,
  subject_name VARCHAR2(100) NOT NULL,
  credits NUMBER DEFAULT 3,
  description VARCHAR2(255)
);

CREATE OR REPLACE TRIGGER trg_subjects_pk
BEFORE INSERT ON subjects FOR EACH ROW
BEGIN
  IF :NEW.subject_id IS NULL THEN
    SELECT seq_subjects.NEXTVAL INTO :NEW.subject_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 8. CLASS SUBJECTS TABLE
-- ----------------------------------------------------------
CREATE TABLE class_subjects (
  class_subject_id NUMBER PRIMARY KEY,
  class_id NUMBER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  subject_id NUMBER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  teacher_id NUMBER REFERENCES teachers(teacher_id) ON DELETE SET NULL,
  schedule_time VARCHAR2(100),
  CONSTRAINT uq_class_sub UNIQUE (class_id, subject_id)
);

CREATE OR REPLACE TRIGGER trg_class_subjects_pk
BEFORE INSERT ON class_subjects FOR EACH ROW
BEGIN
  IF :NEW.class_subject_id IS NULL THEN
    SELECT seq_class_subjects.NEXTVAL INTO :NEW.class_subject_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 9. ATTENDANCE TABLE
-- ----------------------------------------------------------
CREATE TABLE attendance (
  attendance_id NUMBER PRIMARY KEY,
  student_id NUMBER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  class_id NUMBER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR2(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  remarks VARCHAR2(255),
  marked_by NUMBER REFERENCES users(user_id) ON DELETE SET NULL,
  recorded_at DATE DEFAULT SYSDATE,
  CONSTRAINT uq_student_date UNIQUE (student_id, attendance_date)
);

CREATE OR REPLACE TRIGGER trg_attendance_pk
BEFORE INSERT ON attendance FOR EACH ROW
BEGIN
  IF :NEW.attendance_id IS NULL THEN
    SELECT seq_attendance.NEXTVAL INTO :NEW.attendance_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 10. EXAMS TABLE
-- ----------------------------------------------------------
CREATE TABLE exams (
  exam_id NUMBER PRIMARY KEY,
  exam_name VARCHAR2(100) NOT NULL,
  exam_type VARCHAR2(30) CHECK (exam_type IN ('MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT', 'PROJECT')),
  academic_year_id NUMBER REFERENCES academic_years(year_id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  status VARCHAR2(20) DEFAULT 'COMPLETED' CHECK (status IN ('UPCOMING', 'ONGOING', 'COMPLETED', 'PUBLISHED'))
);

CREATE OR REPLACE TRIGGER trg_exams_pk
BEFORE INSERT ON exams FOR EACH ROW
BEGIN
  IF :NEW.exam_id IS NULL THEN
    SELECT seq_exams.NEXTVAL INTO :NEW.exam_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 11. GRADES / MARKS TABLE
-- ----------------------------------------------------------
CREATE TABLE grades (
  mark_id NUMBER PRIMARY KEY,
  exam_id NUMBER NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
  student_id NUMBER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  subject_id NUMBER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  score NUMBER(5, 2) NOT NULL,
  max_score NUMBER(5, 2) DEFAULT 100,
  grade_letter VARCHAR2(5),
  remarks VARCHAR2(255),
  graded_by NUMBER REFERENCES users(user_id) ON DELETE SET NULL,
  recorded_at DATE DEFAULT SYSDATE,
  CONSTRAINT uq_exam_stud_sub UNIQUE (exam_id, student_id, subject_id)
);

CREATE OR REPLACE TRIGGER trg_grades_pk
BEFORE INSERT ON grades FOR EACH ROW
BEGIN
  IF :NEW.mark_id IS NULL THEN
    SELECT seq_grades.NEXTVAL INTO :NEW.mark_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 12. FEES TABLE
-- ----------------------------------------------------------
CREATE TABLE fees (
  fee_id NUMBER PRIMARY KEY,
  student_id NUMBER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  title VARCHAR2(100) NOT NULL,
  fee_type VARCHAR2(30) CHECK (fee_type IN ('TUITION', 'LIBRARY', 'LABORATORY', 'TRANSPORT', 'EXAM', 'SPORTS', 'OTHER')),
  amount NUMBER(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR2(20) DEFAULT 'PENDING' CHECK (status IN ('PAID', 'PENDING', 'OVERDUE', 'PARTIALLY_PAID')),
  paid_amount NUMBER(10, 2) DEFAULT 0,
  payment_date DATE,
  payment_method VARCHAR2(30),
  transaction_ref VARCHAR2(100),
  created_at DATE DEFAULT SYSDATE
);

CREATE OR REPLACE TRIGGER trg_fees_pk
BEFORE INSERT ON fees FOR EACH ROW
BEGIN
  IF :NEW.fee_id IS NULL THEN
    SELECT seq_fees.NEXTVAL INTO :NEW.fee_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 13. ANNOUNCEMENTS TABLE
-- ----------------------------------------------------------
CREATE TABLE announcements (
  announcement_id NUMBER PRIMARY KEY,
  title VARCHAR2(150) NOT NULL,
  content VARCHAR2(4000) NOT NULL,
  target_role VARCHAR2(20) DEFAULT 'ALL' CHECK (target_role IN ('ALL', 'STUDENT', 'TEACHER', 'ADMIN')),
  priority VARCHAR2(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  author_id NUMBER REFERENCES users(user_id) ON DELETE SET NULL,
  expires_at DATE,
  created_at DATE DEFAULT SYSDATE
);

CREATE OR REPLACE TRIGGER trg_announcements_pk
BEFORE INSERT ON announcements FOR EACH ROW
BEGIN
  IF :NEW.announcement_id IS NULL THEN
    SELECT seq_announcements.NEXTVAL INTO :NEW.announcement_id FROM dual;
  END IF;
END;
/

-- ----------------------------------------------------------
-- 14. PERFORMANCE INDEXES
-- ----------------------------------------------------------
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_grades_exam_stud ON grades(exam_id, student_id);
CREATE INDEX idx_fees_stud ON fees(student_id);
CREATE INDEX idx_class_sub_teacher ON class_subjects(teacher_id);
COMMIT;
