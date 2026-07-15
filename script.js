let rows = [];
let headers = [];
let excludedNames = [];
let selectedThisPull = [];

const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const nameColumn = document.getElementById("nameColumn");
const pullNumber = document.getElementById("pullNumber");
const pullButton = document.getElementById("pullButton");
const resetButton = document.getElementById("resetButton");
const restoreAllButton = document.getElementById("restoreAllButton");
const selectedList = document.getElementById("selectedList");
const excludedList = document.getElementById("excludedList");
const message = document.getElementById("message");
const availableCount = document.getElementById("availableCount");
const excludedCount = document.getElementById("excludedCount");

fileInput.addEventListener("change", loadFile);
pullButton.addEventListener("click", pullNames);
resetButton.addEventListener("click", resetEverything);
restoreAllButton.addEventListener("click", restoreAll);

async function loadFile(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  fileName.textContent = file.name;

  const text = await file.text();
  const parsed = parseCSV(text);

  if (parsed.length < 2) {
    showMessage("The file must have a heading row and at least one name.", "error");
    return;
  }

  headers = parsed[0].map(value => value.trim());

  rows = parsed
    .slice(1)
    .filter(row => row.some(value => value.trim() !== ""));

  nameColumn.innerHTML = "";

  headers.forEach((header, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = header || `Column ${index + 1}`;
    nameColumn.appendChild(option);
  });

  const suggestedIndex = headers.findIndex(header =>
    header.toLowerCase().includes("name")
  );

  if (suggestedIndex >= 0) {
    nameColumn.value = suggestedIndex;
  }

  excludedNames = [];
  selectedThisPull = [];

  nameColumn.disabled = false;
  pullButton.disabled = false;
  restoreAllButton.disabled = true;

  renderLists();
  updateCounts();
  showMessage(`${rows.length} records loaded successfully.`, "success");
}

function pullNames() {
  const columnIndex = Number(nameColumn.value);
  const amount = Number(pullNumber.value);

  if (!Number.isInteger(amount) || amount < 1) {
    showMessage("Enter a valid number to pull.", "error");
    return;
  }

  const availableNames = rows
    .map(row => (row[columnIndex] || "").trim())
    .filter(name => name !== "")
    .filter(name => !excludedNames.includes(name));

  const uniqueAvailable = [...new Set(availableNames)];

  if (amount > uniqueAvailable.length) {
    showMessage(
      `Only ${uniqueAvailable.length} name(s) are still available.`,
      "error"
    );
    return;
  }

  shuffle(uniqueAvailable);
  selectedThisPull = uniqueAvailable.slice(0, amount);

  selectedThisPull.forEach(name => {
    if (!excludedNames.includes(name)) {
      excludedNames.push(name);
    }
  });

  renderLists();
  updateCounts();
  showMessage(`${amount} name(s) selected.`, "success");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function renderLists() {
  selectedList.innerHTML = "";

  if (selectedThisPull.length === 0) {
    selectedList.className = "name-list empty-list";
    selectedList.innerHTML = '<div class="empty-message">No names selected yet.</div>';
  } else {
    selectedList.className = "name-list";

    selectedThisPull.forEach((name, index) => {
      const item = document.createElement("div");
      item.className = "name-card selected";

      const number = document.createElement("span");
      number.className = "name-number";
      number.textContent = index + 1;

      const text = document.createElement("span");
      text.className = "name-text";
      text.textContent = name;

      item.appendChild(number);
      item.appendChild(text);
      selectedList.appendChild(item);
    });
  }

  excludedList.innerHTML = "";

  if (excludedNames.length === 0) {
    excludedList.className = "name-list empty-list";
    excludedList.innerHTML = '<div class="empty-message">No excluded names.</div>';
    restoreAllButton.disabled = true;
  } else {
    excludedList.className = "name-list";

    excludedNames.forEach(name => {
      const item = document.createElement("div");
      item.className = "name-card";

      const text = document.createElement("span");
      text.className = "name-text";
      text.textContent = name;

      const restoreButton = document.createElement("button");
      restoreButton.className = "restore-button";
      restoreButton.textContent = "Restore";
      restoreButton.addEventListener("click", () => restoreName(name));

      item.appendChild(text);
      item.appendChild(restoreButton);
      excludedList.appendChild(item);
    });

    restoreAllButton.disabled = false;
  }
}

function restoreName(name) {
  excludedNames = excludedNames.filter(item => item !== name);
  selectedThisPull = selectedThisPull.filter(item => item !== name);

  renderLists();
  updateCounts();
  showMessage(`${name} was restored.`, "success");
}

function restoreAll() {
  excludedNames = [];
  selectedThisPull = [];

  renderLists();
  updateCounts();
  showMessage("All names were restored.", "success");
}

function resetEverything() {
  rows = [];
  headers = [];
  excludedNames = [];
  selectedThisPull = [];

  fileInput.value = "";
  fileName.textContent = "No file selected";
  nameColumn.innerHTML = '<option value="">Upload a file first</option>';
  nameColumn.disabled = true;
  pullButton.disabled = true;
  restoreAllButton.disabled = true;
  pullNumber.value = 1;

  renderLists();
  updateCounts();
  showMessage("System reset.", "success");
}

function updateCounts() {
  const columnIndex = Number(nameColumn.value);

  const allNames = rows
    .map(row => (row[columnIndex] || "").trim())
    .filter(name => name !== "");

  const uniqueNames = [...new Set(allNames)];
  const available = uniqueNames.filter(name => !excludedNames.includes(name));

  availableCount.textContent = available.length;
  excludedCount.textContent = excludedNames.length;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    const nextCharacter = text[i + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        value += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        i++;
      }

      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function showMessage(text, type) {
  message.textContent = text;

  if (type === "error") {
    message.style.color = "#b42318";
  } else {
    message.style.color = "#16803c";
  }
}
