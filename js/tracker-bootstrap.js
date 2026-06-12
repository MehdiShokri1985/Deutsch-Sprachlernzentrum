(function () {
  'use strict';

  if (window.__trackerInitialized) return;

  async function init() {
    try {
      const sess = await window.Auth.getSession();
      if (!sess?.data?.session?.user) return;

      const data = await import('/js/data.js');
      await data.init(sess.data.session.user.id);

      const { ActivityTracker } = await import('/js/core/ActivityTracker.js');
      const tracker = new ActivityTracker();
      await tracker.init(data);
      window.__tracker = tracker;
      window.__trackerInitialized = true;
    } catch (e) {
      if (e.message !== 'No session') {
        console.warn('Tracker init:', e.message);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
