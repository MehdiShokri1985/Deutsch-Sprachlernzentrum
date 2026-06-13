import { init as dataInit, get, getAllKeys } from "./data.js";

const DURATION_UNITS = [
  { label: "h", ms: 3600000 },
  { label: "min", ms: 60000 },
  { label: "s", ms: 1000 },
];

function formatDuration(ms) {
  if (!ms || ms < 1000) return "0s";
  const h = Math.floor(ms / 3600000);
  const min = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${min}min`;
  if (min > 0) return `${min}min ${s}s`;
  return `${s}s`;
}

function formatDurationShort(ms) {
  if (!ms || ms < 1000) return "0s";
  const h = Math.floor(ms / 3600000);
  const min = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${min}m`;
  if (min > 0) return `${min}m`;
  return `${Math.floor(ms / 1000)}s`;
}

function formatDate(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDateTime(iso) {
  if (!iso) return "–";
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

function datasetLabel(key) {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

const ALL_SECTIONS = {
  stories:            { label: 'Geschichten',          color: '#e11d48', url: 'story/stories.html' },
  konnektoren:        { label: 'Konnektoren',          color: '#8b5cf6', url: 'game.html?dataset=konnektoren&json=./json/konnektoren.json' },
  adjektive:          { label: 'Adjektive',            color: '#6366f1', url: 'game.html?dataset=adjektive&json=./json/adjektive.json' },
  multi_exam:         { label: 'Mehrfachprüfung',      color: '#f59e0b', url: 'multi_exam/' },
  präpositionen:      { label: 'Präpositionen',        color: '#0ea5e9', url: 'game.html?dataset=präpositionen&json=./json/präpositionen.json' },
  demonstrativpronomen: { label: 'Demonstrativpronomen', color: '#e11d48', url: 'game.html?dataset=demonstrativpronomen&json=./json/demonstrativpronomen.json' },
  tempora:            { label: 'Tempora',              color: '#64748b', url: 'game.html?dataset=tempora&json=./json/tempora.json' },
  reflexivverben:     { label: 'Reflexivverben',       color: '#14b8a6', url: 'game.html?dataset=reflexivverben&json=./json/reflexivverben.json' },
  kollokationen:      { label: 'Kollokationen',        color: '#f59e0b', url: 'game.html?dataset=kollokationen&json=./json/kollokationen.json' },
  slang:              { label: 'Slang',                color: '#d946ef', url: 'game.html?dataset=slang&json=./json/slang.json' },
  verben:             { label: 'Verben',               color: '#10b981', url: 'verbs-game.html?dataset=verben&json=./json/verben.json' },
  wörter:             { label: 'Wörter',              color: '#f59e0b', url: 'wörter/' },
};

function datasetColor(dataset) {
  const found = ALL_SECTIONS[dataset];
  return found ? found.color : "#6366f1";
}

const WORD_KEY_RE = /^langgame_words_(\w+)_(\w+)_(\w+)_(\w+)_(\w+)$/;
const STATE_KEY_RE = /^langgame_state_(\w+)_(\w+)_(\w+)_(\w+)_(\w+)$/;

function parseKey(key) {
  let m = key.match(WORD_KEY_RE);
  if (m) return { type: "words", gameType: m[1], dataset: m[2], niveau: m[3], mode: m[4], caseFilter: m[5] };
  m = key.match(STATE_KEY_RE);
  if (m) return { type: "state", gameType: m[1], dataset: m[2], niveau: m[3], mode: m[4], caseFilter: m[5] };
  return null;
}

function getWeekId(iso) {
  const d = new Date(iso);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  start.setHours(0, 0, 0, 0);
  return start.toISOString().slice(0, 10);
}

function getMonthId(iso) {
  return new Date(iso).toISOString().slice(0, 7);
}

function getTodayId() {
  return new Date().toISOString().slice(0, 10);
}

function computePeriodStats(sessionHistory) {
  const today = getTodayId();
  const thisWeek = getWeekId(new Date().toISOString());
  const thisMonth = getMonthId(new Date().toISOString());
  const result = { today: 0, week: 0, month: 0 };

  if (!Array.isArray(sessionHistory)) return result;

  for (const s of sessionHistory) {
    const startDay = s.start ? s.start.slice(0, 10) : null;
    if (!startDay) continue;
    const dur = s.duration || 0;
    if (startDay === today) result.today += dur;
    if (getWeekId(s.start) === thisWeek) result.week += dur;
    if (getMonthId(s.start) === thisMonth) result.month += dur;
  }
  return result;
}

/* --------------- Old StatsEngine (for dataset progress) --------------- */
class StatsEngine {
  constructor() {
    this.datasets = {};
    this.totals = {
      totalQuestions: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      sessions: 0,
      timeSpentMs: 0,
      wordsLearned: 0,
      wordsMastered: 0,
      totalWords: 0,
    };
    this.levelCounts = {};
    this.modeCounts = {};
  }

  async load() {
    const sess = await window.Auth.getSession();
    if (!sess?.data?.session?.user) throw new Error("No session");
    await dataInit(sess.data.session.user.id);
    this._processAllKeys();
    return this;
  }

  _processAllKeys() {
    const keys = getAllKeys();
    for (const key of keys) {
      const info = parseKey(key);
      if (!info) continue;
      if (info.type === "words") {
        this._processWordKey(info, get(key));
      } else if (info.type === "state") {
        this._processStateKey(info, get(key));
      }
    }
    this._computeDerived();
  }

  _processWordKey(info, words) {
    if (!words) return;
    const ds = this._ds(info);
    let total = 0, learned = 0, mastered = 0;

    if (Array.isArray(words)) {
      // Old format: array of full word objects
      total = words.length;
      for (const w of words) {
        const sc = w.sureCount || 0;
        if (sc >= 2) { learned++; mastered++; }
        else if (sc >= 1) learned++;
      }
    } else if (typeof words === "object") {
      // New format: progress map { id: { sureCount, ... } }
      const entries = Object.values(words);
      total = entries.length;
      for (const prog of entries) {
        const sc = prog.sureCount || 0;
        if (sc >= 2) { learned++; mastered++; }
        else if (sc >= 1) learned++;
      }
    } else {
      return;
    }

    if (!ds.wordCombos) ds.wordCombos = [];
    ds.wordCombos.push({ niveau: info.niveau, mode: info.mode, caseFilter: info.caseFilter, total, learned, mastered });
  }

  _processStateKey(info, state) {
    if (!state || typeof state !== "object") return;
    const ds = this._ds(info);
    const tq = state.totalQuestions || 0;
    const ca = state.correctAnswers || 0;
    const wa = state.wrongAnswers || 0;
    const sn = state.sessionNumber || 0;
    const tm = state.timeSpentMs || 0;
    this.totals.totalQuestions += tq;
    this.totals.correctAnswers += ca;
    this.totals.wrongAnswers += wa;
    this.totals.sessions += sn;
    this.totals.timeSpentMs += tm;
    this.levelCounts[info.niveau] = (this.levelCounts[info.niveau] || 0) + tq;
    this.modeCounts[info.mode] = (this.modeCounts[info.mode] || 0) + tq;
    if (!ds.stateCombos) ds.stateCombos = [];
    ds.stateCombos.push({ niveau: info.niveau, mode: info.mode, caseFilter: info.caseFilter, totalQuestions: tq, correctAnswers: ca, wrongAnswers: wa, sessions: sn, timeSpentMs: tm });
  }

  _ds(info) {
    const d = info.dataset;
    if (!this.datasets[d]) this.datasets[d] = { label: datasetLabel(d), color: datasetColor(d), gameTypes: new Set(), wordCombos: [], stateCombos: [] };
    this.datasets[d].gameTypes.add(info.gameType);
    return this.datasets[d];
  }

  _computeDerived() {
    for (const ds of Object.values(this.datasets)) {
      ds.totalWords = 0; ds.totalLearned = 0; ds.totalMastered = 0;
      ds.totalQuestions = 0; ds.totalCorrect = 0; ds.totalWrong = 0;
      ds.totalSessions = 0; ds.totalTimeMs = 0;
      if (ds.wordCombos) for (const c of ds.wordCombos) {
        ds.totalWords += c.total; ds.totalLearned += c.learned; ds.totalMastered += c.mastered;
      }
      if (ds.stateCombos) for (const c of ds.stateCombos) {
        ds.totalQuestions += c.totalQuestions; ds.totalCorrect += c.correctAnswers; ds.totalWrong += c.wrongAnswers;
        ds.totalSessions += c.sessions; ds.totalTimeMs += c.timeSpentMs;
      }
      ds.accuracy = ds.totalQuestions > 0 ? Math.round((ds.totalCorrect / ds.totalQuestions) * 100) : 0;
      ds.progress = ds.totalWords > 0 ? Math.round((ds.totalLearned / ds.totalWords) * 100) : 0;
    }
    this.totals.wordsLearned = Object.values(this.datasets).reduce((s, d) => s + d.totalLearned, 0);
    this.totals.wordsMastered = Object.values(this.datasets).reduce((s, d) => s + d.totalMastered, 0);
    this.totals.totalWords = Object.values(this.datasets).reduce((s, d) => s + d.totalWords, 0);
    this.mostStudiedLevel = Object.entries(this.levelCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    this.mostStudiedMode = Object.entries(this.modeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }
}

/* --------------- UI Renderer --------------- */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") el.className = v;
    else if (k === "innerHTML") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === "string" || typeof c === "number") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  }
  return el;
}

function icon(paths, className) {
  return h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", class: className },
    ...paths.map(d => h("path", { d }))
  );
}

const ICONS = {
  questions: ["M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"],
  book: ["M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"],
  clock: ["M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"],
  layers: ["M12 2l-8 4 8 4 8-4-8-4zM2 10l8 4 8-4M2 16l8 4 8-4"],
  calendar: ["M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"],
  activity: ["M13 10V3L4 14h7v7l9-11h-7z"],
  target: ["M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8zm0-14a6 6 0 106 6 6 6 0 00-6-6zm0 4a2 2 0 102 2 2 2 0 00-2-2z"],
  users: ["M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"],
};

function skeleton(root) {
  root.innerHTML =
    '<div class="stats-grid" id="skelGrid"></div>' +
    '<div class="skeleton skeleton-line" style="width:100%;margin-bottom:12px"></div>' +
    '<div class="skeleton skeleton-line" style="width:100%;margin-bottom:12px"></div>';
  const g = document.getElementById("skelGrid");
  for (let i = 0; i < 4; i++) {
    const c = document.createElement("div");
    c.className = "skeleton skeleton-card";
    g.appendChild(c);
  }
}

function renderEmpty(root) {
  root.innerHTML = "";
  root.appendChild(
    h("div", { className: "empty-state" },
      h("svg", { width: "64", height: "64", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", "stroke-width": "1.5" },
        h("path", { d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" })
      ),
      h("h2", {}, "Noch keine Lernstatistiken"),
      h("p", {}, "Beginne mit dem Lernen, um deine Fortschritte hier zu sehen."),
    )
  );
}

function renderSummaryCards(root, totals, stats) {
  const cards = [
    { value: totals.totalQuestions.toLocaleString(), label: "Fragen beantwortet", icon: ICONS.questions, bg: "bg-indigo", svgClass: "svg-indigo" },
    { value: totals.wordsLearned + "/" + totals.totalWords, label: "Wörter gelernt", icon: ICONS.book, bg: "bg-amber", svgClass: "svg-amber" },
    { value: formatDurationShort(stats.activeTime || 0), label: "Aktive Zeit", icon: ICONS.activity, bg: "bg-green", svgClass: "svg-green" },
    { value: formatDurationShort(stats.learningTime || 0), label: "Lernzeit", icon: ICONS.target, bg: "bg-rose", svgClass: "svg-rose" },
  ];

  const grid = h("div", { className: "stats-grid" });
  for (const c of cards) {
    const iconEl = h("div", { className: `stat-card-icon ${c.bg}` }, icon(c.icon, c.svgClass));
    grid.appendChild(
      h("div", { className: "stat-card" },
        iconEl,
        h("div", { className: "stat-card-value" }, String(c.value)),
        h("div", { className: "stat-card-label" }, c.label),
      )
    );
  }
  root.appendChild(grid);
}

function renderPeriodCards(root, sessionHistory) {
  const periods = computePeriodStats(sessionHistory);
  const total = (stats) => stats.totalStudyTime || 0;
  const totalVal = 0;

  const cards = [
    { value: formatDurationShort(periods.today), label: "Heute", icon: ICONS.clock, bg: "bg-sky", svgClass: "svg-sky" },
    { value: formatDurationShort(periods.week), label: "Diese Woche", icon: ICONS.calendar, bg: "bg-purple", svgClass: "svg-purple" },
    { value: formatDurationShort(periods.month), label: "Diesen Monat", icon: ICONS.calendar, bg: "bg-indigo", svgClass: "svg-indigo" },
  ];

  const grid = h("div", { className: "stats-grid" });
  for (const c of cards) {
    const iconEl = h("div", { className: `stat-card-icon ${c.bg}` }, icon(c.icon, c.svgClass));
    grid.appendChild(
      h("div", { className: "stat-card" },
        iconEl,
        h("div", { className: "stat-card-value" }, String(c.value)),
        h("div", { className: "stat-card-label" }, c.label),
      )
    );
  }
  root.appendChild(grid);
}

function renderVisitStats(root, stats) {
  const lv = stats.longestVisit;
  const last = stats.lastVisit;
  const first = stats.firstVisit;

  root.appendChild(
    h("div", { className: "section-title" },
      icon(ICONS.users, "svg-indigo"),
      " Besuche"
    )
  );

  const grid = h("div", { className: "visit-grid" });

  grid.appendChild(
    h("div", { className: "visit-card" },
      h("div", { className: "visit-card-label" }, "Besuche insgesamt"),
      h("div", { className: "visit-card-value" }, String(stats.totalVisits || 0)),
    )
  );

  grid.appendChild(
    h("div", { className: "visit-card" },
      h("div", { className: "visit-card-label" }, "Aktive Tage"),
      h("div", { className: "visit-card-value" }, String(stats.uniqueDays || 0)),
    )
  );

  if (lv && lv.start) {
    grid.appendChild(
      h("div", { className: "visit-card visit-card-wide" },
        h("div", { className: "visit-card-label" }, "Längster Besuch"),
        h("div", { className: "visit-card-date" }, formatDate(lv.start)),
        h("div", { className: "visit-card-time" },
          formatTime(lv.start), " → ", formatTime(lv.end)
        ),
        h("div", { className: "visit-card-duration" }, formatDuration(lv.duration)),
      )
    );
  }

  if (last && last.date) {
    grid.appendChild(
      h("div", { className: "visit-card" },
        h("div", { className: "visit-card-label" }, "Letzter Besuch"),
        h("div", { className: "visit-card-date" }, formatDate(last.date)),
        h("div", { className: "visit-card-duration" }, formatDuration(last.duration)),
      )
    );
  }

  if (first && first.date) {
    grid.appendChild(
      h("div", { className: "visit-card" },
        h("div", { className: "visit-card-label" }, "Erster Besuch"),
        h("div", { className: "visit-card-date" }, formatDate(first.date)),
      )
    );
  }

  root.appendChild(grid);
}

function renderAllSections(root, engine, stats) {
  let hasAny = false;
  const grid = h("div", { className: "dataset-grid" });
  const actions = (stats && stats.learningActions) || {};
  const sections = (stats && stats.sections) || {};

  for (const [id, sec] of Object.entries(ALL_SECTIONS)) {
    const gameDs = engine.datasets[id];

    // Game dataset (adjektive–verben) via StatsEngine
    if (gameDs) {
      hasAny = true;
      grid.appendChild(
        h("a", { className: "dataset-card", href: sec.url },
          h("div", { className: "dataset-name", style: `color:${sec.color}` }, gameDs.label),
          h("div", { className: "dataset-stats" },
            h("span", { className: "dataset-stat" }, "Gelernt: ", h("strong", {}, `${gameDs.totalLearned}/${gameDs.totalWords}`)),
            gameDs.totalQuestions > 0 ? h("span", { className: "dataset-stat" }, "Richtig: ", h("strong", {}, `${gameDs.totalCorrect}/${gameDs.totalQuestions}`)) : null,
          ),
          h("div", { className: "dataset-progress" },
            h("div", { className: "progress-bar-track" },
              h("div", { className: "progress-bar-fill", style: `width:${gameDs.progress}%;background:${sec.color}` })
            )
          ),
          h("div", { className: "dataset-percent" }, gameDs.progress + "%"),
        )
      );
      continue;
    }

    // stories
    if (id === 'stories') {
      const secTime = sections.stories || 0;
      const act = actions.stories || {};
      if (secTime <= 0 && !Object.values(act).some(v => v > 0)) continue;
      hasAny = true;
      const lines = [];
      if (act.storyOpened > 0) lines.push(`Geöffnet: ${act.storyOpened}`);
      if (act.storyCompleted > 0) lines.push(`Abgeschlossen: ${act.storyCompleted}`);
      if (secTime > 0) lines.push(`Zeit: ${formatDuration(secTime)}`);
      grid.appendChild(
        h("a", { className: "dataset-card", href: sec.url },
          h("div", { className: "dataset-name", style: `color:${sec.color}` }, sec.label),
          h("div", { className: "dataset-stats" }, ...lines.map(l =>
            h("span", { className: "dataset-stat" }, l)
          )),
        )
      );
      continue;
    }

    // multi_exam
    if (id === 'multi_exam') {
      const secTime = sections.exams || 0;
      const act = actions.exams || {};
      if (secTime <= 0 && !Object.values(act).some(v => v > 0)) continue;
      hasAny = true;
      const lines = [];
      if (act.examCompleted > 0) lines.push(`Prüfungen: ${act.examCompleted}`);
      if (act.totalScore > 0 && act.totalQuestions > 0) lines.push(`Punkte: ${act.totalScore}/${act.totalQuestions}`);
      if (secTime > 0) lines.push(`Zeit: ${formatDuration(secTime)}`);
      grid.appendChild(
        h("a", { className: "dataset-card", href: sec.url },
          h("div", { className: "dataset-name", style: `color:${sec.color}` }, sec.label),
          h("div", { className: "dataset-stats" }, ...lines.map(l =>
            h("span", { className: "dataset-stat" }, l)
          )),
        )
      );
      continue;
    }

    // wörter
    if (id === 'wörter') {
      const act = actions.vocabulary || {};
      const cv = act.cardViewed || 0;
      if (cv <= 0) continue;
      hasAny = true;
      const secTime = sections.vocabulary || 0;
      const lines = [`Karten: ${cv}`];
      if (secTime > 0) lines.push(`Zeit: ${formatDuration(secTime)}`);
      grid.appendChild(
        h("a", { className: "dataset-card", href: sec.url },
          h("div", { className: "dataset-name", style: `color:${sec.color}` }, sec.label),
          h("div", { className: "dataset-stats" }, ...lines.map(l =>
            h("span", { className: "dataset-stat" }, l)
          )),
        )
      );
      continue;
    }
  }

  if (!hasAny) return;
  root.appendChild(
    h("div", { className: "section-title" },
      icon(ICONS.layers, "svg-indigo"),
      " Fortschritt nach Thema"
    )
  );
  root.appendChild(grid);
}

function renderLevelModeSummary(root, engine) {
  if (engine.mostStudiedLevel.length === 0 && engine.mostStudiedMode.length === 0) return;
  const row = h("div", { className: "stats-grid" });
  if (engine.mostStudiedLevel.length > 0) {
    row.appendChild(
      h("div", { className: "stat-card" },
        h("div", { className: "stat-card-label", style: "font-size:0.9rem;margin-bottom:0.5rem;color:#1a1a2e;font-weight:700" }, "Häufigste Levels"),
        ...engine.mostStudiedLevel.map(([lvl, cnt]) =>
          h("div", { style: "display:flex;justify-content:space-between;font-size:0.85rem;padding:4px 0" },
            h("span", { style: "font-weight:600" }, lvl),
            h("span", { style: "color:#6b7280" }, cnt + " Fragen"),
          )
        ),
      )
    );
  }
  if (engine.mostStudiedMode.length > 0) {
    row.appendChild(
      h("div", { className: "stat-card" },
        h("div", { className: "stat-card-label", style: "font-size:0.9rem;margin-bottom:0.5rem;color:#1a1a2e;font-weight:700" }, "Häufigste Modi"),
        ...engine.mostStudiedMode.map(([m, cnt]) =>
          h("div", { style: "display:flex;justify-content:space-between;font-size:0.85rem;padding:4px 0" },
            h("span", { style: "font-weight:600" }, m),
            h("span", { style: "color:#6b7280" }, cnt + " Fragen"),
          )
        ),
      )
    );
  }
  root.appendChild(row);
}

function renderDashboard(root, engine, stats) {
  root.innerHTML = "";

  const totals = engine.totals;
  const hasData = totals.totalQuestions > 0 || totals.totalWords > 0 ||
    (stats && (stats.totalVisits > 0 || (stats.totalStudyTime || 0) > 0));

  if (!hasData) { renderEmpty(root); return; }

  renderSummaryCards(root, totals, stats);

  if (stats && stats.sessionHistory) {
    renderPeriodCards(root, stats.sessionHistory);
  }

  if (stats) {
    renderVisitStats(root, stats);
  }

  renderAllSections(root, engine, stats);
  renderLevelModeSummary(root, engine);
}

/* --------------- Init --------------- */
export async function init() {
  const root = document.getElementById("statsRoot");
  if (!root) return;
  skeleton(root);

  try {
    const engine = new StatsEngine();
    await engine.load();

    const stats = get("stats");

    renderDashboard(root, engine, stats);
  } catch (err) {
    if (err.message === "No session") {
      window.location.replace("login.html");
    } else {
      root.innerHTML = `<div class="empty-state"><h2>Fehler beim Laden</h2><p>${err.message}</p></div>`;
    }
  }
}
