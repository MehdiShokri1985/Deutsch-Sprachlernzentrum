(function () {
  'use strict';

  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded.');
    return;
  }

  var SUPABASE_URL = 'https://sesltisebtcijdsdeckr.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_RPND2s4rdjF8ORhD-7bDiA_wkpSscWm';

  var client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.Auth = {
    client: client,

    signUp: function (email, password, name) {
      var options = {};
      if (name) {
        options.data = { display_name: name };
      }
      return client.auth.signUp({ email: email, password: password, options: options });
    },

    signIn: function (email, password) {
      return client.auth.signInWithPassword({ email: email, password: password });
    },

    signOut: function () {
      return client.auth.signOut();
    },

    getSession: function () {
      return client.auth.getSession();
    },

    getUser: function () {
      return client.auth.getUser();
    },

    onAuthStateChange: function (callback) {
      return client.auth.onAuthStateChange(callback);
    }
  };
})();
