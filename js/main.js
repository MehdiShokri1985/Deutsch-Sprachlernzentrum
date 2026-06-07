/**
 * نقطه ورود برنامه - نسخه یکپارچه
 */

import { AdaptiveLearningGame } from "./core/AdaptiveLearningGame.js";
import { applyModuleTheme } from "./theme/applyModuleTheme.js";

let game;

document.addEventListener("DOMContentLoaded", () => {
  // خواندن پارامترها از URL
  const params = new URLSearchParams(window.location.search);
  
  const dataset = params.get("dataset");
  const jsonPath = params.get("json");

  if (!dataset || !jsonPath) {
    document.body.innerHTML = `
      <div class="flex items-center justify-center min-h-screen">
        <div class="text-center">
          <h1 class="text-3xl font-bold text-red-600 mb-4">خطا</h1>
          <p>لینک نامعتبر است. لطفاً از صفحه اصلی وارد شوید.</p>
          <a href="index.html" class="mt-6 inline-block text-indigo-600 underline">بازگشت به صفحه اصلی</a>
        </div>
      </div>`;
    return;
  }

  try {
    applyModuleTheme(dataset);
    game = new AdaptiveLearningGame(dataset, jsonPath);
    
    window.game = game;        // برای دسترسی از HTML

    // بروزرسانی عنوان صفحه و هدر
    const titles = {
      adjektive: "German Adjectives",
      konnektoren: "German Konnektoren",
      personalpronomen: "German Personalpronomen",
      possessivpronomen: "German Possessivpronomen",
      präpositionen: "German Präpositionen",
      demonstrativpronomen: "German Demonstrativpronomen",
      tempora: "German Tempora",
      reflexivverben: "German Reflexivverben",
      kollokationen: "German Kollokationen",
      slang: "German Slang",
      verben: "German Verbs",
    };

    document.getElementById("pageTitle").textContent = titles[dataset] || "German Learning";
    document.getElementById("headerTitle").textContent = titles[dataset] || "German Learning";

    console.log(`🎮 Game started: ${dataset}`);
    
  } catch (error) {
    console.error("Failed to start game:", error);
  }
});