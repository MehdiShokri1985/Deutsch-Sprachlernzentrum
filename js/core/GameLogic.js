export class GameLogic {
  constructor(words) {
    this.words = words;
    this._sessionOrder = null;
    this._currentWordId = null;
  }

  initSessionOrder(currentNiveau) {
    const levelWords = this.words.filter(
      (w) => (w.level || "A1") === currentNiveau,
    );
    const ids = levelWords
      .filter((w) => (w.sureCount || 0) < 2)
      .map((w) => w.id);
    this._sessionOrder = this._shuffleArray(ids);
    this._currentWordId = null;
  }

  _shuffleArray(items) {
    const order = [...items];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  selectNextWord(currentNiveau, currentState) {
    const levelWords = this.words.filter(w => (w.level || "A1") === currentNiveau);
    const activeWords = levelWords.filter(w => (w.sureCount || 0) < 2);
    if (activeWords.length === 0) return null;

    if (!this._sessionOrder || this._sessionOrder.length === 0) {
      const ids = activeWords.map(w => w.id);
      this._sessionOrder = this._shuffleArray(ids);
    }

    this._sessionOrder = this._sessionOrder.filter(id => {
      const w = this.words.find(w => w.id === id);
      return w && (w.sureCount || 0) < 2;
    });

    if (this._sessionOrder.length === 0) {
      const ids = activeWords.map(w => w.id);
      if (ids.length === 0) return null;
      this._sessionOrder = this._shuffleArray(ids);
    }

    const wordId = this._sessionOrder.shift();
    const word = this.words.find(w => w.id === wordId);
    if (!word) return this.selectNextWord(currentNiveau, currentState);

    this._currentWordId = wordId;
    return word;
  }

  moveCurrentBack(positions) {
    if (!this._currentWordId || !this._sessionOrder) return;
    const insertAt = Math.min(positions, this._sessionOrder.length);
    this._sessionOrder.splice(insertAt, 0, this._currentWordId);
    this._currentWordId = null;
  }

  moveCurrentToEnd() {
    if (!this._currentWordId || !this._sessionOrder) return;
    this._sessionOrder.push(this._currentWordId);
    this._currentWordId = null;
  }

  forgetCurrentWord() {
    this._currentWordId = null;
  }

  _sessionRank(wordId) {
    if (!this._sessionOrder) return 0;
    const index = this._sessionOrder.indexOf(wordId);
    return index < 0 ? this._sessionOrder.length : index;
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
