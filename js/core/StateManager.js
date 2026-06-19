import { CONFIG } from "../config.js";
import * as data from "../data.js";

export class StateManager {
  constructor(gameType, dataSetName = "adjektive") {
    this.gameType = gameType;
    this.dataSetName = dataSetName;
    this.allStates = {};
  }

  getStateKey(niveau, mode, caseFilter = "all", verbMode = "", tail = "") {
    if (tail && tail !== "all" && this.dataSetName === 'a2worter') {
      if (verbMode && verbMode !== "verben") {
        return `${this.gameType}_${this.dataSetName}_${niveau}_${mode}_${verbMode}_${caseFilter}_tail_${tail}`;
      }
      return `${this.gameType}_${this.dataSetName}_${niveau}_${mode}_${caseFilter}_tail_${tail}`;
    }
    if (verbMode && verbMode !== "verben") {
      return `${this.gameType}_${this.dataSetName}_${niveau}_${mode}_${verbMode}_${caseFilter}`;
    }
    return `${this.gameType}_${this.dataSetName}_${niveau}_${mode}_${caseFilter}`;
  }

  getFullStorageKey(niveau, mode, caseFilter = "all", verbMode = "", tail = "") {
    if (tail && tail !== "all" && this.dataSetName === 'a2worter') {
      if (verbMode && verbMode !== "verben") {
        return `${CONFIG.STORAGE_PREFIX}state_${this.gameType}_${this.dataSetName}_${niveau}_${mode}_${verbMode}_${caseFilter}_tail_${tail}`;
      }
      return `${CONFIG.STORAGE_PREFIX}state_${this.gameType}_${this.dataSetName}_${niveau}_${mode}_${caseFilter}_tail_${tail}`;
    }
    if (verbMode && verbMode !== "verben") {
      return `${CONFIG.STORAGE_PREFIX}state_${this.gameType}_${this.dataSetName}_${niveau}_${mode}_${verbMode}_${caseFilter}`;
    }
    return `${CONFIG.STORAGE_PREFIX}state_${this.gameType}_${this.dataSetName}_${niveau}_${mode}_${caseFilter}`;
  }

  getCurrentState(niveau, mode, caseFilter = "all", verbMode = "", tail = "") {
    const key = this.getStateKey(niveau, mode, caseFilter, verbMode, tail);
    if (!this.allStates[key]) {
      const stored = data.get(this.getFullStorageKey(niveau, mode, caseFilter, verbMode, tail));
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
      correctAnswersList: [],
      timeSpentMs: 0
    };
  }

  saveState(niveau, mode, caseFilter = "all", verbMode = "", tail = "") {
    const key = this.getStateKey(niveau, mode, caseFilter, verbMode, tail);
    const state = this.allStates[key];
    if (state) {
      data.set(this.getFullStorageKey(niveau, mode, caseFilter, verbMode, tail), state);
    }
  }

  resetProgress(niveau, mode, caseFilter = "all", verbMode = "", tail = "") {
    const key = this.getStateKey(niveau, mode, caseFilter, verbMode, tail);
    data.remove(this.getFullStorageKey(niveau, mode, caseFilter, verbMode, tail));
    delete this.allStates[key];
  }
}
