/**
 * database.js — إعداد SQLite وتعريف الجداول ودوال الوصول للبيانات
 * يستخدم node:sqlite المدمج في Node.js 22+
 */
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

// إنشاء مجلد البيانات إن لم يكن موجوداً
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "growth.db");
const db = new DatabaseSync(dbPath);

// تفعيل المفاتيح الأجنبية
db.exec("PRAGMA foreign_keys = ON");

/**
 * إنشاء الجداول عند أول تشغيل
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    result TEXT NOT NULL,
    reason TEXT NOT NULL,
    hours REAL NOT NULL,
    start_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_id INTEGER NOT NULL,
    goal_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    day_in_week INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    deferred INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
  );
`);

/**
 * توزيع مهام الأسبوع على أيامه (1–7) بشكل متساوٍ
 */
function distributeTasksToDays(taskTitles) {
  const days = [];
  const count = taskTitles.length;
  for (let i = 0; i < count; i++) {
    const day = Math.min(7, Math.round(((i + 1) / count) * 7));
    days.push(day === 0 ? 1 : day);
  }
  return days;
}

/**
 * حفظ هدف جديد مع الأسابيع والمهام المُولَّدة من الذكاء الاصطناعي
 */
export function saveGoalWithPlan(goalData, aiPlan) {
  const insertGoal = db.prepare(`
    INSERT INTO goals (name, result, reason, hours, start_date)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertWeek = db.prepare(`
    INSERT INTO weeks (goal_id, week_number, title)
    VALUES (?, ?, ?)
  `);

  const insertTask = db.prepare(`
    INSERT INTO tasks (week_id, goal_id, title, day_in_week)
    VALUES (?, ?, ?, ?)
  `);

  const startDate = new Date().toISOString().split("T")[0];

  db.exec("BEGIN");
  try {
    const goalResult = insertGoal.run(
      goalData.name,
      goalData.result,
      goalData.reason,
      goalData.hours,
      startDate
    );
    const goalId = goalResult.lastInsertRowid;

    for (const week of aiPlan.weeks) {
      const weekResult = insertWeek.run(goalId, week.week_number, week.title);
      const weekId = weekResult.lastInsertRowid;
      const days = distributeTasksToDays(week.tasks);

      week.tasks.forEach((taskTitle, index) => {
        insertTask.run(weekId, goalId, taskTitle, days[index]);
      });
    }

    db.exec("COMMIT");
    return goalId;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/**
 * جلب أحدث هدف (للتطبيق أحادي المستخدم في الـ MVP)
 */
export function getLatestGoal() {
  return db.prepare("SELECT * FROM goals ORDER BY id DESC LIMIT 1").get();
}

/**
 * جلب هدف بالمعرّف
 */
export function getGoalById(id) {
  return db.prepare("SELECT * FROM goals WHERE id = ?").get(id);
}

/**
 * جلب خطة 12 أسبوع كاملة مع المهام لكل أسبوع
 */
export function getPlanWithTasks(goalId) {
  const weeks = getWeeksWithProgress(goalId);
  const taskStmt = db.prepare(
    "SELECT * FROM tasks WHERE week_id = ? ORDER BY id"
  );

  return weeks.map((week) => ({
    ...week,
    tasks: taskStmt.all(week.id),
  }));
}

/**
 * جلب أسابيع هدف مع نسبة إنجاز كل أسبوع
 */
export function getWeeksWithProgress(goalId) {
  return db
    .prepare(
      `
    SELECT w.*,
      COUNT(t.id) AS total_tasks,
      SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) AS completed_tasks
    FROM weeks w
    LEFT JOIN tasks t ON t.week_id = w.id
    WHERE w.goal_id = ?
    GROUP BY w.id
    ORDER BY w.week_number
  `
    )
    .all(goalId);
}

/**
 * حساب اليوم الحالي في البرنامج (1–84)
 */
export function getProgramDay(goal) {
  const start = new Date(goal.start_date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(diff, 1), 84);
}

/**
 * مهام اليوم الحالي
 */
export function getTodayTasks(goalId) {
  const goal = getGoalById(goalId);
  if (!goal) return { goal: null, tasks: [], programDay: 0, daysRemaining: 0 };

  const programDay = getProgramDay(goal);
  const currentWeek = Math.ceil(programDay / 7);
  const dayInWeek = ((programDay - 1) % 7) + 1;
  const daysRemaining = 84 - programDay;

  const tasks = db
    .prepare(
      `
    SELECT t.*, w.week_number, w.title AS week_title
    FROM tasks t
    JOIN weeks w ON w.id = t.week_id
    WHERE t.goal_id = ?
      AND w.week_number = ?
      AND t.day_in_week = ?
    ORDER BY t.id
  `
    )
    .all(goalId, currentWeek, dayInWeek);

  return { goal, tasks, programDay, currentWeek, dayInWeek, daysRemaining };
}

/**
 * إحصائيات الهدف
 */
export function getGoalStats(goalId) {
  const totals = db
    .prepare(
      `
    SELECT
      COUNT(*) AS total_tasks,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_tasks,
      SUM(CASE WHEN deferred = 1 THEN 1 ELSE 0 END) AS deferred_tasks
    FROM tasks WHERE goal_id = ?
  `
    )
    .get(goalId);

  const weeklyStats = db
    .prepare(
      `
    SELECT w.week_number, w.title,
      COUNT(t.id) AS total,
      SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) AS completed
    FROM weeks w
    LEFT JOIN tasks t ON t.week_id = w.id
    WHERE w.goal_id = ?
    GROUP BY w.id
    ORDER BY w.week_number
  `
    )
    .all(goalId);

  const total = totals.total_tasks || 0;
  const completed = totals.completed_tasks || 0;

  return {
    totalTasks: total,
    completedTasks: completed,
    remainingTasks: total - completed,
    deferredTasks: totals.deferred_tasks || 0,
    progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    weeklyStats,
  };
}

/**
 * تحديث مهمة (إنجاز / تأجيل / ملاحظات)
 */
export function updateTask(taskId, updates) {
  const fields = [];
  const values = [];

  if (updates.completed !== undefined) {
    fields.push("completed = ?");
    values.push(updates.completed ? 1 : 0);
    if (updates.completed) {
      fields.push("deferred = 0");
    }
  }
  if (updates.deferred !== undefined) {
    fields.push("deferred = ?");
    values.push(updates.deferred ? 1 : 0);
    if (updates.deferred) {
      fields.push("completed = 0");
    }
  }
  if (updates.notes !== undefined) {
    fields.push("notes = ?");
    values.push(updates.notes);
  }

  if (fields.length === 0) return null;

  values.push(taskId);
  db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
}

/**
 * تحديث حالة إنجاز أسبوع
 */
export function updateWeekCompletion(weekId, completed) {
  db.prepare("UPDATE weeks SET completed = ? WHERE id = ?").run(completed ? 1 : 0, weekId);
  return db.prepare("SELECT * FROM weeks WHERE id = ?").get(weekId);
}

/**
 * مزامنة حالة الأسبوع تلقائياً عند إنجاز كل المهام
 */
export function syncWeekCompletion(weekId) {
  const stats = db
    .prepare(
      `
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS done
    FROM tasks WHERE week_id = ?
  `
    )
    .get(weekId);

  const allDone = stats.total > 0 && stats.total === stats.done;
  updateWeekCompletion(weekId, allDone);
}

export default db;
