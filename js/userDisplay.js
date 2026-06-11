(function () {
  var STYLE_ID = "user-display-styles";
  if (!document.getElementById(STYLE_ID)) {
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".user-profile{display:inline-flex;align-items:center;gap:6px;cursor:default}" +
      ".user-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}" +
      ".user-name{font-size:13px;color:#4f46e5;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}" +
      "@media(max-width:480px){.user-name{max-width:80px;font-size:12px}.user-avatar{width:24px;height:24px;font-size:11px}}" +
      ".stats-nav-link{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:500;color:#6366f1;background:rgba(99,102,241,0.08);text-decoration:none;transition:all 0.2s;white-space:nowrap}" +
      ".stats-nav-link:hover{background:rgba(99,102,241,0.16);color:#4f46e5}" +
      ".stats-nav-link svg{width:16px;height:16px;flex-shrink:0}";
    document.head.appendChild(s);
  }

  function getInitials(displayName, email) {
    if (displayName) return displayName.charAt(0).toUpperCase();
    return email ? email.charAt(0).toUpperCase() : "?";
  }

  function renderProfile(container, user) {
    var displayName = user.user_metadata?.display_name || "";
    var email = user.email || "";
    var label = displayName || email || "User";
    var initial = getInitials(displayName, email);

    container.innerHTML =
      '<div class="user-profile" title="' +
      label.replace(/"/g, "&quot;") +
      '">' +
      '<div class="user-avatar">' +
      initial +
      "</div>" +
      '<span class="user-name">' +
      label.replace(/</g, "&lt;") +
      "</span>" +
      "</div>";
  }

  function init() {
    if (!window.Auth) return;
    window.Auth
      .getSession()
      .then(function (sessionResult) {
        if (!sessionResult.data || !sessionResult.data.session || !sessionResult.data.session.user) return;
        var user = sessionResult.data.session.user;
        var containers = document.querySelectorAll("#userProfileContainer");
        containers.forEach(function (el) {
          renderProfile(el, user);
        });
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
