/**
 * Module theme keys — aligned with index.html menu datasets.
 */

export const MODULE_THEME_IDS = [
  "konnektoren",
  "adjektive",
  "personalpronomen",
  "possessivpronomen",
  "präpositionen",
  "demonstrativpronomen",
  "tempora",
  "reflexivverben",
  "kollokationen",
  "slang",
  "verben",
];

export function resolveThemeId(dataset) {
  if (!dataset) return "konnektoren";
  const id = String(dataset).trim();
  return MODULE_THEME_IDS.includes(id) ? id : "konnektoren";
}
