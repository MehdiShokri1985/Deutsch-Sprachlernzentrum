import { init as dataInit, get, getAllKeys } from "./data.js";

const DURATION_UNITS = [
  { label: "h", ms: 3600000 },
  { label: "min", ms: 60000 },
  { label: "s", ms: 1000 },
];

function formatDuration(ms) {
  if (!ms || ms < 1000) return "0s";
  for (const u of DURATION_UNITS) {
    if (ms >= u.ms) {
      const val = Math.floor(ms / u.ms);
      const rem = ms % u.ms;
      if (u.label === "h" && rem >= 60000) {
        return `${val}h ${Math.floor(rem / 60000)}min`;
      }
      if (u.label === "min" && rem >= 1000) {
        return `${val}min ${Math.floor(rem / 1000)}s`;
      }
      return `${val}${u.label}`;
    }
  }
  return "0s";
}

function datasetLabel(key) {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

const KNOWN_DATASETS = [
  ["adjektive", "#6366f1"],
  ["konnektoren", "#8b5cf6"],
  ["präpositionen", "#0ea5e9"],
  ["demonstrativpronomen", "#e11d48"],
  ["tempora", "#64748b"],
  ["reflexivverben", "#14b8a6"],
  ["kollokationen", "#f59e0b"],
  ["slang", "#d946ef"],
  ["verben", "#10b981"],
];

function datasetColor(dataset) {
  const found = KNOWN_DATASETS.find(([d]) => d === dataset);
  return found ? found[1] : "#6366f1";
}

function datasetUrl(dataset, gameTypes) {
  const base = gameTypes && gameTypes.has("verbs") ? "verbs-game.html" : "game.html";
  return `${base}?dataset=${encodeURIComponent(dataset)}&json=./json/${encodeURIComponent(dataset)}.json`;
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
    if (!Array.isArray(words) || words.length === 0) return;
    const ds = this._ds(info);
    const dataset = info.dataset;

    let learned = 0, mastered = 0;
    for (const w of words) {
      const sc = w.sureCount || 0;
      if (sc >= 2) { learned++; mastered++; }
      else if (sc >= 1) learned++;
    }

    if (!ds.wordCombos) ds.wordCombos = [];
    ds.wordCombos.push({ niveau: info.niveau, mode: info.mode, caseFilter: info.caseFilter, total: words.length, learned, mastered });
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

    this.totals.accuracy = this.totals.totalQuestions > 0 ? Math.round((this.totals.correctAnswers / this.totals.totalQuestions) * 100) : 0;
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

function icon(path, className) {
  return h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", class: className },
    ...path.map(d => h("path", { d }))
  );
}

const ICONS = {
  questions: ["M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"],
  accuracy: ["M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"],
  book: ["M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"],
  clock: ["M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"],
  sessions: ["M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"],
  layers: ["M12 2l-8 4 8 4 8-4-8-4zM2 10l8 4 8-4M2 16l8 4 8-4"],
};

function renderSkeleton(root) {
  root.innerHTML = "";
  const grid = h("div", { className: "stats-grid" });
  for (let i = 0; i < 4; i++) grid.appendChild(h("div", { className: "skeleton skeleton-card" }));
  root.appendChild(grid);
  for (let i = 0; i < 3; i++) root.appendChild(h("div", { className: "skeleton skeleton-line", style: "width:100%;margin-bottom:12px" }));
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

function renderSummaryCards(root, totals) {
  const cards = [
    { value: totals.totalQuestions.toLocaleString(), label: "Fragen beantwortet", icon: ICONS.questions, bg: "bg-indigo", svgClass: "svg-indigo" },
    { value: totals.accuracy + "%", label: "Genauigkeit", icon: ICONS.accuracy, bg: "bg-green", svgClass: "svg-green" },
    { value: totals.wordsLearned + "/" + totals.totalWords, label: "Wörter gelernt", icon: ICONS.book, bg: "bg-amber", svgClass: "svg-amber" },
    { value: totals.sessions, label: "Sitzungen", icon: ICONS.sessions, bg: "bg-sky", svgClass: "svg-sky" },
  ];

  if (totals.timeSpentMs > 0) {
    cards.splice(3, 0, { value: formatDuration(totals.timeSpentMs), label: "Lernzeit", icon: ICONS.clock, bg: "bg-rose", svgClass: "svg-rose" });
  }

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

function renderDatasetProgress(root, datasets) {
  const entries = Object.entries(datasets);
  if (entries.length === 0) return;
  root.appendChild(
    h("div", { className: "section-title" },
      icon(ICONS.layers, "svg-indigo"),
      " Fortschritt nach Thema"
    )
  );
  const grid = h("div", { className: "dataset-grid" });
  for (const [name, ds] of entries) {
    const accuracy = ds.totalQuestions > 0 ? ds.totalCorrect + "/" + ds.totalQuestions : "–";
    const url = datasetUrl(name, ds.gameTypes);
    grid.appendChild(
      h("a", { className: "dataset-card", href: url },
        h("div", { className: "dataset-name", style: `color:${ds.color}` }, ds.label),
        h("div", { className: "dataset-stats" },
          h("span", { className: "dataset-stat" }, "Gelernt: ", h("strong", {}, `${ds.totalLearned}/${ds.totalWords}`)),
          ds.totalQuestions > 0 ? h("span", { className: "dataset-stat" }, "Richtig: ", h("strong", {}, accuracy)) : null,
          ds.totalQuestions > 0 ? h("span", { className: "dataset-stat" }, "Genau: ", h("strong", {}, ds.accuracy + "%")) : null,
          ds.totalSessions > 0 ? h("span", { className: "dataset-stat" }, "Sitzungen: ", h("strong", {}, String(ds.totalSessions))) : null,
        ),
        h("div", { className: "dataset-progress" },
          h("div", { className: "progress-bar-track" },
            h("div", { className: "progress-bar-fill", style: `width:${ds.progress}%;background:${ds.color}` })
          )
        ),
        h("div", { className: "dataset-percent" }, ds.progress + "%"),
      )
    );
  }
  root.appendChild(grid);
}

function renderDashboard(root, engine) {
  root.innerHTML = "";

  const totals = engine.totals;
  const hasData = totals.totalQuestions > 0 || totals.totalWords > 0;
  if (!hasData) { renderEmpty(root); return; }

  renderSummaryCards(root, totals);
  renderDatasetProgress(root, engine.datasets);

  /* Level / Mode summary */
  if (engine.mostStudiedLevel.length > 0 || engine.mostStudiedMode.length > 0) {
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
}

/* --------------- Init --------------- */
export async function init() {
  const root = document.getElementById("statsRoot");
  if (!root) return;
  renderSkeleton(root);

  try {
    const engine = new StatsEngine();
    await engine.load();
    renderDashboard(root, engine);
  } catch (err) {
    if (err.message === "No session") {
      window.location.replace("login.html");
    } else {
      root.innerHTML = `<div class="empty-state"><h2>Fehler beim Laden</h2><p>${err.message}</p></div>`;
    }
  }
}
