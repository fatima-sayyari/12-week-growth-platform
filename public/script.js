/**
 * script.js — الواجهة الأمامية (Vanilla JS)
 */

const app = document.getElementById("app");
const LOGO = "/assets/logo.jpeg";
let currentGoalId = localStorage.getItem("goalId");
let userName = localStorage.getItem("userName") || "";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let revealObserver;
let counterObserver;

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

const REST_LABELS = ["🌿 راحة", "✨ استرخِ", "💆 تعافٍ", "🧘 توازن"];

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

function quoteBanner(index, label = "💡 تذكير") {
  const q = MOTIVATIONAL_QUOTES[index % MOTIVATIONAL_QUOTES.length];
  return `
    <div class="quote-banner animate-in">
      <span class="quote-label">${label}</span>
      <p>${q}</p>
    </div>`;
}

function showWeekCelebration(weekNumber) {
  const key = `celebrated_${currentGoalId}_w${weekNumber}`;
  if (localStorage.getItem(key)) return;

  const quote = MOTIVATIONAL_QUOTES[(weekNumber - 1) % MOTIVATIONAL_QUOTES.length];
  const modal = document.createElement("div");
  modal.className = "celebration-modal";
  modal.innerHTML = `
    <div class="celebration-box animate-in">
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

function cleanDisplayTitle(title) {
  return String(title).replace(/\s*\([\d.]+\s*س\s*—[^)]*\)\s*$/u, "").trim();
}

function getDisplayName(goal) {
  return goal?.user_name || userName || "بطل";
}

function initPageEnhancements() {
  initScrollReveal();
  initTiltCards();
  initMagneticButtons();
  initCounterAnimations();
  initHeroPointerGlow();
}

function collectInteractiveElements() {
  const revealSelectors = [
    ".hero-content",
    ".hero-visual",
    ".impact-card",
    ".method-card",
    ".timeline-item",
    ".quote-banner",
    ".create-intro",
    ".form-card",
    ".week-card",
    ".task-item",
    ".stat-card",
    ".chart-box",
    ".sidebar-card",
    ".rest-day-card",
  ];

  document.querySelectorAll(revealSelectors.join(",")).forEach((el) => {
    if (!el.hasAttribute("data-reveal")) el.setAttribute("data-reveal", "");
  });

  const tiltSelectors = [".impact-card", ".method-card", ".stat-card", ".chart-box", ".timeline-item"];
  document.querySelectorAll(tiltSelectors.join(",")).forEach((el) => {
    if (!el.hasAttribute("data-tilt")) el.setAttribute("data-tilt", "");
  });
}

function initScrollReveal() {
  collectInteractiveElements();
  const items = document.querySelectorAll("[data-reveal]");
  if (!items.length) return;

  if (prefersReducedMotion) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
  }

  items.forEach((el, idx) => {
    if (el.dataset.revealInit) return;
    el.dataset.revealInit = "1";
    el.style.setProperty("--reveal-delay", `${Math.min(idx * 65, 450)}ms`);
    revealObserver.observe(el);
  });
}

function initTiltCards() {
  if (prefersReducedMotion) return;

  document.querySelectorAll("[data-tilt]").forEach((card) => {
    if (card.dataset.tiltInit) return;
    card.dataset.tiltInit = "1";

    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * 7;
      const ry = (px - 0.5) * 7;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}

function initMagneticButtons() {
  if (prefersReducedMotion) return;

  document.querySelectorAll(".hero-actions .btn, .hero-actions-strong .btn, #submitBtn").forEach((btn) => {
    if (btn.dataset.magneticInit) return;
    btn.dataset.magneticInit = "1";
    btn.classList.add("magnetic-btn");

    btn.addEventListener("pointermove", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
    });

    btn.addEventListener("pointerleave", () => {
      btn.style.transform = "";
    });
  });
}

function animateCounter(el, target) {
  const duration = 1200;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    const value = Math.round(target * eased);
    el.textContent = value.toLocaleString("ar");
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function initCounterAnimations() {
  const counters = document.querySelectorAll("[data-counter]");
  if (!counters.length) return;

  if (prefersReducedMotion) {
    counters.forEach((el) => {
      const target = Number(el.dataset.counter || 0);
      el.textContent = Number.isFinite(target) ? target.toLocaleString("ar") : el.textContent;
    });
    return;
  }

  if (!counterObserver) {
    counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.dataset.counterAnimated) return;
          el.dataset.counterAnimated = "1";
          animateCounter(el, Number(el.dataset.counter || 0));
          counterObserver.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
  }

  counters.forEach((el) => {
    if (!el.dataset.counterInit) {
      el.dataset.counterInit = "1";
      counterObserver.observe(el);
    }
  });
}

function initHeroPointerGlow() {
  const hero = document.querySelector(".hero-immersive");
  if (!hero || hero.dataset.glowInit) return;
  hero.dataset.glowInit = "1";
  if (prefersReducedMotion) return;

  hero.addEventListener("pointermove", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    hero.style.setProperty("--mx", `${x}%`);
    hero.style.setProperty("--my", `${y}%`);
    hero.classList.add("pointer-active");
  });

  hero.addEventListener("pointerleave", () => {
    hero.classList.remove("pointer-active");
  });
}

// ─── الوضع الداكن ───
function initTheme() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      toggle.textContent = "☀️";
    } else {
      document.documentElement.removeAttribute("data-theme");
      toggle.textContent = "🌙";
    }
  }

  applyTheme(localStorage.getItem("theme") || "light");
  toggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyTheme(next);
  });
}

// ─── 1. الصفحة الرئيسية ───
function renderHome() {
  app.innerHTML = `
    <section class="hero hero-immersive animate-in">
      <div class="hero-aurora"></div>
      <div class="hero-content">
        <div class="hero-badge pulse-ring"><span class="dot"></span> منصة 12-Week Growth Platform</div>
        <h1>خطة تنقلك من <span>التفكير</span> إلى <span>الإنجاز الحقيقي</span> خلال 12 أسبوعاً</h1>
        <p>
          تجربة تخطيط ذكية ومكثفة تحوّل هدفك الكبير إلى خطوات أسبوعية قابلة للتنفيذ،
          مع متابعة يومية تشدّك للاستمرار.
        </p>
        <div class="form-group hero-name-input">
          <label for="userNameInput">اسمك (لإضفاء طابع شخصي)</label>
          <input type="text" id="userNameInput" placeholder="مثال: فاطمة" value="${userName}" class="shadow-sm" />
        </div>
        <div class="hero-actions hero-actions-strong">
          <a href="#/create" class="btn btn-primary">ابدأ التخطيط</a>
          <a href="#about" class="btn btn-outline">استكشف التجربة</a>
        </div>
        <div class="hero-mini-metrics">
          <div><strong data-counter="12">0</strong><span>أسبوع تركيز</span></div>
          <div><strong data-counter="84">0</strong><span>يوم تنفيذ</span></div>
          <div><strong>∞</strong><span>إمكانية التطوير</span></div>
        </div>
      </div>
      <div class="hero-visual hero-visual-card rounded-4 shadow-sm">
        <div class="logo-glow-wrap">
          <img src="${LOGO}" alt="12 Week of Year" />
        </div>
        <p class="hero-visual-caption">"لا تنتظر السنة القادمة... اصنع نقلة هذا الأسبوع."</p>
      </div>
    </section>

    <section class="impact-strip animate-in">
      <article class="impact-card">
        <h3>🎯 هدف واضح</h3>
        <p>عرّفي ما تريدين الوصول إليه بلغة نتيجة قابلة للقياس.</p>
      </article>
      <article class="impact-card">
        <h3>🧠 خطة ذكية</h3>
        <p>الذكاء الاصطناعي يبني لك خارطة 12 أسبوعاً بمهام عملية.</p>
      </article>
      <article class="impact-card">
        <h3>⚡ تنفيذ يومي</h3>
        <p>تابعي يومك، أنجزي، أجّلي عند الحاجة، وراقبي نسبة التقدم.</p>
      </article>
    </section>

    ${quoteBanner(0, "✦ شرارة اليوم")}

    <section id="about">
      <h2 class="section-title">الفكرة ببساطة</h2>
      <p class="section-desc">
        مستوحى من كتاب The 12 Week Year — نضعك داخل دورة تركيز قصيرة لكنها عالية التأثير،
        حيث كل أسبوع له دور واضح في تحقيق النتيجة النهائية.
      </p>
      <div class="method-grid method-grid-premium">
        ${[
          { n: "01", t: "حدّد هدفك", d: "اكتب الهدف والنتيجة والسبب وساعاتك المتاحة." },
          { n: "02", t: "احصل على خارطة 12 أسبوع", d: "خطة أسبوعية مركزة مع مهام مرتبة ومنطقية." },
          { n: "03", t: "حوّل الانضباط إلى عادة", d: "لوحة يومية + نسب تقدم + إحصائيات تحفزك للاستمرار." },
        ]
          .map(
            (s) => `
          <div class="method-card animate-in">
            <div class="method-num">${s.n}</div>
            <h3>${s.t}</h3>
            <p>${s.d}</p>
          </div>`
          )
          .join("")}
      </div>

      <div class="timeline-lite">
        <div class="timeline-item"><span>الأسبوع 1-4</span><p>تأسيس العادات وبناء الزخم</p></div>
        <div class="timeline-item"><span>الأسبوع 5-8</span><p>تسريع الأداء والتطبيق العملي</p></div>
        <div class="timeline-item"><span>الأسبوع 9-12</span><p>الإنهاء، الإطلاق، وحصد النتيجة</p></div>
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

  const nameInput = document.getElementById("userNameInput");
  nameInput?.addEventListener("input", () => {
    userName = nameInput.value.trim();
    localStorage.setItem("userName", userName);
  });

  initHomeQuoteRotation();
  initPageEnhancements();
}

// ─── 2. صفحة إنشاء الهدف ───
function renderCreate() {
  app.innerHTML = `
    ${quoteBanner(10, "✦ قبل الانطلاق")}
    <section class="create-layout animate-in">
      <div class="create-intro">
        <h1>صمّمي هدفك التالي بثقة</h1>
        <p>
          هذه الخطوة هي أهم قرار: كلما كان الهدف واضحًا، كانت الخطة أذكى والتنفيذ أسرع.
          اكتبي التفاصيل وسنحوّلها مباشرةً إلى خارطة 12 أسبوع.
        </p>
        <div class="create-tips">
          <div>✅ اكتبي النتيجة كأنها حدثت بالفعل</div>
          <div>✅ اجعلي السبب شخصيًا ومحفزًا</div>
          <div>✅ كوني واقعية في عدد الساعات</div>
        </div>
      </div>

      <form id="goalForm" class="form-card animate-in p-4 p-md-5 rounded-4 shadow-sm">
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
        <div class="form-row">
          <div class="form-group">
            <label>عدد الساعات المتاحة أسبوعياً</label>
            <input type="number" name="hours" id="hoursInput" required min="1" max="168" step="0.5" value="20" />
          </div>
          <div class="form-group">
            <label>أيام العمل في الأسبوع</label>
            <select name="work_days" id="workDaysInput">
              <option value="5" selected>5 أيام (يومان راحة)</option>
              <option value="4">4 أيام (3 أيام راحة)</option>
              <option value="3">3 أيام (4 أيام راحة)</option>
              <option value="6">6 أيام (يوم راحة)</option>
              <option value="2">2 أيام (5 أيام راحة)</option>
            </select>
          </div>
        </div>
        <p class="form-hint" id="hoursPreview">20 ساعة = 5 أيام عمل × 4 س/يوم + 2 أيام راحة</p>
        <div class="form-completion">
          <div class="form-completion-track">
            <div id="formCompletionBar" class="form-completion-fill" style="width:0%"></div>
          </div>
          <p id="formCompletionText" class="form-completion-text">جاهزية الخطة: 0%</p>
        </div>
        <div id="formError" class="alert alert-danger hidden"></div>
        <button type="submit" class="btn btn-primary w-100" id="submitBtn">
          إنشاء خطة 12 أسبوع
        </button>
      </form>
    </section>
    ${quoteBanner(2, "✦ ركّز")}
  `;

  function updateHoursPreview() {
    const h = parseFloat(document.getElementById("hoursInput").value) || 0;
    const workDays = itemsWorkDays();
    const perDay = workDays > 0 ? Math.round((h / workDays) * 10) / 10 : 0;
    const rest = 7 - workDays;
    document.getElementById("hoursPreview").textContent =
      `${h} ساعة = ${workDays} أيام عمل × ${perDay} س/يوم + ${rest} ${rest === 1 ? "يوم راحة" : "أيام راحة"}`;
  }

  function itemsWorkDays() {
    return parseInt(document.getElementById("workDaysInput").value) || 5;
  }

  document.getElementById("hoursInput").addEventListener("input", updateHoursPreview);
  document.getElementById("workDaysInput").addEventListener("change", updateHoursPreview);
  updateHoursPreview();

  const goalForm = document.getElementById("goalForm");
  const completionBar = document.getElementById("formCompletionBar");
  const completionText = document.getElementById("formCompletionText");
  const tracked = ["name", "result", "reason", "hours"];
  function updateFormCompletion() {
    const fd = new FormData(goalForm);
    const done = tracked.filter((k) => String(fd.get(k) || "").trim().length > 0).length;
    const pct = Math.round((done / tracked.length) * 100);
    completionBar.style.width = `${pct}%`;
    completionText.textContent = `جاهزية الخطة: ${pct}%`;
  }
  goalForm.querySelectorAll("input, textarea, select").forEach((el) => {
    el.addEventListener("input", updateFormCompletion);
    el.addEventListener("change", updateFormCompletion);
  });
  updateFormCompletion();

  goalForm.addEventListener("submit", async (e) => {
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
          work_days: fd.get("work_days"),
          user_name: userName,
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

  initPageEnhancements();
}

// ─── 3. صفحة خطة 12 أسبوع ───
function renderWeekSchedule(workDays, hoursPerDay, tasks) {
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  let html = `<div class="week-schedule">`;
  for (let d = 1; d <= 7; d++) {
    const dayTasks = tasks.filter((t) => t.day_in_week === d);
    const isWork = d <= workDays;
    html += `
      <div class="schedule-day ${isWork ? "work" : "rest"} ${dayTasks.some((t) => t.completed) ? "has-done" : ""} animate-in">
        <div class="schedule-day-head">
          <span>${dayNames[d - 1] || "يوم " + d}</span>
          <span class="schedule-tag">${isWork ? hoursPerDay + " س" : REST_LABELS[(d - 1) % REST_LABELS.length]}</span>
        </div>
        ${dayTasks.length
          ? dayTasks.map((t) => `<p class="schedule-task ${t.completed ? "done" : ""}">${t.completed ? "✔ " : ""}${cleanDisplayTitle(t.title)}</p>`).join("")
          : `<p class="schedule-empty">${isWork ? "—" : "🌿"}</p>`}
      </div>`;
  }
  html += `</div>`;
  return html;
}

function exportPlanPdf() {
  window.print();
}

async function renderPlan() {
  if (!currentGoalId) { location.hash = "#/create"; return; }
  loading();

  try {
    const { goal, weeks, stats, workDays, hoursPerDay, restDays } =
      await api(`/api/goals/${currentGoalId}/plan`);

    if (goal.user_name) {
      userName = goal.user_name;
      localStorage.setItem("userName", userName);
    }

    const programDay = Math.min(Math.max(
      Math.floor((Date.now() - new Date(goal.start_date + "T00:00:00")) / 86400000) + 1,
      1
    ), 84);

    const activeWeek = weeks.find((w) => {
      const pct = w.total_tasks > 0 ? (w.completed_tasks / w.total_tasks) * 100 : 0;
      return pct < 100;
    });
    const weekNum = activeWeek ? activeWeek.week_number : 12;
    const displayName = getDisplayName(goal);

    app.innerHTML = `
      ${quoteBanner(weekNum - 1, `✦ الأسبوع ${weekNum}`)}
      <div class="page-header animate-in">
        <p class="greeting-text">مرحباً <strong>${displayName}</strong>، أنت في اليوم <strong>${programDay}</strong> من 84</p>
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

      <div class="page-actions no-print">
        <a href="#/today" class="btn btn-primary btn-sm">مهام اليوم</a>
        <a href="#/stats" class="btn btn-outline btn-sm">الإحصائيات</a>
        <button class="btn btn-outline btn-sm" id="exportPdfBtn">📄 تصدير الخطة كـ PDF</button>
      </div>

      <div id="weeksList" class="print-area">
        ${weeks
          .map((w, idx) => {
            const pct = w.total_tasks > 0 ? Math.round((w.completed_tasks / w.total_tasks) * 100) : 0;
            const isDone = w.completed || pct === 100;
            return `
            <div class="week-card ${isDone ? "done" : ""} animate-in shadow-sm" style="animation-delay:${idx * 0.05}s"
              data-week-id="${w.id}" data-week-num="${w.week_number}">
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
                  <li class="${t.completed ? "done task-complete-anim" : ""}">
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

    document.getElementById("exportPdfBtn")?.addEventListener("click", exportPlanPdf);

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
          e.target.closest("li")?.classList.add("task-complete-anim");
          const checks = weekCard.querySelectorAll(".task-check");
          const allDone = [...checks].every((c) => c.checked);
          if (allDone) showWeekCelebration(weekNum);
        }

        renderPlan();
      });
    });
    initPageEnhancements();
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
      workDays = 5, hoursPerDay = 4, restDays = 2,
      isRestDay = false, restDayContent = null,
    } = data;

    const displayName = getDisplayName(goal);
    const todayTasks = [...tasks];
    const extraTasks = [...deferredTasks, ...carryOverTasks.filter(
      (c) => !deferredTasks.some((d) => d.id === c.id) && !tasks.some((t) => t.id === c.id)
    )];

    let tasksHtml;

    if (isRestDay && todayTasks.length === 0 && extraTasks.length === 0) {
      tasksHtml = `
        <div class="rest-day-card animate-in">
          <div class="rest-day-icon">🌿</div>
          <h3>يوم راحة مستحق</h3>
          <p class="rest-day-message">${restDayContent?.message || "راحتك جزء من النجاح — استعد للأيام القادمة بذهن صافٍ."}</p>
          ${restDayContent?.optionalTasks?.length ? `
            <div class="optional-tasks">
              <p class="optional-label">مهام اختيارية خفيفة (إن رغبت):</p>
              <ul>
                ${restDayContent.optionalTasks.map((t) => `<li>${t}</li>`).join("")}
              </ul>
            </div>` : ""}
        </div>`;
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
        <div class="task-item ${t.completed ? "done" : ""} ${t.deferred ? "deferred" : ""} animate-in">
          <strong>${cleanDisplayTitle(t.title)}</strong>
          <p style="color:var(--muted);font-size:0.85rem;margin-top:0.25rem">
            ${t.week_title}${isLate ? " — متأخرة" : ""} · ${hoursPerDay} س
          </p>
          <div class="task-actions no-print">
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
          <div class="page-header animate-in">
            <p class="greeting-text">مرحباً <strong>${displayName}</strong>، أنت في اليوم <strong>${programDay}</strong></p>
            <h1>مهام اليوم</h1>
            <p>اليوم ${programDay} من 84 — الأسبوع ${currentWeek}، يوم ${dayInWeek} من 7</p>
            ${!isRestDay ? `<p class="hours-today">${hoursPerDay} ساعات مخططة لهذا اليوم</p>` : ""}
          </div>
          ${tasksHtml}
        </div>

        <aside class="sidebar-card animate-in shadow-sm">
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
          <p style="font-size:0.85rem;color:var(--muted)">جدول الأسبوع</p>
          <p style="font-size:0.9rem;font-weight:600">${workDays} أيام عمل + ${restDays} راحة</p>
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
    initPageEnhancements();
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
    const displayName = getDisplayName(goal);

    app.innerHTML = `
      <div class="page-header animate-in">
        <p class="greeting-text">مرحباً <strong>${displayName}</strong></p>
        <h1>لوحة الإحصائيات</h1>
        <p>الهدف: ${goal.name}</p>
      </div>

      ${quoteBanner(quoteIdx, "✦ استمر")}

      <div class="stats-grid">
        <div class="stat-card animate-in shadow-sm">
          <div class="value red"><span data-counter="${stats.progressPercent}">0</span>%</div>
          <div class="label">نسبة الإنجاز الكلية</div>
        </div>
        <div class="stat-card animate-in shadow-sm" style="animation-delay:0.05s">
          <div class="value"><span data-counter="${stats.completedTasks}">0</span></div>
          <div class="label">مهام مكتملة</div>
        </div>
        <div class="stat-card animate-in shadow-sm" style="animation-delay:0.1s">
          <div class="value"><span data-counter="${stats.remainingTasks}">0</span></div>
          <div class="label">مهام متبقية</div>
        </div>
        <div class="stat-card animate-in shadow-sm" style="animation-delay:0.15s">
          <div class="value"><span data-counter="${stats.deferredTasks}">0</span></div>
          <div class="label">مهام مؤجّلة</div>
        </div>
      </div>

      <div class="chart-box animate-in rounded-4 shadow-sm">
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

      <div class="chart-box animate-in rounded-4 shadow-sm">
        <h3>نظرة عامة</h3>
        <canvas id="overviewChart" height="200"></canvas>
      </div>

      ${quoteBanner(6, "✦ تذكير")}
    `;

    drawOverviewChart(stats);
    initPageEnhancements();
  } catch (err) {
    app.innerHTML = `<div class="alert">${err.message}</div>`;
  }
}

function drawOverviewChart(stats) {
  const canvas = document.getElementById("overviewChart");
  if (!canvas) return;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#f3f4f6" : "#0a0a0a";

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
    { value: stats.remainingTasks - stats.deferredTasks, color: isDark ? "#e5e7eb" : "#0a0a0a", label: "متبقية" },
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

  ctx.fillStyle = textColor;
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${stats.progressPercent}%`, cx, cy + 7);

  let lx = 16;
  slices.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(lx, 168, 12, 12);
    ctx.fillStyle = textColor;
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
  initTheme();

  if (!currentGoalId) {
    try {
      const goal = await api("/api/goals/latest");
      currentGoalId = String(goal.id);
      localStorage.setItem("goalId", currentGoalId);
      if (goal.user_name) {
        userName = goal.user_name;
        localStorage.setItem("userName", userName);
      }
    } catch { /* لا يوجد هدف */ }
  }
  router();
}

init();
