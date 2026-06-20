/**
 * database.js — قاعدة البيانات ونظام توزيع المهام المتوازن
 */
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "growth.db");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");

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

// ─── نظام التوزيع المتوازن ───────────────────────────────────

/** أيام العمل: 20 ساعة → 4 أيام × 5 ساعات */
export function getWorkDaysPerWeek(weeklyHours) {
  const hoursPerDay = 5;
  return Math.min(5, Math.max(2, Math.round(Number(weeklyHours) / hoursPerDay)));
}

export function getHoursPerWorkDay(weeklyHours) {
  const workDays = getWorkDaysPerWeek(weeklyHours);
  return Math.round((Number(weeklyHours) / workDays) * 10) / 10;
}

export function getRestDaysPerWeek(weeklyHours) {
  return 7 - getWorkDaysPerWeek(weeklyHours);
}

/** تنظيف عنوان المهمة من بيانات التوزيع القديمة */
function cleanTaskTitle(title) {
  return String(title)
    .replace(/\s*\([\d.]+\s*س(?:اعة)?[^)]*\)\s*$/u, "")
    .replace(/\s*\([\d.]+\s*س\s*—[^)]*\)\s*$/u, "")
    .trim();
}

/** تنسيق عنوان المهمة مع الساعات ويوم العمل */
function formatTaskTitle(baseTitle, hoursPerDay, day, workDays) {
  return `${cleanTaskTitle(baseTitle)} (${hoursPerDay} س — يوم ${day}/${workDays})`;
}

/** توزيع المهام على أيام العمل بالتسلسل 1, 2, 3, 4 */
function distributeTasksToDays(count, weeklyHours) {
  const workDays = getWorkDaysPerWeek(weeklyHours);
  return Array.from({ length: count }, (_, i) => (i % workDays) + 1);
}

/** قوالب مهام متوازنة لكل يوم عمل */
export function buildBalancedWeekTasks(weekNumber, goalData) {
  const workDays = getWorkDaysPerWeek(goalData.hours);
  const h = getHoursPerWorkDay(goalData.hours);
  const templates = [
    `تعلّم الأساسيات — الأسبوع ${weekNumber}: ${goalData.result}`,
    `تطبيق عملي — تمرين ${h} ساعات على ${goalData.name}`,
    `مشروع مصغّر — نفّذ خطوة ملموسة (${h} س)`,
    `مراجعة وتقييم — دوّن تقدمك في ${goalData.reason}`,
    `تعميق متقدّم — مهمة إضافية (${h} س)`,
  ];
  return templates.slice(0, workDays);
}

/**
 * إعادة توازن خطة هدف موجود (يصلح الخطط القديمة تلقائياً)
 */
export function rebalanceGoalPlan(goalId) {
  const goal = getGoalById(goalId);
  if (!goal) return false;

  const workDays = getWorkDaysPerWeek(goal.hours);
  const hoursPerDay = getHoursPerWorkDay(goal.hours);

  const weeks = db
    .prepare("SELECT id, week_number FROM weeks WHERE goal_id = ? ORDER BY week_number")
    .all(goalId);

  const getTasks = db.prepare(
    "SELECT id, title FROM tasks WHERE week_id = ? ORDER BY id"
  );
  const updateTask = db.prepare(
    "UPDATE tasks SET day_in_week = ?, title = ? WHERE id = ?"
  );
  const deleteTask = db.prepare("DELETE FROM tasks WHERE id = ?");

  db.exec("BEGIN");
  try {
    for (const week of weeks) {
      let tasks = getTasks.all(week.id);

      // حذف المهام الزائدة
      if (tasks.length > workDays) {
        tasks.slice(workDays).forEach((t) => deleteTask.run(t.id));
        tasks = tasks.slice(0, workDays);
      }

      // إضافة مهام ناقصة
      while (tasks.length < workDays) {
        const idx = tasks.length;
        const title = formatTaskTitle(
          buildBalancedWeekTasks(week.week_number, goal)[idx],
          hoursPerDay,
          idx + 1,
          workDays
        );
        db.prepare(
          "INSERT INTO tasks (week_id, goal_id, title, day_in_week) VALUES (?, ?, ?, ?)"
        ).run(week.id, goalId, title, idx + 1);
        tasks = getTasks.all(week.id);
      }

      // إعادة توزيع الأيام 1 → workDays
      tasks.forEach((task, index) => {
        const day = index + 1;
        const title = formatTaskTitle(task.title, hoursPerDay, day, workDays);
        updateTask.run(day, title, task.id);
      });
    }
    db.exec("COMMIT");
    return true;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ─── حفظ وجلب البيانات ───────────────────────────────────────

export function saveGoalWithPlan(goalData, aiPlan) {
  const insertGoal = db.prepare(`
    INSERT INTO goals (name, result, reason, hours, start_date)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertWeek = db.prepare(`
    INSERT INTO weeks (goal_id, week_number, title) VALUES (?, ?, ?)
  `);
  const insertTask = db.prepare(`
    INSERT INTO tasks (week_id, goal_id, title, day_in_week) VALUES (?, ?, ?, ?)
  `);

  const startDate = new Date().toISOString().split("T")[0];
  const workDays = getWorkDaysPerWeek(goalData.hours);
  const hoursPerDay = getHoursPerWorkDay(goalData.hours);

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

      // استخدم المهام من AI أو القوالب المتوازنة
      let taskTitles = (week.tasks || []).map(cleanTaskTitle);
      if (taskTitles.length < workDays) {
        taskTitles = buildBalancedWeekTasks(week.week_number, goalData);
      }
      taskTitles = taskTitles.slice(0, workDays);

      const days = distributeTasksToDays(taskTitles.length, goalData.hours);
      taskTitles.forEach((title, index) => {
        const day = days[index];
        insertTask.run(
          weekId,
          goalId,
          formatTaskTitle(title, hoursPerDay, day, workDays),
          day
        );
      });
    }

    db.exec("COMMIT");
    return goalId;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getLatestGoal() {
  return db.prepare("SELECT * FROM goals ORDER BY id DESC LIMIT 1").get();
}

export function getGoalById(id) {
  return db.prepare("SELECT * FROM goals WHERE id = ?").get(id);
}

export function getPlanWithTasks(goalId) {
  rebalanceGoalPlan(goalId);
  const goal = getGoalById(goalId);
  const weeks = getWeeksWithProgress(goalId);
  const taskStmt = db.prepare(
    "SELECT * FROM tasks WHERE week_id = ? ORDER BY day_in_week, id"
  );

  return {
    goal,
    workDays: getWorkDaysPerWeek(goal.hours),
    hoursPerDay: getHoursPerWorkDay(goal.hours),
    restDays: getRestDaysPerWeek(goal.hours),
    weeks: weeks.map((week) => ({
      ...week,
      tasks: taskStmt.all(week.id),
    })),
  };
}

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

export function getProgramDay(goal) {
  const start = new Date(goal.start_date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(diff, 1), 84);
}

export function getTodayTasks(goalId) {
  rebalanceGoalPlan(goalId);

  const goal = getGoalById(goalId);
  if (!goal) {
    return {
      goal: null,
      tasks: [],
      deferredTasks: [],
      programDay: 0,
      daysRemaining: 0,
      workDays: 4,
      hoursPerDay: 5,
      restDays: 3,
      isRestDay: false,
    };
  }

  const programDay = getProgramDay(goal);
  const currentWeek = Math.ceil(programDay / 7);
  const dayInWeek = ((programDay - 1) % 7) + 1;
  const daysRemaining = 84 - programDay;
  const workDays = getWorkDaysPerWeek(goal.hours);
  const hoursPerDay = getHoursPerWorkDay(goal.hours);
  const restDays = getRestDaysPerWeek(goal.hours);
  const isRestDay = dayInWeek > workDays;

  const tasks = db
    .prepare(
      `
    SELECT t.*, w.week_number, w.title AS week_title
    FROM tasks t JOIN weeks w ON w.id = t.week_id
    WHERE t.goal_id = ? AND w.week_number = ? AND t.day_in_week = ?
    ORDER BY t.id
  `
    )
    .all(goalId, currentWeek, dayInWeek);

  const deferredTasks = db
    .prepare(
      `
    SELECT t.*, w.week_number, w.title AS week_title
    FROM tasks t JOIN weeks w ON w.id = t.week_id
    WHERE t.goal_id = ? AND w.week_number = ?
      AND t.deferred = 1 AND t.completed = 0 AND t.day_in_week < ?
    ORDER BY t.id
  `
    )
    .all(goalId, currentWeek, dayInWeek);

  // مهام غير مكتملة من أيام سابقة (لم تُنجز ولم تُؤجَّل)
  const carryOverTasks = db
    .prepare(
      `
    SELECT t.*, w.week_number, w.title AS week_title
    FROM tasks t JOIN weeks w ON w.id = t.week_id
    WHERE t.goal_id = ? AND w.week_number = ?
      AND t.completed = 0 AND t.deferred = 0 AND t.day_in_week < ?
    ORDER BY t.day_in_week, t.id
  `
    )
    .all(goalId, currentWeek, dayInWeek);

  return {
    goal,
    tasks,
    deferredTasks,
    carryOverTasks,
    programDay,
    currentWeek,
    dayInWeek,
    daysRemaining,
    workDays,
    hoursPerDay,
    restDays,
    isRestDay,
  };
}

export function getGoalStats(goalId) {
  const totals = db
    .prepare(
      `
    SELECT COUNT(*) AS total_tasks,
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
    FROM weeks w LEFT JOIN tasks t ON t.week_id = w.id
    WHERE w.goal_id = ? GROUP BY w.id ORDER BY w.week_number
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

export function updateTask(taskId, updates) {
  const fields = [];
  const values = [];

  if (updates.completed !== undefined) {
    fields.push("completed = ?");
    values.push(updates.completed ? 1 : 0);
    if (updates.completed) fields.push("deferred = 0");
  }
  if (updates.deferred !== undefined) {
    fields.push("deferred = ?");
    values.push(updates.deferred ? 1 : 0);
    if (updates.deferred) fields.push("completed = 0");
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

export function updateWeekCompletion(weekId, completed) {
  db.prepare("UPDATE weeks SET completed = ? WHERE id = ?").run(completed ? 1 : 0, weekId);
  return db.prepare("SELECT * FROM weeks WHERE id = ?").get(weekId);
}

export function syncWeekCompletion(weekId) {
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS done
       FROM tasks WHERE week_id = ?`
    )
    .get(weekId);
  updateWeekCompletion(weekId, stats.total > 0 && stats.total === stats.done);
}

export default db;
