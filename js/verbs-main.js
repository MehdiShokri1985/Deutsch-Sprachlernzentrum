import { VerbLearningGame } from "./core/VerbLearningGame.js";
import { applyModuleTheme } from "./theme/applyModuleTheme.js";
import * as data from "./data.js";
import { ActivityTracker } from "./core/ActivityTracker.js";

let game;

document.addEventListener("DOMContentLoaded", async () => {
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
    const { data: { user }, error: userError } = await window.Auth.getUser();
    if (user && !userError) {
      await data.init(user.id);
    }

    const tracker = new ActivityTracker();
    await tracker.init(data);
    tracker.setCurrentSection('verbs');
    window.__tracker = tracker;

    applyModuleTheme(dataset);
    game = new VerbLearningGame(dataset, jsonPath);
    window.game = game;

    const title = "German Verbs";
    document.getElementById("pageTitle").textContent = title;
    document.getElementById("headerTitle").textContent = title;

    console.log(`Verb game started: ${dataset}`);
  } catch (error) {
    console.error("Failed to start verb game:", error);
  }
});
