import { CONFIG } from "../config.js";
import * as data from "../data.js";

const PROGRESS_FIELDS = ["mistakeCount", "sureCount", "strength", "dueIn", "correctStreak", "seenCount", "maybeCount", "wrongCount"];
const DEFAULT_PROGRESS = { mistakeCount: 0, sureCount: 0, strength: 0.2, dueIn: 0, correctStreak: 0, seenCount: 0, maybeCount: 0, wrongCount: 0 };

export class DataManager {
  constructor(gameType, dataSetName = "adjektive") {
    this.gameType = gameType;
    this.dataSetName = dataSetName;
  }

  getStorageKeyWords(niveau, mode, caseFilter = "all", verbMode = "") {
    if (verbMode && verbMode !== "verben") {
      return `${CONFIG.STORAGE_PREFIX}words_${this.gameType}_${this.dataSetName}_${niveau}_${mode}_${verbMode}_${caseFilter}`;
    }
    return `${CONFIG.STORAGE_PREFIX}words_${this.gameType}_${this.dataSetName}_${niveau}_${mode}_${caseFilter}`;
  }

  async loadWords(jsonPath, niveau, mode, caseFilter = "all", verbMode = "") {
    try {
      console.log(`[LOAD JSON] game=${this.gameType} file=${jsonPath} level=${niveau} mode=${mode} case=${caseFilter} verbMode=${verbMode || 'default'}`);

      const response = await fetch(jsonPath);
      let words = await response.json();

      // STRIP any existing state fields from JSON — static data only
      words = words.map(word => {
        const clean = { ...word };
        for (const field of PROGRESS_FIELDS) {
          delete clean[field];
        }
        return clean;
      });

      const key = this.getStorageKeyWords(niveau, mode, caseFilter, verbMode);
      console.log(`[LOAD PROGRESS] game=${this.gameType} key=${key}`);
      const progressMap = data.get(key);

      if (progressMap && typeof progressMap === "object" && !Array.isArray(progressMap)) {
        console.log(`[MERGE PROGRESS] game=${this.gameType} level=${niveau} mode=${mode} case=${caseFilter} verbMode=${verbMode || 'default'} wordCount=${Object.keys(progressMap).length}`);
      } else {
        console.log(`[MERGE PROGRESS] game=${this.gameType} level=${niveau} mode=${mode} case=${caseFilter} verbMode=${verbMode || 'default'} no progress found`);
      }

      words = words.map(word => {
        const stored = progressMap && typeof progressMap === "object" && !Array.isArray(progressMap)
          ? progressMap[word.id]
          : null;

        if (stored) {
          console.log(`[DB_STATE_LOADED] id=${word.id} level=${niveau} mode=${mode} case=${caseFilter} verbMode=${verbMode || 'default'}`);

          const clampNonNegative = (val, field) => {
            if (val !== undefined && val !== null && val < 0) {
              console.log(`[INVALID_VALUE_BLOCKED] id=${word.id} field=${field} value=${val} level=${niveau} mode=${mode} case=${caseFilter} verbMode=${verbMode || 'default'}`);
              return 0;
            }
            return val;
          };

          word.mistakeCount = clampNonNegative(stored.mistakeCount, 'mistakeCount') ?? DEFAULT_PROGRESS.mistakeCount;
          word.sureCount = clampNonNegative(stored.sureCount, 'sureCount') ?? DEFAULT_PROGRESS.sureCount;
          word.strength = stored.strength ?? DEFAULT_PROGRESS.strength;
          word.dueIn = stored.dueIn ?? DEFAULT_PROGRESS.dueIn;
          word.correctStreak = clampNonNegative(stored.correctStreak, 'correctStreak') ?? DEFAULT_PROGRESS.correctStreak;
          word.seenCount = clampNonNegative(stored.seenCount, 'seenCount') ?? DEFAULT_PROGRESS.seenCount;
          word.maybeCount = clampNonNegative(stored.maybeCount, 'maybeCount') ?? DEFAULT_PROGRESS.maybeCount;
          word.wrongCount = clampNonNegative(stored.wrongCount, 'wrongCount') ?? DEFAULT_PROGRESS.wrongCount;
        } else {
          console.log(`[DEFAULT_STATE_CREATED] id=${word.id} level=${niveau} mode=${mode} case=${caseFilter} verbMode=${verbMode || 'default'}`);
          Object.assign(word, { ...DEFAULT_PROGRESS });
        }

        console.log(`[STATE_MERGED_IN_MEMORY] id=${word.id} level=${niveau} mode=${mode} case=${caseFilter} verbMode=${verbMode || 'default'}`);

        // Initialize sentence state at runtime (not persisted)
        if (word.sentences) {
          word.sentences = word.sentences.map(s => ({
            ...s,
            strength: 0.3,
            dueIn: 0,
            mistakeCount: 0,
            seenCount: 0,
            correctStreak: 0,
            sureCount: 0,
          }));
        }

        return word;
      });

      if (caseFilter !== "all") {
        words = words.filter(w => w.caseverb && w.caseverb.some(cv => cv.case === caseFilter));
      }

      return words;
    } catch (error) {
      console.error("Error loading words:", error);
      throw error;
    }
  }

  saveProgress(words, niveau, mode, caseFilter = "all", verbMode = "") {
    const key = this.getStorageKeyWords(niveau, mode, caseFilter, verbMode);
    const savedProgress = data.get(key) || {};
    const progressMap = {};
    let changedCount = 0;
    let skippedCount = 0;
    let removedCount = 0;

    for (const word of words) {
      if (!word.id) continue;

      const isDefault = (
        (word.mistakeCount ?? 0) === DEFAULT_PROGRESS.mistakeCount &&
        (word.sureCount ?? 0) === DEFAULT_PROGRESS.sureCount &&
        (word.strength ?? DEFAULT_PROGRESS.strength) === DEFAULT_PROGRESS.strength &&
        (word.dueIn ?? 0) === DEFAULT_PROGRESS.dueIn &&
        (word.correctStreak ?? 0) === DEFAULT_PROGRESS.correctStreak &&
        (word.seenCount ?? 0) === DEFAULT_PROGRESS.seenCount
      );

      if (isDefault) {
        if (word.id in savedProgress) {
          removedCount++;
          console.log(`[REMOVE DEFAULT WORD] id=${word.id} key=${key} game=${this.gameType} level=${niveau} mode=${mode} case=${caseFilter}`);
        } else {
          skippedCount++;
          console.log(`[SKIP DEFAULT WORD] id=${word.id} key=${key} game=${this.gameType} level=${niveau} mode=${mode} case=${caseFilter}`);
        }
      } else {
        progressMap[word.id] = {};
        for (const field of PROGRESS_FIELDS) {
          if (word[field] !== undefined) {
            progressMap[word.id][field] = word[field];
          }
        }
        changedCount++;
        console.log(`[STATE_SAVED_TO_DB] id=${word.id} level=${niveau} mode=${mode} case=${caseFilter}`);
      }
    }

    var ids = Object.keys(progressMap);
    var sample = ids.length > 3 ? ids.slice(0, 3).join(',') + '...' : ids.join(',');
    console.log('[SAVE PROGRESS] game=' + this.gameType + ' level=' + niveau + ' mode=' + mode + ' case=' + caseFilter + ' changed=' + changedCount + ' skipped=' + skippedCount + ' removed=' + removedCount + ' stored=' + ids.length + ' ids=[' + sample + ']');
    if (ids.length > 0) {
      data.set(key, progressMap);
    } else {
      console.log('[SAVE PROGRESS] empty map, skipping write');
    }
  }

  saveWords(words, niveau, mode, caseFilter = "all", verbMode = "") {
    this.saveProgress(words, niveau, mode, caseFilter, verbMode);
  }
}