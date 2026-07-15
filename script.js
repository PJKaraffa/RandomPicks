let rows = [];
let headers = [];
let previouslySelected = [];
let selectedThisPull = [];
let isSetupCollapsed = false;

const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const nameColumn = document.getElementById("nameColumn");
const pullNumber = document.getElementById("pullNumber");
const excludeChoice = document.getElementById("excludeChoice");
const pullButton = document.getElementById("pullButton");
const resetButton = document.getElementById("resetButton");
const resetAllButton = document.getElementById("resetAllButton");
const newPullButton = document.getElementById("newPullButton");
const setupToggle = document.getElementById("setupToggle");
const setupCard = document.getElementById("setupCard");
const collapsedSummary = document.getElementById("collapsedSummary");
const toggleIcon = document.getElementById("toggleIcon");
const setupSubtitle = document.getElementById("setupSubtitle");
const selectedList = document.getElementById("selectedList");
const message = document.getElementById("message");
const loadedCount = document.getElementById("loadedCount");
const availableCount = document.getElementById("availableCount");
const previousCount = document.getElementById("previousCount");
const summaryFile = document.getElementById("summaryFile");
const summaryPulled = document.getElementById("summaryPulled");
const summaryExclude = document.getElementById("summaryExclude");
const summaryAvailable = document.getElementById("summaryAvailable");

fileInput.addEventListener("change", loadCSV);
pullButton.addEventListener("click", pullRandomNames);
resetButton.addEventListener("click", resetSelections);
resetAllButton.addEventListener("click", resetEverything);
newPullButton.addEventListener("click", startNewPull);
setupToggle.addEventListener("click", toggleSetup);
nameColumn.addEventListener("change", updateCounts);
excludeChoice.addEventListener("change", updateCounts);

async function loadCSV(event) {
  const file = event.target.files[0];

  if (!file) return;

  try {
    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.length < 2) {
      throw new Error("The CSV must contain headings and at least one data row.");
    }

    headers = parsed[0].map((value, index) => {
      const heading = String(value || "").trim();
      return heading || `Column ${index + 1}`;
    });

    rows = parsed
      .slice(1)
      .filter(row => row.some(value => String(value || "").trim() !== ""));

    if (!rows.length) {
      throw new Error("No usable names were found in the file.");
    }

    fillColumnDropdown();

    const suggestedColumn = headers.findIndex(header =>
      header.toLowerCase().includes("name")
    );

    if (suggestedColumn >= 0) {
      nameColumn.value = String(suggestedColumn);
    }

    fileName.textContent = file.name;
    nameColumn.disabled = false;
    pullButton.disabled = false;
    previouslySelected = [];
    selectedThisPull = [];

    expandSetup();
    renderSelectedNames();
    updateCounts();
    showMessage(`${rows.length} record(s) loaded.`, "success");
  } catch (error) {
    showMessage(error.message || "The file could not be loaded.", "error");
  }
}

function fillColumnDropdown() {
  nameColumn.innerHTML = "";

  headers.forEach((header, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = header;
    nameColumn.appendChild(option);
  });
}

function pullRandomNames() {
  if (!rows.length) {
    showMessage("Upload a CSV file first.", "error");
    return;
  }

  const amount = Number.parseInt(pullNumber.value, 10);

  if (!Number.isInteger(amount) || amount < 1) {
    showMessage("Enter a valid number to pull.", "error");
    return;
  }

  const allNames = getUniqueNames();
  const shouldExclude = excludeChoice.value === "yes";

  const eligibleNames = shouldExclude
    ? allNames.filter(name => !previouslySelected.includes(name))
    : allNames;

  if (amount > eligibleNames.length) {
    showMessage(`Only ${eligibleNames.length} name(s) are available.`, "error");
    return;
  }

  selectedThisPull = shuffle([...eligibleNames]).slice(0, amount);

  if (shouldExclude) {
    selectedThisPull.forEach(name => {
      if (!previouslySelected.includes(name)) {
        previouslySelected.push(name);
      }
    });
  }

  renderSelectedNames();
  updateCounts();
  showMessage(`${amount} name(s) selected.`, "success");

  collapseSetup();
  newPullButton.classList.remove("hidden");
}

function getUniqueNames() {
  const columnIndex = Number(nameColumn.value);

  return [...new Set(
    rows
      .map(row => String(row[columnIndex] || "").trim())
      .filter(name => name !== "")
  )];
}

function shuffle(array) {
  for (let index = array.length - 1; index > 0; index--) {
    const randomIndex = secureRandomIndex(index + 1);

    [array[index], array[randomIndex]] = [
      array[randomIndex],
      array[index]
    ];
  }

  return array;
}

function secureRandomIndex(max) {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error("Maximum value must be a positive integer.");
  }

  const randomValues = new Uint32Array(1);
  const largestValidValue =
    Math.floor(0x100000000 / max) * max;

  let randomValue;

  do {
    crypto.getRandomValues(randomValues);
    randomValue = randomValues[0];
  } while (randomValue >= largestValidValue);

  return randomValue % max;
}
}

function renderSelectedNames() {
  selectedList.innerHTML = "";

  if (!selectedThisPull.length) {
    selectedList.innerHTML =
      '<div class="empty-message">No names selected yet.</div>';
    return;
  }

  selectedThisPull.forEach((name, index) => {
    const row = document.createElement("div");
    row.className = "selected-name";

    const number = document.createElement("span");
    number.className = "selected-number";
    number.textContent = String(index + 1);

    const text = document.createElement("span");
    text.className = "selected-text";
    text.textContent = name;

    row.appendChild(number);
    row.appendChild(text);
    selectedList.appendChild(row);
  });
}

function collapseSetup() {
  isSetupCollapsed = true;
  setupCard.classList.add("collapsed");
  collapsedSummary.classList.remove("hidden");
  toggleIcon.textContent = "▶";
  setupToggle.setAttribute("aria-expanded", "false");
  setupSubtitle.textContent = "Click to expand setup.";
  updateSummary();
}

function expandSetup() {
  isSetupCollapsed = false;
  setupCard.classList.remove("collapsed");
  collapsedSummary.classList.add("hidden");
  toggleIcon.textContent = "▼";
  setupToggle.setAttribute("aria-expanded", "true");
  setupSubtitle.textContent = "Upload a CSV file and select the column containing the names.";
}

function toggleSetup() {
  if (isSetupCollapsed) {
    expandSetup();
  } else {
    collapseSetup();
  }
}

function startNewPull() {
  selectedThisPull = [];
  renderSelectedNames();
  expandSetup();
  newPullButton.classList.add("hidden");
  showMessage("Ready for the next pull.", "success");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateCounts() {
  const names = rows.length ? getUniqueNames() : [];
  const shouldExclude = excludeChoice.value === "yes";

  const available = shouldExclude
    ? names.filter(name => !previouslySelected.includes(name)).length
    : names.length;

  loadedCount.textContent = String(names.length);
  availableCount.textContent = String(available);
  previousCount.textContent = String(previouslySelected.length);

  updateSummary();
}

function updateSummary() {
  summaryFile.textContent = fileName.textContent;
  summaryPulled.textContent = String(selectedThisPull.length);
  summaryExclude.textContent = excludeChoice.value === "yes" ? "Yes" : "No";
  summaryAvailable.textContent = availableCount.textContent;
}

function resetSelections() {
  previouslySelected = [];
  selectedThisPull = [];
  renderSelectedNames();
  updateCounts();
  expandSetup();
  newPullButton.classList.add("hidden");
  showMessage("Selections were reset.", "success");
}

function resetEverything() {
  rows = [];
  headers = [];
  previouslySelected = [];
  selectedThisPull = [];

  fileInput.value = "";
  fileName.textContent = "No file selected";
  nameColumn.innerHTML = '<option value="">Upload a file first</option>';
  nameColumn.disabled = true;
  pullNumber.value = "1";
  excludeChoice.value = "yes";
  pullButton.disabled = true;

  renderSelectedNames();
  updateCounts();
  expandSetup();
  newPullButton.classList.add("hidden");
  showMessage("The system was completely reset.", "success");
}

function parseCSV(text) {
  const output = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < cleanText.length; index++) {
    const character = cleanText[index];
    const nextCharacter = cleanText[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        value += '"';
        index++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") index++;
      row.push(value);
      output.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value !== "" || row.length > 0) {
    row.push(value);
    output.push(row);
  }

  return output;
}

function showMessage(text, type) {
  message.textContent = text;
  message.style.color = type === "error" ? "#bd2c2c" : "#159447";
}
