/**
 * UI manager for verb learning page (+ conjugation practice).
 */

import { UIManager } from "./UIManager.js";
import { VerbConjugationPractice } from "./VerbConjugationPractice.js";

export class VerbUIManager extends UIManager {
  constructor(game) {
    super(game);
    this.conjugationPractice = new VerbConjugationPractice(game);
    this.setupVerbPracticeButton();
  }

  setupVerbPracticeButton() {
    const btn = document.getElementById("practiceVerbFormsBtn");
    btn?.addEventListener("click", () => {
      if (this.game.currentWord) {
        this.conjugationPractice.open(this.game.currentWord);
      }
    });
  }

  setResultModalActions(mode) {
    super.setResultModalActions(mode);

    const group = document.getElementById("resultModalContinueGroup");
    const continueBtn = document.getElementById("continueBtn");
    const isContinue = mode === "continue";
    const isLevelComplete = mode === "levelComplete";
    const showGroup =
      isContinue &&
      !isLevelComplete &&
      this.modalSource === "answerFlow" &&
      !!this.game.currentWord;

    group?.classList.toggle("hidden", !showGroup);
    if (continueBtn && showGroup) {
      continueBtn.classList.remove("hidden");
    }

    this.updatePracticeVerbButton(mode);
  }

  updatePracticeVerbButton(mode) {
    const btn = document.getElementById("practiceVerbFormsBtn");
    if (!btn) return;

    const show =
      mode === "continue" &&
      this.modalSource === "answerFlow" &&
      this.game.currentWord;

    btn.classList.toggle("game-result-btn--verb-practice-active", !!show);
  }

  resetResultModalButtons() {
    super.resetResultModalButtons();
    const mode =
      this.modalSource === "levelComplete" ? "levelComplete" : "answer";
    this.updatePracticeVerbButton(mode);
  }

  showResultContinueButton() {
    super.showResultContinueButton();
    this.updatePracticeVerbButton("continue");
  }

  showLevelComplete() {
    super.showLevelComplete();
    this.updatePracticeVerbButton("levelComplete");
  }

  closeModal() {
    this.conjugationPractice.close();
    super.closeModal();
  }
}
