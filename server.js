/**
 * server.js — Express + Google Gemini API
 */
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  saveGoalWithPlan, getLatestGoal, getGoalById, getWeeksWithProgress,
  rebalanceGoalPlan, getPlanWithTasks, getTodayTasks, getGoalStats,
  buildBalancedWeekTasks, getWorkDaysPerWeek, getHoursPerWorkDay,
  updateTask, updateWeekCompletion, syncWeekCompletion,
} from "./database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * تنظيف وتحليل JSON من استجابة Gemini بمرونة
 * يزيل ```json``` والتعليقات قبل JSON.parse
 */
function parseGeminiJson(rawText) {
  let text = String(rawText).trim();

  // إزالة كتل Markdown
  text = text.replace(/^```(?:json|JSON)?\s*/i, "");
  text = text.replace(/\s*```\s*$/i, "");

  // إزالة التعليقات
  text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  text = text.replace(/\/\/[^\n]*/g, "");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("لم يتم العثور على JSON صالح في استجابة الذكاء الاصطناعي");
  }

  const jsonStr = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    // محاولة ثانية: إزالة فواصل زائدة
    const fixed = jsonStr.replace(/,\s*([\]}])/g, "$1");
    return JSON.parse(fixed);
  }
}

/** توليد خطة 12 أسبوعاً عبر Gemini */
async function generatePlanWithGemini({ goal, result, reason, hours, workDays, userName }) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY غير مُعرَّف");

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `أنت خبير في التخطيط الاستراتيجي ومنهجية "سنة الـ 12 أسبوعاً".
قسّم هذا الهدف الكبير إلى خطة عمل دقيقة ومكثفة لمدة 12 أسبوعاً فقط.

المعطيات:
- الهدف الأساسي: ${goal}
- النتيجة النهائية المطلوبة: ${result}
- الدافع/السبب: ${reason}
- الوقت المتاح للتنفيذ: ${hours} ساعة أسبوعياً

المطلوب لكل أسبوع:
1. عنوان ملهم يوضح التركيز الأساسي للأسبوع.
2. من 3 إلى 5 مهام "عملية جداً" وقابلة للقياس (Actionable Tasks).
3. يجب أن تتناسب صعوبة المهام مع عدد الساعات المتاحة (${hours} ساعة).
4. تأكد من وجود تدرج منطقي بحيث يكون الأسبوع 12 هو مرحلة الإنهاء أو الإطلاق.

يجب أن تكون الاستجابة بصيغة JSON فقط، بالهيكل التالي:
{
  "weeks": [
    {
      "week_number": 1,
      "title": "عنوان الأسبوع",
      "tasks": ["مهمة 1 تفصيلية", "مهمة 2 تفصيلية", "مهمة 3 تفصيلية"]
    }
  ]
}
ملاحظة: لا تكتب أي نصوص خارج الـ JSON.`;

  const response = await model.generateContent(prompt);
  const plan = parseGeminiJson(response.response.text());

  if (!plan.weeks || plan.weeks.length !== 12) {
    throw new Error("الخطة لا تحتوي 12 أسبوعاً");
  }
  for (const week of plan.weeks) {
    if (!week.tasks || week.tasks.length < 3) {
      throw new Error(`الأسبوع ${week.week_number} ناقص مهام (يحتاج 3 على الأقل)`);
    }
    week.tasks = week.tasks.slice(0, 5);
  }
  return plan;
}

function getFallbackPlan(goalData) {
  const themes = [
    "وضوح الرؤية والتأسيس", "بناء العادات اليومية", "إدارة الوقت بفعالية",
    "تطوير المهارات الأساسية", "تعزيز الانضباط الذاتي", "الصحة والطاقة",
    "بناء العلاقات الداعمة", "الإنتاجية العميقة", "التقدم نحو النتيجة",
    "التعلم المستمر", "القيادة الذاتية", "التقييم والاحتفال بالإنجاز",
  ];
  return {
    weeks: themes.map((title, i) => ({
      week_number: i + 1,
      title: `${title} — ${goalData.name}`,
      tasks: buildBalancedWeekTasks(i + 1, goalData),
    })),
  };
}

// ─── API ───

app.post("/api/goals", async (req, res) => {
  try {
    const { name, result, reason, hours, work_days, user_name } = req.body;
    if (!name || !result || !reason || !hours) {
      return res.status(400).json({ error: "جميع الحقول مطلوبة" });
    }

    const goalData = {
      name: String(name).trim(),
      result: String(result).trim(),
      reason: String(reason).trim(),
      hours: parseFloat(hours),
      work_days: Math.min(6, Math.max(2, parseInt(work_days) || 5)),
      user_name: String(user_name || "").trim(),
    };

    let plan;
    try {
      plan = await generatePlanWithGemini({
        goal: goalData.name, result: goalData.result,
        reason: goalData.reason, hours: goalData.hours,
        workDays: goalData.work_days, userName: goalData.user_name,
      });
    } catch (aiError) {
      console.warn("فشل Gemini:", aiError.message);
      plan = getFallbackPlan(goalData);
    }

    const goalId = saveGoalWithPlan(goalData, plan);
    res.status(201).json({ id: goalId, message: "تم إنشاء الخطة بنجاح" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "حدث خطأ" });
  }
});

app.get("/api/goals/latest", (req, res) => {
  const goal = getLatestGoal();
  if (!goal) return res.status(404).json({ error: "لا يوجد هدف" });
  res.json(goal);
});

app.get("/api/goals/:id", (req, res) => {
  const goal = getGoalById(req.params.id);
  if (!goal) return res.status(404).json({ error: "الهدف غير موجود" });
  res.json(goal);
});

app.get("/api/goals/:id/plan", (req, res) => {
  const plan = getPlanWithTasks(req.params.id);
  if (!plan.goal) return res.status(404).json({ error: "الهدف غير موجود" });
  res.json({ ...plan, stats: getGoalStats(req.params.id) });
});

app.post("/api/goals/:id/rebalance", (req, res) => {
  if (!getGoalById(req.params.id)) return res.status(404).json({ error: "الهدف غير موجود" });
  rebalanceGoalPlan(req.params.id);
  res.json({ message: "تم إعادة التوازن", plan: getPlanWithTasks(req.params.id) });
});

app.get("/api/goals/:id/today", (req, res) => {
  const data = getTodayTasks(req.params.id);
  if (!data.goal) return res.status(404).json({ error: "الهدف غير موجود" });
  res.json({ ...data, stats: getGoalStats(req.params.id) });
});

app.get("/api/goals/:id/stats", (req, res) => {
  const goal = getGoalById(req.params.id);
  if (!goal) return res.status(404).json({ error: "الهدف غير موجود" });
  res.json({ goal, stats: getGoalStats(req.params.id) });
});

app.patch("/api/tasks/:id", (req, res) => {
  const task = updateTask(req.params.id, req.body);
  if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });
  syncWeekCompletion(task.week_id);
  res.json(task);
});

app.patch("/api/weeks/:id", (req, res) => {
  const week = updateWeekCompletion(req.params.id, req.body.completed);
  if (!week) return res.status(404).json({ error: "الأسبوع غير موجود" });
  res.json(week);
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 يعمل على http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) console.warn("⚠️ GEMINI_API_KEY غير مُعرَّف");
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") console.error(`❌ المنفذ ${PORT} مشغول`);
  else console.error(err);
  process.exit(1);
});
