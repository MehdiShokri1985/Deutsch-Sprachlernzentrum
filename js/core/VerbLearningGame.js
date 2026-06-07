/**
 * Verb learning game — meaning as question, infinitive as answer.
 */

import { AdaptiveLearningGame } from "./AdaptiveLearningGame.js";
import { VerbGameLogic } from "./VerbGameLogic.js";
import { VerbUIManager } from "../Ui/VerbUIManager.js";

export class VerbLearningGame extends AdaptiveLearningGame {
  async init() {
    try {
      this.words = await this.dataManager.loadWords(
        this.jsonPath,
        this.currentNiveau,
        this.currentMode,
        this.currentCase,
      );

      this.populateCaseSelect(this.words);
      this.gameLogic = new VerbGameLogic(this.words);
      this.uiManager = new VerbUIManager(this);

      this.setupEventListeners();
      this.updateUI();

      document.getElementById("modeModal").classList.remove("hidden");
      this.isGameStartEligible = true;
    } catch (error) {
      console.error("Error initializing verb game:", error);
      this.showError("Failed to load game data");
    }
  }

  determineQuestionType(word) {
    return this.gameLogic.determineQuestionType(word);
  }

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
