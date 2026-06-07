/**
 * Dynamic Exam Generator Engine
 * senior frontend architecture, scalable dynamic UI systems, schema-driven quiz engine design
 */

const state = {
  files: [],
  currentData: null,
  config: {
    qTitleIdx: "none",
    qValueIdx: "none",
    aValueIdx: 0,
    exampleValueIndices: [],
    qOrder: "sequential",
    aOrder: "sequential",
    mode: "exam",
  },
  pool: [],
  currentIndex: 0,
  allPossibleAnswers: [],
};

// --- DOM Elements ---
const fileSelector = document.getElementById("file-selector");
const dynamicConfig = document.getElementById("dynamic-config");
const qTitleSelector = document.getElementById("q-title-selector");
const qValueSelector = document.getElementById("q-value-selector");
const aValueSelector = document.getElementById("a-value-selector");
const exampleValueSelectors = document.getElementById(
  "example-value-selectors",
);
const qOrderSelector = document.getElementById("q-order");
const aOrderSelector = document.getElementById("a-order");
const startBtn = document.getElementById("start-btn");
const configPanel = document.getElementById("config-panel");
const displayArea = document.getElementById("display-area");
const examContainer = document.getElementById("exam-container");
const studyContainer = document.getElementById("study-container");
const resetBtn = document.getElementById("reset-btn");
const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const modeBadge = document.getElementById("mode-badge");

const GROUPS = ["Nominativ", "Akkusativ", "Dativ", "Genitiv"];

// --- Translation Helpers ---

function makeGtrans(text) {
  var a = document.createElement("a");
  a.href = "https://translate.google.com/?sl=de&tl=fa&text=" + encodeURIComponent(text);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = "gtrans-link";
  a.title = "Translate";
  a.textContent = text;
  return a;
}

function gtransHTML(text) {
  var url = "https://translate.google.com/?sl=de&tl=fa&text=" + encodeURIComponent(text);
  var safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
 
  return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="gtrans-link" title="Translate">' + safe + '</a>';
}

// --- Initialization ---
async function init() {
  try {
    const response = await fetch("manifest.json");
    state.files = await response.json();

    fileSelector.innerHTML =
      '<option value="" disabled selected>Choose a JSON file...</option>';
    state.files.forEach((file) => {
      const option = document.createElement("option");
      option.value = file;
      option.textContent = file.replace(".json", "").toUpperCase();
      fileSelector.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading manifest:", error);
  }

  fileSelector.addEventListener("change", handleFileChange);
  startBtn.addEventListener("click", startEngine);
  resetBtn.addEventListener("click", resetApp);
}

async function handleFileChange(e) {
  const file = e.target.value;
  try {
    const response = await fetch(file);
    state.currentData = await response.json();
    inspectData();
    renderFilePreview();
    dynamicConfig.classList.remove("hidden");
  } catch (error) {
    console.error("Error loading JSON:", error);
    alert("Failed to load JSON file.");
  }
}

function inspectData() {
  // Determine max fields for titles/values by scanning all valid groups
  let sampleObj = null;
  for (const g of GROUPS) {
    if (state.currentData[g]) {
      sampleObj = state.currentData[g].find((obj) => !obj.sentences);
      if (sampleObj) break;
    }
  }

  if (sampleObj) {
    const fieldCount = Object.keys(sampleObj).length;
    updateIndexSelectors(fieldCount);
  }
}

function updateIndexSelectors(count) {
  const selectors = [qTitleSelector, qValueSelector, aValueSelector];
  selectors.forEach((sel) => {
    const currentVal = sel.value;
    sel.innerHTML = "";
    if (sel === qTitleSelector || sel === qValueSelector) {
      const noneOpt = document.createElement("option");
      noneOpt.value = "none";
      noneOpt.textContent = "None";
      sel.appendChild(noneOpt);
    }

    for (let i = 0; i < count; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent =
        (sel === qTitleSelector ? "title" : "value") + (i + 1);
      sel.appendChild(option);
    }

    if (currentVal !== null) sel.value = currentVal;
  });

  exampleValueSelectors.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const div = document.createElement("div");
    div.className = "checkbox-item";
    div.innerHTML = `
            <input type="checkbox" id="ex-val-${i}" value="${i}">
            <label for="ex-val-${i}">value${i + 1}</label>
        `;
    exampleValueSelectors.appendChild(div);
  }
}

function renderFilePreview() {
  const data = state.currentData;
  const preview = document.getElementById("file-preview");
  let firstGroup = null;
  let firstObj = null;

  for (const g of GROUPS) {
    if (data[g] && Array.isArray(data[g])) {
      firstGroup = g;
      firstObj = data[g].find(function (obj) { return !obj.sentences; });
      if (firstObj) break;
    }
  }

  if (!firstObj) {
    preview.classList.add("hidden");
    return;
  }

  var keys = Object.keys(firstObj);
  var values = Object.values(firstObj);

  preview.className = "file-preview";
  preview.classList.add("group-" + firstGroup.toLowerCase());
  preview.querySelector(".preview-header").textContent = firstGroup + " → Object Preview";

  var body = preview.querySelector(".preview-pairs");
  body.innerHTML = "";

  keys.forEach(function (key, i) {
    var pair = document.createElement("div");
    pair.className = "preview-pair";

    var titleLine = document.createElement("div");
    titleLine.className = "preview-line";

    var titleTag = document.createElement("span");
    titleTag.className = "preview-tag";
    titleTag.textContent = "title" + (i + 1);

    var titleSep = document.createElement("span");
    titleSep.className = "preview-sep";
    titleSep.textContent = ":";

    var titleData = document.createElement("span");
    titleData.className = "preview-data";
    titleData.textContent = key;

    titleLine.appendChild(titleTag);
    titleLine.appendChild(titleSep);
    titleLine.appendChild(titleData);

    var valLine = document.createElement("div");
    valLine.className = "preview-line";

    var valTag = document.createElement("span");
    valTag.className = "preview-tag";
    valTag.textContent = "value" + (i + 1);

    var valSep = document.createElement("span");
    valSep.className = "preview-sep";
    valSep.textContent = ":";

    var valData = document.createElement("span");
    valData.className = "preview-data preview-answer";
    valData.textContent = values[i];

    valLine.appendChild(valTag);
    valLine.appendChild(valSep);
    valLine.appendChild(valData);

    pair.appendChild(titleLine);
    pair.appendChild(valLine);
    body.appendChild(pair);
  });

  preview.classList.remove("hidden");
}

function startEngine() {
  state.config.qTitleIdx = qTitleSelector.value;
  state.config.qValueIdx = qValueSelector.value;
  state.config.aValueIdx = parseInt(aValueSelector.value);
  state.config.qOrder = qOrderSelector.value;
  state.config.aOrder = aOrderSelector.value;
  state.config.mode = document.querySelector(
    'input[name="app-mode"]:checked',
  ).value;

  state.config.exampleValueIndices = Array.from(
    exampleValueSelectors.querySelectorAll("input:checked"),
  ).map((cb) => parseInt(cb.value));

  preparePool();

  configPanel.classList.add("hidden");
  displayArea.classList.remove("hidden");

  if (state.config.mode === "exam") {
    examContainer.classList.remove("hidden");
    studyContainer.classList.add("hidden");
    examContainer.innerHTML = "";
    state.currentIndex = 0;

    progressContainer.classList.remove("hidden");
    progressBar.style.width = "0%";
    progressText.textContent = "0 / " + state.pool.length;
    modeBadge.textContent = "Exam";
    modeBadge.className = "mode-exam";

    renderNextQuestion();
  } else {
    examContainer.classList.add("hidden");
    studyContainer.classList.remove("hidden");

    progressContainer.classList.add("hidden");
    modeBadge.textContent = "Study";
    modeBadge.className = "mode-study";

    renderStudySheet();
  }
}

function preparePool() {
  state.pool = [];

  // Process ALL groups automatically
  GROUPS.forEach((groupName) => {
    const groupData = state.currentData[groupName];
    if (!groupData) return;

    const dataObjects = groupData.filter((obj) => !obj.sentences);

    const groupItems = dataObjects.map((obj) => {
      const keys = Object.keys(obj);
      const values = Object.values(obj);

      let questionText = "";
      if (state.config.qTitleIdx !== "none") {
        questionText += keys[parseInt(state.config.qTitleIdx)];
      }
      if (state.config.qValueIdx !== "none") {
        if (questionText) questionText += ": ";
        questionText += values[parseInt(state.config.qValueIdx)];
      }

      const answer = values[state.config.aValueIdx];
      const examples = state.config.exampleValueIndices
        .map((idx) => values[idx])
        .join(" ");

      return {
        type: "question", // Mark as question item
        group: groupName,
        questionText,
        answer,
        examples,
      };
    });

    state.pool.push(...groupItems);

    // Add sentence block if available for this group
    const sentenceBlock = groupData.find((obj) => obj.sentences);
    if (sentenceBlock && sentenceBlock.sentences) {
      state.pool.push({
        type: "sentences", // Mark as sentences item
        group: groupName,
        sentences: sentenceBlock.sentences,
      });
    }
  });

  state.allPossibleAnswers = [...new Set(state.pool.map((p) => p.answer))];
  if (state.config.aOrder === "random") {
    shuffle(state.allPossibleAnswers);
  } else {
    state.allPossibleAnswers.sort();
  }

  if (state.config.qOrder === "random") {
    shuffle(state.pool);
  }
}

function renderNextQuestion() {
  const pct = Math.round((state.currentIndex / state.pool.length) * 100);
  progressBar.style.width = pct + "%";
  progressText.textContent = state.currentIndex + " / " + state.pool.length;

  if (state.currentIndex >= state.pool.length) {
    progressBar.style.width = "100%";
    progressText.textContent = state.pool.length + " / " + state.pool.length;
    const completion = document.createElement("div");
    completion.className = "completion-screen";
    completion.innerHTML = "<h3>Exam Completed!</h3><p>All questions answered correctly.</p>";
    examContainer.appendChild(completion);
    return;
  }

  const item = state.pool[state.currentIndex];

  if (item.type === "sentences") {
      const sentencesBlock = document.createElement("div");
      sentencesBlock.className = "sentences-block";
      sentencesBlock.classList.add("group-" + item.group.toLowerCase());
      sentencesBlock.innerHTML =
      `<h3>${item.group} Sentences</h3><ul>` +
      item.sentences.map((s) => `<li>${gtransHTML(s.de)} : ${s.fa}</li>`).join("") +
      `</ul>`;
    examContainer.appendChild(sentencesBlock);
    sentencesBlock.scrollIntoView({ behavior: "smooth" });
    state.currentIndex++;
    renderNextQuestion();
    return;
  }

  const row = document.createElement("div");
  row.className = "question-row";
  row.id = `q-row-${state.currentIndex}`;
  row.classList.add("group-" + item.group.toLowerCase());

  if (
    state.currentIndex === 0 ||
    state.pool[state.currentIndex - 1].group !== item.group
  ) {
    const groupDivider = document.createElement("div");
    groupDivider.className = "group-section-header";
    groupDivider.classList.add("group-" + item.group.toLowerCase());
    const label = document.createElement("span");
    label.className = "group-section-label";
    label.appendChild(makeGtrans(item.group));
    groupDivider.appendChild(label);
    examContainer.appendChild(groupDivider);

    const groupBadge = document.createElement("span");
    groupBadge.className = "group-badge";
    groupBadge.classList.add("group-" + item.group.toLowerCase());
    groupBadge.textContent = item.group;
    row.appendChild(groupBadge);
  }

  const qText = document.createElement("span");
  qText.className = "question-text";
  qText.appendChild(makeGtrans((state.currentIndex + 1) + ". " + item.questionText));
  row.appendChild(qText);

  const select = document.createElement("select");
  select.className = "answer-select";
  select.innerHTML = '<option value="" disabled selected>?</option>';
  state.allPossibleAnswers.forEach((ans) => {
    const opt = document.createElement("option");
    opt.value = ans;
    opt.textContent = ans;
    select.appendChild(opt);
  });

  select.addEventListener("change", (e) => handleAnswer(e, item, row, select));
  row.appendChild(select);

  examContainer.appendChild(row);
  row.scrollIntoView({ behavior: "smooth" });
}

function handleAnswer(e, item, row, select) {
  const selectedValue = e.target.value;
  if (selectedValue === item.answer) {
    row.classList.add("is-solved");
    select.classList.add("hidden");

    const ansDisplay = document.createElement("span");
    ansDisplay.className = "correct-answer";
    ansDisplay.appendChild(makeGtrans(item.answer));
    row.appendChild(ansDisplay);

    if (item.examples) {
      const exDisplay = document.createElement("span");
      exDisplay.className = "inline-example";
      exDisplay.appendChild(makeGtrans("(" + item.examples + ")"));
      row.appendChild(exDisplay);
    }

    state.currentIndex++;
    renderNextQuestion();
  } else {
    alert("Try again!");
    select.value = "";
  }
}

function renderStudySheet() {
  studyContainer.innerHTML = `<h2 style='font-size: 16px;font-weight: bold;'>Study Sheet: ${gtransHTML(state.currentData.Kasus)} (All Groups)</h2>`;

  GROUPS.forEach((groupName) => {
    const groupItems = state.pool.filter((item) => item.group === groupName);
    if (groupItems.length === 0) return;

    const groupSection = document.createElement("div");
    groupSection.className = "study-group-section";
    groupSection.classList.add("group-" + groupName.toLowerCase());
    studyContainer.appendChild(groupSection);

    const groupTitle = document.createElement("h3");
    groupTitle.appendChild(makeGtrans(groupName));
    groupSection.appendChild(groupTitle);

    const table = document.createElement("table");
    table.className = "study-table";
    groupSection.appendChild(table);

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Question</th>
            <th>Answer</th>
            <th>Examples</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    groupItems.forEach((item) => {
      if (item.type === "question") {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                    <td>${gtransHTML(item.questionText)}</td>
                    <td><strong>${gtransHTML(item.answer)}</strong></td>
                    <td class="inline-example">${item.examples ? item.examples.split(" + ").map(function(p) {
                        return /[\u0600-\u06FF]/.test(p)
                            ? '<span class="s-fa">' + p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") + '</span>'
                            : '<span class="s-de">' + gtransHTML(p) + '</span>';
                    }).join(" ") : ""}</td>
                `;
        tbody.appendChild(tr);
      }
    });
    table.appendChild(tbody);

    // Find and render sentences for this group
    const sentenceItem = groupItems.find((item) => item.type === "sentences");
    if (sentenceItem) {
      const sentencesBlock = document.createElement("div");
      sentencesBlock.className = "sentences-block study-mode"; // Add a class for styling
      sentencesBlock.innerHTML =
        `<h4>Sentences for ${groupName}</h4><ul>` +
        sentenceItem.sentences.map((s) => `<li><span class="s-de">${gtransHTML(s.de)}</span><span class="s-fa">${s.fa}</span></li>`).join("") +
        `</ul>`;
      groupSection.appendChild(sentencesBlock);
    }
  });
}

function resetApp() {
  displayArea.classList.add("hidden");
  configPanel.classList.remove("hidden");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

init();
