/**
 * Helpers for verb JSON (tenses, persons, forms).
 */

export const VERB_PERSONS = [
  "Ich",
  "du",
  "er/sie/es",
  "wir",
  "ihr",
  "sie/Sie",
];

export const VERB_TENSE_KEYS = ["prasens", "perfekt", "prateritum", "futur"];

export const VERB_TENSE_LABELS = {
  prasens: "Präsens",
  perfekt: "Perfekt",
  prateritum: "Präteritum",
  futur: "Futur",
};

export function getTensePersonEntries(verb, tenseKey) {
  const arr = verb[tenseKey];
  if (!Array.isArray(arr)) return [];
  return arr.filter((e) => e.person && e.form);
}

export function getTenseExamples(verb, tenseKey) {
  const arr = verb[tenseKey];
  if (!Array.isArray(arr)) return [];
  const block = arr.find((e) => e.sentences || e.examples);
  return block?.sentences || block?.examples || [];
}

/** Unique slot id: one conjugation cell (tense + person). */
export function makeVerbSlotId(tenseKey, person) {
  return `${tenseKey}:${person}`;
}

/** All conjugation slots with stable identity (duplicate forms stay separate). */
export function getAllVerbFormSlots(verb) {
  const slots = [];
  for (const tenseKey of VERB_TENSE_KEYS) {
    getTensePersonEntries(verb, tenseKey).forEach((e) => {
      slots.push({
        id: makeVerbSlotId(tenseKey, e.person),
        form: e.form,
        tenseKey,
        person: e.person,
      });
    });
  }
  return slots;
}

export function shuffleArray(items) {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function normalizeForm(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}
