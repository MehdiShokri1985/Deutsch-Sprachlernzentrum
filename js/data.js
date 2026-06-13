const TABLE = 'user_progress';
const DEBOUNCE_MS = 3000;

let _userId = null;
let _cache = {};
let _saveTimer = null;
let _onRemoteChange = null;
let _subscription = null;
let _generation = 0;
let _flushPromise = null;
let _isResetting = false;

function _log(op, table, ok, detail) {
  const icon = ok ? 'OK' : 'FAIL';
  console.log('[' + icon + '] [' + op + '] table=' + table + (detail ? ' ' + detail : ''));
}

function _client() {
  if (!window.Auth || !window.Auth.client) {
    throw new Error('Auth not initialized');
  }
  return window.Auth.client;
}

async function _flush() {
  if (!_userId) return;
  const gen = _generation;
  const supabase = _client();
  _log('WRITE', TABLE, true, 'user_id=' + _userId);
  const p = supabase
    .from(TABLE)
    .upsert({
      user_id: _userId,
      data: _cache,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  _flushPromise = p;
  const { error } = await p;

  if (error) {
    _log('WRITE', TABLE, false, error.message);
    console.error('Error saving user data:', error.message);
  } else if (gen !== _generation) {
    _log('WRITE', TABLE, true, 'stale write gen=' + gen + '->' + _generation + ', skipping');
  } else {
    _log('WRITE', TABLE, true, 'data keys=' + Object.keys(_cache).length);
  }
}

function _scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flush, DEBOUNCE_MS);
}

export async function init(userId) {
  _userId = userId;

  const supabase = _client();
  _log('READ', TABLE, true, 'user_id=' + userId);
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    _log('READ', TABLE, false, error.message);
    console.error('Error loading user data:', error.message);
    return;
  }

  if (data && data.data) {
    _cache = data.data;
    _log('READ', TABLE, true, 'loaded keys=' + Object.keys(_cache).length);
  } else {
    _log('READ', TABLE, true, 'no existing data');
  }

  // Migrate localStorage keys that don't already exist in Supabase
  await _migrateFromLocalStorage(userId);

  // Migrate old-format keys (without gameType) to new-format keys (with gameType)
  _migrateKeyFormat();

  // Migrate old-format full-word arrays to lightweight progress maps
  _migrateOldWordFormat();

  _subscribe(userId);
}

export function get(key) {
  return _cache[key] !== undefined ? _cache[key] : null;
}

export function getAllKeys() {
  return Object.keys(_cache);
}

export function set(key, value) {
  _cache[key] = value;
  _scheduleSave();
}

export function remove(key) {
  delete _cache[key];
  _scheduleSave();
}

export async function flush() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  await _flush();
}

function _storageKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('langgame_')) {
      keys.push(k);
    }
  }
  return keys;
}

async function _migrateFromLocalStorage(userId) {
  const storageKeys = _storageKeys();
  if (storageKeys.length === 0) return;

  let changed = false;
  for (const key of storageKeys) {
    if (_cache[key] !== undefined) {
      localStorage.removeItem(key);
      continue;
    }
    try {
      _cache[key] = JSON.parse(localStorage.getItem(key));
    } catch {
      _cache[key] = localStorage.getItem(key);
    }
    localStorage.removeItem(key);
    changed = true;
  }

  if (changed) {
    _log('MIGRATE', TABLE, true, 'merged missing keys=' + storageKeys.length + ' user_id=' + userId);
    _scheduleSave();
  } else {
    _log('MIGRATE', TABLE, true, 'all localStorage keys already in Supabase, skipped');
  }
}

function _migrateKeyFormat() {
  // Map known dataset names to their gameType
  var datasetToGameType = {
    adjektive: 'game',
    konnektoren: 'game',
    personalpronomen: 'game',
    possessivpronomen: 'game',
    präpositionen: 'game',
    demonstrativpronomen: 'game',
    tempora: 'game',
    reflexivverben: 'game',
    kollokationen: 'game',
    slang: 'game',
    verben: 'verbs'
  };

  var prefix = 'langgame_';
  var migrated = false;

  for (var key of Object.keys(_cache)) {
    if (!key.startsWith(prefix)) continue;
    var segments = key.substring(prefix.length).split('_');
    var type = segments[0];
    if (type !== 'words' && type !== 'state') continue;

    var second = segments[1];
    // If second segment is a known dataset → old format (no gameType)
    if (datasetToGameType[second]) {
      var datasetName = second;
      var gameType = datasetToGameType[datasetName];
      var rest = segments.slice(2).join('_');
      var newKey = prefix + type + '_' + gameType + '_' + datasetName + '_' + rest;

      if (!(newKey in _cache)) {
        _cache[newKey] = _cache[key];
        migrated = true;
      }
      delete _cache[key];
    }
  }

  if (migrated) {
    _log('MIGRATE_KEYS', TABLE, true, 'upgraded old keys to gameType format');
    _scheduleSave();
  }
}

function _migrateOldWordFormat() {
  var prefix = 'langgame_words_';
  var migrated = false;

  for (var key of Object.keys(_cache)) {
    if (!key.startsWith(prefix)) continue;
    var val = _cache[key];
    if (!Array.isArray(val) || val.length === 0) continue;

    console.log('[MIGRATE WORDS] old-format array detected: key=' + key + ' words=' + val.length);
    var progressMap = {};
    for (var i = 0; i < val.length; i++) {
      var w = val[i];
      if (w && w.id != null) {
        progressMap[w.id] = {
          mistakeCount: w.mistakeCount ?? 0,
          sureCount: w.sureCount ?? 0,
          strength: w.strength ?? 0.3,
          dueIn: w.dueIn ?? 0,
          correctStreak: w.correctStreak ?? 0,
          seenCount: w.seenCount ?? 0
        };
      }
    }
    _cache[key] = progressMap;
    migrated = true;
    console.log('[MIGRATE WORDS] converted to progress map: key=' + key + ' entries=' + Object.keys(progressMap).length);
  }

  if (migrated) {
    _scheduleSave();
  }
}

function _subscribe(userId) {
  if (_subscription) return;

  const supabase = _client();
  _subscription = supabase
    .channel('user_progress_sync')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: TABLE,
      filter: 'user_id=eq.' + userId
    }, (payload) => {
      _log('REALTIME', TABLE, true, 'event=' + payload.eventType);
      if (_isResetting) {
        _log('REALTIME', TABLE, true, 'ignored (resetting)');
        return;
      }
      if (payload.eventType === 'DELETE') {
        _generation++;
        if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
        _cache = {};
        if (_onRemoteChange) {
          _onRemoteChange(_cache);
        }
        return;
      }
      if (payload.new && payload.new.data) {
        _generation++;
        if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
        _cache = payload.new.data;
        if (_onRemoteChange) {
          _onRemoteChange(_cache);
        }
      }
    })
    .subscribe();
}

export function onRemoteChange(callback) {
  _onRemoteChange = callback;
}

export function unsubscribe() {
  if (_subscription) {
    const supabase = _client();
    supabase.removeChannel(_subscription);
    _subscription = null;
  }
}

export async function resetAllData(gameType, datasetName, niveau, mode, caseFilter, verbMode = "") {
  _generation++;
  _isResetting = true;

  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }

  if (_flushPromise) {
    _log('RESET', TABLE, true, 'waiting for in-flight flush to settle');
    try {
      await Promise.resolve(_flushPromise);
    } catch (err) {
      // ignore flush errors during reset
    }
    _flushPromise = null;
  }

  // Remove only the cache keys for this exact combination
  const prefix = 'langgame_';
  const vmSegment = (verbMode && verbMode !== "verben") ? '_' + verbMode : '';
  const wordKey = prefix + 'words_' + gameType + '_' + datasetName + '_' + niveau + '_' + mode + vmSegment + '_' + caseFilter;
  const stateKey = prefix + 'state_' + gameType + '_' + datasetName + '_' + niveau + '_' + mode + vmSegment + '_' + caseFilter;

  console.log('[RESET PROGRESS] game=' + gameType + ' dataset=' + datasetName + ' level=' + niveau + ' mode=' + mode + ' case=' + caseFilter + ' verbMode=' + (verbMode || 'default'));
  console.log('RESET TARGET KEYS:', wordKey, stateKey);
  delete _cache[wordKey];
  delete _cache[stateKey];

  if (!_userId) {
    _isResetting = false;
    _log('RESET', TABLE, true, 'no userId, skipping DB update');
    return { ok: true, detail: 'no user' };
  }

  // Update Supabase row with remaining data (preserves all other combinations)
  const supabase = _client();
  _log('RESET', TABLE, true, 'updating row user_id=' + _userId + ' gameType=' + gameType + ' dataset=' + datasetName + ' combo=' + niveau + '_' + mode + vmSegment + '_' + caseFilter);
  const { error } = await supabase
    .from(TABLE)
    .upsert({
      user_id: _userId,
      data: _cache,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) {
    _isResetting = false;
    _log('RESET', TABLE, false, error.message);
    return { ok: false, error: error.message };
  }

  console.log('REMAINING KEYS:', Object.keys(_cache));
  _log('RESET', TABLE, true, 'gameType=' + gameType + ' dataset=' + datasetName + ' combo=' + niveau + '_' + mode + '_' + caseFilter + ' remaining keys=' + Object.keys(_cache).length);
  _isResetting = false;
  return { ok: true, detail: 'gameType=' + gameType + ' dataset=' + datasetName + ' combo=' + niveau + '_' + mode + '_' + caseFilter + ' reset' };
}

export async function testSupabaseConnection(userId) {
  console.log('--- Supabase Connection Test ---');
  console.log('Table: ' + TABLE);
  console.log('User: ' + userId);

  const supabase = _client();

  const testPayload = {
    user_id: userId,
    data: { _debug_test: true, timestamp: new Date().toISOString() },
    updated_at: new Date().toISOString()
  };

  const { error: writeError } = await supabase
    .from(TABLE)
    .upsert(testPayload, { onConflict: 'user_id' });

  if (writeError) {
    console.log('WRITE: FAIL');
    console.log('Error:', writeError.message);
    return { ok: false, error: writeError.message };
  }
  console.log('WRITE: OK');

  const { data, error: readError } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    console.log('READ: FAIL');
    console.log('Error:', readError.message);
    return { ok: false, error: readError.message };
  }
  console.log('READ: OK');

  if (data && data.data && data.data._debug_test === true) {
    console.log('DATA MATCH: OK');
    console.log('--- Test passed ---');
    return { ok: true };
  }

  console.log('DATA MATCH: FAIL - unexpected payload');
  console.log('--- Test failed ---');
  return { ok: false, error: 'data mismatch' };
}

export async function testSupabaseAuthAndRLS() {
  const steps = [];

  function logStep(label, ok, detail) {
    const status = ok ? 'PASS' : 'FAIL';
    steps.push({ label, status, detail });
    console.log('[' + status + '] ' + label + (detail ? ' - ' + detail : ''));
  }

  try {
    // Step 1: Validate auth — use getUser() (server-validated)
    const authResult = await _client().auth.getUser();
    const user = authResult.data?.user;
    if (!user || authResult.error) {
      logStep('AUTH USER ID FOUND', false, authResult.error?.message || 'no user');
      return { ok: false, steps };
    }
    logStep('AUTH USER ID FOUND', true, 'id=' + user.id);

    // Step 2: Refresh session explicitly before DB ops
    const refreshResult = await _client().auth.refreshSession();
    if (refreshResult.error) {
      logStep('SESSION REFRESH', false, refreshResult.error.message);
      return { ok: false, steps };
    }
    logStep('SESSION REFRESH', true, 'token refreshed');

    // Verify the refreshed session is attached
    const sessionCheck = await _client().auth.getSession();
    const accessToken = sessionCheck.data?.session?.access_token;
    if (!accessToken) {
      logStep('SESSION ATTACHED', false, 'no access_token after refresh');
      return { ok: false, steps };
    }
    logStep('SESSION ATTACHED', true, 'token present');

    // Step 3: Write test data
    const timestamp = new Date().toISOString();
    const testKey = '_debug_rls_' + Date.now();
    const { error: writeErr } = await _client()
      .from(TABLE)
      .upsert({
        user_id: user.id,
        data: { [testKey]: true, timestamp },
        updated_at: timestamp
      }, { onConflict: 'user_id' });

    if (writeErr) {
      const isRLS = writeErr.message?.toLowerCase().includes('permission') ||
                    writeErr.message?.toLowerCase().includes('policy') ||
                    writeErr.code === '42501';
      if (isRLS) {
        logStep('WRITE SUCCESS', false, 'RLS BLOCKED: ' + writeErr.message);
      } else {
        logStep('WRITE SUCCESS', false, writeErr.message);
      }
      return { ok: false, steps };
    }
    logStep('WRITE SUCCESS', true, 'upserted ' + testKey);

    // Step 4: Read it back
    const { data: readData, error: readErr } = await _client()
      .from(TABLE)
      .select('data')
      .eq('user_id', user.id)
      .maybeSingle();

    if (readErr) {
      const isRLS = readErr.message?.toLowerCase().includes('permission') ||
                    readErr.message?.toLowerCase().includes('policy') ||
                    readErr.code === '42501';
      if (isRLS) {
        logStep('READ SUCCESS', false, 'RLS BLOCKED: ' + readErr.message);
      } else {
        logStep('READ SUCCESS', false, readErr.message);
      }
      return { ok: false, steps };
    }

    if (readData && readData.data && readData.data[testKey] === true) {
      logStep('READ SUCCESS', true, 'data verified');
      logStep('RLS PASSED', true, 'user_id=' + user.id + ' auth.uid() matches');
    } else {
      logStep('READ SUCCESS', false, 'data mismatch — RLS may be filtering rows');
      return { ok: false, steps };
    }

    // Cleanup: remove the test key
    const current = _cache;
    const cleaned = Object.assign({}, current);
    _cache = cleaned;
    await _flush();

    console.log('\n=== RLS/AUTH DIAGNOSTIC: ALL PASSED ===');
    return { ok: true, steps };

  } catch (err) {
    logStep('DIAGNOSTIC CRASH', false, err.message);
    return { ok: false, steps };
  }
}

export async function debugCheckDb() {
  if (!_userId) {
    console.log('[DEBUG] No user — DB check skipped');
    return null;
  }
  const supabase = _client();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', _userId);
  if (error) {
    console.log('[DEBUG] DB check error:', error.message);
    return null;
  }
  console.log('[DEBUG] DB AFTER RESET:', data && data.length > 0 ? data : []);
  return data;
}
