/**
 * database.js — قاعدة البيانات ونظام التوزيع (أيام عمل يحددها المستخدم)
 */
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "growth.db"));
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    result TEXT NOT NULL,
    reason TEXT NOT NULL,
    hours REAL NOT NULL,
    work_days INTEGER DEFAULT 5,
    user_name TEXT DEFAULT '',
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

// ترقية الجداول القديمة
for (const sql of [
  "ALTER TABLE goals ADD COLUMN work_days INTEGER DEFAULT 5",
  "ALTER TABLE goals ADD COLUMN user_name TEXT DEFAULT ''",
]) {
  try { db.exec(sql); } catch { /* العمود موجود */ }
}

// ─── رسائل أيام الراحة ───
export const REST_DAY_MESSAGES = [
  "راحتك جزء من النجاح — جسمك وعقلك يحتاجان للتعافي لينطلقا بقوة.",
  "الأسبوع الـ 12 ليس سباقاً؛ استعد للأيام القادمة بذهن صافٍ.",
  "اليوم فرصة لمراجعة ما أنجزته والاحتفال بخطواتك الصغيرة.",
  "الانضباط يعني معرفة متى تتوقف — أنت تتقن فن التوازن.",
];

export const LIGHT_OPTIONAL_TASKS = [
  "📖 راجع ملاحظات الأسبوع (10 دقائق)",
  "📝 خطّط لأهم 3 مهام للأسبوع القادم",
  "🧘 تأمل 5 دقائق في سبب هدفك",
  "📊 راجع نسبة إنجازك الحالية",
  "💡 اقرأ عبارة تحفيزية واكتب فكرة واحدة",
];

// ─── حساب الأيام والساعات ───

/** أيام العمل من اختيار المستخدم (افتراضي 5) */
export function getWorkDaysPerWeek(goal) {
  const days = Number(goal?.work_days);
  return days >= 2 && days <= 6 ? days : 5;
}

export function getHoursPerWorkDay(goal) {
  const wd = getWorkDaysPerWeek(goal);
  return Math.round((Number(goal.hours) / wd) * 10) / 10;
}

export function getRestDaysPerWeek(goal) {
  return 7 - getWorkDaysPerWeek(goal);
}

function cleanTaskTitle(title) {
  return String(title)
    .replace(/\s*\([\d.]+\s*س(?:اعة)?[^)]*\)\s*$/u, "")
    .replace(/\s*\([\d.]+\s*س\s*—[^)]*\)\s*$/u, "")
    .trim();
}

function formatTaskTitle(base, hoursPerDay, day, workDays) {
  return `${cleanTaskTitle(base)} (${hoursPerDay} س — يوم ${day}/${workDays})`;
}

/** مهام متوازنة — صعوبة تتدرج حسب رقم الأسبوع */
export function buildBalancedWeekTasks(weekNumber, goalData) {
  const wd = getWorkDaysPerWeek(goalData);
  const h = getHoursPerWorkDay(goalData);
  const level = weekNumber <= 4 ? "أساسي" : weekNumber <= 8 ? "متوسط" : "متقدّم";
  const templates = [
    `[${level}] تعلّم — الأسبوع ${weekNumber}: ${goalData.result}`,
    `[${level}] تطبيق عملي — ${h} ساعات على ${goalData.name}`,
    `[${level}] مشروع مصغّر — خطوة ملموسة (${h} س)`,
    `[${level}] مراجعة — دوّن تقدمك (${goalData.reason})`,
    `[${level}] تعميق — مهمة إضافية (${h} س)`,
    `[${level}] توسّع — بناء على ما تعلّمته (${h} س)`,
  ];
  return templates.slice(0, wd);
}

export function rebalanceGoalPlan(goalId) {
  const goal = getGoalById(goalId);
  if (!goal) return false;

  const workDays = getWorkDaysPerWeek(goal);
  const hoursPerDay = getHoursPerWorkDay(goal);
  const weeks = db.prepare("SELECT id, week_number FROM weeks WHERE goal_id = ? ORDER BY week_number").all(goalId);
  const getTasks = db.prepare("SELECT id, title FROM tasks WHERE week_id = ? ORDER BY id");
  const updateTask = db.prepare("UPDATE tasks SET day_in_week = ?, title = ? WHERE id = ?");
  const deleteTask = db.prepare("DELETE FROM tasks WHERE id = ?");

  db.exec("BEGIN");
  try {
    for (const week of weeks) {
      let tasks = getTasks.all(week.id);
      if (tasks.length > workDays) {
        tasks.slice(workDays).forEach((t) => deleteTask.run(t.id));
        tasks = tasks.slice(0, workDays);
      }
      while (tasks.length < workDays) {
        const idx = tasks.length;
        const title = formatTaskTitle(
          buildBalancedWeekTasks(week.week_number, goal)[idx],
          hoursPerDay, idx + 1, workDays
        );
        db.prepare("INSERT INTO tasks (week_id, goal_id, title, day_in_week) VALUES (?,?,?,?)")
          .run(week.id, goalId, title, idx + 1);
        tasks = getTasks.all(week.id);
      }
      tasks.forEach((task, i) => {
        const day = i + 1;
        updateTask.run(day, formatTaskTitle(task.title, hoursPerDay, day, workDays), task.id);
      });
    }
    db.exec("COMMIT");
    return true;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function saveGoalWithPlan(goalData, aiPlan) {
  const insertGoal = db.prepare(`
    INSERT INTO goals (name, result, reason, hours, work_days, user_name, start_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertWeek = db.prepare("INSERT INTO weeks (goal_id, week_number, title) VALUES (?,?,?)");
  const insertTask = db.prepare("INSERT INTO tasks (week_id, goal_id, title, day_in_week) VALUES (?,?,?,?)");

  const startDate = new Date().toISOString().split("T")[0];
  const workDays = getWorkDaysPerWeek(goalData);
  const hoursPerDay = getHoursPerWorkDay(goalData);

  db.exec("BEGIN");
  try {
    const r = insertGoal.run(
      goalData.name, goalData.result, goalData.reason, goalData.hours,
      workDays, goalData.user_name || "", startDate
    );
    const goalId = r.lastInsertRowid;

    for (const week of aiPlan.weeks) {
      const wr = insertWeek.run(goalId, week.week_number, week.title);
      let titles = (week.tasks || []).map(cleanTaskTitle);
      if (titles.length < workDays) titles = buildBalancedWeekTasks(week.week_number, goalData);
      titles = titles.slice(0, workDays);

      titles.forEach((title, i) => {
        const day = i + 1;
        insertTask.run(wr.lastInsertRowid, goalId, formatTaskTitle(title, hoursPerDay, day, workDays), day);
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
  const taskStmt = db.prepare("SELECT * FROM tasks WHERE week_id = ? ORDER BY day_in_week, id");
  return {
    goal,
    workDays: getWorkDaysPerWeek(goal),
    hoursPerDay: getHoursPerWorkDay(goal),
    restDays: getRestDaysPerWeek(goal),
    weeks: getWeeksWithProgress(goalId).map((w) => ({
      ...w,
      tasks: taskStmt.all(w.id),
    })),
  };
}

export function getWeeksWithProgress(goalId) {
  return db.prepare(`
    SELECT w.*, COUNT(t.id) AS total_tasks,
      SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) AS completed_tasks
    FROM weeks w LEFT JOIN tasks t ON t.week_id = w.id
    WHERE w.goal_id = ? GROUP BY w.id ORDER BY w.week_number
  `).all(goalId);
}

export function getProgramDay(goal) {
  const start = new Date(goal.start_date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000) + 1;
  return Math.min(Math.max(diff, 1), 84);
}

export function getTodayTasks(goalId) {
  rebalanceGoalPlan(goalId);
  const goal = getGoalById(goalId);
  const empty = {
    goal: null, tasks: [], deferredTasks: [], carryOverTasks: [],
    programDay: 0, daysRemaining: 0, workDays: 5, hoursPerDay: 4,
    restDays: 2, isRestDay: false, restDayContent: null,
  };
  if (!goal) return empty;

  const programDay = getProgramDay(goal);
  const currentWeek = Math.ceil(programDay / 7);
  const dayInWeek = ((programDay - 1) % 7) + 1;
  const workDays = getWorkDaysPerWeek(goal);
  const hoursPerDay = getHoursPerWorkDay(goal);
  const isRestDay = dayInWeek > workDays;

  const tasks = db.prepare(`
    SELECT t.*, w.week_number, w.title AS week_title
    FROM tasks t JOIN weeks w ON w.id = t.week_id
    WHERE t.goal_id = ? AND w.week_number = ? AND t.day_in_week = ?
    ORDER BY t.id
  `).all(goalId, currentWeek, dayInWeek);

  const deferredTasks = db.prepare(`
    SELECT t.*, w.week_number, w.title AS week_title
    FROM tasks t JOIN weeks w ON w.id = t.week_id
    WHERE t.goal_id = ? AND w.week_number = ?
      AND t.deferred = 1 AND t.completed = 0 AND t.day_in_week < ?
  `).all(goalId, currentWeek, dayInWeek);

  const carryOverTasks = db.prepare(`
    SELECT t.*, w.week_number, w.title AS week_title
    FROM tasks t JOIN weeks w ON w.id = t.week_id
    WHERE t.goal_id = ? AND w.week_number = ?
      AND t.completed = 0 AND t.deferred = 0 AND t.day_in_week < ?
    ORDER BY t.day_in_week, t.id
  `).all(goalId, currentWeek, dayInWeek);

  // محتوى يوم الراحة — رسالة تحفيزية + مهام اختيارية خفيفة
  const restDayContent = isRestDay ? {
    message: REST_DAY_MESSAGES[(dayInWeek + currentWeek) % REST_DAY_MESSAGES.length],
    optionalTasks: [
      LIGHT_OPTIONAL_TASKS[(dayInWeek * 2) % LIGHT_OPTIONAL_TASKS.length],
      LIGHT_OPTIONAL_TASKS[(dayInWeek * 2 + 1) % LIGHT_OPTIONAL_TASKS.length],
    ],
  } : null;

  return {
    goal, tasks, deferredTasks, carryOverTasks,
    programDay, currentWeek, dayInWeek,
    daysRemaining: 84 - programDay,
    workDays, hoursPerDay, restDays: 7 - workDays,
    isRestDay, restDayContent,
  };
}

export function getGoalStats(goalId) {
  const totals = db.prepare(`
    SELECT COUNT(*) AS total_tasks,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_tasks,
      SUM(CASE WHEN deferred = 1 THEN 1 ELSE 0 END) AS deferred_tasks
    FROM tasks WHERE goal_id = ?
  `).get(goalId);

  const weeklyStats = db.prepare(`
    SELECT w.week_number, w.title, COUNT(t.id) AS total,
      SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) AS completed
    FROM weeks w LEFT JOIN tasks t ON t.week_id = w.id
    WHERE w.goal_id = ? GROUP BY w.id ORDER BY w.week_number
  `).all(goalId);

  const total = totals.total_tasks || 0;
  const completed = totals.completed_tasks || 0;
  return {
    totalTasks: total, completedTasks: completed,
    remainingTasks: total - completed,
    deferredTasks: totals.deferred_tasks || 0,
    progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    weeklyStats,
  };
}

export function updateTask(taskId, updates) {
  const fields = [], values = [];
  if (updates.completed !== undefined) {
    fields.push("completed = ?"); values.push(updates.completed ? 1 : 0);
    if (updates.completed) fields.push("deferred = 0");
  }
  if (updates.deferred !== undefined) {
    fields.push("deferred = ?"); values.push(updates.deferred ? 1 : 0);
    if (updates.deferred) fields.push("completed = 0");
  }
  if (updates.notes !== undefined) { fields.push("notes = ?"); values.push(updates.notes); }
  if (!fields.length) return null;
  values.push(taskId);
  db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
}

export function updateWeekCompletion(weekId, completed) {
  db.prepare("UPDATE weeks SET completed = ? WHERE id = ?").run(completed ? 1 : 0, weekId);
  return db.prepare("SELECT * FROM weeks WHERE id = ?").get(weekId);
}

export function syncWeekCompletion(weekId) {
  const s = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) AS done FROM tasks WHERE week_id=?`).get(weekId);
  updateWeekCompletion(weekId, s.total > 0 && s.total === s.done);
}

export default db;
