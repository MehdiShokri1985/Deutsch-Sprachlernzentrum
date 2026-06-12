const INACTIVITY_TIMEOUT_MS = 60000;
const AUTO_SAVE_INTERVAL_MS = 30000;
const ACTIVITY_EVENTS = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart', 'touchmove'];

const STATS_KEY = 'stats';

function now() {
  return Date.now();
}

function floorToDay(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function createDefaultStats() {
  return {
    totalStudyTime: 0,
    activeTime: 0,
    learningTime: 0,
    totalVisits: 0,
    uniqueDays: 0,
    activeDays: [],
    sections: {
      vocabulary: 0,
      stories: 0,
      verbs: 0,
      exams: 0
    },
    learningActions: {
      vocabulary: { correctAnswer: 0, wrongAnswer: 0, cardViewed: 0 },
      stories: { storyOpened: 0, storyCompleted: 0 },
      verbs: { correctAnswer: 0, wrongAnswer: 0, practiceCompleted: 0 },
      exams: { examCompleted: 0 }
    },
    longestVisit: null,
    lastVisit: null,
    firstVisit: null,
    visitHistory: [],
    sessionHistory: [],
    _version: 2
  };
}

export class ActivityTracker {
  constructor() {
    this._data = null;
    this._stats = null;
    this._userId = null;

    this._active = false;
    this._learning = false;
    this._visible = true;
    this._focused = true;

    this._sessionStart = null;
    this._activeSessionStart = null;
    this._learningSessionStart = null;

    this._currentSection = null;
    this._sectionLearningStart = null;

    this._inactivityTimer = null;
    this._autoSaveInterval = null;
    this._debounceTimer = null;
    this._tickTimer = null;

    this._listeners = [];
    this._initialized = false;
  }

  async init(dataModule) {
    if (this._initialized) return;
    this._initialized = true;

    this._data = dataModule;

    const sess = await window.Auth.getSession();
    if (!sess?.data?.session?.user) throw new Error('No session');
    this._userId = sess.data.session.user.id;

    const raw = dataModule.get(STATS_KEY);
    if (raw && typeof raw === 'object') {
      this._stats = this._mergeWithDefaults(raw);
    } else {
      this._stats = createDefaultStats();
    }

    this._registerActivityListeners();
    this._registerVisibilityListener();
    this._registerFocusListeners();
    this._registerBeforeUnload();

    this._sessionStart = now();
    this._activeSessionStart = null;
    this._learningSessionStart = null;

    this._handleVisit();
    this._startAutoSave();
    this._startTick();

    this._active = false;
    this._learning = false;

    dataModule.onRemoteChange((remoteCache) => {
      this._onRemoteDataChange(remoteCache);
    });

    this._scheduleSave();
  }

  _onRemoteDataChange(remoteCache) {
    const remoteStats = remoteCache[STATS_KEY];
    if (!remoteStats || typeof remoteStats !== 'object') return;

    const local = this._stats;

    local.totalStudyTime = Math.max(local.totalStudyTime || 0, remoteStats.totalStudyTime || 0);
    local.activeTime = Math.max(local.activeTime || 0, remoteStats.activeTime || 0);
    local.learningTime = Math.max(local.learningTime || 0, remoteStats.learningTime || 0);
    local.totalVisits = Math.max(local.totalVisits || 0, remoteStats.totalVisits || 0);

    if (remoteStats.sections) {
      for (const [sec, val] of Object.entries(remoteStats.sections)) {
        if (local.sections[sec] !== undefined) {
          local.sections[sec] = Math.max(local.sections[sec] || 0, val || 0);
        }
      }
    }

    if (remoteStats.learningActions) {
      for (const [sec, actions] of Object.entries(remoteStats.learningActions)) {
        if (!local.learningActions[sec]) local.learningActions[sec] = {};
        for (const [action, count] of Object.entries(actions)) {
          local.learningActions[sec][action] = Math.max(
            local.learningActions[sec][action] || 0,
            count || 0
          );
        }
      }
    }

    if (remoteStats.activeDays && Array.isArray(remoteStats.activeDays)) {
      const merged = new Set(local.activeDays || []);
      for (const d of remoteStats.activeDays) merged.add(d);
      local.activeDays = Array.from(merged).sort();
      local.uniqueDays = local.activeDays.length;
    }

    if (remoteStats.longestVisit && remoteStats.longestVisit.duration) {
      if (!local.longestVisit || remoteStats.longestVisit.duration > local.longestVisit.duration) {
        local.longestVisit = remoteStats.longestVisit;
      }
    }

    if (remoteStats.firstVisit) {
      if (!local.firstVisit || remoteStats.firstVisit.date < local.firstVisit.date) {
        local.firstVisit = remoteStats.firstVisit;
      }
    }

    if (remoteStats.lastVisit) {
      if (!local.lastVisit || remoteStats.lastVisit.date > local.lastVisit.date) {
        local.lastVisit = remoteStats.lastVisit;
      }
    }

    if (remoteStats.visitHistory && Array.isArray(remoteStats.visitHistory)) {
      const merged = new Set(local.visitHistory || []);
      for (const v of remoteStats.visitHistory) merged.add(v);
      local.visitHistory = Array.from(merged).sort().slice(-1000);
    }

    if (remoteStats.sessionHistory && Array.isArray(remoteStats.sessionHistory)) {
      const seen = new Set();
      const merged = [...(local.sessionHistory || []), ...remoteStats.sessionHistory];
      merged.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      const deduped = [];
      for (const s of merged) {
        const key = s.start + '|' + s.duration;
        if (!seen.has(key)) { seen.add(key); deduped.push(s); }
      }
      local.sessionHistory = deduped.slice(-500);
    }
  }

  _mergeWithDefaults(raw) {
    const def = createDefaultStats();
    const merged = { ...def, ...raw };
    if (raw.sections) merged.sections = { ...def.sections, ...raw.sections };
    if (raw.learningActions) merged.learningActions = { ...def.learningActions, ...raw.learningActions };
    for (const sec of Object.keys(def.learningActions)) {
      if (merged.learningActions[sec]) {
        merged.learningActions[sec] = { ...def.learningActions[sec], ...merged.learningActions[sec] };
      }
    }
    return merged;
  }

  _registerActivityListeners() {
    const handler = () => this._onActivity();
    for (const ev of ACTIVITY_EVENTS) {
      document.addEventListener(ev, handler, { passive: true, capture: true });
      this._listeners.push({ el: document, ev, handler });
    }
  }

  _registerVisibilityListener() {
    const handler = () => {
      if (document.hidden) {
        this._visible = false;
        this._onInactive();
      } else {
        this._visible = true;
        if (this._focused) {
          this._onActivity();
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    this._listeners.push({ el: document, ev: 'visibilitychange', handler });
  }

  _registerFocusListeners() {
    const blurHandler = () => {
      this._focused = false;
      this._onInactive();
    };
    const focusHandler = () => {
      this._focused = true;
      if (this._visible) {
        this._onActivity();
      }
    };
    window.addEventListener('blur', blurHandler);
    window.addEventListener('focus', focusHandler);
    this._listeners.push({ el: window, ev: 'blur', handler: blurHandler });
    this._listeners.push({ el: window, ev: 'focus', handler: focusHandler });
  }

  _registerBeforeUnload() {
    const handler = () => {
      this._flushActiveTime();
      this._flushLearningTime();
      this._flushSectionTime();
      this._finalizeSession();
      this._saveNow();
    };
    window.addEventListener('beforeunload', handler);
    this._listeners.push({ el: window, ev: 'beforeunload', handler });

    const pageHideHandler = () => {
      this._flushActiveTime();
      this._flushLearningTime();
      this._flushSectionTime();
      this._finalizeSession();
      this._saveNow();
    };
    window.addEventListener('pagehide', pageHideHandler);
    this._listeners.push({ el: window, ev: 'pagehide', handler: pageHideHandler });
  }

  _startAutoSave() {
    this._autoSaveInterval = setInterval(() => {
      this._flushActiveTime();
      this._flushLearningTime();
      this._saveNow();
    }, AUTO_SAVE_INTERVAL_MS);
  }

  _startTick() {
    this._tickTimer = setInterval(() => {
      this._flushActiveTime();
      this._flushLearningTime();
      this._flushSectionTime();
    }, 1000);
  }

  _onActivity() {
    if (!this._visible || !this._focused) return;

    if (this._inactivityTimer) {
      clearTimeout(this._inactivityTimer);
      this._inactivityTimer = null;
    }

    if (!this._active) {
      this._active = true;
      this._activeSessionStart = now();
    }

    this._inactivityTimer = setTimeout(() => {
      this._onInactive();
    }, INACTIVITY_TIMEOUT_MS);
  }

  _onInactive() {
    this._flushActiveTime();
    this._flushLearningTime();
    this._flushSectionTime();
    if (this._inactivityTimer) {
      clearTimeout(this._inactivityTimer);
      this._inactivityTimer = null;
    }
    this._active = false;
    this._learning = false;
    this._activeSessionStart = null;
    this._learningSessionStart = null;
    this._sectionLearningStart = null;
  }

  _flushActiveTime() {
    if (this._active && this._activeSessionStart !== null) {
      const elapsed = now() - this._activeSessionStart;
      if (elapsed > 0) {
        this._stats.activeTime += elapsed;
      }
      this._activeSessionStart = now();
    }
  }

  _flushLearningTime() {
    if (this._learning && this._learningSessionStart !== null) {
      const elapsed = now() - this._learningSessionStart;
      if (elapsed > 0) {
        this._stats.learningTime += elapsed;
        this._stats.totalStudyTime += elapsed;
      }
      this._learningSessionStart = now();
    }
  }

  _finalizeSession() {
    if (this._sessionStart !== null) {
      const sessionDuration = now() - this._sessionStart;
      if (sessionDuration > 1000) {
        this._stats.sessionHistory.push({
          start: new Date(this._sessionStart).toISOString(),
          end: new Date().toISOString(),
          duration: sessionDuration
        });
        if (this._stats.sessionHistory.length > 500) {
          this._stats.sessionHistory = this._stats.sessionHistory.slice(-500);
        }

        if (!this._stats.longestVisit || sessionDuration > this._stats.longestVisit.duration) {
          this._stats.longestVisit = {
            start: new Date(this._sessionStart).toISOString(),
            end: new Date().toISOString(),
            duration: sessionDuration
          };
        }

        this._stats.lastVisit = {
          date: new Date().toISOString(),
          duration: sessionDuration
        };
      }
    }
  }

  _handleVisit() {
    this._stats.totalVisits++;
    this._stats.visitHistory.push(new Date().toISOString());
    if (this._stats.visitHistory.length > 1000) {
      this._stats.visitHistory = this._stats.visitHistory.slice(-1000);
    }

    if (!this._stats.firstVisit) {
      this._stats.firstVisit = { date: new Date().toISOString() };
    }

    const today = floorToDay(now());
    if (!this._stats.activeDays.includes(today)) {
      this._stats.activeDays.push(today);
      this._stats.uniqueDays = this._stats.activeDays.length;
    }
  }

  setCurrentSection(sectionId) {
    this._flushSectionTime();
    this._currentSection = sectionId;
    if (this._learning && this._visible && this._focused) {
      this._sectionLearningStart = now();
    }
  }

  _flushSectionTime() {
    if (this._currentSection && this._sectionLearningStart !== null) {
      const elapsed = now() - this._sectionLearningStart;
      if (elapsed > 0 && this._stats.sections[this._currentSection] !== undefined) {
        this._stats.sections[this._currentSection] += elapsed;
      }
      this._sectionLearningStart = now();
    }
  }

  markLearningAction(section, actionType) {
    if (!this._visible || !this._focused) return;
    this._onActivity();

    if (this._currentSection !== section) {
      this._flushSectionTime();
      this._currentSection = section;
    }

    if (!this._learning) {
      this._learning = true;
      this._learningSessionStart = now();
      this._sectionLearningStart = now();
    }

    if (this._stats.learningActions[section] && this._stats.learningActions[section][actionType] !== undefined) {
      this._stats.learningActions[section][actionType]++;
    }
  }

  addSectionTime(section, ms) {
    if (ms > 0 && this._stats.sections[section] !== undefined) {
      this._stats.sections[section] += ms;
    }
  }

  getStats() {
    return this._stats;
  }

  getStatsForDashboard() {
    this._flushActiveTime();
    this._flushLearningTime();
    return this._stats;
  }

  _scheduleSave() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._flushActiveTime();
      this._flushLearningTime();
      this._saveNow();
    }, 3000);
  }

  _saveNow() {
    if (!this._data || !this._stats) return;
    const toStore = JSON.parse(JSON.stringify(this._stats));
    this._data.set(STATS_KEY, toStore);
  }

  async destroy() {
    this._flushActiveTime();
    this._flushLearningTime();
    this._finalizeSession();
    this._saveNow();

    if (this._inactivityTimer) clearTimeout(this._inactivityTimer);
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    if (this._autoSaveInterval) clearInterval(this._autoSaveInterval);
    if (this._tickTimer) clearInterval(this._tickTimer);

    for (const { el, ev, handler } of this._listeners) {
      el.removeEventListener(ev, handler);
    }
    this._listeners = [];
    this._initialized = false;
  }
}
