/**
 * Verb learning game — meaning as question, infinitive as answer.
 * Supports tense modes: prasens, perfekt, prateritum, futur
 */

import { AdaptiveLearningGame } from "./AdaptiveLearningGame.js";
import { VerbGameLogic } from "./VerbGameLogic.js";
import { VerbUIManager } from "../Ui/VerbUIManager.js";

export class VerbLearningGame extends AdaptiveLearningGame {
  constructor(dataSetName = "verben", jsonPath) {
    super(dataSetName, jsonPath, "verbs");
    this.verbMode = "verben";
    this.currentVerbEntry = null;
  }

  async init() {
    try {
      this.verbMode = document.getElementById("verbModeSelect")?.value || "verben";
      this.currentVerbEntry = null;

      this.words = await this.dataManager.loadWords(
        this.jsonPath,
        this.currentNiveau,
        this.currentMode,
        this.currentCase,
        this.verbMode,
      );

      this.populateCaseSelect(this.words);
      this.gameLogic = new VerbGameLogic(this.words);
      this.uiManager = new VerbUIManager(this);

      this.setupEventListeners();
      this.setupVerbModeListener();
      this.updateUI();

      this.isGameStartEligible = true;
    } catch (error) {
      console.error("Error initializing verb game:", error);
      this.showError("Failed to load game data");
    }
  }

  setupVerbModeListener() {
    const sel = document.getElementById("verbModeSelect");
    if (!sel) return;
    sel.addEventListener("change", () => this.changeVerbMode(sel.value));
  }

  async changeVerbMode(newMode) {
    if (newMode === this.verbMode) return;
    this.verbMode = newMode;
    this.currentVerbEntry = null;

    const caseSelect = document.getElementById("caseSelect");
    if (caseSelect) {
      if (newMode !== "verben") {
        caseSelect.value = "all";
        this.currentCase = "all";
        caseSelect.disabled = true;
      } else {
        caseSelect.disabled = false;
      }
    }

    if (this._sessionStartTimestamp !== null) {
      const elapsed = Date.now() - this._sessionStartTimestamp;
      if (elapsed > 0) {
        const state = this.getCurrentState();
        state.timeSpentMs = (state.timeSpentMs || 0) + elapsed;
      }
    }
    this._sessionStartTimestamp = null;

    await this.reloadWordsForCurrentCombination();
    this.forceResetUIState();
    this.resetSession();
    this.updateUI();
    this.saveData();
  }

  determineQuestionType(word) {
    return this.gameLogic.determineQuestionType(word);
  }

  getAutocompleteCandidates(input) {
    if (this.verbMode === "verben") {
      return super.getAutocompleteCandidates(input);
    }
    const lower = input.toLowerCase();
    const candidates = [];
    for (const w of this.words) {
      const forms = w[this.verbMode];
      if (!forms) continue;
      for (const t of forms) {
        if (t.person && t.form.toLowerCase().startsWith(lower)) {
          candidates.push({ value: t.form, display: `${t.form}` });
          if (candidates.length >= 8) break;
        }
      }
      if (candidates.length >= 8) break;
    }
    return candidates;
  }

  getCorrectAnswer() {
    if (this.verbMode !== "verben" && this.currentVerbEntry) {
      return this.currentVerbEntry.form;
    }
    return this.currentWord?.word ?? "";
  }

  nextQuestion() {
    this.currentWord = this.selectNextWord();

    if (!this.currentWord) {
      this.showLevelComplete();
      return;
    }

    this.currentQuestionType = this.determineQuestionType(this.currentWord);
    this.currentSentence = null;

    if (this.verbMode !== "verben") {
      const tenseArray = this.currentWord[this.verbMode];
      if (tenseArray && tenseArray.length > 0) {
        const forms = tenseArray.filter(t => t.person);
        if (forms.length > 0) {
          this.currentVerbEntry = forms[Math.floor(Math.random() * forms.length)];
        } else {
          this.currentVerbEntry = null;
        }
      } else {
        this.currentVerbEntry = null;
      }
    } else {
      this.currentVerbEntry = null;
    }

    const currentState = this.getCurrentState();
    currentState.lastWordId = this.currentWord.id;

    this.questionStartTime = Date.now();
    this.lastResponseDurationMs = null;

    this.renderQuestion();
    this.updateUI();
    this.saveData();
  }

  async reloadWordsForCurrentCombination() {
    try {
      this.words = await this.dataManager.loadWords(
        this.jsonPath,
        this.currentNiveau,
        this.currentMode,
        this.currentCase,
        this.verbMode,
      );
      this.gameLogic = new VerbGameLogic(this.words);
    } catch (error) {
      console.error("Error reloading words:", error);
    }
  }

  finishVerbPractice() {
    this.uiManager.conjugationPractice.close();
    this.closeModal();
  }
}
