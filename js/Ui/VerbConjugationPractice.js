/**
 * Progressive verb conjugation practice (one combobox at a time).
 */

import {
  VERB_PERSONS,
  VERB_TENSE_KEYS,
  VERB_TENSE_LABELS,
  getTensePersonEntries,
  getTenseExamples,
  makeVerbSlotId,
  normalizeForm,
} from "../core/verbUtils.js";

export class VerbConjugationPractice {
  constructor(game) {
    this.game = game;
    this.verb = null;
    /** @type {Set<string>} solved slot ids (tense:person) */
    this.usedSlotIds = new Set();
    this.tenseIndex = 0;
    this.personIndex = 0;
    /** @type {'select'|'person'|'done'} */
    this.phase = "select";
    this.completedTenses = [];

    this.modal = document.getElementById("verbConjugationModal");
    this.content = document.getElementById("verbConjugationContent");
    this.subtitle = document.getElementById("verbPracticeSubtitle");
    this.continueBtn = document.getElementById("verbPracticeContinueBtn");
    this.closeBtn = document.getElementById("closeVerbConjugationBtn");

    this.continueBtn?.addEventListener("click", () =>
      this.game.finishVerbPractice(),
    );
    this.closeBtn?.addEventListener("click", () => this.close());
  }

  open(verb) {
    if (!verb || !this.modal) return;

    this.verb = verb;
    this.usedSlotIds = new Set();
    this.tenseIndex = -1;
    this.personIndex = 0;
    this.phase = "select";
    this.completedTenses = [];

    const pronPart = verb.pronunciation
      ? ` <span class="pronunciation">(${verb.pronunciation})</span>`
      : "";
    this.subtitle.innerHTML = verb.word
      ? `${verb.word}${pronPart} — ${verb.meaning || ""}`
      : "";

    this.game.uiManager?.setWordProgressSquaresVisible(false);
    document.getElementById("panel")?.classList.add("hidden");
    document.getElementById("resultModal")?.classList.add("hidden");

    this.modal.classList.remove("hidden");
    this.render();
  }

  close(restoreResultView = true) {
    this.modal?.classList.add("hidden");
    this.content.innerHTML = "";

    if (restoreResultView) {
      document.getElementById("resultModal")?.classList.remove("hidden");
      this.game.uiManager?.setWordProgressSquaresVisible(true);
      document.getElementById("panel")?.classList.add("hidden");
    }
  }

  getCurrentTenseKey() {
    return VERB_TENSE_KEYS[this.tenseIndex];
  }

  getCurrentPersonEntry() {
    const tenseKey = this.getCurrentTenseKey();
    const entries = getTensePersonEntries(this.verb, tenseKey);
    const person = VERB_PERSONS[this.personIndex];
    return entries.find((e) => e.person === person) || null;
  }

  render() {
    if (!this.content || !this.verb) return;

    // Invariant: while verbConjugationModal is active, competing panels must be hidden.
    // Re-enforced on every render so async or external state changes cannot leak through.
    if (this.modal && !this.modal.classList.contains("hidden")) {
      this.game.uiManager?.setWordProgressSquaresVisible(false);
      document.getElementById("resultModal")?.classList.add("hidden");
    }

    let html = "";

    this.completedTenses.forEach((block) => {
      html += this.renderTenseBlock(block, true);
    });

    if (this.phase === "done") {
      this.content.innerHTML = html;
      return;
    }

    if (this.phase === "select") {
      html += this.renderTenseSelectionCards();
      this.content.innerHTML = html;
      this.attachSelectionHandlers();
      return;
    }

    const tenseKey = this.getCurrentTenseKey();
    if (!tenseKey) {
      this.phase = "done";
      this.render();
      return;
    }

    if (this.phase === "person") {
      html += this.renderActiveTense(tenseKey);
    }

    this.content.innerHTML = html;
    this.attachActiveInput();
  }

  renderTenseSelectionCards() {
    const cards = [
      { key: "prasens", label: "Präsens", bg: "bg-blue-50", border: "border-blue-300", btn: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-400", accent: "text-blue-700", shadow: "shadow-blue-100" },
      { key: "perfekt", label: "Perfekt", bg: "bg-emerald-50", border: "border-emerald-300", btn: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-400", accent: "text-emerald-700", shadow: "shadow-emerald-100" },
      { key: "prateritum", label: "Präteritum", bg: "bg-amber-50", border: "border-amber-300", btn: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-400", accent: "text-amber-700", shadow: "shadow-amber-100" },
      { key: "futur", label: "Futur", bg: "bg-violet-50", border: "border-violet-300", btn: "bg-violet-600 hover:bg-violet-700 focus:ring-violet-400", accent: "text-violet-700", shadow: "shadow-violet-100" },
    ];

    const available = cards.filter(
      (c) => !this.completedTenses.some((b) => b.label === c.label)
    );

    if (available.length === 0) return "";

    let html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">';

    available.forEach((card) => {
      html += `
        <div class="${card.bg} ${card.border} border-2 rounded-xl p-4 flex flex-col items-center gap-3 shadow-sm transition-shadow hover:shadow-md ${card.shadow}">
          <h3 class="text-lg font-bold ${card.accent} tracking-tight">${card.label}</h3>
          <button type="button" data-tense="${card.key}" class="verb-practice-select-btn ${card.btn} text-white font-semibold px-5 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 w-full max-w-[10rem]">
            Complete
          </button>
        </div>`;
    });

    html += "</div>";
    return html;
  }

  attachSelectionHandlers() {
    const buttons = this.content.querySelectorAll(".verb-practice-select-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tenseKey = btn.dataset.tense;
        const idx = VERB_TENSE_KEYS.indexOf(tenseKey);
        if (idx !== -1) this.startTensePractice(idx);
      });
    });
  }

  startTensePractice(idx) {
    this.tenseIndex = idx;
    this.personIndex = 0;
    this.phase = "person";
    this.render();
  }

  renderTenseBlock(block, completed) {
    const cls = completed
      ? "verb-practice-tense verb-practice-tense--completed"
      : "verb-practice-tense";
    let html = `<section class="${cls}"><h3 class="verb-practice-tense-title">${block.label}</h3><div class="verb-practice-rows">`;

    block.solvedRows.forEach((row) => {
      html += this.renderSolvedRow(row.person, row.form, row.fa);
    });

    html += `</div>`;

    if (block.examples?.length) {
      html += this.renderExamplesSection(block.examples);
    }

    html += `</section>`;
    return html;
  }

  renderActiveTense(tenseKey) {
    const label = VERB_TENSE_LABELS[tenseKey] || tenseKey;
    let html = `<section class="verb-practice-tense"><h3 class="verb-practice-tense-title">${label}</h3><div class="verb-practice-rows">`;

    for (let i = 0; i < this.personIndex; i++) {
      const person = VERB_PERSONS[i];
      const row = this.getSolvedRowForPerson(tenseKey, person);
      if (row) {
        html += this.renderSolvedRow(row.person, row.form, row.fa);
      }
    }

    if (this.personIndex < VERB_PERSONS.length) {
      const person = VERB_PERSONS[this.personIndex];
      html += `<div class="verb-practice-row verb-practice-row--active" data-active="1">
        <span class="verb-person-label">${person}</span>
        <button type="button" class="verb-complete-btn" id="verbActiveInput">Complete</button>
      </div>`;
    }

    html += `</div></section>`;
    return html;
  }

  renderSolvedRow(person, form, fa) {
    const line = `${person} ${form}`.trim();
    return `<div class="verb-practice-row verb-practice-row--done">
      <span class="verb-practice-line">${this.googleTranslateDeLink(line, "verb-practice-de")} <span class="text-gray-400">—</span> <span class="verb-practice-fa" dir="rtl">${this.escapeHtml(fa || "")}</span></span>
    </div>`;
  }

  renderExamplesSection(examples) {
    if (!examples?.length) return "";
    let html = `<div class="verb-practice-examples"><div class="verb-practice-examples-title">Beispielsätze</div>`;
    examples.forEach((ex) => {
      html += `<div class="verb-example-row">
        ${this.googleTranslateDeLink(ex.de || "", "verb-example-de")}
        <span class="verb-example-fa" dir="rtl">${this.escapeHtml(ex.fa || "")}</span>
      </div>`;
    });
    html += `</div>`;
    return html;
  }

  getSolvedRowForPerson(tenseKey, person) {
    const entries = getTensePersonEntries(this.verb, tenseKey);
    const e = entries.find((x) => x.person === person);
    if (!e) return null;
    return { person: e.person, form: e.form, fa: e.fa };
  }

  attachActiveInput() {
    const btn = document.getElementById("verbActiveInput");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const entry = this.getCurrentPersonEntry();
      if (!entry) return;
      this.checkAnswer(entry.form);
    });
  }

  checkAnswer(raw) {
    const entry = this.getCurrentPersonEntry();
    if (!entry) return;

    if (normalizeForm(raw) !== normalizeForm(entry.form)) return;

    const tenseKey = this.getCurrentTenseKey();
    this.usedSlotIds.add(makeVerbSlotId(tenseKey, entry.person));
    this.personIndex++;

    if (this.personIndex >= VERB_PERSONS.length) {
      this.finishCurrentTense();
    } else {
      this.render();
    }
  }

  finishCurrentTense() {
    const tenseKey = this.getCurrentTenseKey();
    const entries = getTensePersonEntries(this.verb, tenseKey);
    const solvedRows = VERB_PERSONS.map((person) => {
      const e = entries.find((x) => x.person === person);
      return e ? { person: e.person, form: e.form, fa: e.fa } : null;
    }).filter(Boolean);

    this.completedTenses.push({
      label: VERB_TENSE_LABELS[tenseKey] || tenseKey,
      solvedRows,
      examples: getTenseExamples(this.verb, tenseKey),
    });

    this.tenseIndex = -1;
    this.personIndex = 0;

    if (this.completedTenses.length >= VERB_TENSE_KEYS.length) {
      this.phase = "done";
    } else {
      this.phase = "select";
    }

    this.render();
  }

  googleTranslateDeLink(text, className) {
    const german = String(text || "").trim();
    if (!german) return "";
    const href = `https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(german)}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${className} hover:underline">${this.escapeHtml(german)}</a>`;
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }
}
