/**
 * کلاس اصلی بازی یادگیری تطبیقی - نسخه ماژولار
 * Main Adaptive Learning Game Class - Modular Version
 *
 * این فایل هسته اصلی بازی است و مسئولیت هماهنگی بین
 * DataManager, StateManager, GameLogic و UIManager را دارد.
 *
 * This file is the main core of the game and coordinates between
 * DataManager, StateManager, GameLogic and UIManager.
 */

import { DataManager } from "./DataManager.js";
import { StateManager } from "./StateManager.js";
import { GameLogic } from "./GameLogic.js";
import { UIManager } from "../Ui/UIManager.js";
import * as data from "../data.js";

export class AdaptiveLearningGame {
  /**
   * سازنده کلاس
   * Constructor
   *
   * @param {string} dataSetName - نام مجموعه داده (adjektive, verben, ...)
   * @param {string} jsonPath - مسیر فایل JSON
   */
  constructor(dataSetName = "adjektive", jsonPath, gameType = "game") {
    this.dataSetName = dataSetName;
    this.gameType = gameType;

    this.jsonPath = jsonPath;

    // تزریق وابستگی‌ها (Dependency Injection)
    this.dataManager = new DataManager(gameType, dataSetName);
    this.stateManager = new StateManager(gameType, dataSetName);
    this.gameLogic = null; // بعد از لود داده‌ها مقداردهی می‌شود
    this.uiManager = null;

    // متغیرهای اصلی بازی
    this.words = [];
    this.currentNiveau = "A1";
    this.currentMode = "hard";
    this.currentCase = "all";
    this.currentWord = null;
    this.currentQuestionType = null;
    this.currentSentence = null;
    this.isAnswering = false;
    this.lastFaToDeIndex = 0;
    this.pendingIsCorrect = false;
    this.pendingCorrectAnswer = null;
    this.verbMode = "";
    this.autoCompleteMode = 1;
    this.currentTail = "all";
    this.isA2Worter = dataSetName === 'a2worter';
    this._allWords = [];

    // Question timing (ms since epoch)
    this.questionStartTime = null;
    this.lastResponseDurationMs = null;

    // Session time tracking
    this._sessionStartTimestamp = null;

    // Game-start eligibility state
    this.isGameStartEligible = false;

    this.init();
  }

  /**
   * مقداردهی اولیه بازی
   * Initialize the game
   */
  async init() {
    try {
      // A2 Wörter: force Niveau to A2 and lock it
      if (this.isA2Worter) {
        this.currentNiveau = "A2";
      }

      // Restore saved tail preference before loading words
      this.currentTail = this._restoreTailPreference();

      // بارگذاری داده‌ها — load unfiltered first to extract tail options
      const unfilteredWords = await this.dataManager.loadWords(
        this.jsonPath,
        this.currentNiveau,
        this.currentMode,
        this.currentCase,
        "",
        "", // no tail filter for initial load
      );

      // Populate tail dropdown from full dataset before applying filter
      if (this.isA2Worter) {
        this._allWords = unfilteredWords;
        this.populateTailSelect();
      }

      // Load words WITH the current tail so word progress is merged from
      // the tail-specific key (e.g. langgame_words_game_a2worter_A2_hard_all_tail_A).
      // This ensures sureCount, mistakeCount, etc. persist correctly per Tail.
      if (this.isA2Worter && this.currentTail !== "all") {
        this.words = await this.dataManager.loadWords(
          this.jsonPath,
          this.currentNiveau,
          this.currentMode,
          this.currentCase,
          "",
          this.currentTail,
        );
      } else {
        this.words = unfilteredWords;
      }

      this.populateCaseSelect(this.words);

      // ایجاد نمونه‌های منطق و رابط کاربری
      this.gameLogic = new GameLogic(this.words);
      this.uiManager = new UIManager(this);

      this.setupEventListeners();
      this.updateUI();

      // A2 Wörter: show tail selector and lock niveau
      if (this.isA2Worter) {
        document.getElementById("tailSelectContainer")?.classList.remove("hidden");
        const levelSelect = document.getElementById("levelSelect");
        if (levelSelect) {
          levelSelect.value = "A2";
          levelSelect.setAttribute("disabled", "disabled");
        }
      }

      // Enable panel click after page refresh initialization
      this.isGameStartEligible = true;
    } catch (error) {
      console.error("Error initializing game:", error);
      this.showError("Failed to load game data");
    }
  }

  populateCaseSelect(words) {
    const caseSet = new Set();
    words.forEach(w => {
      if (w.caseverb) {
        w.caseverb.forEach(cv => caseSet.add(cv.case));
      }
    });
    const cases = ["all", ...Array.from(caseSet).sort()];
    const select = document.getElementById("caseSelect");
    if (select) {
      select.innerHTML = cases.map(c => `<option value="${c}">${c}</option>`).join("");
      select.value = this.currentCase;
    }
  }

  populateTailSelect() {
    const tailSet = new Set();
    this._allWords.forEach(w => {
      if (w.Teil) {
        tailSet.add(w.Teil);
      }
    });
    const tails = ["all", ...Array.from(tailSet).sort()];
    const select = document.getElementById("tailSelect");
    if (select) {
      select.innerHTML = tails.map(t => `<option value="${t}">${t === "all" ? "Alle" : t}</option>`).join("");
      select.value = this.currentTail;
    }
  }

  async changeTail(newTail) {
    if (newTail === this.currentTail) return;
    if (window.loaderShow) window.loaderShow('Teil wird gewechselt...');
    try {
      this.saveData();
      this.currentTail = newTail;
      this._saveTailPreference();
      await this.reloadWordsForCurrentCombination();
      this.populateTailSelect();
      this.forceResetUIState();
      this.resetSession();
      this.updateUI();
      this.saveData();
      console.log(`[TAIL CHANGE] tail=${newTail}`);
    } finally {
      if (window.loaderReady) window.loaderReady();
    }
  }

  _saveTailPreference() {
    data.set(`langgame_tail_${this.dataSetName}`, this.currentTail);
  }

  _restoreTailPreference() {
    const saved = data.get(`langgame_tail_${this.dataSetName}`);
    return saved || "all";
  }

  /**
   * دریافت کلید ترکیب فعلی
   * Get current combination key
   */
  getCurrentKey() {
    const tail = this.isA2Worter && this.currentTail && this.currentTail !== "all" ? `_tail_${this.currentTail}` : "";
    if (this.verbMode && this.verbMode !== "verben") {
      return `${this.currentNiveau}_${this.currentMode}_${this.verbMode}_${this.currentCase}${tail}`;
    }
    return `${this.currentNiveau}_${this.currentMode}_${this.currentCase}${tail}`;
  }

  getCurrentState() {
    return this.stateManager.getCurrentState(
      this.currentNiveau,
      this.currentMode,
      this.currentCase,
      this.verbMode,
      this.currentTail,
    );
  }

  saveData() {
    if (this._sessionStartTimestamp === null) {
      console.log('[SAVE_SKIPPED] Session not started yet');
      return;
    }

    const elapsed = Date.now() - this._sessionStartTimestamp;
    if (elapsed > 0) {
      const state = this.getCurrentState();
      state.timeSpentMs = (state.timeSpentMs || 0) + elapsed;
    }
    this._sessionStartTimestamp = Date.now();

    const state = this.getCurrentState();
    console.log(`[STATE_UPDATE] level=${this.currentNiveau} mode=${this.currentMode} case=${this.currentCase} verbMode=${this.verbMode || 'default'} score=${state.score} correct=${state.correctAnswers} wrong=${state.wrongAnswers} total=${state.totalQuestions} session=${state.sessionNumber} timeMs=${state.timeSpentMs}`);

    console.log(`[CROSS_LAYER_DETECTED] persisting SESSION layer + LEARNING ENGINE layer simultaneously level=${this.currentNiveau} mode=${this.currentMode} case=${this.currentCase} verbMode=${this.verbMode || 'default'}`);

    this.dataManager.saveWords(
      this.words,
      this.currentNiveau,
      this.currentMode,
      this.currentCase,
      this.verbMode,
      this.currentTail,
    );
    this.stateManager.saveState(this.currentNiveau, this.currentMode, this.currentCase, this.verbMode, this.currentTail);
  }

  /**
   * تنظیم شنونده‌های رویداد
   * Setup all event listeners
   */
  setupEventListeners() {
    // Panel click to start game
    document
      .getElementById("panel")
      .addEventListener("click", () => this.handlePanelClick());

    // Reset button
    document.getElementById("resetBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.resetProgress();
    });

    // انتخاب سطح و حالت و حالت دستوری
    document
      .getElementById("levelSelect")
      .addEventListener("change", (e) => this.changeLevel(e.target.value));
    document
      .getElementById("modeSelect")
      .addEventListener("change", () => this.changeMode("hard"));
    document
      .getElementById("caseSelect")
      ?.addEventListener("change", (e) => this.changeCase(e.target.value));

    document
      .getElementById("tailSelect")
      ?.addEventListener("change", (e) => this.changeTail(e.target.value));

    // دکمه‌های اطمینان
    document
      .getElementById("sureBtn")
      .addEventListener("click", () => this.handleConfidence("sure"));
    document
      .getElementById("maybeBtn")
      .addEventListener("click", () => this.handleConfidence("maybe"));
    document
      .getElementById("practiceAgainBtn")
      ?.addEventListener("click", () => this.resetProgress());

    document
      .getElementById("continueBtn")
      ?.addEventListener("click", () => this.closeModal());

    // مودال اشتباهات
    document
      .getElementById("closeMistakesBtn")
      .addEventListener("click", () => this.closeMistakesModal());
    const closeCorrectBtn = document.getElementById("closeCorrectAnswersBtn");
    if (closeCorrectBtn) {
      closeCorrectBtn.addEventListener("click", () =>
        this.closeCorrectAnswersModal(),
      );
    }
    document
      .getElementById("wrongCounter")
      .addEventListener("click", () => this.showMistakesModal());
    const correctCounter = document.getElementById("correctCounter");
    if (correctCounter) {
      correctCounter.addEventListener("click", () =>
        this.showCorrectAnswersModal(),
      );
    }

    // پاپآپ جزئیات کلمه
    document
      .getElementById("closeWordDetailsBtn")
      .addEventListener("click", () => this.closeWordDetailsPopup());

    // ورودی حالت سخت
    const hardInput = document.getElementById("hardInput");
    hardInput.addEventListener("input", () => this.handleInput());
    hardInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submitHardAnswer();
    });
    hardInput.addEventListener("blur", () => {
      setTimeout(() => {
        const list = document.getElementById("autocompleteList");
        if (list) {
          list.innerHTML = "";
          list.classList.add("hidden");
        }
      }, 150);
    });

    // کیبورد جهانی
    document.addEventListener("keydown", (e) => {
      if (this.isAnswering) return;
      const currentState = this.getCurrentState();
      switch (e.key) {
        case "Enter":
          if (currentState.totalQuestions === 0) this.startGame();
          break;
        case "Escape":
          document.querySelectorAll(".modal-overlay").forEach((m) => {
            if (!m.classList.contains("hidden")) m.classList.add("hidden");
          });
          break;
      }
    });

    window.addEventListener("beforeunload", () => this.saveData());
  }

  /**
   * انتخاب حالت بازی
   * Select game mode
   */
  selectMode(mode) {
    this.currentMode = mode;
    document.getElementById("modeModal").classList.add("hidden");
    this.updateUI();
    this.setAutoCompleteMode(1);
  }

  /**
   * تنظیم حالت تکمیل خودکار
   * Set autocomplete mode
   */
  setAutoCompleteMode(mode) {
    this.autoCompleteMode = mode;

    document
      .querySelectorAll('#hardInputContainer button[id^="ac"]')
      .forEach((btn) => {
        btn.classList.toggle(
          "theme-ac-btn--active",
          parseInt(btn.id.replace("ac", "")) === mode,
        );
      });

    const submitBtn = document.getElementById("submitBtn");
    if (submitBtn) {
      submitBtn.classList.toggle("hidden", mode !== 0);
    }
  }

  /**
   * شروع بازی
   * Start new session
   */
  startGame() {
    const currentState = this.getCurrentState();
    currentState.totalQuestions = 0;
    currentState.sessionNumber++;

    this.gameLogic.initSessionOrder(this.currentNiveau);

    // Disable panel click after game starts
    this.isGameStartEligible = false;

    this._sessionStartTimestamp = Date.now();

    this.nextQuestion();
  }

  /**
   * Handle panel click - start game only when eligible
   */
  handlePanelClick() {
    if (this.isGameStartEligible) {
      this.startGame();
    }
  }

  /**
   * انتخاب کلمه بعدی با استفاده از GameLogic
   * Select next word using GameLogic
   */
  selectNextWord() {
    const currentState = this.getCurrentState();
    const selected = this.gameLogic.selectNextWord(
      this.currentNiveau,
      currentState,
    );

    if (!selected) {
      this.showLevelComplete();
      return null;
    }
    return selected;
  }

  /**
   * تعیین نوع سوال با استفاده از GameLogic
   * Determine question type using GameLogic
   */
  determineQuestionType(word) {
    return this.gameLogic.determineQuestionType(word);
  }

  /**
   * نمایش سوال - واگذار شده به UIManager
   * Render question (delegated to UIManager)
   */
  renderQuestion() {
    this.uiManager.renderQuestion();
  }

  /**
   * نمایش سوال در حالت سخت
   * Render hard question
   */
  renderHardQuestion() {
    this.uiManager.renderHardQuestion();
  }

  /**
   * مدیریت ورودی کاربر (Autocomplete)
   * Handle user input
   */
  handleInput() {
    this.uiManager.handleInput();
  }

  /**
   * اعمال پاسخ به صورت اتمی روی هر سه لایه
   * Atomic answer processing: SESSION + LEARNING ENGINE + ANALYTICS
   *
   * @param {object} param0
   * @param {string} param0.wordId
   * @param {boolean} param0.isCorrect
   * @param {{level:string, mode:string, case:string}} param0.context
   * @param {number} [param0.scoreIncrement] - optional session score increment
   */
  applyAnswer({ wordId, isCorrect, context: { level, mode, case: caseFilter } = {}, scoreIncrement } = {}) {
    if (!wordId) throw new Error('[applyAnswer] wordId required');
    if (typeof isCorrect !== 'boolean') throw new Error('[applyAnswer] isCorrect must be boolean');

    const state = this.getCurrentState();
    const word = this.words.find(w => w.id === wordId);
    if (!word) throw new Error('[applyAnswer] word not found: ' + wordId);

    // STEP 1 — Session layer (source of truth)
    state.totalQuestions++;
    if (isCorrect) {
      state.correctAnswers++;
      state.correctAnswersList = state.correctAnswersList || [];
      state.correctAnswersList.push(wordId);
      if (scoreIncrement != null) state.score += scoreIncrement;
    } else {
      state.wrongAnswers++;
    }
    console.log(`[SYNC_SESSION_UPDATE] wordId=${wordId} isCorrect=${isCorrect} correctAnswers=${state.correctAnswers} wrongAnswers=${state.wrongAnswers} totalQuestions=${state.totalQuestions}`);

    // STEP 2 — Word learning engine (unchanged logic)
    if (isCorrect) {
      word.sureCount = (word.sureCount || 0) + 1;
      word.correctStreak = (word.correctStreak || 0) + 1;
      word.mistakeCount = 0;
      word.strength = Math.min(1, (word.strength || 0) + 0.05);
      word.dueIn = Math.max(0, (word.dueIn || 0) - 1);
    } else {
      word.mistakeCount = (word.mistakeCount || 0) + 1;
      word.wrongCount = (word.wrongCount || 0) + 1;
      word.correctStreak = 0;
      word.sureCount = Math.max(0, (word.sureCount || 0) - 1);
      word.strength = Math.max(0.001, (word.strength || 0) - 0.05);
      word.dueIn = 1;
    }
    word.seenCount = (word.seenCount || 0) + 1;

    if (word.sureCount < 0) throw new Error('NEGATIVE sureCount on word=' + wordId);
    if (word.correctStreak < 0) throw new Error('NEGATIVE correctStreak on word=' + wordId);
    if (word.mistakeCount < 0) throw new Error('NEGATIVE mistakeCount on word=' + wordId);

    console.log(`[SYNC_WORD_UPDATE] wordId=${wordId} isCorrect=${isCorrect} sureCount=${word.sureCount} correctStreak=${word.correctStreak} mistakeCount=${word.mistakeCount} strength=${word.strength} dueIn=${word.dueIn} seenCount=${word.seenCount}`);

    // STEP 3 — Stats mirror (derived FROM session, never independent)
    if (window.__tracker) {
      const section = this.gameType === 'verbs' ? 'verbs' : 'vocabulary';
      const stats = window.__tracker.getStats();
      if (stats && stats.learningActions && stats.learningActions[section]) {
        stats.learningActions[section].correctAnswer = state.correctAnswers;
        stats.learningActions[section].wrongAnswer = state.wrongAnswers;
      }
    }
    console.log(`[SYNC_STATS_MIRROR] wordId=${wordId} isCorrect=${isCorrect} correctAnswer=${state.correctAnswers} wrongAnswer=${state.wrongAnswers}`);

    // STEP 4 — Atomic persist (all layers together)
    this.saveData();

    console.log(`[SYNC_COMPLETE] wordId=${wordId} isCorrect=${isCorrect} correctAnswers=${state.correctAnswers} wrongAnswers=${state.wrongAnswers} totalQuestions=${state.totalQuestions}`);

    return { state, word };
  }

  /**
   * ارسال پاسخ در حالت سخت
   * Submit answer in hard mode
   */
  getAutocompleteCandidates(input) {
    const lower = input.toLowerCase();
    return this.words
      .filter((w) => w.word.toLowerCase().startsWith(lower))
      .slice(0, 8)
      .map((w) => ({
        value: w.word,
        display: w.word,
        pronunciation: w.pronunciation,
      }));
  }

  getCorrectAnswer() {
    return this.currentWord?.word ?? "";
  }

  submitHardAnswer() {
    if (this.isAnswering) return;

    const selected = document.getElementById("hardInput").value.trim();
    if (!selected) return;

    this.isAnswering = true;
    const correctAnswer = this.getCorrectAnswer();
    const isCorrect = selected.toLowerCase() === correctAnswer.toLowerCase();

    this.pendingIsCorrect = isCorrect;
    this.pendingCorrectAnswer = correctAnswer;

    this.recordAnswerTiming();

    this.applyAnswer({
      wordId: this.currentWord.id,
      isCorrect,
      context: {
        level: this.currentNiveau,
        mode: this.currentMode,
        case: this.currentCase,
      },
      scoreIncrement: isCorrect ? 30 : 0,
    });

    if (!isCorrect) {
      this.applyWrongAnswerScheduling();
    }

    this.showResult(this.pendingIsCorrect, this.pendingCorrectAnswer);
    this.updateUI();
  }

  /**
   * بررسی پاسخ (چندگزینه‌ای)
   * Check answer (multiple choice)
   */
  checkAnswer(selectedAnswer, correctAnswer) {
    if (this.isAnswering) return;
    if (!this.currentWord) {
      this.showLevelComplete();
      return;
    }

    this.isAnswering = true;
    const isCorrect = selectedAnswer === correctAnswer;

    this.pendingIsCorrect = isCorrect;
    this.pendingCorrectAnswer = correctAnswer;

    this.recordAnswerTiming();

    const scoreMap = {
      de_to_fa: 10,
      word_with_sentence: 15,
      fa_to_de: 20,
      sentence_only: 25,
    };
    const scoreIncrement = isCorrect
      ? (scoreMap[this.currentQuestionType?.type] || 10)
      : 0;

    this.applyAnswer({
      wordId: this.currentWord.id,
      isCorrect,
      context: {
        level: this.currentNiveau,
        mode: this.currentMode,
        case: this.currentCase,
      },
      scoreIncrement,
    });

    if (!isCorrect) {
      this.applyWrongAnswerScheduling();
    }

    this.showResult(this.pendingIsCorrect, this.pendingCorrectAnswer);
    this.updateUI();
  }

  /**
   * Record elapsed time from question render to answer submission.
   */
  recordAnswerTiming() {
    if (this.questionStartTime != null) {
      this.lastResponseDurationMs = Date.now() - this.questionStartTime;
    } else {
      this.lastResponseDurationMs = null;
    }
  }

  /**
   * Apply automatic scheduling after a wrong answer based on wrongCount.
   */
  applyWrongAnswerScheduling() {
    if (!this.currentWord) return;
    const wrongCount = this.currentWord.wrongCount || 0;

    if (wrongCount === 1) {
      this.gameLogic.moveCurrentBack(5);
      console.log(`[WRONG_SCHEDULE] id=${this.currentWord.id} wrongCount=${wrongCount} moveBack=5`);
    } else if (wrongCount === 2) {
      this.gameLogic.moveCurrentBack(10);
      console.log(`[WRONG_SCHEDULE] id=${this.currentWord.id} wrongCount=${wrongCount} moveBack=10`);
    } else {
      this.gameLogic.moveCurrentToEnd();
      console.log(`[WRONG_SCHEDULE] id=${this.currentWord.id} wrongCount=${wrongCount} moveToEnd`);
    }
  }

  /**
   * Handle user confidence after a correct answer.
   * Queue-based scheduling: sure removes from cycle, maybe repositions in queue.
   */
  handleConfidence(confidence) {
    if (!this.pendingIsCorrect) {
      this.saveData();
      this.updateUI();
      this.uiManager.showResultContinueButton();
      return;
    }

    if (confidence === "sure") {
      this.currentWord.sureCount = 2;
      this.gameLogic.forgetCurrentWord();
      console.log(`[CONFIDENCE_SURE] id=${this.currentWord.id} level=${this.currentNiveau} marked learned, removed from queue`);
    } else if (confidence === "maybe") {
      const mc = this.currentWord.maybeCount || 0;
      this.currentWord.maybeCount = mc + 1;

      if (mc === 0) {
        this.gameLogic.moveCurrentBack(5);
        console.log(`[CONFIDENCE_MAYBE] id=${this.currentWord.id} maybeCount=${mc + 1} moveBack=5`);
      } else if (mc === 1) {
        this.gameLogic.moveCurrentBack(10);
        console.log(`[CONFIDENCE_MAYBE] id=${this.currentWord.id} maybeCount=${mc + 1} moveBack=10`);
      } else {
        this.gameLogic.moveCurrentToEnd();
        console.log(`[CONFIDENCE_MAYBE] id=${this.currentWord.id} maybeCount=${mc + 1} moveToEnd`);
      }
    }

    this.saveData();
    this.updateUI();
    this.uiManager.showResultContinueButton();
  }

  /**
   * نمایش نتیجه پاسخ
   * Show result modal
   */
  showResult(isCorrect, correctAnswer) {
    this.uiManager.showResult(isCorrect, correctAnswer);
  }

  /**
   * نمایش جمله اصلی
   * Display original sentence
   */
  displayOriginalSentence() {
    this.uiManager.displayOriginalSentence();
  }

  /**
   * نمایش مودال اشتباهات
   * Show mistakes modal
   */
  showMistakesModal() {
    this.uiManager.showMistakesModal();
  }

  /**
   * بستن مودال اشتباهات
   * Close mistakes modal
   */
  closeMistakesModal() {
    this.uiManager.closeMistakesModal();
  }

  showCorrectAnswersModal() {
    this.uiManager.showCorrectAnswersModal();
  }

  closeCorrectAnswersModal() {
    this.uiManager.closeCorrectAnswersModal();
  }

  /**
   * بستن پاپآپ جزئیات کلمه
   * Close word details popup
   */
  closeWordDetailsPopup() {
    this.uiManager.closeWordDetailsPopup();
  }

  /**
   * نمایش پیام تکمیل سطح
   * Show level complete message
   */
  showLevelComplete() {
    this.uiManager.showLevelComplete();
  }

  /**
   * بستن مودال نتیجه و رفتن به سوال بعدی
   * Close result modal
   */
  closeModal() {
    this.uiManager.closeModal();
  }

  /**
   * تغییر حالت بازی
   * Change game mode
   */
  //   changeMode(newMode) {
  async changeMode(newMode) {
    if (window.loaderShow) window.loaderShow('Modus wird gewechselt...');
    try {
      this.currentMode = newMode;
      await this.reloadWordsForCurrentCombination();
      this.forceResetUIState();
      this.resetSession();
      this.updateUI();
      this.saveData();
      console.log(`🔄 Changed to ${this.getCurrentKey()}`);
    } finally {
      if (window.loaderReady) window.loaderReady();
    }
  }

  /**
   * تغییر حالت دستوری
   * Change case filter
   */
  async changeCase(newCase) {
    if (window.loaderShow) window.loaderShow('Filter wird angewandt...');
    try {
      this.currentCase = newCase;
      const sel = document.getElementById("caseSelect");
      if (sel) sel.value = newCase;
      await this.reloadWordsForCurrentCombination();
      this.forceResetUIState();
      this.resetSession();
      this.updateUI();
      this.saveData();
      console.log(`🔄 Changed to ${this.getCurrentKey()}`);
    } finally {
      if (window.loaderReady) window.loaderReady();
    }
  }

  /**
   * تغییر سطح
   * Change level
   */
  //   changeLevel(newLevel) {
  async changeLevel(newLevel) {
    if (window.loaderShow) window.loaderShow('Level wird gewechselt...');
    try {
      this.currentNiveau = newLevel;
      await this.reloadWordsForCurrentCombination();
      this.forceResetUIState();
      this.resetSession();
      this.updateUI();
      this.saveData();
      console.log(`🔄 Changed to ${this.getCurrentKey()}`);
    } finally {
      if (window.loaderReady) window.loaderReady();
    }
  }

  /**
   * ریست جلسه (UI)
   * Reset current session UI
   */
  resetSession() {
    this.uiManager.resetSession();
  }

  /**
   * Force reset UI to initial panel state (used for mode/level changes)
   * Hides resultModal, restores panel visibility, enables panel click
   */
  forceResetUIState() {
    // Hide resultModal if visible
    const modal = document.getElementById("resultModal");
    if (modal && !modal.classList.contains("hidden")) {
      modal.classList.add("hidden");
    }

    const verbConjugationModal = document.getElementById(
      "verbConjugationModal",
    );
    if (verbConjugationModal) {
      verbConjugationModal.classList.add("hidden");
    }

    // Restore panel visibility
    const panel = document.getElementById("panel");
    if (panel) {
      panel.classList.remove("hidden");
    }

    // Restore answer options visibility
    const answerOptions = document.getElementById("answerOptions");
    if (answerOptions) {
      answerOptions.classList.remove("hidden");
    }

    // Reset answering state
    this.isAnswering = false;
    this.questionStartTime = null;
    this.lastResponseDurationMs = null;
    if (this.uiManager) {
      this.uiManager.setWordProgressSquaresVisible(false);
      this.uiManager.resetResultModalButtons();
    }

    // Enable panel click for new mode/level
    this.isGameStartEligible = true;
  }

  /**
   * بارگذاری مجدد کلمات برای ترکیب فعلی
   * Reload words for current combination
   */
  async reloadWordsForCurrentCombination() {
    try {
      this.words = await this.dataManager.loadWords(
        this.jsonPath,
        this.currentNiveau,
        this.currentMode,
        this.currentCase,
        this.verbMode,
        this.currentTail,
      );
      this.gameLogic = new GameLogic(this.words);
    } catch (error) {
      console.error("Error reloading words:", error);
    }
  }

  /**
   * ریست کامل پیشرفت برای ترکیب فعلی
   * Reset all progress for current combination
   */
  async resetProgress() {
    if (
      !confirm(
        "Are you sure you want to reset all progress for current combination?",
      )
    ) return;
    if (window.loaderShow) window.loaderShow('Fortschritt wird zurückgesetzt...');
    try {
      // STEP 1 — Reset only this exact combination (preserves all others)
      const result = await data.resetAllData(this.gameType, this.dataSetName, this.currentNiveau, this.currentMode, this.currentCase, this.verbMode, this.currentTail);
      if (result.ok) {
        console.log('RESET OK: ' + this.gameType + '/' + this.dataSetName + '/' + this.getCurrentKey());
      } else {
        console.error('RESET FAILED: ' + result.error);
      }

      // STEP 2 — Clear local game state
      this.stateManager.resetProgress(this.currentNiveau, this.currentMode, this.currentCase, this.verbMode, this.currentTail);

      // STEP 3 — Reset word objects in memory (dynamic defaults, never from JSON)
      const DEFAULT_WORD_STATE = {
        strength: 0.2,
        dueIn: 0,
        seenCount: 0,
        mistakeCount: 0,
        correctStreak: 0,
        sureCount: 0,
        maybeCount: 0,
        wrongCount: 0,
      };
      const DEFAULT_SENTENCE_STATE = {
        strength: 0.3,
        dueIn: 0,
        mistakeCount: 0,
        seenCount: 0,
        correctStreak: 0,
        sureCount: 0,
      };
      const levelWords = this.words.filter(
        (word) => (word.level || "A1") === this.currentNiveau,
      );
      levelWords.forEach((word) => {
        Object.assign(word, { ...DEFAULT_WORD_STATE });

        if (word.sentences) {
          word.sentences.forEach((sentence) => {
            Object.assign(sentence, { ...DEFAULT_SENTENCE_STATE });
          });
        }
      });

      this.forceResetUIState();
      this.resetSession();
      this.updateUI();

      // Enable panel click after reset
      this._sessionStartTimestamp = null;
      this.isGameStartEligible = true;

      console.log(`[RESET_EXECUTED] game=${this.gameType} dataset=${this.dataSetName} level=${this.currentNiveau} mode=${this.currentMode} case=${this.currentCase} verbMode=${this.verbMode || 'default'}`);
    } finally {
      if (window.loaderReady) window.loaderReady();
    }
  }

  /**
   * به‌روزرسانی رابط کاربری
   * Update UI
   */
  updateUI() {
    this.uiManager.updateUI();
  }

  /**
   * پخش صدا
   * Play sound feedback
   */
  playSound(type) {
    this.uiManager.playSound(type);
  }

  /**
   * نمایش خطا
   * Show error message
   */
  showError(message) {
    this.uiManager.showError(message);
  }

  /**
   * سوال بعدی
   * Next question
   */
  nextQuestion() {
    this.currentWord = this.selectNextWord();

    if (!this.currentWord) {
      this.showLevelComplete();
      return;
    }

    this.currentQuestionType = this.determineQuestionType(this.currentWord);
    this.currentSentence = null;
    const currentState = this.getCurrentState();

    currentState.lastWordId = this.currentWord.id;

    // انتخاب جمله اگر لازم باشد
    if (
      this.currentQuestionType.showSentence &&
      this.currentWord.sentences?.length > 0
    ) {
      const available = this.currentWord.sentences.filter((s) => s.dueIn <= 0);
      const pool =
        available.length > 0 ? available : this.currentWord.sentences;
      this.currentSentence = pool[Math.floor(Math.random() * pool.length)];

      if (this.currentSentence) {
        this.currentSentence.seenCount =
          (this.currentSentence.seenCount || 0) + 1;
      }
    }

    this.questionStartTime = Date.now();
    this.lastResponseDurationMs = null;

    this.renderQuestion();
    this.updateUI();
    this.saveData();
  }
}
