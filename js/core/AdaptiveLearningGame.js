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

export class AdaptiveLearningGame {
  /**
   * سازنده کلاس
   * Constructor
   *
   * @param {string} dataSetName - نام مجموعه داده (adjektive, verben, ...)
   * @param {string} jsonPath - مسیر فایل JSON
   */
  constructor(dataSetName = "adjektive", jsonPath) {
    this.dataSetName = dataSetName;

    this.jsonPath = jsonPath;

    // تزریق وابستگی‌ها (Dependency Injection)
    this.dataManager = new DataManager(dataSetName);
    this.stateManager = new StateManager(dataSetName);
    this.gameLogic = null; // بعد از لود داده‌ها مقداردهی می‌شود
    this.uiManager = null;

    // متغیرهای اصلی بازی
    this.words = [];
    this.currentNiveau = "A1";
    this.currentMode = "normal";
    this.currentCase = "all";
    this.currentWord = null;
    this.currentQuestionType = null;
    this.currentSentence = null;
    this.isAnswering = false;
    this.lastFaToDeIndex = 0;
    this.pendingIsCorrect = false;
    this.pendingCorrectAnswer = null;
    this.autoCompleteMode = 1;

    // Question timing (ms since epoch)
    this.questionStartTime = null;
    this.lastResponseDurationMs = null;
    this.FAST_ANSWER_THRESHOLD_MS = 5000;

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
      // بارگذاری داده‌ها
      this.words = await this.dataManager.loadWords(
        this.jsonPath,
        this.currentNiveau,
        this.currentMode,
        this.currentCase,
      );

      this.populateCaseSelect(this.words);

      // ایجاد نمونه‌های منطق و رابط کاربری
      this.gameLogic = new GameLogic(this.words);
      this.uiManager = new UIManager(this);

      this.setupEventListeners();
      this.updateUI();

      // نمایش مودال انتخاب حالت
      document.getElementById("modeModal").classList.remove("hidden");

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

  /**
   * دریافت کلید ترکیب فعلی
   * Get current combination key
   */
  getCurrentKey() {
    return `${this.currentNiveau}_${this.currentMode}_${this.currentCase}`;
  }

  /**
   * دریافت وضعیت فعلی از StateManager
   * Get current state from StateManager
   */
  getCurrentState() {
    return this.stateManager.getCurrentState(
      this.currentNiveau,
      this.currentMode,
      this.currentCase,
    );
  }

  /**
   * ذخیره‌سازی داده‌ها
   * Save all data
   */
  saveData() {
    this.dataManager.saveWords(
      this.words,
      this.currentNiveau,
      this.currentMode,
      this.currentCase,
    );
    this.stateManager.saveState(this.currentNiveau, this.currentMode, this.currentCase);
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
      .addEventListener("change", (e) => this.changeMode(e.target.value));
    document
      .getElementById("caseSelect")
      ?.addEventListener("change", (e) => this.changeCase(e.target.value));

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
      .getElementById("easyBtn")
      .addEventListener("click", () => this.handleEasyMastery());
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
   * ارسال پاسخ در حالت سخت
   * Submit answer in hard mode
   */
  submitHardAnswer() {
    if (this.isAnswering) return;

    const selected = document.getElementById("hardInput").value.trim();
    if (!selected) return;

    this.isAnswering = true;
    const correctAnswer = this.currentWord.word;
    const isCorrect = selected.toLowerCase() === correctAnswer.toLowerCase();

    this.pendingIsCorrect = isCorrect;
    this.pendingCorrectAnswer = correctAnswer;

    const currentState = this.getCurrentState();

    if (isCorrect) {
      currentState.correctAnswers++;
      currentState.score += 30;
    } else {
      currentState.wrongAnswers++;
    }

    currentState.totalQuestions++;
    this.recordAnswerTiming();
    this.saveData();
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

    const currentState = this.getCurrentState();

    if (isCorrect) {
      currentState.correctAnswers++;
      const scoreMap = {
        de_to_fa: 10,
        word_with_sentence: 15,
        fa_to_de: 20,
        sentence_only: 25,
      };
      currentState.score += scoreMap[this.currentQuestionType.type] || 10;
    } else {
      currentState.wrongAnswers++;
    }

    currentState.totalQuestions++;
    currentState.lastWordId = this.currentWord.id;

    this.recordAnswerTiming();
    this.saveData();
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
   * Whether the fast-answer mastery override is available for this result.
   */
  isFastAnswerEligible() {
    return (
      this.pendingIsCorrect === true &&
      this.lastResponseDurationMs != null &&
      this.lastResponseDurationMs < this.FAST_ANSWER_THRESHOLD_MS
    );
  }

  /**
   * Instant mastery: remove current word from repetition cycle (sureCount >= 2).
   */
  handleEasyMastery() {
    if (!this.currentWord || !this.isFastAnswerEligible()) return;

    this.currentWord.sureCount = 2;

    this.saveData();
    this.updateUI();
    this.uiManager.showResultContinueButton();
  }

  /**
   * پردازش سطح اطمینان کاربر
   * Handle user confidence
   */
  handleConfidence(confidence) {
    const isCorrect = this.pendingIsCorrect;
    const isSentence =
      this.currentQuestionType &&
      this.currentQuestionType.isSentence &&
      this.currentSentence;
    const target = isSentence ? this.currentSentence : this.currentWord;

    if (isCorrect) {
      if (confidence === "sure") {
        target.strength = Math.min(1, (target.strength || 0) + 0.25);
        target.dueIn = Math.min(40, (target.dueIn || 0) + 15);
        target.sureCount = (target.sureCount || 0) + 1;
        target.correctStreak = (target.correctStreak || 0) + 1;
        target.mistakeCount = 0;
      } else {
        target.strength = Math.min(1, (target.strength || 0) + 0.08);
        target.dueIn = Math.min(25, Math.max(1, (target.dueIn || 0) + 3));
        target.sureCount = (target.sureCount || 0) - 1;
        target.correctStreak = (target.correctStreak || 0) + 1;
        target.mistakeCount = 0;
      }
    } else {
      if (confidence === "sure") {
        target.strength = Math.max(0.001, (target.strength || 0) - 0.3);
        target.dueIn = 1;
        target.mistakeCount = (target.mistakeCount || 0) + 2;
        target.correctStreak = 0;
        target.sureCount = (target.sureCount || 0) - 1;
      } else {
        target.strength = Math.max(0.001, (target.strength || 0) - 0.05);
        target.dueIn = 1;
        target.mistakeCount = (target.mistakeCount || 0) + 1;
        target.correctStreak = 0;
        target.sureCount = (target.sureCount || 0) - 1;
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
    this.currentMode = newMode;
    await this.reloadWordsForCurrentCombination();

    // Hide resultModal if visible and reset UI to initial panel state
    this.forceResetUIState();
    this.resetSession();
    this.updateUI();
    this.saveData();
    console.log(`🔄 Changed to ${this.getCurrentKey()}`);
  }

  /**
   * تغییر حالت دستوری
   * Change case filter
   */
  async changeCase(newCase) {
    this.currentCase = newCase;
    const sel = document.getElementById("caseSelect");
    if (sel) sel.value = newCase;
    await this.reloadWordsForCurrentCombination();
    this.forceResetUIState();
    this.resetSession();
    this.updateUI();
    this.saveData();
    console.log(`🔄 Changed to ${this.getCurrentKey()}`);
  }

  /**
   * تغییر سطح
   * Change level
   */
  //   changeLevel(newLevel) {
  async changeLevel(newLevel) {
    this.currentNiveau = newLevel;
    await this.reloadWordsForCurrentCombination();
    // Hide resultModal if visible and reset UI to initial panel state
    this.forceResetUIState();
    this.resetSession();
    this.updateUI();
    this.saveData();
    console.log(`🔄 Changed to ${this.getCurrentKey()}`);
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
      this.uiManager.hideEasyMasteryButton();
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
  resetProgress() {
    if (
      confirm(
        "Are you sure you want to reset all progress for current combination?",
      )
    ) {
      this.stateManager.resetProgress(this.currentNiveau, this.currentMode, this.currentCase);

      // ریست پیشرفت کلمات سطح فعلی
      const levelWords = this.words.filter(
        (word) => (word.level || "A1") === this.currentNiveau,
      );
      levelWords.forEach((word) => {
        word.strength = 0.3;
        word.dueIn = 0;
        word.seenCount = 0;
        word.mistakeCount = 0;
        word.correctStreak = 0;
        word.sureCount = 0;

        if (word.sentences) {
          word.sentences.forEach((sentence) => {
            sentence.strength = 0.3;
            sentence.dueIn = 0;
            sentence.mistakeCount = 0;
            sentence.seenCount = 0;
            sentence.correctStreak = 0;
            sentence.sureCount = 0;
          });
        }
      });

      this.forceResetUIState();
      this.resetSession();
      this.updateUI();
      this.saveData();

      // Enable panel click after reset
      this.isGameStartEligible = true;

      console.log(`🗑️ Reset progress for ${this.getCurrentKey()}`);
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

    this.currentWord.seenCount = (this.currentWord.seenCount || 0) + 1;

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
