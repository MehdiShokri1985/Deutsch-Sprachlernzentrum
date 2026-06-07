/**
 * منطق اصلی انتخاب کلمه و نوع سوال (بدون وابستگی به UI)
 * Core game logic: word selection and question type determination
 */

export class GameLogic {
  constructor(words) {
    this.words = words;
    /** @type {string[]|null} shuffled word ids for current session */
    this._sessionOrder = null;
  }

  /**
   * Shuffle question order once per game session (not by id sort).
   */
  initSessionOrder(currentNiveau) {
    const levelWords = this.words.filter(
      (w) => (w.level || "A1") === currentNiveau,
    );
    const ids = levelWords
      .filter((w) => (w.sureCount || 0) < 2)
      .map((w) => w.id);
    this._sessionOrder = this._shuffleArray(ids);
  }

  _shuffleArray(items) {
    const order = [...items];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  _sessionRank(wordId) {
    if (!this._sessionOrder) return 0;
    const index = this._sessionOrder.indexOf(wordId);
    return index < 0 ? this._sessionOrder.length : index;
  }

  _orderPoolBySession(pool) {
    pool.sort((a, b) => this._sessionRank(a.id) - this._sessionRank(b.id));
  }

  selectNextWord(currentNiveau, currentState) {
    const levelWords = this.words.filter(w => (w.level || "A1") === currentNiveau);
    const activeWords = levelWords.filter(w => (w.sureCount || 0) < 2);
    if (activeWords.length === 0) return null;

    const dueWords = activeWords.filter(w => w.dueIn <= 0);
    const candidateWords = dueWords.length > 0 ? dueWords : activeWords;

    let availableWords = candidateWords.filter(w => w.id !== currentState.lastWordId);
    if (availableWords.length === 0) availableWords = candidateWords;

    const newWords = availableWords.filter(w => w.seenCount === 0);
    const reviewWords = availableWords.filter(w => w.seenCount > 0);

    const questionPosition = currentState.totalQuestions % 4;
    let selectedPool =
      questionPosition === 0 && newWords.length > 0
        ? newWords
        : reviewWords.length > 0
          ? reviewWords
          : newWords;

    this._orderPoolBySession(selectedPool);

    let selected = selectedPool[0];
    if (selected && selected.id === currentState.lastWordId && selectedPool.length > 1) {
      selected = selectedPool.find(w => w.id !== currentState.lastWordId) || selected;
    }
    return selected;
  }

   determineQuestionType(word) {
          const s = word.strength;
          this.questionCounter = (this.questionCounter || 0) + 1;

          if (this.lastFaToDeIndex > 4) {
            this.lastFaToDeIndex = 0;
            return !word.sentences || word.sentences.length === 0 ? { type: "de_to_fa", showWord: true } : { type: "fa_to_de", showWord: true };
          }

          let mode;
          const rand = Math.random();
          if (s < 0.4) mode = rand < 0.6 ? "de_to_fa" : "word_with_sentence";
          else if (s < 0.7) {
            if (rand < 0.4) mode = "de_to_fa";
            else if (rand < 0.8) mode = "word_with_sentence";
            else mode = "fa_to_de";
          } else {
            if (rand < 0.4) mode = "fa_to_de";
            else if (rand < 0.8) mode = "sentence_only";
            else mode = "word_with_sentence";
          }

          if ((mode === "word_with_sentence" || mode === "sentence_only") && (!word.sentences || word.sentences.length === 0)) {
            mode = "de_to_fa";
          }

          if (mode === "fa_to_de") this.lastFaToDeIndex = 0;
          else this.lastFaToDeIndex++;

          const result = {
            de_to_fa: () => ({ type: "de_to_fa", showWord: true }),
            word_with_sentence: () => ({ type: "word_with_sentence", showSentence: true }),
            fa_to_de: () => ({ type: "fa_to_de", showWord: true }),
            sentence_only: () => ({ type: "sentence_only", showSentence: true, isSentence: true }),
          }[mode]();

          return result;
        }
}