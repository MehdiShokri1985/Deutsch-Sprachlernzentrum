/**
 * مدیریت وضعیت‌های ایزوله برای هر ترکیب سطح + حالت + نوع داده
 * Isolated state manager for each (niveau + mode + dataset) combination
 */

import { CONFIG } from "../config.js";

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
      const saved = localStorage.getItem(this.getFullStorageKey(niveau, mode, caseFilter));
      this.allStates[key] = saved ? JSON.parse(saved) : this.createNewState();
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
      localStorage.setItem(this.getFullStorageKey(niveau, mode, caseFilter), JSON.stringify(state));
    }
  }

  resetProgress(niveau, mode, caseFilter = "all") {
    const key = this.getStateKey(niveau, mode, caseFilter);
    localStorage.removeItem(this.getFullStorageKey(niveau, mode, caseFilter));
    delete this.allStates[key];
  }
}