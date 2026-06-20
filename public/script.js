/**
 * script.js — الواجهة الأمامية (Vanilla JS)
 */

const app = document.getElementById("app");
const LOGO = "/assets/logo.jpeg";
let currentGoalId = localStorage.getItem("goalId");

// ─── عبارات تحفيزية ───
const MOTIVATIONAL_QUOTES = [
  "السنوات الطويلة تخدعنا؛ فهي تعطينا شعوراً كاذباً بأن لدينا الكثير من الوقت، مما يؤدي إلى التسويف.",
  "النجاح لا يأتي مما تفعله أحياناً، بل مما تفعله باستمرار. التركيز على 12 أسبوعاً يجعلك تلتزم بالفعل لا بالتخطيط.",
  "توقف عن محاولة القيام بكل شيء. اختر الأهداف التي ستحدث الفرق الأكبر، وركز عليها بكل قوتك.",
  "الخطة بدون تنفيذ مجرد أمنية. في الـ 12 أسبوعاً، لا وقت للأعذار؛ العمل هو المقياس الوحيد.",
  "لا يمكنك إدارة وقتك، يمكنك فقط إدارة أفعالك. ركز على أنشطتك الأكثر تأثيراً في كل أسبوع.",
  "الأداء العالي يتطلب التزاماً صارماً بالتنفيذ اليومي، وليس فقط رؤية بعيدة المدى.",
  "الانضباط هو الجسر بين الأهداف والإنجازات.",
  "عليك أن تتوقع حدوث العوائق، ولكن لا تجعلها سبباً للتوقف. في نظام الـ 12 أسبوعاً، كل أسبوع هو بداية جديدة لتعويض ما فاتك.",
  "أنت لست بحاجة إلى مزيد من الوقت، أنت بحاجة إلى مزيد من التركيز والانضباط في الوقت المتاح لديك.",
  "الرؤية بدون تنفيذ هي مجرد هلوسة.",
  "لا تنتظر بداية السنة الجديدة أو الشهر القادم لتبدأ؛ اعتبر أن اليوم هو بداية \"أسابيعك الـ 12\" الحاسمة، وابدأ بالعمل فوراً على الأهداف التي ستغير واقعك.",
];

// ─── أدوات مساعدة ───

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "حدث خطأ");
  return data;
}

function updateNav() {
  const show = !!currentGoalId;
  document.querySelectorAll(".nav-plan, .nav-today, .nav-stats").forEach((el) => {
    el.classList.toggle("hidden", !show);
  });
}

function progressBar(percent) {
  return `
    <div class="progress-wrap">
      <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
      <p class="progress-label">${percent}% مكتمل</p>
    </div>`;
}

function loading() {
  app.innerHTML = `<div class="loading"><div class="spinner"></div><p style="margin-top:1rem">جاري التحميل...</p></div>`;
}

/** عبارة واحدة — تُستخدم في كل الصفحات */
function quoteBanner(index, label = "💡 تذكير") {
  const q = MOTIVATIONAL_QUOTES[index % MOTIVATIONAL_QUOTES.length];
  return `
    <div class="quote-banner">
      <span class="quote-label">${label}</span>
      <p>${q}</p>
    </div>`;
}

/** عرض احتفال بإنجاز أسبوع (مرة واحدة لكل أسبوع) */
function showWeekCelebration(weekNumber) {
  const key = `celebrated_${currentGoalId}_w${weekNumber}`;
  if (localStorage.getItem(key)) return;

  const quote = MOTIVATIONAL_QUOTES[(weekNumber - 1) % MOTIVATIONAL_QUOTES.length];
  const modal = document.createElement("div");
  modal.className = "celebration-modal";
  modal.innerHTML = `
    <div class="celebration-box">
      <div class="celebration-icon">🎉</div>
      <h2>أحسنت! أنجزت الأسبوع ${weekNumber}</h2>
      <p class="celebration-quote">${quote}</p>
      <button class="btn btn-primary" id="closeCelebration">واصل التقدم</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector("#closeCelebration").onclick = () => {
    localStorage.setItem(key, "1");
    modal.remove();
  };
}

/** تدوير عبارة في الرئيسية فقط */
function initHomeQuoteRotation() {
  const textEl = document.getElementById("homeQuote");
  if (!textEl) return;
  let i = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  textEl.textContent = MOTIVATIONAL_QUOTES[i];
  setInterval(() => {
    i = (i + 1) % MOTIVATIONAL_QUOTES.length;
    textEl.style.opacity = "0";
    setTimeout(() => {
      textEl.textContent = MOTIVATIONAL_QUOTES[i];
      textEl.style.opacity = "1";
    }, 300);
  }, 8000);
}

// ─── 1. الصفحة الرئيسية ───
function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="hero-badge"><span class="dot"></span> The 12 Week Year</div>
        <h1>حوّل <span>12 أسبوعاً</span> إلى سنة كاملة من الإنجاز</h1>
        <p>
          بدلاً من الأهداف السنوية البعيدة، ساعدك هذه المنصة على تحويل هدفك الكبير
          إلى خطة عملية واضحة لمدة 12 أسبوعاً — مهمة تلو الأخرى.
        </p>
        <div class="hero-actions">
          <a href="#/create" class="btn btn-primary">ابدأ التخطيط</a>
          <a href="#about" class="btn btn-outline">كيف يعمل؟</a>
        </div>
      </div>
      <div class="hero-visual">
        <img src="${LOGO}" alt="12 Week of Year" />
      </div>
    </section>

    ${quoteBanner(0, "✦ عبارة اليوم")}

    <section id="about">
      <h2 class="section-title">الفكرة ببساطة</h2>
      <p class="section-desc">
        مستوحى من كتاب The 12 Week Year — نضغّط سنة كاملة من التخطيط في 12 أسبوعاً
        مع أهداف أسبوعية ومهام يومية قابلة للقياس.
      </p>
      <div class="method-grid">
        ${[
          { n: "01", t: "حدّد هدفك", d: "اسم الهدف، النتيجة المطلوبة، السبب، والوقت المتاح." },
          { n: "02", t: "خطة ذكية", d: "الذكاء الاصطناعي يقسّم هدفك إلى 12 أسبوعاً بمهام واضحة." },
          { n: "03", t: "نفّذ يومياً", d: "تابع مهامك، سجّل تقدمك، وراقب إنجازك أسبوعاً بعد أسبوع." },
        ]
          .map(
            (s) => `
          <div class="method-card">
            <div class="method-num">${s.n}</div>
            <h3>${s.t}</h3>
            <p>${s.d}</p>
          </div>`
          )
          .join("")}
      </div>
      <div class="text-center">
        <a href="#/create" class="btn btn-primary">ابدأ التخطيط الآن</a>
      </div>
    </section>

    <div class="quote-banner quote-banner-dark">
      <span class="quote-label">✦ تحفيز</span>
      <p id="homeQuote"></p>
    </div>
  `;
  initHomeQuoteRotation();
}

// ─── 2. صفحة إنشاء الهدف ───
function renderCreate() {
  app.innerHTML = `
    ${quoteBanner(10, "✦ قبل أن تبدأ")}
    <div class="page-header text-center">
      <h1>إنشاء هدف جديد</h1>
      <p>أدخل تفاصيل هدفك وسنُنشئ خطة 12 أسبوعاً بالذكاء الاصطناعي</p>
    </div>
    <form id="goalForm" class="form-card">
      <div class="form-group">
        <label>اسم الهدف</label>
        <input type="text" name="name" required placeholder="مثال: تعلّم تطوير الويب" />
      </div>
      <div class="form-group">
        <label>النتيجة المطلوبة</label>
        <textarea name="result" rows="2" required placeholder="ماذا تريد أن تحقق بعد 12 أسبوعاً؟"></textarea>
      </div>
      <div class="form-group">
        <label>سبب الهدف</label>
        <textarea name="reason" rows="2" required placeholder="لماذا هذا الهدف مهم لك؟"></textarea>
      </div>
      <div class="form-group">
        <label>عدد الساعات المتاحة أسبوعياً</label>
        <input type="number" name="hours" id="hoursInput" required min="1" max="168" step="0.5" value="20" />
        <p class="form-hint" id="hoursPreview">20 ساعة = 4 أيام عمل × 5 س/يوم + 3 أيام راحة</p>
      </div>
      <div id="formError" class="alert hidden"></div>
      <button type="submit" class="btn btn-primary" id="submitBtn" style="width:100%">
        إنشاء خطة 12 أسبوع
      </button>
    </form>
    ${quoteBanner(2, "✦ ركّز")}
  `;

  function updateHoursPreview() {
    const h = parseFloat(document.getElementById("hoursInput").value) || 0;
    const workDays = Math.min(5, Math.max(2, Math.round(h / 5)));
    const perDay = Math.round((h / workDays) * 10) / 10;
    const rest = 7 - workDays;
    document.getElementById("hoursPreview").textContent =
      `${h} ساعة = ${workDays} أيام عمل × ${perDay} س/يوم + ${rest} أيام راحة`;
  }
  document.getElementById("hoursInput").addEventListener("input", updateHoursPreview);
  updateHoursPreview();

  document.getElementById("goalForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submitBtn");
    const errEl = document.getElementById("formError");
    const fd = new FormData(e.target);

    btn.disabled = true;
    btn.textContent = "جاري التوليد بالذكاء الاصطناعي...";
    errEl.classList.add("hidden");

    try {
      const result = await api("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          result: fd.get("result"),
          reason: fd.get("reason"),
          hours: fd.get("hours"),
        }),
      });

      currentGoalId = String(result.id);
      localStorage.setItem("goalId", currentGoalId);
      updateNav();
      location.hash = "#/plan";
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "إنشاء خطة 12 أسبوع";
    }
  });
}

// ─── 3. صفحة خطة 12 أسبوع ───
function renderWeekSchedule(workDays, hoursPerDay, tasks) {
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  let html = `<div class="week-schedule">`;
  for (let d = 1; d <= 7; d++) {
    const dayTasks = tasks.filter((t) => t.day_in_week === d);
    const isWork = d <= workDays;
    html += `
      <div class="schedule-day ${isWork ? "work" : "rest"} ${dayTasks.some(t=>t.completed)?"has-done":""}">
        <div class="schedule-day-head">
          <span>${dayNames[d - 1] || "يوم " + d}</span>
          <span class="schedule-tag">${isWork ? hoursPerDay + " س" : "راحة"}</span>
        </div>
        ${dayTasks.length
          ? dayTasks.map(t => `<p class="schedule-task ${t.completed?"done":""}">${t.completed?"✔ ":""}${cleanDisplayTitle(t.title)}</p>`).join("")
          : `<p class="schedule-empty">${isWork ? "—" : "🌿"}</p>`}
      </div>`;
  }
  html += `</div>`;
  return html;
}

function cleanDisplayTitle(title) {
  return String(title).replace(/\s*\([\d.]+\s*س\s*—[^)]*\)\s*$/u, "").trim();
}

async function renderPlan() {
  if (!currentGoalId) { location.hash = "#/create"; return; }
  loading();

  try {
    const { goal, weeks, stats, workDays, hoursPerDay, restDays } =
      await api(`/api/goals/${currentGoalId}/plan`);
    const activeWeek = weeks.find((w) => {
      const pct = w.total_tasks > 0 ? (w.completed_tasks / w.total_tasks) * 100 : 0;
      return pct < 100;
    });
    const weekNum = activeWeek ? activeWeek.week_number : 12;

    app.innerHTML = `
      ${quoteBanner(weekNum - 1, `✦ الأسبوع ${weekNum}`)}
      <div class="page-header">
        <h1>خطة 12 أسبوع</h1>
        <p>الهدف: <strong>${goal.name}</strong> — ${goal.result}</p>
        <div class="schedule-summary">
          <span>📅 ${workDays} أيام عمل</span>
          <span>⏱ ${hoursPerDay} س/يوم</span>
          <span>🌿 ${restDays} أيام راحة</span>
          <span>📊 ${goal.hours} س/أسبوع</span>
        </div>
        <div style="max-width:400px;margin-top:0.75rem">${progressBar(stats.progressPercent)}</div>
      </div>

      <div class="page-actions">
        <a href="#/today" class="btn btn-primary btn-sm">مهام اليوم</a>
        <a href="#/stats" class="btn btn-outline btn-sm">الإحصائيات</a>
      </div>

      <div id="weeksList">
        ${weeks
          .map((w) => {
            const pct = w.total_tasks > 0 ? Math.round((w.completed_tasks / w.total_tasks) * 100) : 0;
            const isDone = w.completed || pct === 100;
            return `
            <div class="week-card ${isDone ? "done" : ""}" data-week-id="${w.id}" data-week-num="${w.week_number}">
              <div class="week-header">
                <div>
                  <span class="week-badge">الأسبوع ${w.week_number}</span>
                  <h3 class="week-title">${w.title}</h3>
                </div>
                <div style="min-width:120px">${progressBar(pct)}</div>
              </div>
              ${isDone ? `<div class="week-done-quote">${MOTIVATIONAL_QUOTES[(w.week_number - 1) % MOTIVATIONAL_QUOTES.length]}</div>` : ""}
              ${renderWeekSchedule(workDays, hoursPerDay, w.tasks)}
              <ul class="task-list">
                ${w.tasks
                  .map(
                    (t) => `
                  <li class="${t.completed ? "done" : ""}">
                    <input type="checkbox" class="task-check" data-id="${t.id}"
                      ${t.completed ? "checked" : ""} />
                    <span class="task-day-badge">يوم ${t.day_in_week}</span>
                    <span class="task-text">${cleanDisplayTitle(t.title)}</span>
                    <span class="task-hours">${hoursPerDay} س</span>
                  </li>`
                  )
                  .join("")}
              </ul>
            </div>`;
          })
          .join("")}
      </div>
    `;

    document.querySelectorAll(".task-check").forEach((cb) => {
      cb.addEventListener("change", async (e) => {
        const weekCard = e.target.closest(".week-card");
        const weekNum = Number(weekCard.dataset.weekNum);
        const completed = e.target.checked;

        await api(`/api/tasks/${e.target.dataset.id}`, {
          method: "PATCH",
          body: JSON.stringify({ completed }),
        });

        if (completed) {
          const checks = weekCard.querySelectorAll(".task-check");
          const allDone = [...checks].every((c) => c.checked);
          if (allDone) showWeekCelebration(weekNum);
        }

        renderPlan();
      });
    });
  } catch (err) {
    app.innerHTML = `<div class="alert">${err.message}</div>`;
  }
}

// ─── 4. صفحة اليوم ───
async function renderToday() {
  if (!currentGoalId) { location.hash = "#/create"; return; }
  loading();

  try {
    const data = await api(`/api/goals/${currentGoalId}/today`);
    const tasks = data.tasks ?? [];
    const deferredTasks = data.deferredTasks ?? [];
    const carryOverTasks = data.carryOverTasks ?? [];
    const {
      goal, programDay, currentWeek, dayInWeek,
      daysRemaining, stats,
      workDays = 4, hoursPerDay = 5, restDays = 3, isRestDay = false,
    } = data;

    const todayTasks = [...tasks];
    const extraTasks = [...deferredTasks, ...carryOverTasks.filter(
      (c) => !deferredTasks.some((d) => d.id === c.id) && !tasks.some((t) => t.id === c.id)
    )];

    let tasksHtml;
    if (isRestDay && todayTasks.length === 0 && extraTasks.length === 0) {
      tasksHtml = `<p class="rest-day-msg">🌿 يوم راحة — ${workDays} أيام عمل + ${restDays} أيام راحة في الأسبوع</p>`;
    } else {
      if (todayTasks.length > 0) {
        tasksHtml = `<h3 class="today-section-title">مهام اليوم (${hoursPerDay} س)</h3>`;
        tasksHtml += todayTasks.map((t) => renderTaskCard(t, false)).join("");
      }
      if (extraTasks.length > 0) {
        tasksHtml = (tasksHtml || "") + `<h3 class="today-section-title">مهام متأخرة</h3>`;
        tasksHtml += extraTasks.map((t) => renderTaskCard(t, true)).join("");
      }
      if (!tasksHtml) {
        tasksHtml = `<p style="color:var(--muted)">لا توجد مهام لهذا اليوم.</p>`;
      }
    }

    function renderTaskCard(t, isLate) {
      return `
        <div class="task-item ${t.completed ? "done" : ""} ${t.deferred ? "deferred" : ""}">
          <strong>${cleanDisplayTitle(t.title)}</strong>
          <p style="color:var(--muted);font-size:0.85rem;margin-top:0.25rem">
            ${t.week_title}${isLate ? " — متأخرة" : ""} · ${hoursPerDay} س
          </p>
          <div class="task-actions">
            <button class="btn btn-primary btn-sm complete-btn" data-id="${t.id}">✔ إنجاز</button>
            <button class="btn btn-outline btn-sm defer-btn" data-id="${t.id}">تأجيل</button>
          </div>
          <textarea class="notes-input" rows="2" placeholder="ملاحظات..."
            data-id="${t.id}">${t.notes || ""}</textarea>
        </div>`;
    }

    app.innerHTML = `
      ${quoteBanner(currentWeek - 1, `✦ تحفيز الأسبوع ${currentWeek}`)}
      <div class="today-grid">
        <div>
          <div class="page-header">
            <h1>مهام اليوم</h1>
            <p>اليوم ${programDay} من 84 — الأسبوع ${currentWeek}، يوم ${dayInWeek} من ${workDays} أيام عمل</p>
            ${!isRestDay ? `<p class="hours-today">${hoursPerDay} ساعات مخططة لهذا اليوم</p>` : ""}
          </div>
          ${tasksHtml}
        </div>

        <aside class="sidebar-card">
          <h3>ملخص اليوم</h3>
          <p style="font-size:0.85rem;color:var(--muted)">الأيام المتبقية</p>
          <div class="stat-big">${daysRemaining}</div>
          <hr style="margin:1rem 0;border-color:var(--border)" />
          <p style="font-size:0.85rem;color:var(--muted)">ساعات اليوم</p>
          <div class="stat-big" style="font-size:1.5rem">${isRestDay ? "—" : hoursPerDay + " س"}</div>
          <hr style="margin:1rem 0;border-color:var(--border)" />
          <p style="font-size:0.85rem;color:var(--muted)">نسبة الإنجاز</p>
          ${progressBar(stats.progressPercent)}
          <hr style="margin:1rem 0;border-color:var(--border)" />
          <p style="font-size:0.85rem;color:var(--muted)">الهدف: ${goal.name}</p>
          <div class="quote-sidebar">${MOTIVATIONAL_QUOTES[programDay % MOTIVATIONAL_QUOTES.length]}</div>
        </aside>
      </div>
    `;

    document.querySelectorAll(".complete-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleTaskAction(btn.dataset.id, "complete"));
    });
    document.querySelectorAll(".defer-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleTaskAction(btn.dataset.id, "defer"));
    });
    document.querySelectorAll(".notes-input").forEach((ta) => {
      ta.addEventListener("blur", () => saveNotes(ta.dataset.id, ta.value));
    });
  } catch (err) {
    app.innerHTML = `<div class="alert">${err.message}</div>`;
  }
}

async function handleTaskAction(taskId, action) {
  const body = action === "complete" ? { completed: true } : { deferred: true };
  await api(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(body) });
  renderToday();
}

async function saveNotes(taskId, notes) {
  await api(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ notes }) });
}

// ─── 5. لوحة الإحصائيات ───
async function renderStats() {
  if (!currentGoalId) { location.hash = "#/create"; return; }
  loading();

  try {
    const { goal, stats } = await api(`/api/goals/${currentGoalId}/stats`);
    const quoteIdx = Math.min(10, Math.floor(stats.progressPercent / 10));

    app.innerHTML = `
      <div class="page-header">
        <h1>لوحة الإحصائيات</h1>
        <p>الهدف: ${goal.name}</p>
      </div>

      ${quoteBanner(quoteIdx, "✦ استمر")}

      <div class="stats-grid">
        <div class="stat-card">
          <div class="value red">${stats.progressPercent}%</div>
          <div class="label">نسبة الإنجاز الكلية</div>
        </div>
        <div class="stat-card">
          <div class="value">${stats.completedTasks}</div>
          <div class="label">مهام مكتملة</div>
        </div>
        <div class="stat-card">
          <div class="value">${stats.remainingTasks}</div>
          <div class="label">مهام متبقية</div>
        </div>
        <div class="stat-card">
          <div class="value">${stats.deferredTasks}</div>
          <div class="label">مهام مؤجّلة</div>
        </div>
      </div>

      <div class="chart-box">
        <h3>التقدم الأسبوعي</h3>
        ${stats.weeklyStats
          .map((w) => {
            const pct = w.total > 0 ? Math.round((w.completed / w.total) * 100) : 0;
            return `
            <div class="bar-row">
              <span class="bar-label">أسبوع ${w.week_number}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
              <span class="bar-pct">${pct}%</span>
            </div>`;
          })
          .join("")}
      </div>

      <div class="chart-box">
        <h3>نظرة عامة</h3>
        <canvas id="overviewChart" height="200"></canvas>
      </div>

      ${quoteBanner(6, "✦ تذكير")}
    `;

    drawOverviewChart(stats);
  } catch (err) {
    app.innerHTML = `<div class="alert">${err.message}</div>`;
  }
}

function drawOverviewChart(stats) {
  const canvas = document.getElementById("overviewChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth - 48;
  canvas.width = w * dpr;
  canvas.height = 200 * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = "200px";
  ctx.scale(dpr, dpr);

  const cx = w / 2;
  const cy = 90;
  const r = Math.min(65, w / 4);
  const total = stats.totalTasks || 1;

  const slices = [
    { value: stats.completedTasks, color: "#8b1a1a", label: "مكتملة" },
    { value: stats.remainingTasks - stats.deferredTasks, color: "#0a0a0a", label: "متبقية" },
    { value: stats.deferredTasks, color: "#9ca3af", label: "مؤجّلة" },
  ].filter((s) => s.value > 0);

  let angle = -Math.PI / 2;
  slices.forEach((s) => {
    const slice = (s.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    angle += slice;
  });

  ctx.fillStyle = "#0a0a0a";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${stats.progressPercent}%`, cx, cy + 7);

  let lx = 16;
  slices.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(lx, 168, 12, 12);
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${s.label} (${s.value})`, lx + 16, 178);
    lx += 110;
  });
}

// ─── التوجيه ───

const routes = {
  "/": renderHome,
  "/create": renderCreate,
  "/plan": renderPlan,
  "/dashboard": renderPlan,
  "/today": renderToday,
  "/stats": renderStats,
};

function router() {
  const hash = location.hash.slice(1) || "/";
  (routes[hash] || renderHome)();
  updateNav();
  document.getElementById("siteNav")?.classList.remove("open");
}

window.addEventListener("hashchange", router);
document.getElementById("navToggle")?.addEventListener("click", () => {
  document.getElementById("siteNav").classList.toggle("open");
});

async function init() {
  if (!currentGoalId) {
    try {
      const goal = await api("/api/goals/latest");
      currentGoalId = String(goal.id);
      localStorage.setItem("goalId", currentGoalId);
    } catch { /* لا يوجد هدف */ }
  }
  router();
}

init();
