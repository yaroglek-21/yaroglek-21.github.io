const SUPABASE_URL = "https://hmhzmuwkspkhqdyqfuxa.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtaHptdXdrc3BraHFkeXFmdXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDQyMTUsImV4cCI6MjA2NDk4MDIxNX0.1EdztlkETvjFBvk3zYCy5DQS8pIz3BkgTNIE8EIuSOY";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const currentUser = JSON.parse(localStorage.getItem("user"));
const loginBtn = document.getElementById("login-btn");
const userGreeting = document.getElementById("user-greeting");
const userEmail = document.getElementById("user-email");

function toggleMenu() {
  const nav = document.getElementById("main-nav");
  nav.classList.toggle("open");
}

if (currentUser && loginBtn) {
  loginBtn.textContent = "Вийти";
  loginBtn.href = "#";
  loginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}

function logout() {
  localStorage.removeItem("user");
  supabaseClient.auth.signOut().then(() => {
    const loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
      loginBtn.textContent = "Увійти";
      loginBtn.href = "auth.html";
      loginBtn.style.display = "inline-block";
    }
    window.location.href = "auth.html";
  });
}

// 🔥 Рейтинг
const ratingList = document.getElementById("rating-list");

if (ratingList) {
  supabaseClient
    .from("results")
    .select("user_id, score")
    .then(({ data, error }) => {
      if (error) {
        console.error("Помилка завантаження рейтингу:", error.message);
        return;
      }

      const userScores = {};
      data.forEach(({ user_id, score }) => {
        if (!userScores[user_id]) userScores[user_id] = 0;
        userScores[user_id] += score;
      });

      const entries = Object.entries(userScores);

      Promise.all(
        entries.map(async ([user_id, score]) => {
          const { data: profile } = await supabaseClient
            .from("profiles")
            .select("full_name, class")
            .eq("id", user_id)
            .single();

          const name = profile
            ? `${profile.full_name} (${profile.class} клас)`
            : "Користувач";

          return { name, score };
        })
      ).then((users) => {
        users.sort((a, b) => b.score - a.score);
        users.forEach((u) => {
          const li = document.createElement("li");
          li.textContent = `${u.name} — ${u.score} балів`;
          ratingList.appendChild(li);
        });
      });
    });
}

// 📩 Надсилання тесту (оновлена й узгоджена версія)
async function submitTest(lessonId) {
  const btn = document.getElementById(`submit-${lessonId}`);
  const icon = document.getElementById(`status-${lessonId}`);
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) {
    alert("⚠️ Ви не авторизовані. Увійдіть, щоб зберегти результат.");
    return;
  }

  // 🔒 Єдина перевірка для блокування повторного відправлення
  const testKey = `test_submitted_${lessonId}_${user.id}`;
  if (localStorage.getItem(testKey) === "true") {
    alert("✅ Ви вже відправили цей тест. Повторна спроба неможлива.");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Пройдено";
      btn.classList.add("disabled");
    }
    if (icon) icon.innerHTML = "✔️";
    return;
  }

  // 🛡️ Тимчасово блокуємо кнопку, щоб не клікали багато разів
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Відправляється...";
  }

  // 🔢 Підрахунок балів
  const questions = ["q1", "q2", "q3", "q4"];
  let total = 0;
  questions.forEach((q) => {
    const selected = document.querySelector(`input[name="${q}"]:checked`);
    if (selected) total += parseInt(selected.value);
  });
  const points = total * 10;

  // 🗃️ Збереження результату в Supabase
  const { error } = await supabaseClient.from("results").upsert([
    {
      user_id: user.id,
      lesson_id: lessonId,
      score: points,
    },
  ]);

  if (error) {
    alert("❌ Помилка збереження: " + error.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Відправити ще раз";
    }
  } else {
    // 💾 Позначаємо тест як виконаний у localStorage
    localStorage.setItem(testKey, "true");

    if (btn) {
      btn.classList.add("disabled");
      btn.textContent = "Пройдено";
      btn.disabled = true;
    }
    if (icon) icon.innerHTML = "✔️";

    alert(`✅ Результат збережено: ${points} балів!`);
  }
}

// ✅ Ініціалізація статусу тестів
async function initializeLessonStatus() {
  if (!currentUser || !window.location.pathname.includes("lessons.html"))
    return;

  const { data: results } = await supabaseClient
    .from("results")
    .select("lesson_id")
    .eq("user_id", currentUser.id);

  if (results && Array.isArray(results)) {
    results.forEach(({ lesson_id }) => {
      const testKey = `test_submitted_${lesson_id}_${currentUser.id}`;
      localStorage.setItem(testKey, "true");

      const btn = document.getElementById(`submit-${lesson_id}`);
      const icon = document.getElementById(`status-${lesson_id}`);
      if (btn) {
        btn.classList.add("disabled");
        btn.textContent = "Пройдено";
        btn.disabled = true;
      }
      if (icon) icon.innerHTML = "✔";
    });
  }

  // 🧩 Якщо користувач пройшов тест раніше (offline або збережений стан)
  document.querySelectorAll("[id^='submit-']").forEach((btn) => {
    const lessonId = btn.id.replace("submit-", "");
    const testKey = `test_submitted_${lessonId}_${currentUser.id}`;
    if (localStorage.getItem(testKey) === "true") {
      btn.classList.add("disabled");
      btn.textContent = "Пройдено";
      btn.disabled = true;
      const icon = document.getElementById(`status-${lessonId}`);
      if (icon) icon.innerHTML = "✔";
    }
  });
}

initializeLessonStatus();

// 📅 Профіль
if (window.location.pathname.includes("profile.html") && currentUser) {
  (async () => {
    document.getElementById("user-email").textContent = currentUser.email;

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name, class, avatar_url")
      .eq("id", currentUser.id)
      .single();

    if (profile) {
      document.getElementById("user-name").textContent = profile.full_name;
      document.getElementById("user-class").textContent = profile.class;

      const avatar = document.getElementById("user-avatar");
      if (profile.avatar_url) {
        avatar.src = profile.avatar_url;
        avatar.style.display = "block";
      } else {
        const { data: urlData } = supabaseClient.storage
          .from("avatars")
          .getPublicUrl(`${currentUser.id}.png`);
        if (urlData?.publicUrl) {
          avatar.src = urlData.publicUrl;
          avatar.style.display = "block";
        }
      }
    }

    const { data } = await supabaseClient
      .from("results")
      .select("lesson_id, score")
      .eq("user_id", currentUser.id);

    let total = 0;
    const resultsBlock = document.getElementById("user-results");
    resultsBlock.innerHTML = "";

    data?.forEach(({ lesson_id, score }) => {
      total += score;
      const match = lesson_id.match(/\d+/);
      const lessonNumber = match ? match[0] : lesson_id;
      const p = document.createElement("p");
      p.textContent = `Урок ${lessonNumber}: ${score} балів`;
      resultsBlock.appendChild(p);
    });

    document.getElementById("total-score").textContent = total;

    const { data: allResults } = await supabaseClient
      .from("results")
      .select("user_id, score");

    const userScores = {};
    allResults?.forEach(({ user_id, score }) => {
      if (!userScores[user_id]) userScores[user_id] = 0;
      userScores[user_id] += score;
    });

    const sorted = Object.entries(userScores).sort((a, b) => b[1] - a[1]);
    const rank = sorted.findIndex(([id]) => id === currentUser.id) + 1;
    document.getElementById("user-rank").textContent = rank;
  })();
}

// 🖊️ Редагування профілю
function toggleEdit() {
  const modal = document.getElementById("edit-modal");
  if (modal) {
    modal.style.display = modal.style.display === "block" ? "none" : "block";
  }
}

window.addEventListener("click", function (event) {
  const modal = document.getElementById("edit-modal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
});

async function updateProfile() {
  const fullName = document.getElementById("edit-fullname").value.trim();
  const className = document.getElementById("edit-class").value.trim();
  const avatarFile = document.getElementById("avatar-input")?.files[0];
  let avatarUrl = null;

  if (avatarFile) {
    const fileName = `${currentUser.id}.png`;
    const { error: uploadError } = await supabaseClient.storage
      .from("avatars")
      .upload(fileName, avatarFile, { upsert: true });

    if (uploadError) {
      alert("❌ Помилка завантаження аватара: " + uploadError.message);
      return;
    }

    const { data: urlData, error: urlErr } = supabaseClient.storage
      .from("avatars")
      .getPublicUrl(fileName);

    if (urlErr) {
      alert("❌ Помилка отримання URL: " + urlErr.message);
      return;
    }

    avatarUrl = urlData.publicUrl;
  }

  const updateData = {
    id: currentUser.id,
    full_name: fullName,
    class: className,
  };

  if (avatarUrl) updateData.avatar_url = avatarUrl;

  const { error } = await supabaseClient.from("profiles").upsert([updateData]);

  if (error) {
    alert("❌ Помилка збереження: " + error.message);
  } else {
    alert("✅ Профіль оновлено!");
    location.reload();
  }
}

// 📦 Показ/приховування уроку
function toggleLesson(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === "block" ? "none" : "block";
}
// Відкриття модального відео
if (window.innerWidth < 768) {
  document.querySelectorAll(".video-wrapper iframe").forEach((iframe) => {
    iframe.style.pointerEvents = "none";
    const wrapper = iframe.closest(".video-wrapper");
    if (wrapper) {
      wrapper.style.cursor = "pointer";
      wrapper.addEventListener("click", () => {
        const modal = document.getElementById("video-modal");
        const frame = document.getElementById("video-frame");
        frame.src = iframe.src + "?autoplay=1";
        modal.style.display = "block";
      });
    }
  });
}

function closeVideoModal() {
  const modal = document.getElementById("video-modal");
  const frame = document.getElementById("video-frame");
  modal.style.display = "none";
  frame.src = "";
}

window.addEventListener("click", function (event) {
  const modal = document.getElementById("video-modal");
  if (event.target === modal) {
    closeVideoModal();
  }
});
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  section.classList.toggle("open");
}
