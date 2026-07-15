let rows = [];
let headers = [];
let previouslySelected = [];
let selectedThisPull = [];

const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const nameColumn = document.getElementById("nameColumn");
const pullNumber = document.getElementById("pullNumber");
const excludeChoice = document.getElementById("excludeChoice");
const pullButton = document.getElementById("pullButton");
const resetButton = document.getElementById("resetButton");
const resetAllButton = document.getElementById("resetAllButton");
const selectedList = document.getElementById("selectedList");
const message = document.getElementById("message");
const loadedCount = document.getElementById("loadedCount");
const availableCount = document.getElementById("availableCount");
const previousCount = document.getElementById("previousCount");

fileInput.addEventListener("change", loadCSV);
pullButton.addEventListener("click", pullRandomNames);
resetButton.addEventListener("click", resetSelections);
resetAllButton.addEventListener("click", resetEverything);
nameColumn.addEventListener("change", updateCounts);
excludeChoice.addEventListener("change", updateCounts);

async function loadCSV(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

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

    renderSelectedNames();
    updateCounts();
    showMessage(`${rows.length} record(s) loaded.`, "success");
  } catch (error) {
    rows = [];
    headers = [];
    fileInput.value = "";
    fileName.textContent = "No file selected";
    nameColumn.innerHTML = '<option value="">Upload a file first</option>';
    nameColumn.disabled = true;
    pullButton.disabled = true;

    renderSelectedNames();
    updateCounts();
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

  if (!eligibleNames.length) {
    showMessage("There are no names available. Click Reset to start again.", "error");
    return;
  }

  if (amount > eligibleNames.length) {
    showMessage(
      `Only ${eligibleNames.length} name(s) are available for this pull.`,
      "error"
    );
    return;
  }

  const shuffled = shuffle([...eligibleNames]);
  selectedThisPull = shuffled.slice(0, amount);

  if (shouldExclude) {
    selectedThisPull.forEach(name => {
      if (!previouslySelected.includes(name)) {
        previouslySelected.push(name);
      }
    });
  }

  renderSelectedNames();
  updateCounts();

  const ending = shouldExclude
    ? " They will be excluded from the next pull."
    : " Repeats are allowed on the next pull.";

  showMessage(`${amount} name(s) selected.${ending}`, "success");
}

function getUniqueNames() {
  const columnIndex = Number(nameColumn.value);

  const names = rows
    .map(row => String(row[columnIndex] || "").trim())
    .filter(name => name !== "");

  return [...new Set(names)];
}

function shuffle(array) {
  for (let index = array.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [
      array[randomIndex],
      array[index]
    ];
  }

  return array;
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
    row.style.animationDelay = `${index * 50}ms`;

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

function updateCounts() {
  const names = rows.length ? getUniqueNames() : [];
  const shouldExclude = excludeChoice.value === "yes";

  const available = shouldExclude
    ? names.filter(name => !previouslySelected.includes(name)).length
    : names.length;

  loadedCount.textContent = String(names.length);
  availableCount.textContent = String(available);
  previousCount.textContent = String(previouslySelected.length);
}

function resetSelections() {
  previouslySelected = [];
  selectedThisPull = [];

  renderSelectedNames();
  updateCounts();
  showMessage("Selections were reset. All loaded names are available again.", "success");
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
    } else if (
      (character === "\n" || character === "\r") &&
      !insideQuotes
    ) {
      if (character === "\r" && nextCharacter === "\n") {
        index++;
      }

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
