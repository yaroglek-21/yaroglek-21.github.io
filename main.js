// main.js
import { supabase, getSession, requireAuth } from "./supabase.js";

const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
const param = (k) => new URLSearchParams(location.search).get(k);

// ---------- UI utils ----------
function toggleMenu() {
  const nav = qs("#main-nav");
  if (nav) nav.classList.toggle("open");
}
window.toggleMenu = toggleMenu;

function alertJSON(title, obj) {
  alert(`${title}:\n\n` + JSON.stringify(obj, null, 2));
}

function populateSelect(
  selectEl,
  items,
  valueKey = "id",
  labelKey = "title",
  placeholder = "Виберіть"
) {
  if (!selectEl) return;

  selectEl.innerHTML = "";

  // додаємо пункт-заглушку
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  ph.disabled = false;
  ph.selected = true;
  selectEl.appendChild(ph);

  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it[valueKey];
    opt.textContent = it[labelKey];
    selectEl.appendChild(opt);
  }

  selectEl.disabled = false;
}

// ================= HEADER =================
async function initHeader() {
  const authLink = qs("#auth-link");
  const adminLink = qs("#nav-admin");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Не увійшов
  if (!user) {
    if (authLink) {
      authLink.textContent = "Увійти";
      authLink.href = "auth.html";
    }
    if (adminLink) adminLink.style.display = "none";
    return;
  }

  // Увійшов → кнопка виходу
  if (authLink) {
    authLink.textContent = "Вийти";
    authLink.href = "#";
    authLink.onclick = async (e) => {
      e.preventDefault();
      localStorage.removeItem("is_admin");
      await supabase.auth.signOut();
      location.href = "auth.html";
    };
  }

  // Показуємо адмінку з localStorage
  const isAdmin = localStorage.getItem("is_admin") === "1";
  if (adminLink) adminLink.style.display = isAdmin ? "inline-block" : "none";
}

// ================= ADMIN SECURITY =================
function requireLocalAdmin() {
  const isAdmin = localStorage.getItem("is_admin") === "1";
  if (!isAdmin) {
    location.href = "index.html";
    return false;
  }
  return true;
}

// ================= PUBLIC PAGES =================
async function initIndex() {
  await initHeader();
}

async function initSubjects() {
  await initHeader();
  const wrap = qs("#subjectsGrid");
  const { data, error } = await supabase
    .from("subjects")
    .select("id, title, description, banner_url, order_index")
    .order("order_index", { ascending: true });

  if (error) {
    alertJSON("Помилка завантаження предметів", error);
    return;
  }

  const subjects = data || [];
  if (!subjects.length) {
    wrap.innerHTML = `<div class="intro">Немає предметів</div>`;
    return;
  }

  wrap.innerHTML = subjects
    .map(
      (s) => `
      <a class="lesson-banner banner-img"
         href="./topics.html?subject=${s.id}"
         style="background-image:url('${s.banner_url || "back_cs.jpg"}')">
         <h3>${s.title}</h3>
      </a>`
    )
    .join("");
}

async function initTopics() {
  await initHeader();
  const subjectId = Number(param("subject"));
  if (!subjectId) return (location.href = "subjects.html");

  const { data: subj } = await supabase
    .from("subjects")
    .select("title")
    .eq("id", subjectId)
    .single();

  qs("#subjectTitle").textContent = subj?.title || "Теми";

  const list = qs("#topicsList");
  const { data: topics, error } = await supabase
    .from("topics")
    .select("id, title, order_index")
    .eq("subject_id", subjectId)
    .order("order_index");

  if (error) {
    alertJSON("Помилка завантаження тем", error);
    return;
  }

  if (!topics?.length) {
    list.innerHTML = `<div class="intro">Немає тем</div>`;
    return;
  }

  list.innerHTML = topics
    .map(
      (t) => `
      <button class="accordion-btn" onclick="toggleLesson('topic_${t.id}')">${t.title}</button>
      <div id="topic_${t.id}" class="lesson-content">
        <div class="topic-lessons" data-topic="${t.id}">Завантаження...</div>
      </div>`
    )
    .join("");

  for (const t of topics) {
    const mount = qs(`.topic-lessons[data-topic="${t.id}"]`);
    const { data: lessons, error: errL } = await supabase
      .from("lessons")
      .select("id, title, order_index")
      .eq("topic_id", t.id)
      .order("order_index");

    if (errL) {
      mount.innerHTML = `<div class="intro">Помилка: ${errL.message}</div>`;
      continue;
    }

    mount.innerHTML = lessons?.length
      ? lessons
          .map(
            (l) =>
              `<a class="btn-save" href="./lesson.html?id=${l.id}" style="display:block;margin:8px auto;max-width:420px;">${l.title}</a>`
          )
          .join("")
      : `<div class="intro">Немає уроків</div>`;
  }
}
window.toggleLesson = (id) => {
  const el = qs("#" + id);
  if (el) el.style.display = el.style.display === "block" ? "none" : "block";
};

async function initLesson() {
  await initHeader();
  const id = Number(param("id"));
  if (!id) return (location.href = "subjects.html");

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, title, youtube_url")
    .eq("id", id)
    .single();

  if (error || !lesson) {
    qs("#lessonWrap").innerHTML = `<div class="intro">Урок не знайдено</div>`;
    return;
  }

  qs("#lessonTitle").textContent = lesson.title;

  // Нормалізація YouTube URL
  function toEmbedURL(url) {
    if (!url) return "";
    if (url.includes("youtu.be")) {
      const id = url.split("youtu.be/")[1].split("?")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("watch?v=")) {
      const id = url.split("watch?v=")[1].split("&")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("embed")) return url;
    return `https://www.youtube.com/embed/${url}`;
  }

  qs("#ytFrame").src = toEmbedURL(lesson.youtube_url);

  const { data: test } = await supabase
    .from("tests")
    .select("id")
    .eq("lesson_id", id)
    .maybeSingle();

  const btn = qs("#toTest");
  if (test?.id) btn.href = `./test.html?id=${test.id}`;
  else {
    btn.classList.add("disabled");
    btn.textContent = "Тест ще не додано";
  }
}

async function initTest() {
  await requireAuth();
  await initHeader();

  const id = Number(param("id"));
  if (!id) return (location.href = "subjects.html");

  const { data: test, error } = await supabase
    .from("tests")
    .select("id, lesson_id, questions")
    .eq("id", id)
    .single();

  if (error || !test) {
    qs("#testForm").innerHTML = `<div class="intro">Тест не знайдено</div>`;
    return;
  }

  // Отримуємо назву уроку
  const { data: lessonData } = await supabase
    .from("lessons")
    .select("title")
    .eq("id", test.lesson_id)
    .single();

  qs("#testTitle").textContent = lessonData?.title
    ? `${lessonData.title}`
    : "Тест";

  const form = qs("#testForm");
  form.innerHTML = "";

  (test.questions || []).forEach((q, i) => {
    form.innerHTML += `
      <div class="lesson-content" style="display:block">
        <h3>${i + 1}. ${q.question}</h3>
        ${q.options
          .map(
            (opt, oi) =>
              `<label><input type="radio" name="q${i}" value="${oi}"> ${opt}</label><br>`
          )
          .join("")}
      </div>`;
  });

  qs("#submitTest").onclick = async () => {
    const session = await getSession();
    let score = 0;

    (test.questions || []).forEach((q, i) => {
      const checked = qs(`input[name="q${i}"]:checked`);
      if (checked && Number(checked.value) === Number(q.correct)) score++;
    });

    const totalQuestions = (test.questions || []).length;
    const maxPoints = totalQuestions * 10;
    const points = score * 10;

    // Пишемо результат
    const { error: resErr } = await supabase.from("results").insert({
      user_id: session.user.id,
      test_id: test.id,
      score: points,
    });

    const resultBox = qs("#testResult");

    if (resErr) {
      if (resErr.code === "23505") {
        resultBox.textContent =
          "⚠️ Ви вже проходили цей тест. Повторне проходження заборонено.";
        resultBox.style.display = "block";
        resultBox.style.background = "#ffeaea";
        resultBox.style.borderColor = "#d95353";
        resultBox.style.color = "#9c1c1c";
        return;
      }
      resultBox.textContent =
        "❌ Сталася помилка під час збереження результату.";
      resultBox.style.display = "block";
      return;
    }

    // Якщо все добре — показуємо результат
    resultBox.textContent = `✅ Ваш результат: ${points} / ${maxPoints} балів`;
    resultBox.style.display = "block";
    resultBox.scrollIntoView({ behavior: "smooth" });

    // ---------------------
    // ВИДАЧА БЕЙДЖА 100%
    // ---------------------
    if (points === maxPoints && totalQuestions > 0) {
      try {
        // 100% видача — тип випадковий
        const r = Math.random();
        let type =
          r < 0.02
            ? "legendary" // 2%
            : r < 0.2
            ? "epic" // 20% (від 0.02 до 0.20)
            : "rare";

        await supabase.from("badges").insert({
          user_id: session.user.id,
          type,
        });

        // PNG картинки
        const badgeImg = {
          legendary: "legendary.png",
          epic: "epic.png",
          rare: "rare.png",
        }[type];

        // Блок для відображення
        const badgeBox = qs("#badgeResult");
        badgeBox.style.display = "block";
        badgeBox.className = "test-result";
        badgeBox.style.background = "#e7fff3";
        badgeBox.style.borderColor = "#16a34a";
        badgeBox.style.color = "#14532d";
        badgeBox.style.marginTop = "15px";
        badgeBox.style.padding = "16px";
        badgeBox.style.borderRadius = "10px";
        badgeBox.style.animation = "fadeIn 0.6s ease";

        badgeBox.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;text-align:center;">
        <div style="font-size:22px;">
          ${
            type === "legendary"
              ? "🏆 Ви отримали <b>ЛЕГЕНДАРНИЙ</b> бейдж!"
              : type === "epic"
              ? "🌟 Ви отримали <b>ЕПІЧНИЙ</b> бейдж!"
              : "✨ Ви отримали <b>РІДКІСНИЙ</b> бейдж!"
          }
        </div>
        <img src="${badgeImg}" style="width:60px;height:60px;">
      </div>
    `;

        badgeBox.scrollIntoView({ behavior: "smooth" });
      } catch (e) {
        console.error("Помилка видачі бейджа:", e);
      }
    }

    // Блокуємо кнопку “Надіслати”
    const btn = qs("#submitTest");
    if (btn) {
      btn.classList.add("disabled");
      btn.setAttribute("disabled", "disabled");
    }
  };
}

// ================= ADMIN =================
async function initAdmin() {
  await requireAuth();
  await initHeader();
  if (!requireLocalAdmin()) return;

  // ---- helpers to load data ----
  async function getSubjects() {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, title")
      .order("order_index");
    if (error) {
      alertJSON("Помилка завантаження предметів", error);
      return [];
    }
    return data || [];
  }
  async function getTopicsBySubject(subjectId) {
    const { data, error } = await supabase
      .from("topics")
      .select("id, title")
      .eq("subject_id", subjectId)
      .order("order_index");
    if (error) {
      alertJSON("Помилка завантаження тем", error);
      return [];
    }
    return data || [];
  }
  async function getLessonsByTopic(topicId) {
    const { data, error } = await supabase
      .from("lessons")
      .select("id, title")
      .eq("topic_id", topicId)
      .order("order_index");
    if (error) {
      alertJSON("Помилка завантаження уроків", error);
      return [];
    }
    return data || [];
  }

  // ---- render lists (таблиці) ----
  async function renderSubjects() {
    const wrap = qs("#subjectsAdmin");
    const { data, error } = await supabase
      .from("subjects")
      .select("id,title,order_index")
      .order("order_index");
    if (error) {
      wrap.innerHTML = "Помилка завантаження";
      return;
    }
    wrap.innerHTML = (data || [])
      .map(
        (s) => `
  <div class="row-item">
    <div><strong>${s.title}</strong></div>
    <button class="btn-save" style="background:#ef4475" data-type="subjects" data-id="${s.id}">
      Видалити (${s.title})
    </button>
  </div>`
      )
      .join("");

    bindDeletes(wrap);
  }

  // --- Теми: показуємо ТІЛЬКИ вибраного предмета ---
  async function renderTopics() {
    const wrap = qs("#topicsAdmin");
    const subjectSel = qs("#topicSubjectSel");
    const selectedSubjectId = Number(subjectSel?.value) || null;

    // якщо предмет не обрано (порожній селект) — просто очистимо
    if (!selectedSubjectId) {
      wrap.innerHTML = `<div class="intro">Оберіть предмет, щоб побачити теми</div>`;
      return;
    }

    const { data, error } = await supabase
      .from("topics")
      .select("id, subject_id, title, order_index")
      .eq("subject_id", selectedSubjectId)
      .order("order_index");

    if (error) {
      wrap.innerHTML = "Помилка завантаження";
      return;
    }

    if (!data?.length) {
      wrap.innerHTML = `<div class="intro">Тем для цього предмета ще немає</div>`;
      return;
    }

    wrap.innerHTML = (data || [])
      .map(
        (t) => `
  <div class="row-item">
    <div><strong>${t.title}</strong></div>
    <button class="btn-save" style="background:#ef4475" data-type="topics" data-id="${t.id}">
      Видалити (${t.title})
    </button>
  </div>`
      )
      .join("");

    bindDeletes(wrap);
  }

  // --- Уроки: фільтруємо за предметом і, якщо обрано, за темою ---
  async function renderLessons() {
    const wrap = qs("#lessonsAdmin");
    const subjSel = qs("#lessonSubjectSel");
    const topicSel = qs("#lessonTopicSel");

    const selectedSubjectId = Number(subjSel?.value) || null;
    const selectedTopicId = Number(topicSel?.value) || null;

    if (!selectedSubjectId) {
      wrap.innerHTML = `<div class="intro">Оберіть предмет (і при потребі тему), щоб побачити уроки</div>`;
      return;
    }

    // якщо вибрана конкретна тема — фільтруємо по ній
    if (selectedTopicId) {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, topic_id, title, order_index")
        .eq("topic_id", selectedTopicId)
        .order("order_index");

      if (error) {
        wrap.innerHTML = "Помилка завантаження";
        return;
      }

      wrap.innerHTML = (data || [])
        .map(
          (l) => `
    <div class="row-item">
      <div><strong>${l.title}</strong></div>
      <button class="btn-save" style="background:#ef4475" data-type="lessons" data-id="${l.id}">
        Видалити (${l.title})
      </button>
    </div>`
        )
        .join("");

      bindDeletes(wrap);
      return;
    }

    // якщо тема не вибрана — показуємо всі уроки ВСІХ тем обраного предмета
    // 1) беремо всі теми предмета
    const { data: topics, error: topicsErr } = await supabase
      .from("topics")
      .select("id")
      .eq("subject_id", selectedSubjectId);

    if (topicsErr) {
      wrap.innerHTML = "Помилка завантаження";
      return;
    }
    const topicIds = (topics || []).map((t) => t.id);
    if (!topicIds.length) {
      wrap.innerHTML = `<div class="intro">Для цього предмета ще немає тем</div>`;
      return;
    }

    // 2) тягнемо уроки по списку topic_id
    const { data: lessons, error: lessonsErr } = await supabase
      .from("lessons")
      .select("id, topic_id, title, order_index")
      .in("topic_id", topicIds)
      .order("topic_id")
      .order("order_index");

    if (lessonsErr) {
      wrap.innerHTML = "Помилка завантаження";
      return;
    }

    wrap.innerHTML =
      (lessons?.length ? lessons : [])
        .map(
          (l) => `
      <div class="row-item">
        <div>[${l.id}] ${l.title} — topic:${l.topic_id}</div>
        <div>order: ${l.order_index ?? 0}</div>
        <button class="btn-save"
                style="background:#ef4475"
                data-type="lessons"
                data-id="${l.id}"
                data-title="${l.title}">
          🗑 Видалити «${l.title}»
        </button>
      </div>
    `
        )
        .join("") ||
      `<div class="intro">Уроків для цього предмета ще немає</div>`;

    bindDeletes(wrap);
  }

  function bindDeletes(scope) {
    qsa("button[data-type]", scope).forEach((btn) => {
      btn.onclick = async () => {
        const type = btn.dataset.type; // subjects | topics | lessons
        const id = Number(btn.dataset.id);
        const title = btn.dataset.title || "";

        const ok = confirm(
          `Видалити ${
            type === "subjects"
              ? "предмет"
              : type === "topics"
              ? "тему"
              : "урок"
          } «${title || "ID " + id}»?`
        );
        if (!ok) return;

        const { error } = await supabase.from(type).delete().eq("id", id);
        if (error) {
          alertJSON("Помилка видалення", error);
          return;
        }

        if (type === "subjects") renderSubjects();
        if (type === "topics") renderTopics();
        if (type === "lessons") renderLessons();
      };
    });
  }

  // ---- SUBJECTS: форма (без order_index) ----
  qs("#subjectForm").onsubmit = async (e) => {
    e.preventDefault();
    const title = qs("#subjectTitle").value.trim();
    const description = qs("#subjectDesc").value.trim();
    const banner_url = qs("#subjectBanner").value.trim();

    if (!title || !banner_url) {
      alert("Заповніть назву і URL банера.");
      return;
    }

    const { error } = await supabase
      .from("subjects")
      .insert({ title, description, banner_url });

    if (error) {
      alertJSON("Помилка при додаванні предмета", error);
      return;
    }
    e.target.reset?.();
    await bootstrapTopicAndLessonSelects(); // оновимо селекти
    renderSubjects();
  };

  // ---- TOPICS: форма з селектом предмету ----
  async function initTopicForm() {
    const sel = qs("#topicSubjectSel");
    const subjects = await getSubjects();

    populateSelect(sel, subjects, "id", "title", "Виберіть предмет");
    sel.onchange = renderTopics;

    // при старті НЕ виводимо теми автоматично
    qs(
      "#topicsAdmin"
    ).innerHTML = `<div class="intro">Оберіть предмет, щоб побачити теми</div>`;
  }

  qs("#topicForm").onsubmit = async (e) => {
    e.preventDefault();
    const subjectSel = qs("#topicSubjectSel");
    const subject_id = Number(subjectSel.value);
    const title = qs("#topicTitle").value.trim();

    if (!subject_id || !title) {
      alert("Оберіть предмет і впишіть назву теми.");
      return;
    }

    const { error } = await supabase
      .from("topics")
      .insert({ subject_id, title });

    if (error) {
      alertJSON("Помилка при додаванні теми", error);
      return;
    }

    e.target.reset?.();

    // 🔥 ДОДАНО
    await bootstrapTopicAndLessonSelects(); // оновлюємо селекти
    await renderTopics(); // показуємо теми вибраного предмета
  };

  // ---- LESSONS: каскад Subject -> Topic ----
  async function initLessonForm() {
    const subjSel = qs("#lessonSubjectSel");
    const topicSel = qs("#lessonTopicSel");

    const subjects = await getSubjects();
    populateSelect(subjSel, subjects, "id", "title", "Виберіть предмет");

    // при старті — тема порожня
    populateSelect(topicSel, [], "id", "title", "Виберіть тему");
    topicSel.disabled = true;

    subjSel.onchange = async () => {
      const subjId = Number(subjSel.value);

      if (!subjId) {
        populateSelect(topicSel, [], "id", "title", "Виберіть тему");
        topicSel.disabled = true;
        qs(
          "#lessonsAdmin"
        ).innerHTML = `<div class="intro">Оберіть предмет</div>`;
        return;
      }

      const topics = await getTopicsBySubject(subjId);
      populateSelect(topicSel, topics, "id", "title", "Виберіть тему");
      topicSel.disabled = false;

      renderLessons();
    };

    topicSel.onchange = renderLessons;

    // стартове повідомлення
    qs(
      "#lessonsAdmin"
    ).innerHTML = `<div class="intro">Оберіть предмет, щоб побачити уроки</div>`;
  }

  qs("#lessonForm").onsubmit = async (e) => {
    e.preventDefault();

    const topic_id = Number(qs("#lessonTopicSel").value);
    const title = qs("#lessonTitle").value.trim();
    const youtube_url = qs("#lessonUrl").value.trim();

    if (!topic_id || !title) {
      alert("Оберіть тему і впишіть назву уроку.");
      return;
    }

    const { error } = await supabase
      .from("lessons")
      .insert({ topic_id, title, youtube_url });

    if (error) {
      alertJSON("Помилка при додаванні уроку", error);
      return;
    }

    e.target.reset?.();

    // 🔥 ДОДАНО
    await bootstrapTestSelects(); // оновлюємо селекти тестів
    await renderLessons(); // відображаємо уроки для вибраної теми/предмета
  };

  // ---- TESTS: каскад Subject -> Topic -> Lesson + конструктор ----
  let qbQuestions = [];

  function renderQB() {
    const list = qs("#qbList");
    list.innerHTML = "";

    qbQuestions.forEach((q, qi) => {
      const block = document.createElement("div");
      block.className = "qb-item";
      block.innerHTML = `
        <div class="qb-item-head">
          <strong>Питання ${qi + 1}</strong>
          <button type="button" class="qb-remove" data-idx="${qi}">×</button>
        </div>
        <input class="qb-q" placeholder="Текст питання" value="${q.question.replaceAll(
          '"',
          "&quot;"
        )}" />
        <div class="qb-opts">
          ${q.options
            .map(
              (opt, oi) => `
            <label class="qb-opt">
              <input type="radio" name="correct_${qi}" value="${oi}" ${
                q.correct === oi ? "checked" : ""
              } />
              <input class="qb-o" data-qi="${qi}" data-oi="${oi}" placeholder="Варіант ${
                oi + 1
              }" value="${opt.replaceAll('"', "&quot;")}" />
            </label>`
            )
            .join("")}
        </div>
      `;
      list.appendChild(block);
    });

    // видалення
    qsa(".qb-remove", list).forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        qbQuestions.splice(idx, 1);
        renderQB();
      };
    });

    // зміни текстів питання
    qsa(".qb-q", list).forEach((inp, idx) => {
      inp.oninput = () => {
        qbQuestions[idx].question = inp.value.trim();
      };
    });

    // зміни варіантів
    qsa(".qb-o", list).forEach((inp) => {
      inp.oninput = () => {
        const qi = Number(inp.dataset.qi);
        const oi = Number(inp.dataset.oi);
        qbQuestions[qi].options[oi] = inp.value.trim();
      };
    });

    // вибір правильної
    qsa('input[type="radio"]', list).forEach((r) => {
      r.onchange = () => {
        const qi = Number(r.name.split("_")[1]);
        qbQuestions[qi].correct = Number(r.value);
      };
    });
  }

  function addQuestion() {
    qbQuestions.push({
      question: "",
      options: ["", "", "", ""],
      correct: 0,
    });
    renderQB();
  }

  async function initTestForm() {
    const subjSel = qs("#testSubjectSel");
    const topicSel = qs("#testTopicSel");
    const lessonSel = qs("#testLessonSel");

    const subjects = await getSubjects();
    populateSelect(subjSel, subjects, "id", "title", "Виберіть предмет");

    populateSelect(topicSel, [], "id", "title", "Виберіть тему");
    topicSel.disabled = true;

    populateSelect(lessonSel, [], "id", "title", "Виберіть урок");
    lessonSel.disabled = true;

    subjSel.onchange = async () => {
      const subjId = Number(subjSel.value);

      if (!subjId) {
        populateSelect(topicSel, [], "id", "title", "Виберіть тему");
        topicSel.disabled = true;

        populateSelect(lessonSel, [], "id", "title", "Виберіть урок");
        lessonSel.disabled = true;
        return;
      }

      const topics = await getTopicsBySubject(subjId);
      populateSelect(topicSel, topics, "id", "title", "Виберіть тему");
      topicSel.disabled = false;

      populateSelect(lessonSel, [], "id", "title", "Виберіть урок");
      lessonSel.disabled = true;
    };

    topicSel.onchange = async () => {
      const topicId = Number(topicSel.value);

      if (!topicId) {
        populateSelect(lessonSel, [], "id", "title", "Виберіть урок");
        lessonSel.disabled = true;
        return;
      }

      const lessons = await getLessonsByTopic(topicId);
      populateSelect(lessonSel, lessons, "id", "title", "Виберіть урок");
      lessonSel.disabled = lessons.length === 0;
    };
  }

  // --- ПРИВ'ЯЗКА КНОПОК КОНСТРУКТОРА ТЕСТУ ---
  const addBtn = qs("#qbAddQuestion");
  const saveBtn = qs("#qbSave");

  // перший рендер (порожній)
  renderQB();

  if (addBtn) {
    addBtn.onclick = () => {
      addQuestion();
    };
  }

  if (saveBtn) {
    saveBtn.onclick = async () => {
      const lessonSel = qs("#testLessonSel");
      const lesson_id = Number(lessonSel?.value);

      if (!lesson_id) {
        alert("Оберіть урок, до якого зберігаємо тест.");
        return;
      }

      const prepared = (qbQuestions || [])
        .map((q) => ({
          question: (q.question || "").trim(),
          options: (q.options || []).map((o) => o.trim()),
          correct: Number(q.correct ?? 0),
        }))
        .filter(
          (q) =>
            q.question &&
            q.options.length === 4 &&
            q.options.every((o) => o !== "")
        );

      if (!prepared.length) {
        alert("Додайте хоча б одне повне питання.");
        return;
      }

      const { data: existing } = await supabase
        .from("tests")
        .select("id")
        .eq("lesson_id", lesson_id)
        .maybeSingle();

      let err;
      if (existing?.id) {
        ({ error: err } = await supabase
          .from("tests")
          .update({ questions: prepared })
          .eq("id", existing.id));
      } else {
        ({ error: err } = await supabase
          .from("tests")
          .insert({ lesson_id, questions: prepared }));
      }

      if (err) {
        alert("Помилка збереження тесту.");
        console.log(err);
        return;
      }

      alert("Тест збережено!");
    };
  }

  // ---- каскади, що треба оновлювати після вставок ----
  async function bootstrapTopicAndLessonSelects() {
    await initTopicForm();
    await initLessonForm();
  }
  async function bootstrapTestSelects() {
    await initTestForm();
  }

  // ---- старт ----
  await Promise.all([
    renderSubjects(),
    renderTopics(),
    renderLessons(),
    bootstrapTopicAndLessonSelects(),
    bootstrapTestSelects(),
  ]);
  // =========================
  //      РЕЙТИНГ УЧНІВ
  // =========================

  async function initAdminRating() {
    const container = document.createElement("section");
    container.className = "lesson-box";
    container.innerHTML = `
    <h3>Рейтинг учнів</h3>

    <div style="margin-bottom:12px; display:flex; gap:12px; flex-wrap:wrap;">
      <select id="ratingSubjectSel" style="min-width:240px"></select>
      <select id="ratingClassSel" style="min-width:160px">
        <option value="">Всі класи</option>
      </select>
    </div>

    <div id="ratingTable"></div>
  `;
    document.querySelector("main.container").appendChild(container);

    const subjectSel = container.querySelector("#ratingSubjectSel");
    const classSel = container.querySelector("#ratingClassSel");
    const table = container.querySelector("#ratingTable");

    // Підтягуємо предмети
    const subjects = await getSubjects();
    populateSelect(subjectSel, subjects, "id", "title", "Виберіть предмет");

    // Підтягуємо список класів (унікальні)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("class")
      .not("class", "is", null);

    const classes = [...new Set((profiles || []).map((p) => p.class))].sort();
    classes.forEach((cls) => {
      const opt = document.createElement("option");
      opt.value = cls;
      opt.textContent = cls;
      classSel.appendChild(opt);
    });

    // Коли міняємо предмет або клас → оновлюємо рейтинг
    subjectSel.onchange = renderRating;
    classSel.onchange = renderRating;

    async function renderRating() {
      const subjectId = Number(subjectSel.value);
      const selectedClass = classSel.value;

      if (!subjectId) {
        table.innerHTML = `<div class="intro">Оберіть предмет</div>`;
        return;
      }

      // 1) Отримуємо уроки вибраного предмету
      const { data: topics } = await supabase
        .from("topics")
        .select("id")
        .eq("subject_id", subjectId);

      const topicIds = (topics || []).map((t) => t.id);

      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, topic_id");

      const lessonIds = (lessons || [])
        .filter((l) => topicIds.includes(l.topic_id))
        .map((l) => l.id);

      if (!lessonIds.length) {
        table.innerHTML = `<div class="intro">Немає уроків у цього предмета</div>`;
        return;
      }

      // 2) Отримуємо тести цих уроків
      const { data: tests } = await supabase
        .from("tests")
        .select("id, lesson_id, questions")
        .in("lesson_id", lessonIds);

      const testIds = (tests || []).map((t) => t.id);

      if (!testIds.length) {
        table.innerHTML = `<div class="intro">Немає тестів для цього предмета</div>`;
        return;
      }

      // 3) Результати цих тестів
      const { data: results } = await supabase
        .from("results")
        .select("user_id, score, tests(lesson_id)")
        .in("test_id", testIds);

      if (!results?.length) {
        table.innerHTML = `<div class="intro">Поки немає результатів</div>`;
        return;
      }

      // 4) Групуємо по учнях + рахуємо суму балів
      const users = {};
      for (const r of results) {
        if (!users[r.user_id]) users[r.user_id] = 0;
        users[r.user_id] += r.score;
      }

      // 5) Підтягуємо профілі учнів
      const userIds = Object.keys(users);

      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, class")
        .in("id", userIds);

      // 6) Формуємо таблицю
      let rows = profs.map((p) => ({
        username: p.username,
        class: p.class || "—",
        total: users[p.id],
      }));

      // Фільтр по класу
      if (selectedClass) {
        rows = rows.filter((r) => r.class === selectedClass);
      }

      // Сортуємо за сумою балів
      rows.sort((a, b) => b.total - a.total);

      // 7) Вивід таблиці
      table.innerHTML = `
      <table class="rating-table">
        <tr>
          <th>Учень</th>
          <th>Клас</th>
          <th>Сума балів</th>
        </tr>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${r.username}</td>
            <td>${r.class}</td>
            <td>${r.total}</td>
          </tr>
        `
          )
          .join("")}
      </table>
    `;
    }
  }

  // ДОДАТИ В КІНЕЦЬ initAdmin():
  await initAdminRating();
}

// ================= ROUTER =================
function boot() {
  const page = document.body.dataset.page || "";
  if (page === "index") initIndex();
  if (page === "subjects") initSubjects();
  if (page === "topics") initTopics();
  if (page === "lesson") initLesson();
  if (page === "test") initTest();
  if (page === "profile") {
    (async () => {
      await requireAuth();
      await initHeader();

      const session = await getSession();

      // 1) Дані профілю
      const { data: me } = await supabase
        .from("profiles")
        .select("username, rating, class")
        .eq("id", session.user.id)
        .single();
      // ==== РОЗРАХУНОК РЕЙТИНГУ КОРИСТУВАЧА У СВОЄМУ КЛАСІ ====

      // id поточного користувача
      const userId = session.user.id;

      // 1) Підтягнемо профіль, щоб мати class та username для відображення
      const { data: profileData, error: profErr } = await supabase
        .from("profiles")
        .select("class, username, rating")
        .eq("id", userId)
        .single();

      const myClass = profileData?.class || null;

      // 2) Отримуємо місце у класі через безпечну функцію БД (SECURITY DEFINER)
      //    ВАЖЛИВО: цю функцію треба створити один раз SQL-скриптом нижче.
      let classRankText = "—";
      if (myClass) {
        const { data: rankRows, error: rankErr } = await supabase.rpc(
          "class_rank",
          { my_user: userId }
        );

        if (!rankErr && Array.isArray(rankRows) && rankRows.length > 0) {
          classRankText = String(rankRows[0].rank);
        } else {
          // якщо раптом функція ще не створена або помилка — краще показати "—", а не 1
          classRankText = "—";
        }
      }

      qs("#profileCard").innerHTML = `
        <p><strong>Email:</strong> ${session.user.email}</p>
        <p><strong>Ім'я користувача:</strong> ${me?.username || "—"}</p>
        <p><strong>Клас:</strong> ${me?.class || "—"}</p>
        <p><strong>Місце у класі:</strong> ${classRankText}</p>
        <p><strong>Адмін:</strong> ${
          localStorage.getItem("is_admin") === "1" ? "так" : "ні"
        }</p>
      `;

      // --- Логіка відкривання/закривання форми ---
      const openBtn = qs("#openEditProfile");
      const editSection = qs("#editProfileSection");
      const closeBtn = qs("#closeEditProfile");

      if (openBtn && editSection && closeBtn) {
        openBtn.onclick = () => {
          openBtn.style.display = "none";
          editSection.style.display = "block";
        };

        closeBtn.onclick = () => {
          editSection.style.display = "none";
          openBtn.style.display = "inline-block";
        };
      }

      // ==========================
      // Заповнення форми редагування
      // ==========================
      const editUsername = qs("#editUsername");
      const editClass = qs("#editClass");
      const profileMsg = qs("#editProfileMsg");

      // Заповнюємо поля з бази
      editUsername.value = me?.username || "";
      editClass.value = me?.class || "";

      // Обробник збереження профілю
      qs("#editProfileForm").onsubmit = async (e) => {
        e.preventDefault();

        const newUsername = editUsername.value.trim();
        const newClass = editClass.value.trim();

        if (!newUsername) {
          profileMsg.textContent = "Введіть ім’я користувача!";
          profileMsg.style.display = "block";
          return;
        }

        const { error } = await supabase
          .from("profiles")
          .update({
            username: newUsername,
            class: newClass,
          })
          .eq("id", session.user.id);

        if (error) {
          profileMsg.innerHTML = "❌ Помилка збереження профілю.";
          profileMsg.style.display = "block";
          profileMsg.style.background = "#ffeaea";
          profileMsg.style.borderColor = "#d95353";
          profileMsg.style.color = "#9c1c1c";
          profileMsg.scrollIntoView({ behavior: "smooth" });
          return;
        }

        profileMsg.innerHTML = "Профіль успішно оновлено!";
        profileMsg.style.display = "block";
        profileMsg.style.background = "#eaffd4";
        profileMsg.style.borderColor = "#7bc043";
        profileMsg.style.color = "#316100";
        profileMsg.scrollIntoView({ behavior: "smooth" });

        // Оновлюємо блок профілю без перезавантаження
        qs("#profileCard").innerHTML = `
    <p><strong>Email:</strong> ${session.user.email}</p>
    <p><strong>Ім'я користувача:</strong> ${newUsername}</p>
    <p><strong>Клас:</strong> ${newClass || "—"}</p>
    <p><strong>Рейтинг:</strong> ${me?.rating ?? 0}</p>
    <p><strong>Адмін:</strong> ${
      localStorage.getItem("is_admin") === "1" ? "так" : "ні"
    }</p>
  `;
      };

      // ============================
      //   Вибір предмету → результати
      // ============================

      const resultsWrap = qs("#myResults");

      // 1) Завантажуємо предмети
      const { data: mySubjects } = await supabase
        .from("subjects")
        .select("id, title")
        .order("order_index");

      // Створюємо селект
      resultsWrap.innerHTML = `
  <label style="font-weight:bold; display:block; margin-bottom:8px">
    Оберіть предмет:
  </label>
  <select id="resultSubjectSel" class="profile-select" style="margin-bottom:16px;">
    <option value="">Виберіть предмет</option>
    ${mySubjects
      .map((s) => `<option value="${s.id}">${s.title}</option>`)
      .join("")}
  </select>

  <ul id="resultList"></ul>
`;

      const subjectSel = qs("#resultSubjectSel");
      const resultList = qs("#resultList");

      // ============================
      // ЛОГІКА ЗАВАНТАЖЕННЯ РЕЗУЛЬТАТІВ
      // ============================
      subjectSel.onchange = async () => {
        resultList.innerHTML = "";

        const subjId = Number(subjectSel.value);
        if (!subjId) {
          resultList.innerHTML = `<li>Оберіть предмет</li>`;
          return;
        }

        // 1) Теми предмета
        const { data: topics } = await supabase
          .from("topics")
          .select("id, title, subject_id")
          .eq("subject_id", subjId);

        const topicMap = {};
        (topics || []).forEach((t) => (topicMap[t.id] = t)); // <— ВАЖЛИВО! Зберігаємо весь об’єкт

        // 2) Уроки цих тем
        const topicIds = (topics || []).map((t) => t.id);

        const { data: lessons } = await supabase
          .from("lessons")
          .select("id, title, topic_id")
          .in("topic_id", topicIds);

        const lessonMap = {};
        (lessons || []).forEach((l) => (lessonMap[l.id] = l));

        // 3) Тести цих уроків (ВАЖЛИВО: тягнемо також questions)
        const lessonIds = (lessons || []).map((l) => l.id);

        const { data: tests } = await supabase
          .from("tests")
          .select("id, lesson_id, questions") // <— додано questions
          .in("lesson_id", lessonIds);

        const testIds = (tests || []).map((t) => t.id);

        if (!testIds.length) {
          resultList.innerHTML = `<li>Тестів для цього предмета немає.</li>`;
          return;
        }

        // 4) Результати користувача
        const { data: results } = await supabase
          .from("results")
          .select("score, test_id")
          .in("test_id", testIds)
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (!results?.length) {
          resultList.innerHTML = `<li>Немає результатів по цьому предмету.</li>`;
          return;
        }

        // 5) Формуємо список
        resultList.innerHTML = results
          .map((r) => {
            const test = tests.find((t) => t.id === r.test_id);

            const lesson = test ? lessonMap[test.lesson_id] : null;
            const topicName =
              lesson && topicMap[lesson.topic_id]
                ? topicMap[lesson.topic_id].title
                : "—";

            // кількість питань у тесті
            const questionsCount = Array.isArray(test?.questions)
              ? test.questions.length
              : 0;

            const maxScore = questionsCount * 10;

            return `
<li class="row-item">
  <div style="text-align:center">
    <strong>${lesson?.title || "Урок"}</strong><br>
    Тема: ${topicName}<br>
    Бал: ${r.score} / ${maxScore || r.score}
  </div>
</li>
`;
          })
          .join("");
      };

      // --------------------------
      //   3) Бейджі
      // --------------------------
      let badgesSection = qs("#myBadges");

      if (!badgesSection) {
        const container = qs("main.container") || document.body;
        const sec = document.createElement("section");
        sec.className = "intro";
        sec.innerHTML = `
    <h3>Мої бейджі</h3>
    <div id="myBadges"></div>
  `;
        container.appendChild(sec);
        badgesSection = qs("#myBadges");
      }

      // Завантажуємо всі бейджі користувача
      const { data: badges } = await supabase
        .from("badges")
        .select("type")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      // Групуємо
      const groups = { legendary: [], epic: [], rare: [] };
      (badges || []).forEach((b) => groups[b.type]?.push(b));

      const badgeGroupHTML = (label, arr, emoji) => `
  <div class="lesson-content" style="display:block;margin-bottom:12px">
    <h3 style="margin-top:0">${emoji} ${label} (${arr.length})</h3>
    ${
      arr.length
        ? `<ul class="list">` +
          arr
            .map(
              (b) =>
                `<li class="row-item">
                   <img src="${b.type}.png" style="width:40px;height:40px;margin-right:8px;">
                 </li>`
            )
            .join("") +
          `</ul>`
        : `<div class="intro" style="margin:0">Поки немає</div>`
    }
  </div>
`;

      badgesSection.innerHTML =
        badgeGroupHTML("Легендарні", groups.legendary, "🏆") +
        badgeGroupHTML("Епічні", groups.epic, "🌟") +
        badgeGroupHTML("Рідкісні", groups.rare, "✨");
    })();
  }
  if (page === "admin") initAdmin();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
