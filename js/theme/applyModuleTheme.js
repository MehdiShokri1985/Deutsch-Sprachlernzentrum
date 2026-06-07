/**
 * Apply per-module theme class on <body> from URL dataset.
 */

import { resolveThemeId, MODULE_THEME_IDS } from "./moduleThemes.js";

export function applyModuleTheme(dataset) {
  const id = resolveThemeId(dataset);
  const body = document.body;
  if (!body) return id;

  body.classList.add("module-themed");

  MODULE_THEME_IDS.forEach((key) => {
    body.classList.remove(`theme-${key}`);
  });

  body.classList.add(`theme-${id}`);
  return id;
}
