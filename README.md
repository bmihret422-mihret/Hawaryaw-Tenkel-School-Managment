# Apex Academy - Enterprise School Management System
### Built with HTML5, CSS3, JavaScript (ES6+), Node.js, Express, and Oracle Database XE

A complete, full-stack, enterprise-grade School Information and Management System (SMS / ERP) powered natively by **Oracle Database Express Edition (XE)** and a **Node.js REST API**, accompanied by a modern, responsive Single Page Dashboard frontend.

---

## 🌟 Key Highlights & Features

1. **Native Oracle Database Integration**:
   - Built on Oracle Database Express Edition (`XE`) with tables, sequences, triggers for auto-incrementing primary keys, check constraints, cascading foreign keys, and indexes.
   - Connection pooling with `node-oracledb` Thick client support.
   - Idempotent upserts for daily attendance and exam marks using Oracle's native `MERGE INTO` statements.

2. **Role-Based Access Control (RBAC)**:
   - **Administrator (`ADMIN`)**: Complete control over students, teachers, classes, curriculum, attendance, grading, fee invoicing, notices, and system diagnostics.
   - **Teacher / Faculty (`TEACHER`)**: View assigned classes, take daily class attendance with 1-click "Mark All Present", enter exam marks in bulk, and post notices.
   - **Student / Guardian (`STUDENT`)**: Personal 360-degree portal with attendance metrics, grades, printable academic transcripts/report cards, and fee payment histories.

3. **Core Functional Modules**:
   - 📊 **Dynamic Dashboard**: Role-tailored metrics, student enrollment distribution, recent fee receipts, and priority announcements.
   - 🎓 **Students Directory**: Live search, filtering by class, enrollment modal, and 360° student profile with tabs for Personal Info, Grades, Attendance, and Fees.
   - 👨‍🏫 **Faculty & Instructors**: Teacher registry, qualifications, specializations, salaries, and course allocations.
   - 🏫 **Classes & Sections**: Class capacity tracking, room assignments, student roster, and subject/teacher mapping.
   - 📚 **Courses & Curriculum**: Course codes, credit hours, and syllabus descriptions.
   - 📅 **Attendance Tracker**: Class roster attendance sheet with date picker, status choices (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`), remarks, and 1-click "Mark All Present".
   - 📝 **Gradebook & Examinations**: Multi-term exam scheduling, class grade entry sheet with automatic letter grade calculation (`A+`, `A`, `B+`, etc.), and **Printable Official Student Report Cards**.
   - 💳 **Fee Invoicing & Receipts**: Tuition and facility billing, payment recording, balance tracking, and **Official Printable Payment Receipts**.
   - 📢 **Notice Board**: Role-targeted announcements with priority tags (`URGENT`, `HIGH`, `NORMAL`).
   - ⚙️ **Oracle DB Insights**: Live connection ping, pool utilization metrics, schema version, and database timestamps.

4. **Modern UI/UX**:
   - Single Page Application (SPA) architecture with fast tab routing.
   - Light and Dark mode toggle with persistent state.
   - One-click demo login buttons for rapid testing of Admin, Teacher, and Student views.
   - Toast notifications and modal dialogs.
   - Dedicated print stylesheets (`@media print`) for official report cards and receipts.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18.x or later installed)
- **Oracle Database XE** (Running locally on `localhost:1521/XE`)
- **Oracle Instant Client** (64-bit Windows)

### 2. Environment Configuration (`.env`)
The project comes pre-configured for local Oracle XE:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=super_secure_school_jwt_key_2026_change_in_production

# Oracle Database XE Configuration
DB_USER=SCHOOL_DB
DB_PASSWORD=School123
DB_CONNECT_STRING=localhost:1521/XE
ORACLE_CLIENT_DIR=C:\Users\hp\Downloads\instantclient-basic-windows.x64-19.32.0.0.0dbru\instantclient_19_32
```

### 3. Database Initialization & Seeding
To apply the Oracle DDL schema (12 tables, 12 sequences, 12 triggers) and populate realistic sample students, teachers, classes, grades, and invoices:
```powershell
npm run setup-db
```
*(Or simply `npm run seed` to repopulate seed data at any time).*

### 4. Start the Application
```powershell
npm start
```
Now open **http://localhost:3000** in your web browser.

---

## 🔑 Demo Login Accounts

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **👑 Administrator** | `admin` | `admin123` | Full access to all modules, billing, and system settings |
| **👨‍🏫 Teacher (Faculty)** | `teacher.roberts` | `teacher123` | Mathematics instructor, Grade 10A mentor |
| **🎓 Student** | `student.liam` | `student123` | Grade 10A student with grades, attendance, and fees |

*(You can also click the quick demo buttons on the login screen to sign in instantly with one click!)*

---

## 📂 Project Directory Structure

```
school-managment/
├── .env                     # Oracle connection & server config
├── .env.example             # Configuration template
├── package.json             # NPM dependencies & scripts
├── server.js                # Express app & Oracle pool lifecycle
├── config/
│   ├── db.js                # Oracle Thick client pool & transaction runner
│   └── schema.sql           # Oracle DDL (tables, triggers, sequences, indexes)
├── middleware/
│   └── auth.js              # JWT authentication & RBAC middleware
├── routes/
│   ├── auth.routes.js       # Login, health check, password change
│   ├── dashboard.routes.js  # Role-specific analytics & summaries
│   ├── students.routes.js   # Student CRUD & profile 360 data
│   ├── teachers.routes.js   # Faculty CRUD & course mappings
│   ├── classes.routes.js    # Class sections & roster management
│   ├── subjects.routes.js   # Curriculum courses catalog
│   ├── attendance.routes.js # Daily attendance logging & reports
│   ├── grades.routes.js     # Exams, gradebook sheet & report cards
│   ├── fees.routes.js       # Fee invoices, payments & printable receipts
│   └── announcements.routes.js # Campus notice board
├── scripts/
│   ├── setup-db.js          # Full Oracle schema creation & seeding
│   └── seed-data.js         # Realistic demo data populator
└── public/
    ├── index.html           # SPA frontend layout & modal dialogs
    ├── css/
    │   └── styles.css       # Design system, dark/light theme, print CSS
    └── js/
        ├── api.js           # Fetch wrapper with JWT headers
        ├── ui.js            # Toast, modal, theme, and formatting helpers
        ├── auth.js          # Auth handling & role-based visibility
        ├── dashboard.js     # Dashboard views & analytics
        ├── students.js      # Students directory & profile modal
        ├── teachers.js      # Faculty management
        ├── classes.js       # Class cards & allocations
        ├── subjects.js      # Curriculum catalog
        ├── attendance.js    # Class attendance tracker
        ├── grades.js        # Grade entry sheet & report card generator
        ├── fees.js          # Invoicing, payments & receipts
        ├── announcements.js # Campus broadcasts
        └── app.js           # Router & application bootstrap
```

---

## 🏛️ Oracle Database Schema Overview

- **`USERS`**: Accounts, hashed passwords (bcrypt), email, phone, role (`ADMIN`, `TEACHER`, `STUDENT`), status.
- **`ACADEMIC_YEARS`**: Academic session terms and active term flag.
- **`CLASSES`**: Grade level, section, room number, max capacity, academic year.
- **`TEACHERS`**: User relation, employee code, qualification, specialization, salary.
- **`STUDENTS`**: User relation, admission number, roll number, class assignment, DOB, gender, blood group, guardian info.
- **`SUBJECTS`**: Course code, name, credit hours, curriculum description.
- **`CLASS_SUBJECTS`**: Cross-reference mapping classes, subjects, teachers, and timetable schedules.
- **`ATTENDANCE`**: Daily student presence logs (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`), remarks, marked by user.
- **`EXAMS`**: Midterms, Finals, Quizzes with date ranges and published status.
- **`GRADES`**: Student assessment scores, max marks, letter grades (`A+` to `F`), and faculty remarks.
- **`FEES`**: Invoices for tuition, laboratory, sports, etc., tracking billed amount, paid amount, payment date, method, and reference.
- **`ANNOUNCEMENTS`**: Campus noticeboard memos with audience targeting and priority tiers (`URGENT`, `HIGH`, `NORMAL`).
