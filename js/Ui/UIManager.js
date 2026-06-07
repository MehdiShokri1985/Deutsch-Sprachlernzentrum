/**
 * مدیریت تمام عملیات مربوط به رابط کاربری (UI Manager)
 * User Interface Manager - Handles all DOM interactions
 */

import { WordProgressSquares } from "./WordProgressSquares.js";
import { getTensePersonEntries, VERB_TENSE_LABELS, VERB_TENSE_KEYS } from "../core/verbUtils.js";


export class UIManager {
  constructor(game) {
    this.game = game; // مرجع به instance اصلی بازی
    this.modalSource = null; // Track where the modal was opened from

        this.wordProgressSquares = new WordProgressSquares(game, (word) =>
      this.openWordDetailsModal(word),
    );


    this.setupWordDetailsPopup();
    this.setupAccordionListeners();
  }

  /**
   * به‌روزرسانی کامل رابط کاربری
   * Update all UI elements
   */
  updateUI() {
    const levelWords = this.game.words.filter(
      (w) => (w.level || "A1") === this.game.currentNiveau,
    );

    let totalSureNeeded = levelWords.length * 2;
    let totalSureAchieved = levelWords.reduce(
      (sum, word) => sum + Math.min(2, word.sureCount || 0),
      0,
    );

    const percentage =
      totalSureNeeded > 0
        ? Math.round((totalSureAchieved / totalSureNeeded) * 100)
        : 0;
    const currentState = this.game.getCurrentState();

    // Debug logging
    console.log(`🔍 DEBUG updateUI - ${this.game.getCurrentKey()}:`, {
      activeNiveau: this.game.currentNiveau,
      activeMode: this.game.currentMode,
      progress: percentage,
    });

    // به‌روزرسانی شمارنده‌ها
    document.getElementById("correctCount").textContent =
      currentState.correctAnswers;
    document.getElementById("wrongCount").textContent =
      currentState.wrongAnswers;
    const scoreEl = document.getElementById("score");
    if (scoreEl) scoreEl.textContent = currentState.score;
    document.getElementById("masteryProgress").textContent = percentage;
    document.getElementById("progressBar").style.width = `${percentage}%`;

    // تنظیم selectها
    document.getElementById("levelSelect").value = this.game.currentNiveau;
    document.getElementById("modeSelect").value = this.game.currentMode;

    // آمار سطح
    document.getElementById("levelStats").innerHTML =
      `Wörter: <strong>${levelWords.length}</strong> | Richtig: <strong class="text-green-500">${currentState.correctAnswers}</strong> | Falsch: <strong class="text-red-500">${currentState.wrongAnswers}</strong>`;
    // رندر مربع‌های پیشرفت کلمات
    //########################################################################################
    //########################################################################################
    //########################################################################################
    this.renderWordProgressSquares(levelWords);
  }

  /**
 
  /**
   * رندر مربع‌های پیشرفت کلمات
   * Render word progress squares
   */
  renderWordProgressSquares(levelWords) {
   this.wordProgressSquares.render(levelWords);
  }

  /**
   * باز کردن مودال جزئیات کلمه با مخفی کردن آیکون، عنوان و پیام
   * Open word details modal with icon, title, and message hidden
   */
  openWordDetailsModal(word) {
    const popup = document.getElementById("wordDetailsPopup");
    const content = document.getElementById("wordDetailsContent");

    // Dynamic field rendering
    let html = "";

    // Word
    if (word.word) {
      html += `<div class="mb-3 pb-3 border-b border-gray-200">
        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Word</div>
        <div class="text-lg font-bold">
          <a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(word.word)}" target="_blank" class="theme-word-link hover:underline">${word.word}</a>
        </div>
      </div>`;
    }

    // Meaning
    if (word.meaning) {
      html += `<div class="mb-3 pb-3 border-b border-gray-200">
        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Meaning</div>
        <div class="text-gray-700">${word.meaning}</div>
      </div>`;
    }

    // Type
    // if (word.type) {
    //   html += `<div class="mb-3 pb-3 border-b border-gray-200">
    //     <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Type</div>
    //     <div class="text-gray-700">${word.type}</div>
    //   </div>`;
    // }

    // Level
    // if (word.level) {
    //   html += `<div class="mb-3 pb-3 border-b border-gray-200">
    //     <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Level</div>
    //     <div class="text-gray-700">${word.level}</div>
    //   </div>`;
    // }

    // Sure Count
    // if (word.sureCount !== undefined) {
    //   html += `<div class="mb-3 pb-3 border-b border-gray-200">
    //     <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Sure Count</div>
    //     <div class="text-gray-700 font-semibold">${word.sureCount}</div>
    //   </div>`;
    // }

    // Strength
    // if (word.strength !== undefined) {
    //   html += `<div class="mb-3 pb-3 border-b border-gray-200">
    //     <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Strength</div>
    //     <div class="text-gray-700">${(word.strength * 100).toFixed(1)}%</div>
    //   </div>`;
    // }

    // Due In
    // if (word.dueIn !== undefined) {
    //   html += `<div class="mb-3 pb-3 border-b border-gray-200">
    //     <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Due In</div>
    //     <div class="text-gray-700">${word.dueIn} questions</div>
    //   </div>`;
    // }

    // Seen Count
    // if (word.seenCount !== undefined) {
    //   html += `<div class="mb-3 pb-3 border-b border-gray-200">
    //     <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Seen Count</div>
    //     <div class="text-gray-700">${word.seenCount}</div>
    //   </div>`;
    // }

    // Mistake Count
    // if (word.mistakeCount !== undefined) {
    //   html += `<div class="mb-3 pb-3 border-b border-gray-200">
    //     <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Mistake Count</div>
    //     <div class="text-gray-700">${word.mistakeCount}</div>
    //   </div>`;
    // }

    // Correct Streak
    // if (word.correctStreak !== undefined) {
    //   html += `<div class="mb-3 pb-3 border-b border-gray-200">
    //     <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Correct Streak</div>
    //     <div class="text-gray-700">${word.correctStreak}</div>
    //   </div>`;
    // }

    // ID
    // if (word.id) {
    //   html += `<div class="mb-3 pb-3 border-b border-gray-200">
    //     <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">ID</div>
    //     <div class="text-gray-700 text-xs">${word.id}</div>
    //   </div>`;
    // }

    // Sentences
    if (word.sentences && word.sentences.length > 0) {
      html += `<div class="mt-4">
        <div class="text-xs text-gray-500 uppercase tracking-wide mb-2">Example Sentences</div>`;
      word.sentences.slice(0, 5).forEach((s, index) => {
        html += `<div class="mb-3 p-3 bg-gray-50 rounded-lg">`;
        if (s.de) {
          html += `<div class="text-sm text-blue-700 mb-1">
            <a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(s.de)}" target="_blank" class="hover:underline">${s.de}</a>
          </div>`;
        }
        if (s.fa) {
          html += `<div class="text-sm text-gray-600 text-right rtl" dir="rtl">"${s.fa}"</div>`;
        }

        html += `</div>`;
      });
      html += `</div>`;
    }

    content.innerHTML = html;
    popup.classList.remove("hidden");
    popup.classList.add("flex");
  }

  /**
   * بستن پاپآپ جزئیات کلمه
   * Close word details popup
   */
  closeWordDetailsPopup() {
    const popup = document.getElementById("wordDetailsPopup");
    popup.classList.add("hidden");
    popup.classList.remove("flex");
  }

  setupWordDetailsPopup() {
    const popup = document.getElementById("wordDetailsPopup");
    popup.addEventListener("click", (e) => {
      if (e.target === popup) {
        this.closeWordDetailsPopup();
      }
    });
  }

  setupAccordionListeners() {
    const handleClick = (e) => {
      const header = e.target.closest(".accordion-header");
      if (!header) return;
      const item = header.closest(".accordion-item");
      if (!item) return;
      const body = item.querySelector(".accordion-body");
      if (!body) return;
      const isOpen = item.classList.toggle("is-open");
      body.style.maxHeight = isOpen ? `${body.scrollHeight}px` : "0";
    };
    document
      .getElementById("correctAnswersList")
      ?.addEventListener("click", handleClick);
    document
      .getElementById("mistakesList")
      ?.addEventListener("click", handleClick);
  }

  /**
   * Show or hide the fast-answer "خیلی راحت" button (no layout gap when hidden).
   */
  updateEasyMasteryButton() {
    const easyBtn = document.getElementById("easyBtn");
    if (!easyBtn) return;

    const show =
      this.modalSource === "answerFlow" && this.game.isFastAnswerEligible();
    easyBtn.classList.toggle("hidden", !show);
  }

  hideEasyMasteryButton() {
    const easyBtn = document.getElementById("easyBtn");
    if (easyBtn) easyBtn.classList.add("hidden");
  }

  setWordProgressSquaresVisible(visible) {
    const el = document.getElementById("wordProgressSquares");
    if (el) el.classList.toggle("hidden", !visible);
  }

  /**
   * Toggle result modal actions: confidence buttons vs level-complete replay.
   */
  setResultModalActions(mode) {
    const sureBtn = document.getElementById("sureBtn");
    const maybeBtn = document.getElementById("maybeBtn");
    const practiceAgainBtn = document.getElementById("practiceAgainBtn");
    const continueBtn = document.getElementById("continueBtn");
    const isLevelComplete = mode === "levelComplete";
    const isContinue = mode === "continue";

    if (sureBtn) sureBtn.classList.toggle("hidden", isLevelComplete || isContinue);
    if (maybeBtn) maybeBtn.classList.toggle("hidden", isLevelComplete || isContinue);
    if (practiceAgainBtn) {
      practiceAgainBtn.classList.toggle("hidden", !isLevelComplete);
    }
    if (continueBtn) {
      continueBtn.classList.toggle("hidden", !isContinue);
    }
    if (isLevelComplete || isContinue) {
      this.hideEasyMasteryButton();
    }
  }

  /**
   * After confidence / easy: hide rating buttons, show Continue.
   */
  showResultContinueButton() {
    this.setResultModalActions("continue");
  }

  resetResultModalButtons() {
    this.setResultModalActions(
      this.modalSource === "levelComplete" ? "levelComplete" : "answer",
    );
    if (this.modalSource === "answerFlow") {
      this.updateEasyMasteryButton();
    }
  }

  //#########################################################################################
  //#########################################################################################
  //#########################################################################################

  /**
   * Generate type label HTML if type exists
   */
  getTypeLabelHTML() {
    if (this.game.currentWord && this.game.currentWord.type) {
      return `<span class="theme-type-label absolute top-0 left-0 text-xs px-2 py-1 rounded-md font-medium">${this.game.currentWord.type}</span>`;
    }
    return "";
  }

  /**
   * نمایش سوال
   * Render current question
   */
  renderQuestion() {
    const wordDisplay = document.getElementById("fallingWord");
    const sentenceDisplay = document.getElementById("sentenceDisplay");
    const questionType = document.getElementById("questionType");
    const answerOptions = document.getElementById("answerOptions");
    const hardContainer = document.getElementById("hardInputContainer");

    answerOptions.innerHTML = "";
    hardContainer.classList.add("hidden");
    document.getElementById("hardInput").value = "";
    document.getElementById("autocompleteList").classList.add("hidden");

    if (this.game.currentMode === "hard") {
      hardContainer.classList.remove("hidden");
      this.renderHardQuestion();
    } else {
      wordDisplay.className = "falling-word font-bold relative";
      sentenceDisplay.classList.add("hidden");
      questionType.textContent = "";

      const isSentence =
        this.game.currentQuestionType.isSentence && this.game.currentSentence;
      const target = isSentence
        ? this.game.currentSentence
        : this.game.currentWord;
      const sureCount = target.sureCount || 0;
      const typeLabel = this.getTypeLabelHTML();
      console.log(this.game.currentWord);
      switch (this.game.currentQuestionType.type) {
        case "de_to_fa":
          const pronDe = this.game.currentWord.pronunciation || "";
          const pronHtmlDe = pronDe
            ? `<br><span class="pronunciation">(${pronDe})</span>`
            : "";
          wordDisplay.innerHTML = `${typeLabel}<a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(this.game.currentWord.word)}" target="_blank" class="theme-word-link hover:underline">${this.game.currentWord.word}</a>${pronHtmlDe}`;
          // questionType.textContent = "Auf Persisch übersetzen";
          break;
        case "word_with_sentence":
          sentenceDisplay.textContent = `"${this.game.currentSentence.fa}"`;
          sentenceDisplay.classList.remove("hidden");
          // questionType.textContent = "Finde das Adjektiv";
          wordDisplay.innerHTML = `${typeLabel}?`;
          break;
        case "fa_to_de":
          wordDisplay.innerHTML = `${typeLabel}${this.game.currentWord.meaning}`;
          // questionType.textContent = "Ins Deutsche übersetzen";
          break;
        case "sentence_only":
          sentenceDisplay.textContent = `"${this.game.currentSentence.de}"`;
          sentenceDisplay.classList.remove("hidden");
          // questionType.textContent = "Was bedeutet dieser Satz?";
          wordDisplay.innerHTML = `${typeLabel}?`;
          break;
      }

      questionType.textContent += ` (Sure: ${sureCount}/2)`;
      this.generateAnswerOptions();
    }
  }

  /**
   * نمایش سوال در حالت Hard (ورودی متنی)
   */
  renderHardQuestion() {
    const wordDisplay = document.getElementById("fallingWord");
    const sentenceDisplay = document.getElementById("sentenceDisplay");
    const questionType = document.getElementById("questionType");

    wordDisplay.className = "falling-word font-bold";
    sentenceDisplay.classList.add("hidden");
    questionType.textContent = "";

    const isSentence =
      this.game.currentQuestionType.isSentence && this.game.currentSentence;
    const target = isSentence
      ? this.game.currentSentence
      : this.game.currentWord;
    const sureCount = target.sureCount || 0;

    if (
      this.game.currentQuestionType.type === "word_with_sentence" ||
      this.game.currentQuestionType.type === "sentence_only"
    ) {
      sentenceDisplay.textContent = `"${this.game.currentSentence.fa}"`;
      sentenceDisplay.classList.remove("hidden");
      // questionType.textContent = "Schreibe das passende Adjektiv";
      wordDisplay.textContent = "?";
    } else {
      wordDisplay.textContent = this.game.currentWord.meaning;
      // questionType.textContent = "Ins Deutsche übersetzen (eintippen)";
    }

    questionType.textContent += ` (Sure: ${sureCount}/2)`;
  }

  /**
   * تولید گزینه‌های پاسخ چندگزینه‌ای
   */
  generateAnswerOptions() {
    const answerOptions = document.getElementById("answerOptions");
    answerOptions.innerHTML = "";

    let correctAnswer;
    switch (this.game.currentQuestionType.type) {
      case "de_to_fa":
        correctAnswer = this.game.currentWord.meaning;
        break;
      case "word_with_sentence":
        correctAnswer = this.game.currentWord.word;
        break;
      case "fa_to_de":
        correctAnswer = this.game.currentWord.word;
        break;
      case "sentence_only":
        correctAnswer = this.game.currentSentence.fa;
        break;
    }

    let options = [correctAnswer];
    const distractors = this.generateDistractors(correctAnswer, 3);
    options = options.concat(distractors);
    options.sort(() => Math.random() - 0.5);

    options.forEach((option) => {
      const button = document.createElement("button");
      button.className =
        "game-answer-btn bg-white border-1 border-gray-300 rounded-lg text-center transition-all transform hover:scale-105 shadow focus:outline-none focus:ring-2 focus:ring-offset-2";

      if (
        this.game.currentQuestionType.type === "fa_to_de" ||
        this.game.currentQuestionType.type === "word_with_sentence"
      ) {
        const verbForOption = this.game.words.find((w) => w.word === option);
        const pron = verbForOption?.pronunciation || "";
        const pronHtml = pron
          ? ` <span class="pronunciation">(${pron})</span>`
          : "";
        button.innerHTML = `<div class="flex justify-between items-center"><span>${option}${pronHtml}</span><a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(option)}" target="_blank" class="theme-translate-link text-sm ml-2" onclick="event.stopPropagation()">🌐</a></div>`;
      } else {
        button.textContent = option;
      }

      button.addEventListener("click", () =>
        this.game.checkAnswer(option, correctAnswer),
      );
      answerOptions.appendChild(button);
    });
  }

  /**
   * تولید گزینه‌های انحرافی (کامل)
   */
  generateDistractors(correctAnswer, count) {
    let distractors = new Set();
    const type = this.game.currentQuestionType.type;
    let candidates = [];

    if (type === "de_to_fa") {
      candidates = this.game.words
        .filter((w) => w.meaning !== correctAnswer)
        .map((w) => w.meaning);
    } else if (type === "fa_to_de" || type === "word_with_sentence") {
      candidates = this.game.words
        .filter((w) => w.word !== correctAnswer)
        .map((w) => w.word);
    } else if (type === "sentence_only") {
      candidates = this.game.words
        .flatMap((w) => w.sentences || [])
        .filter((s) => s.fa !== correctAnswer)
        .map((s) => s.fa);
    }

    candidates.sort(() => Math.random() - 0.5);

    for (let item of candidates) {
      if (distractors.size >= count) break;
      const correctLen = String(correctAnswer).length;
      const itemLen = String(item).length;
      if (
        Math.abs(correctLen - itemLen) <= 3 ||
        (correctAnswer &&
          item &&
          String(correctAnswer)[0].toLowerCase() ===
            String(item)[0].toLowerCase())
      ) {
        distractors.add(item);
      }
    }

    // Fallbacks
    while (distractors.size < count && candidates.length > 0) {
      distractors.add(
        candidates[Math.floor(Math.random() * candidates.length)],
      );
    }

    return Array.from(distractors).slice(0, count);
  }

  /**
   * نمایش نتیجه پاسخ
   */
  showResult(isCorrect, correctAnswer) {
    const modal = document.getElementById("resultModal");
    this.modalSource = "answerFlow";
    this.displayOriginalSentence();
    const currentState = this.game.getCurrentState();

    if (isCorrect) {
      document.getElementById("modalIcon").textContent = "";
      document.getElementById("modalTitle").textContent = "Correct!";
      document.getElementById("modalTitle").className =
        "text-2xl  mb-2 text-green-600";
      this.playSound("correct");

      currentState.correctAnswersList = currentState.correctAnswersList || [];
      const existingCorrect = currentState.correctAnswersList.find(
        (m) => m.word === this.game.currentWord.word,
      );
      if (!existingCorrect) {
        currentState.correctAnswersList.unshift({
          word: this.game.currentWord.word,
          meaning: this.game.currentWord.meaning,
          sentences: this.game.currentWord.sentences
            ? [...this.game.currentWord.sentences]
            : [],
          prasens: this.game.currentWord.prasens,
          perfekt: this.game.currentWord.perfekt,
          prateritum: this.game.currentWord.prateritum,
          futur: this.game.currentWord.futur,
        });
      }
    } else {
      document.getElementById("modalIcon").textContent = "";
      document.getElementById("modalTitle").textContent = "Wrong";
      document.getElementById("modalTitle").className =
        "text-2xl mb-2 text-red-600";
      // document.getElementById("modalMessage").textContent =
      //   `The correct answer was: ${correctAnswer}`;
      this.playSound("wrong");

      const existingMistake = currentState.mistakes.find(
        (m) => m.word === this.game.currentWord.word,
      );
      if (!existingMistake) {
        currentState.mistakes.unshift({
          word: this.game.currentWord.word,
          meaning: this.game.currentWord.meaning,
          sentences: this.game.currentWord.sentences
            ? [...this.game.currentWord.sentences]
            : [],
          prasens: this.game.currentWord.prasens,
          perfekt: this.game.currentWord.perfekt,
          prateritum: this.game.currentWord.prateritum,
          futur: this.game.currentWord.futur,
        });
        if (currentState.mistakes.length > 20) currentState.mistakes.pop();
      }
      this.game.saveData();
    }

    const pron = this.game.currentWord.pronunciation || "";
    const pronHtml = pron
      ? ` <span class="pronunciation">(${pron})</span>`
      : "";
    const w = this.game.currentWord;
    let content = `<div class="md-pair-row md-word-row"><div class="md-pair-start"><strong class="md-label"> . </strong> <a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(w.word)}" target="_blank" class="md-word-link hover:underline" style="font-size:1.15rem">${w.word}</a> ${pronHtml}</div><div class="md-pair-end" dir="rtl">${w.meaning}</div></div>`;
    if (w.prasens && w.prasens.length > 0) {
      content += `<div class="md-pair-row" style="font-size:0.85rem;color:#4f6f0c;background-color: #f9fff2"><span style="font-weight:400">. ${w.prasens[0].form} / ${w.perfekt?.[3]?.form || '?'} / ${w.prateritum?.[0]?.form || '?'}</span></div>`;
    }

    if (w.caseverb && w.caseverb.length > 0) {
      const caseColors = {
        "Intransitiv": '#6b7280',
        "Akk": '#2563eb',
        "Dativ": '#0d9488',
        'Dativ für Person': '#0f766e',
        gen: '#7c3aed',
        nom: '#d97706'
      };
      w.caseverb.forEach((cv) => {
        const color = caseColors[cv.case] || '#6b7280';
        content += `<div style="margin-top:0.2rem"><span style="font-size:0.7rem;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.04em">${cv.case}</span></div>`;
        cv.examples.forEach((ex) => {
          content += `<div class="md-pair-row" style="margin-top:0.05rem"><div class="md-pair-start" style="color:#1f2937;font-weight:500"><a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(ex.german)}" target="_blank" class="hover:underline" style="color:inherit">${ex.german}</a></div><div class="md-pair-end" dir="rtl" style="font-size:0.8rem;color:#6b7280">${ex.persian}</div></div>`;
        });
      });
    }

    if (
      this.game.currentWord.sentences &&
      this.game.currentWord.sentences.length > 0
    ) {
      // content += `<div class="md-section-label"><strong>Example Sentences:</strong></div>`;
      this.game.currentWord.sentences.slice(0, 3).forEach((s) => {
        content += `<div class="md-pair-row md-example-row"><div class="md-pair-start"><a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(s.de)}" target="_blank" class="md-example-de hover:underline">${s.de}</a></div><div class="md-pair-end" dir="rtl">"${s.fa}"</div></div>`;
      });
    }

    const synTags = w.synonyms?.length > 0 ? w.synonyms.map(s => `<a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(s)}&op=translate" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:0.1rem 0.5rem;font-size:0.75rem;font-weight:500;color:#065f46;background:#d1fae5;border-radius:999px;text-decoration:none;transition:background 0.15s" onmouseover="this.style.background='#a7f3d0'" onmouseout="this.style.background='#d1fae5'">${s}</a>`).join('') : '';
    const antTags = w.antonyms?.length > 0 ? w.antonyms.map(a => `<a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(a)}&op=translate" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:0.1rem 0.5rem;font-size:0.75rem;font-weight:500;color:#991b1b;background:#fee2e2;border-radius:999px;text-decoration:none;transition:background 0.15s" onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'">${a}</a>`).join('') : '';
    const synCol = synTags ? `<div style="flex:1 1 160px;min-width:0"><div style="font-size:0.7rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.15rem">Synonyms</div><div style="display:flex;flex-wrap:wrap;gap:0.3rem">${synTags}</div></div>` : '';
    const antCol = antTags ? `<div style="flex:1 1 160px;min-width:0"><div style="font-size:0.7rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.15rem">Antonyms</div><div style="display:flex;flex-wrap:wrap;gap:0.3rem">${antTags}</div></div>` : '';
    if (synCol || antCol) {
      content += `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.3rem">${synCol}${antCol}</div>`;
    }

    document.getElementById("modalDetails").innerHTML = content;

    // Hide question view and show inline result view
    document.getElementById("panel").classList.add("hidden");
    document.getElementById("answerOptions").classList.add("hidden");
    document.getElementById("hardInputContainer").classList.add("hidden");
    document.getElementById("autocompleteList").classList.add("hidden");

    this.resetResultModalButtons();
    this.setWordProgressSquaresVisible(true);
    modal.classList.remove("hidden");
  }

  /**
   * نمایش جمله اصلی بعد از پاسخ
   */
  displayOriginalSentence() {
    const wordDisplay = document.getElementById("fallingWord");
    const sentenceDisplay = document.getElementById("sentenceDisplay");
    const questionType = document.getElementById("questionType");

    wordDisplay.className = "falling-word font-bold";
    sentenceDisplay.classList.remove("hidden");
    questionType.textContent = "Original sentence";

    if (
      (this.game.currentQuestionType.isSentence ||
        this.game.currentQuestionType.type === "word_with_sentence") &&
      this.game.currentSentence
    ) {
      sentenceDisplay.textContent = `"${this.game.currentSentence.de}"`;
      const pronOrig = this.game.currentWord.pronunciation || "";
      const pronHtmlOrig = pronOrig
        ? `<br><span class="pronunciation">(${pronOrig})</span>`
        : "";
      wordDisplay.innerHTML = `<a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(this.game.currentWord.word)}" target="_blank" class="theme-word-link hover:underline">${this.game.currentWord.word}</a>${pronHtmlOrig} ✓`;
    } else if (
      this.game.currentWord.sentences &&
      this.game.currentWord.sentences.length > 0
    ) {
      const rs =
        this.game.currentWord.sentences[
          Math.floor(Math.random() * this.game.currentWord.sentences.length)
        ];
      sentenceDisplay.innerHTML = `<div class="text-gray-800"><a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(rs.de)}" target="_blank" class="hover:underline break-words">${rs.de}</a></div><div class="text-gray-600 mt-1 sm:mt-2" dir="rtl">"${rs.fa}"</div>`;
      const pronOrig2 = this.game.currentWord.pronunciation || "";
      const pronHtmlOrig2 = pronOrig2
        ? `<br><span class="pronunciation">(${pronOrig2})</span>`
        : "";
      wordDisplay.innerHTML = `<a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(this.game.currentWord.word)}" target="_blank" class="theme-word-link hover:underline">${this.game.currentWord.word}</a>${pronHtmlOrig2} ✓`;
    }
  }

  /**
   * Render tense table HTML for a verb item
   */
  renderTensesHTML(item) {
    let html = "";
    for (const tenseKey of VERB_TENSE_KEYS) {
      const entries = getTensePersonEntries(item, tenseKey);
      if (entries.length === 0) continue;
      const label = VERB_TENSE_LABELS[tenseKey];
      html += `<div class="mb-4 last:mb-0">
        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">${label}</div>
        <div class="bg-white rounded-lg overflow-hidden border border-gray-200">
          <table class="w-full text-sm">
            <tbody>`;
      entries.forEach(({ person, form,fa }) => {
        html += `<tr class="border-b border-gray-100 last:border-0">
          <td class="py-1.5 px-3">
            <a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(person+' '+form)}" target="_blank" class="text-gray-500  font-medium hover:underline inline-block">${person+' '+form}</a>
          
          </td>

        </tr>`;
      });
      html += `</tbody></table></div></div>`;
    }
    return html;
  }

  /**
   * Render a single accordion card for correct/mistake list items
   */
  renderAccordionCard(item, colors) {
    const { border, bg, hover, text, textMuted, borderInner, chevron } = colors;
    const hasTenses = VERB_TENSE_KEYS.some(
      (key) => Array.isArray(item[key]) && item[key].length > 0,
    );

    let html = `
    <div class="accordion-item border ${border} rounded-xl ${bg} overflow-hidden transition-colors">
      <div class="accordion-header p-5 cursor-pointer select-none hover:${hover} transition-colors flex items-start justify-between gap-3" role="button" tabindex="0">
        <div class="flex-1 min-w-0">
          <a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(item.word)}" target="_blank" class="${text} font-bold hover:underline text-xl block" onclick="event.stopPropagation()">${item.word}</a>
          <div class="${textMuted} mt-1 text-md text-right dir-rtl" dir="rtl">${item.meaning}</div>
        </div>
        <span class="accordion-chevron-wrap mt-1.5 shrink-0 flex items-center justify-center">
          <svg class="accordion-chevron ${chevron}" width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6.5 9L11 13.5L15.5 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </div>
      <div class="accordion-body max-h-0 overflow-hidden transition-all duration-300 ease-in-out">
        <div class="px-5 pb-5">
          <div class="border-t ${borderInner} pt-4 space-y-4">`;

    if (hasTenses) {
      html += this.renderTensesHTML(item);
    }

    if (item.sentences && item.sentences.length > 0) {
      const labelColor = text;
      html += `<div><div class="text-sm font-semibold ${labelColor} mb-2">Examples:</div>`;
      item.sentences.forEach((s) => {
        html += `
          <div class="mb-3 bg-white rounded-xl p-4 border border-gray-200">
            <div class="text-gray-800"><a href="https://translate.google.com/?sl=de&tl=fa&text=${encodeURIComponent(s.de)}" target="_blank" class="hover:underline">${s.de}</a></div>
            <div class="text-emerald-700 mt-1 text-right dir-rtl" dir="rtl">"${s.fa}"</div>
          </div>`;
      });
      html += `</div>`;
    }

    html += `</div></div></div></div>`;
    return html;
  }

  /**
   * نمایش لیست اشتباهات
   */
  showMistakesModal() {
    const modal = document.getElementById("mistakesModal");
    const listContainer = document.getElementById("mistakesList");
    listContainer.innerHTML = "";

    const currentState = this.game.getCurrentState();

    if (currentState.mistakes.length === 0) {
      listContainer.innerHTML = `<p class="text-gray-500 text-center py-8">Bisher wurden keine Fehler registriert.</p>`;
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      return;
    }

    const colors = {
      border: "border-red-200",
      bg: "bg-red-50",
      hover: "bg-red-100",
      text: "text-red-500",
      textMuted: "text-gray-400",
      borderInner: "border-red-200",
      chevron: "text-red-400",
    };

    currentState.mistakes.forEach((item) => {
      listContainer.innerHTML += this.renderAccordionCard(item, colors);
    });

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  closeMistakesModal() {
    const modal = document.getElementById("mistakesModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  showCorrectAnswersModal() {
    const modal = document.getElementById("correctAnswersModal");
    const listContainer = document.getElementById("correctAnswersList");
    listContainer.innerHTML = "";

    const currentState = this.game.getCurrentState();
    currentState.correctAnswersList = currentState.correctAnswersList || [];

    if (currentState.correctAnswersList.length === 0) {
      listContainer.innerHTML = `<p class="text-gray-500 text-center py-8">Noch keine richtigen Antworten.</p>`;
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      return;
    }

    const colors = {
      border: "border-green-200",
      bg: "bg-green-50",
      hover: "bg-green-100",
      text: "text-green-600",
      textMuted: "text-gray-400",
      borderInner: "border-green-200",
      chevron: "text-green-600",
    };

    currentState.correctAnswersList.forEach((item) => {
      listContainer.innerHTML += this.renderAccordionCard(item, colors);
    });

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  closeCorrectAnswersModal() {
    const modal = document.getElementById("correctAnswersModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  resetSession() {
    document.getElementById("fallingWord").textContent =
      "Klicke hier, um zu beginnen.";
    document.getElementById("sentenceDisplay").classList.add("hidden");
    document.getElementById("answerOptions").innerHTML = "";
    document.getElementById("hardInputContainer").classList.add("hidden");
  }

  showLevelComplete() {
    const modal = document.getElementById("resultModal");
    this.modalSource = "levelComplete";
    this.setResultModalActions("levelComplete");
    this.setWordProgressSquaresVisible(true);
    document.getElementById("modalIcon").textContent = "🎉";
    document.getElementById("modalTitle").textContent = "Level Complete!";
    document.getElementById("modalTitle").className =
      "text-2xl mb-2 text-green-600";
    // document.getElementById("modalMessage").textContent =
    //   `You have mastered all active words in ${this.game.currentNiveau}!`;
    document.getElementById("modalDetails").innerHTML =
      `<div class="text-center py-6 text-gray-600">You can continue practicing or change level from the menu.</div>`;

    // Hide question view and show inline result view
    document.getElementById("panel").classList.add("hidden");
    document.getElementById("answerOptions").classList.add("hidden");
    document.getElementById("hardInputContainer").classList.add("hidden");
    document.getElementById("autocompleteList").classList.add("hidden");

    modal.classList.remove("hidden");
  }

  closeModal() {
    this.hideEasyMasteryButton();
    this.resetResultModalButtons();
    this.setWordProgressSquaresVisible(false);

    const modal = document.getElementById("resultModal");
    modal.classList.add("hidden");

    // Restore question view
    document.getElementById("panel").classList.remove("hidden");
    document.getElementById("answerOptions").classList.remove("hidden");

    // Restore hidden elements
    document.getElementById("modalIcon").classList.remove("hidden");
    document.getElementById("modalTitle").classList.remove("hidden");
    // document.getElementById("modalMessage").classList.remove("hidden");

    this.game.isAnswering = false;

    if (this.modalSource === "answerFlow" && this.game.currentWord) {
      this.game.nextQuestion();
    }

    this.modalSource = null;
  }

  handleInput() {
    const input = document.getElementById("hardInput").value.trim();
    const list = document.getElementById("autocompleteList");
    list.innerHTML = "";

    if (!input || this.game.autoCompleteMode === 0) {
      list.classList.add("hidden");
      return;
    }

    const minLength = this.game.autoCompleteMode;
    if (input.length < minLength) {
      list.classList.add("hidden");
      return;
    }

    const candidates = this.game.words
      .filter((w) => w.word.toLowerCase().startsWith(input.toLowerCase()))
      .slice(0, 8);

    if (candidates.length === 0) {
      list.classList.add("hidden");
      return;
    }

    candidates.forEach((word) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "game-autocomplete-chip";
      btn.textContent = word.word;
      btn.setAttribute("role", "option");
      btn.onclick = () => {
        document.getElementById("hardInput").value = word.word;
        list.classList.add("hidden");
        this.game.submitHardAnswer();
      };
      list.appendChild(btn);
    });

    list.classList.remove("hidden");
  }

  playSound(type) {
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = type === "correct" ? 800 : 300;
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  }

  showError(message) {
    const toast = document.createElement("div");
    toast.className =
      "fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}
