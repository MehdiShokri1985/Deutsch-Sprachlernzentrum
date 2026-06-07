/**
 * Verb game logic — meaning → word (fa_to_de only).
 */

import { GameLogic } from "./GameLogic.js";

export class VerbGameLogic extends GameLogic {
  determineQuestionType() {
    return { type: "fa_to_de", showWord: true };
  }
}
