import { CONFIG } from "../config.js";
import * as data from "../data.js";

export class StateManager {
  constructor(dataSetName = "adjektive") {
    this.dataSetName = dataSetName;
    this.allStates = {};
  }

  getStateKey(niveau, mode, caseFilter = "all") {
    return `${this.dataSetName}_${niveau}_${mode}_${caseFilter}`;
  }

  getFullStorageKey(niveau, mode, caseFilter = "all") {
    return `${CONFIG.STORAGE_PREFIX}state_${this.getStateKey(niveau, mode, caseFilter)}`;
  }

  getCurrentState(niveau, mode, caseFilter = "all") {
    const key = this.getStateKey(niveau, mode, caseFilter);
    if (!this.allStates[key]) {
      const stored = data.get(this.getFullStorageKey(niveau, mode, caseFilter));
      this.allStates[key] = stored ? JSON.parse(JSON.stringify(stored)) : this.createNewState();
    }
    return this.allStates[key];
  }

  createNewState() {
    return {
      score: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      lastWordId: null,
      progress: 0,
      sessionNumber: 1,
      mistakes: [],
      correctAnswersList: []
    };
  }

  saveState(niveau, mode, caseFilter = "all") {
    const key = this.getStateKey(niveau, mode, caseFilter);
    const state = this.allStates[key];
    if (state) {
      data.set(this.getFullStorageKey(niveau, mode, caseFilter), state);
    }
  }

  resetProgress(niveau, mode, caseFilter = "all") {
    const key = this.getStateKey(niveau, mode, caseFilter);
    data.remove(this.getFullStorageKey(niveau, mode, caseFilter));
    delete this.allStates[key];
  }
}