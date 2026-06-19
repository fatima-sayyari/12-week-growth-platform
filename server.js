/**
 * server.js — خادم Express مع تكامل Google Gemini API
 */
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  saveGoalWithPlan,
  getLatestGoal,
  getGoalById,
  getWeeksWithProgress,
  getPlanWithTasks,
  getTodayTasks,
  getGoalStats,
  updateTask,
  updateWeekCompletion,
  syncWeekCompletion,
} from "./database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// مفتاح Gemini من متغيرات البيئة
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * بناء البرومبت وإرساله لـ Gemini لتوليد خطة 12 أسبوعاً
 */
async function generatePlanWithGemini({ goal, result, reason, hours }) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY غير مُعرَّف في ملف .env");
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `قسّم هذا الهدف إلى خطة مدتها 12 أسبوعًا.
لكل أسبوع:
- هدف أسبوعي واضح.
- 3 إلى 5 مهام قابلة للتنفيذ.
- ترتيب منطقي من البداية حتى الوصول للنتيجة النهائية.

الهدف: ${goal}
النتيجة المطلوبة: ${result}
السبب: ${reason}
الساعات المتاحة أسبوعيًا: ${hours}

أرجع النتيجة بصيغة JSON فقط بدون أي نص إضافي، بالهيكل التالي:
{
  "weeks": [
    {
      "week_number": 1,
      "title": "عنوان هدف الأسبوع",
      "tasks": ["مهمة 1", "مهمة 2", "مهمة 3"]
    }
  ]
}
يجب أن يحتوي المصفوفة على 12 أسبوعاً بالضبط.`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();

  // استخراج JSON من الاستجابة (قد يأتي داخل ```json)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("لم يتمكن الذكاء الاصطناعي من إرجاع خطة صالحة");
  }

  const plan = JSON.parse(jsonMatch[0]);

  if (!plan.weeks || plan.weeks.length !== 12) {
    throw new Error("الخطة المُولَّدة لا تحتوي على 12 أسبوعاً");
  }

  // التأكد من أن كل أسبوع يحتوي 3–5 مهام
  for (const week of plan.weeks) {
    if (!week.tasks || week.tasks.length < 3) {
      throw new Error(`الأسبوع ${week.week_number} لا يحتوي على مهام كافية`);
    }
    week.tasks = week.tasks.slice(0, 5);
  }

  return plan;
}

/**
 * خطة احتياطية عند فشل Gemini (للتطوير المحلي بدون مفتاح API)
 */
function getFallbackPlan(goalData) {
  const themes = [
    "وضوح الرؤية والتأسيس",
    "بناء العادات اليومية",
    "إدارة الوقت بفعالية",
    "تطوير المهارات الأساسية",
    "تعزيز الانضباط الذاتي",
    "الصحة والطاقة",
    "بناء العلاقات الداعمة",
    "الإنتاجية العميقة",
    "التقدم نحو النتيجة",
    "التعلم المستمر",
    "القيادة الذاتية",
    "التقييم والاحتفال بالإنجاز",
  ];

  return {
    weeks: themes.map((title, i) => ({
      week_number: i + 1,
      title: `${title} — ${goalData.name}`,
      tasks: [
        `حدّد إجراءات الأسبوع ${i + 1} المرتبطة بـ: ${goalData.result}`,
        `خصّص ${Math.round(goalData.hours / 12)} ساعة للتنفيذ اليومي`,
        `راجع تقدمك ودوّن ملاحظات حول: ${goalData.reason}`,
        `نفّذ أهم مهمة لهذا الأسبوع`,
      ],
    })),
  };
}

// ─── API Routes ───────────────────────────────────────────────

/** إنشاء هدف جديد وتوليد الخطة بالذكاء الاصطناعي */
app.post("/api/goals", async (req, res) => {
  try {
    const { name, result, reason, hours } = req.body;

    if (!name || !result || !reason || !hours) {
      return res.status(400).json({ error: "جميع الحقول مطلوبة" });
    }

    const goalData = {
      name: String(name).trim(),
      result: String(result).trim(),
      reason: String(reason).trim(),
      hours: parseFloat(hours),
    };

    let plan;
    try {
      plan = await generatePlanWithGemini({
        goal: goalData.name,
        result: goalData.result,
        reason: goalData.reason,
        hours: goalData.hours,
      });
    } catch (aiError) {
      console.warn("فشل Gemini، استخدام الخطة الاحتياطية:", aiError.message);
      plan = getFallbackPlan(goalData);
    }

    const goalId = saveGoalWithPlan(goalData, plan);
    res.status(201).json({ id: goalId, message: "تم إنشاء الخطة بنجاح" });
  } catch (err) {
    console.error("خطأ في إنشاء الهدف:", err);
    res.status(500).json({ error: err.message || "حدث خطأ في الخادم" });
  }
});

/** جلب أحدث هدف */
app.get("/api/goals/latest", (req, res) => {
  const goal = getLatestGoal();
  if (!goal) return res.status(404).json({ error: "لا يوجد هدف بعد" });
  res.json(goal);
});

/** جلب هدف بالمعرّف */
app.get("/api/goals/:id", (req, res) => {
  const goal = getGoalById(req.params.id);
  if (!goal) return res.status(404).json({ error: "الهدف غير موجود" });
  res.json(goal);
});

/** لوحة التحكم — الأسابيع الـ 12 */
app.get("/api/goals/:id/dashboard", (req, res) => {
  const goal = getGoalById(req.params.id);
  if (!goal) return res.status(404).json({ error: "الهدف غير موجود" });

  const weeks = getWeeksWithProgress(req.params.id);
  const stats = getGoalStats(req.params.id);
  res.json({ goal, weeks, stats });
});

/** صفحة خطة 12 أسبوع — الأسابيع مع المهام */
app.get("/api/goals/:id/plan", (req, res) => {
  const goal = getGoalById(req.params.id);
  if (!goal) return res.status(404).json({ error: "الهدف غير موجود" });

  const weeks = getPlanWithTasks(req.params.id);
  const stats = getGoalStats(req.params.id);
  res.json({ goal, weeks, stats });
});

/** صفحة اليوم */
app.get("/api/goals/:id/today", (req, res) => {
  const data = getTodayTasks(req.params.id);
  if (!data.goal) return res.status(404).json({ error: "الهدف غير موجود" });

  const stats = getGoalStats(req.params.id);
  res.json({ ...data, stats });
});

/** الإحصائيات */
app.get("/api/goals/:id/stats", (req, res) => {
  const goal = getGoalById(req.params.id);
  if (!goal) return res.status(404).json({ error: "الهدف غير موجود" });
  res.json({ goal, stats: getGoalStats(req.params.id) });
});

/** تحديث مهمة */
app.patch("/api/tasks/:id", (req, res) => {
  const { completed, deferred, notes } = req.body;
  const task = updateTask(req.params.id, { completed, deferred, notes });
  if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });

  syncWeekCompletion(task.week_id);
  res.json(task);
});

/** تحديث حالة أسبوع */
app.patch("/api/weeks/:id", (req, res) => {
  const { completed } = req.body;
  const week = updateWeekCompletion(req.params.id, completed);
  if (!week) return res.status(404).json({ error: "الأسبوع غير موجود" });
  res.json(week);
});

// توجيه كل المسارات غير المعروفة إلى الواجهة الأمامية (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 12-Week Growth Platform يعمل على http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.warn("⚠️  GEMINI_API_KEY غير مُعرَّف — سيتم استخدام خطة احتياطية");
  }
});
